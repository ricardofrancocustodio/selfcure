import { chromium }  from '@playwright/test';
import type { Page } from '@playwright/test';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RuntimeElement {
  tag:       string;
  role?:     string;
  /** Accessible name — aria-label or visible text */
  name?:     string;
  /** Best selector available */
  selector:  string;
  testId?:   string;
  /** Testability score 0–100 */
  score:     number;
}

export interface RuntimeRouteEvidence {
  url:                    string;
  route:                  string;
  status:                 'reachable' | 'error' | 'timeout' | 'auth-required';
  title?:                 string;
  domSnapshotPath?:       string;
  accessibilityTreePath?: string;
  screenshotPath?:        string;
  interactiveElements:    RuntimeElement[];
  consoleErrors:          string[];
  loadTimeMs:             number;
}

export interface RuntimeDiscoveryOptions {
  baseURL:       string;
  routes:        string[];
  outDir:        string;
  timeout?:      number;
  headless?:     boolean;
  storageState?: string;
  screenshots?:  boolean;
}

export interface RuntimeDiscoveryResult {
  routes:        RuntimeRouteEvidence[];
  scannedRoutes: number;
  reachable:     number;
  errored:       number;
}

// ---------------------------------------------------------------------------
// Element extraction & scoring (pure helpers — testable without browser)
// ---------------------------------------------------------------------------

/** Compute a testability score for a single element from its attributes. */
export function scoreElement(opts: {
  testId?: string;
  id?:     string;
  name?:   string;
  type?:   string;
  tag:     string;
}): number {
  if (opts.testId) return 100;
  if (opts.id)     return 85;
  if (opts.name)   return 75;
  if (opts.type)   return 50;
  // bare tag only
  return opts.tag === 'button' || opts.tag === 'a' ? 30 : 20;
}

/** Build the best CSS selector for an element from its attributes. */
export function buildRuntimeSelector(opts: {
  testId?: string;
  id?:     string;
  name?:   string;
  tag:     string;
}): string {
  if (opts.testId) return `[data-testid="${opts.testId}"]`;
  if (opts.id)     return `#${opts.id}`;
  if (opts.name)   return `[aria-label="${opts.name}"]`;
  return opts.tag;
}

// ---------------------------------------------------------------------------
// In-browser DOM scan (runs via page.evaluate — must use globalThis)
// ---------------------------------------------------------------------------

const DOM_SCAN_SELECTORS = [
  'button', 'input:not([type=hidden])', 'select', 'textarea',
  'a[href]', '[role=button]', '[role=link]', '[role=textbox]',
  '[role=checkbox]', '[role=radio]', '[role=combobox]',
];

type RawElement = {
  tag:      string;
  role?:    string;
  testId?:  string;
  id?:      string;
  name?:    string;
  type?:    string;
};

