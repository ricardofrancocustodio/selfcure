import { chromium }  from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFile }  from 'node:fs/promises';
import path          from 'node:path';
import type { AccessibilityFinding, A11ySeverity, WcagLevel } from '@selfcure/analyzer';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface DynamicScanRoute {
  /** Relative route path, e.g. "/" or "/checkout/summary" */
  path: string;
  /** Optional: Playwright storage-state JSON path for pre-authenticated sessions */
  storageState?: string;
  /** Wait condition after navigation — default: 'networkidle' */
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
}

export interface DynamicScanOptions {
  /** Base URL of the running app, e.g. "http://localhost:3000" */
  baseURL: string;
  /** Routes to scan — defaults to [{path: '/'}] */
  routes?: DynamicScanRoute[] | string[];
  /** WCAG level to check — default 'AA' */
  level?: WcagLevel;
  /** Page navigation timeout ms — default 30000 */
  timeout?: number;
  /** Run browser without UI — default true */
  headless?: boolean;
  /**
   * URL or local path to axe-core script.
   * Defaults to the axe-core CDN. For offline use, point to
   * node_modules/axe-core/axe.min.js or a local copy.
   */
  axeSource?: string;
}

export interface DynamicScanResult {
  findings:      AccessibilityFinding[];
  scannedRoutes: number;
  errors:        Array<{ route: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_AXE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';

const WCAG_TAGS: Record<WcagLevel, string[]> = {
  A:   ['wcag2a'],
  AA:  ['wcag2a', 'wcag2aa'],
  AAA: ['wcag2a', 'wcag2aa', 'wcag2aaa'],
};

const IMPACT_SEVERITY: Record<string, A11ySeverity> = {
  critical: 'critical',
  serious:  'major',
  moderate: 'minor',
  minor:    'info',
};

// ---------------------------------------------------------------------------
// axe result types (subset of the full axe results schema)
// ---------------------------------------------------------------------------

interface AxeNodeResult {
  html:           string;
  target:         string[];
  failureSummary: string;
}

interface AxeViolation {
  id:          string;
  impact:      string | null;
  description: string;
  help:        string;
  helpUrl:     string;
  tags:        string[];
  nodes:       AxeNodeResult[];
}

interface AxeResults {
  violations: AxeViolation[];
  url:        string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _seq = 0;
function makeFindingId(): string {
  _seq++;
  return `a11y_dyn_${Date.now().toString(36)}${_seq.toString(36).padStart(3, '0')}`;
}

/** Extract WCAG criterion numbers like "4.1.2" from axe tags like "wcag412". */
export function wcagRefsFromTags(tags: string[]): string[] {
  const refs: string[] = [];
  for (const tag of tags) {
    if (!/^wcag\d+$/.test(tag)) continue;
    const d = tag.slice(4);
    if (d.length === 3) refs.push(`${d[0]}.${d[1]}.${d[2]}`);
    else if (d.length === 2) refs.push(`${d[0]}.${d[1]}`);
    else refs.push(d);
  }
  return refs;
}

/** Map axe impact string to our A11ySeverity. */
export function impactToSeverity(impact: string | null): A11ySeverity {
  return IMPACT_SEVERITY[impact ?? ''] ?? 'minor';
}

/** Derive the highest applicable WCAG level from axe tags. */
export function levelFromTags(tags: string[]): WcagLevel {
  if (tags.includes('wcag2aaa')) return 'AAA';
  if (tags.includes('wcag2aa'))  return 'AA';
  return 'A';
}

async function injectAxe(page: Page, source: string): Promise<void> {
  if (/^https?:\/\//.test(source)) {
    await page.addScriptTag({ url: source });
  } else {
    const abs     = path.resolve(source);
    const content = await readFile(abs, 'utf-8');
    await page.addScriptTag({ content });
  }
}

function mapViolations(
  violations: AxeViolation[],
  pageUrl:    string,
  now:        string,
): AccessibilityFinding[] {
  const findings: AccessibilityFinding[] = [];

  for (const v of violations) {
    const severity = impactToSeverity(v.impact);
    const level    = levelFromTags(v.tags);
    const wcag     = wcagRefsFromTags(v.tags);
    const ruleId   = `a11y-dynamic.${v.id}`;

    for (let nodeIdx = 0; nodeIdx < v.nodes.length; nodeIdx++) {
      const node     = v.nodes[nodeIdx]!;
      const selector = node.target.join(', ');

      findings.push({
        id:          makeFindingId(),
        ruleId,
        wcag,
        level,
        severity,
        status:      'open',
        sourceFile:  pageUrl,
        line:        0,
        column:      nodeIdx, // used as finding-key differentiator per node
        selector,
        message:     v.help,
        remediation: node.failureSummary || v.description,
        firstSeenAt: now,
        lastSeenAt:  now,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Per-page scan
// ---------------------------------------------------------------------------

async function scanPage(
  page:    Page,
  url:     string,
  level:   WcagLevel,
  source:  string,
  timeout: number,
  waitUntil: 'load' | 'domcontentloaded' | 'networkidle',
): Promise<AccessibilityFinding[]> {
  await page.goto(url, { timeout, waitUntil });
  await injectAxe(page, source);

  // The callback runs inside the browser — use globalThis to avoid TS DOM-lib requirement
  const results = await page.evaluate((tags: string[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any;
    return g.axe.run(g.document, { runOnly: { type: 'tag', values: tags } }) as Promise<unknown>;
  }, WCAG_TAGS[level]) as AxeResults;

  const now = new Date().toISOString();
  return mapViolations(results.violations, url, now);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Launch a Playwright browser, navigate to each configured route, inject
 * axe-core, run WCAG checks, and return findings mapped to AccessibilityFinding[].
 *
 * Requires Playwright browsers to be installed (`npx playwright install`).
 * Requires the target app to be running and accessible at baseURL.
 */
export async function runDynamicScan(opts: DynamicScanOptions): Promise<DynamicScanResult> {
  const {
    baseURL,
    level      = 'AA',
    timeout    = 30_000,
    headless   = true,
    axeSource  = DEFAULT_AXE_CDN,
  } = opts;

  // Normalise routes to DynamicScanRoute[]
  const rawRoutes = opts.routes ?? ['/'];
  const routes: DynamicScanRoute[] = rawRoutes.map((r) =>
    typeof r === 'string' ? { path: r } : r,
  );

  const allFindings: AccessibilityFinding[] = [];
  const errors: DynamicScanResult['errors']   = [];

  const browser = await chromium.launch({ headless });
  try {
    for (const route of routes) {
      const url = new URL(route.path, baseURL).toString();
      const ctx = await browser.newContext(
        route.storageState ? { storageState: route.storageState } : {},
      );
      const page = await ctx.newPage();
      try {
        const findings = await scanPage(
          page,
          url,
          level,
          axeSource,
          timeout,
          route.waitUntil ?? 'networkidle',
        );
        allFindings.push(...findings);
      } catch (err: unknown) {
        errors.push({
          route: url,
          error: err instanceof Error ? err.message : String(err),
        });
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }

  return { findings: allFindings, scannedRoutes: routes.length, errors };
}