async function extractElements(page: Page): Promise<RuntimeElement[]> {
  const raw = await page.evaluate((selectors: string[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g    = globalThis as any;
    const doc  = g.document;
    const seen = new Set();
    const out: RawElement[] = [];

    for (const sel of selectors) {
      for (const el of doc.querySelectorAll(sel)) {
        if (seen.has(el)) continue;
        seen.add(el);

        const tag     = el.tagName.toLowerCase();
        const testId  = el.getAttribute('data-testid') || undefined;
        const id      = el.id || undefined;
        const aLabel  = el.getAttribute('aria-label') || undefined;
        const text    = el.textContent?.trim().slice(0, 60) || undefined;
        const type    = el.getAttribute('type') || undefined;
        const role    = el.getAttribute('role') || undefined;

        out.push({ tag, role, testId, id, name: aLabel || text, type });
      }
    }
    return out;
  }, DOM_SCAN_SELECTORS) as RawElement[];

  return raw.map((r) => {
    const score    = scoreElement(r);
    const selector = buildRuntimeSelector(r);
    const el: RuntimeElement = { tag: r.tag, selector, score };
    if (r.role)   el.role   = r.role;
    if (r.name)   el.name   = r.name;
    if (r.testId) el.testId = r.testId;
    return el;
  });
}

// ---------------------------------------------------------------------------
// Per-route rendering
// ---------------------------------------------------------------------------

function safeName(route: string): string {
  return (route.replace(/^\//, '').replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').slice(0, 48) || 'root');
}

async function renderRoute(
  page:        Page,
  url:         string,
  route:       string,
  outDir:      string,
  timeout:     number,
  screenshots: boolean,
): Promise<RuntimeRouteEvidence> {
  const consoleErrors: string[] = [];
  const onConsole = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  page.on('console', onConsole);

  const t0 = Date.now();
  let status: RuntimeRouteEvidence['status'] = 'reachable';
  let title: string | undefined;

  try {
    const response = await page.goto(url, { timeout, waitUntil: 'networkidle' });
    const httpStatus = response?.status() ?? 200;
    if (httpStatus === 401 || httpStatus === 403) status = 'auth-required';
    title = await page.title().catch(() => undefined);
  } catch (err: unknown) {
    status = String(err).toLowerCase().includes('timeout') ? 'timeout' : 'error';
  }

  const loadTimeMs = Date.now() - t0;

  let domSnapshotPath: string | undefined;
  let accessibilityTreePath: string | undefined;
  let screenshotPath: string | undefined;
  let interactiveElements: RuntimeElement[] = [];

  if (status === 'reachable') {
    const base = safeName(route);

    // DOM snapshot
    const domDir = path.join(outDir, 'dom-snapshots');
    await mkdir(domDir, { recursive: true });
    const domFile = path.join(domDir, `${base}.html`);
    await writeFile(domFile, await page.content(), 'utf-8');
    domSnapshotPath = domFile;

    // Accessibility tree snapshot (ARIA markup format, Playwright >= 1.41)
    const a11ySnapshot = await page.locator('body').ariaSnapshot().catch(() => null);
    if (a11ySnapshot) {
      const treeDir  = path.join(outDir, 'accessibility-trees');
      await mkdir(treeDir, { recursive: true });
      const treeFile = path.join(treeDir, `${base}.aria.txt`);
      await writeFile(treeFile, a11ySnapshot, 'utf-8');
      accessibilityTreePath = treeFile;
    }

    // Screenshot
    if (screenshots) {
      const ssDir = path.join(outDir, 'screenshots');
      await mkdir(ssDir, { recursive: true });
      const ssFile = path.join(ssDir, `${base}.png`);
      await page.screenshot({ path: ssFile, fullPage: true }).catch(() => {});
      screenshotPath = ssFile;
    }

    // Interactive elements
    interactiveElements = await extractElements(page).catch(() => []);
  }

  page.off('console', onConsole);

  return {
    url, route, status, title,
    domSnapshotPath, accessibilityTreePath, screenshotPath,
    interactiveElements, consoleErrors, loadTimeMs,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Launch Playwright, visit each route, and capture runtime evidence.
 * Requires the app to be running at `baseURL`.
 */
export async function runRuntimeDiscovery(opts: RuntimeDiscoveryOptions): Promise<RuntimeDiscoveryResult> {
  const {
    baseURL,
    routes,
    outDir,
    timeout     = 30_000,
    headless    = true,
    storageState,
    screenshots = false,
  } = opts;

  const browser = await chromium.launch({ headless });
  const results: RuntimeRouteEvidence[] = [];

  try {
    for (const route of routes) {
      const url = new URL(route, baseURL).toString();
      const ctx = await browser.newContext(storageState ? { storageState } : {});
      const pg  = await ctx.newPage();
      try {
        const evidence = await renderRoute(pg, url, route, outDir, timeout, screenshots);
        results.push(evidence);
      } catch (err: unknown) {
        results.push({
          url, route, status: 'error', interactiveElements: [],
          consoleErrors: [String(err)], loadTimeMs: 0,
        });
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }

  return {
    routes:        results,
    scannedRoutes: routes.length,
    reachable:     results.filter((r) => r.status === 'reachable').length,
    errored:       results.filter((r) => r.status !== 'reachable').length,
  };
}
