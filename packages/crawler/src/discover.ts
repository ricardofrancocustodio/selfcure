import { readFile, stat }  from 'node:fs/promises';
import path                 from 'node:path';
import { glob }             from 'glob';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DetectedFramework = 'react' | 'vue' | 'angular' | 'next' | 'nuxt' | 'svelte' | 'unknown';
export type PackageManager    = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';

export interface RouteCandidate {
  /** URL path e.g. "/checkout/summary" */
  path: string;
  /** Absolute source file path */
  filePath: string;
  /** True when the path contains dynamic segments like ":id" or "*" */
  isDynamic: boolean;
  /** 0–1 confidence that this is a real navigable route */
  confidence: number;
  /** How this candidate was inferred */
  source: 'pages-dir' | 'app-dir' | 'views-dir' | 'router-config' | 'convention';
}

export interface ComponentCandidate {
  filePath: string;
  name: string;
  /** Which route this component belongs to, when deterministically inferrable */
  route?: string;
}

export interface ProjectMap {
  projectRoot: string;
  framework:      DetectedFramework;
  packageManager: PackageManager;
  devCommand?:    string;
  buildCommand?:  string;
  testCommand?:   string;
  routeCandidates:     RouteCandidate[];
  componentCandidates: ComponentCandidate[];
  generatedAt: string;
}

export interface DiscoverProjectOptions {
  projectRoot: string;
  ignore?: string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const DEFAULT_IGNORE = ['**/node_modules/**', '**/dist/**', '**/.git/**', '**/coverage/**', '**/.next/**', '**/.nuxt/**'];

/** Derive a clean URL path from an absolute file path relative to a base dir. */
function fileToUrlPath(absFile: string, baseDir: string): { urlPath: string; isDynamic: boolean } {
  const rel      = path.relative(baseDir, absFile);
  const noExt    = rel.replace(/\.(tsx?|jsx?|vue|svelte)$/, '');
  const segments = noExt.split(path.sep);

  // Remove trailing "index"
  if (segments[segments.length - 1] === 'index') segments.pop();

  const rawPath = segments.length > 0 ? '/' + segments.join('/') : '/';

  // Next.js [param] / [...rest] → :param / *
  const urlPath = rawPath
    .replace(/\/\[\.\.\.(\w+)\]/g, '/*')
    .replace(/\/\[(\w+)\]/g, '/:$1');

  const isDynamic = urlPath.includes(':') || urlPath.includes('*');
  return { urlPath, isDynamic };
}

// ---------------------------------------------------------------------------
// Framework detection
// ---------------------------------------------------------------------------

async function readPackageJson(root: string): Promise<Record<string, unknown>> {
  try {
    const raw = await readFile(path.join(root, 'package.json'), 'utf-8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function allDeps(pkg: Record<string, unknown>): Record<string, string> {
  return {
    ...(pkg['dependencies']    as Record<string, string> | undefined ?? {}),
    ...(pkg['devDependencies'] as Record<string, string> | undefined ?? {}),
  };
}

export async function detectFramework(root: string): Promise<DetectedFramework> {
  const pkg  = await readPackageJson(root);
  const deps = allDeps(pkg);

  if (deps['next'])           return 'next';
  if (deps['nuxt'])           return 'nuxt';
  if (deps['@angular/core'])  return 'angular';
  if (deps['svelte'])         return 'svelte';
  if (deps['vue'])            return 'vue';
  if (deps['react'])          return 'react';
  return 'unknown';
}

export async function detectPackageManager(root: string): Promise<PackageManager> {
  const checks: Array<[string, PackageManager]> = [
    ['bun.lockb',       'bun'],
    ['pnpm-lock.yaml',  'pnpm'],
    ['yarn.lock',       'yarn'],
    ['package-lock.json', 'npm'],
  ];
  for (const [lockfile, pm] of checks) {
    try { await stat(path.join(root, lockfile)); return pm; } catch { /* next */ }
  }
  return 'unknown';
}

async function detectScripts(root: string): Promise<Pick<ProjectMap, 'devCommand' | 'buildCommand' | 'testCommand'>> {
  const pkg     = await readPackageJson(root);
  const scripts = (pkg['scripts'] as Record<string, string> | undefined) ?? {};

  const dev   = ['dev', 'start', 'serve', 'develop'].find((s) => scripts[s]);
  const build = ['build', 'compile'].find((s) => scripts[s]);
  const test  = ['test', 'test:unit', 'test:e2e', 'test:run'].find((s) => scripts[s]);

  const pm = await detectPackageManager(root);
  const runner = pm === 'unknown' ? 'npm' : pm === 'bun' ? 'bun' : pm;

  return {
    devCommand:   dev   ? `${runner} run ${dev}`   : undefined,
    buildCommand: build ? `${runner} run ${build}` : undefined,
    testCommand:  test  ? `${runner} run ${test}`  : undefined,
  };
}

// ---------------------------------------------------------------------------
// Route discovery per framework
// ---------------------------------------------------------------------------

async function discoverNextRoutes(root: string, ignore: string[]): Promise<RouteCandidate[]> {
  const candidates: RouteCandidate[] = [];

  // Pages router: pages/**/*.{tsx,jsx,ts,js}
  const pagesDir = path.join(root, 'pages');
  const pageFiles = await glob('**/*.{tsx,jsx,ts,js}', {
    cwd: pagesDir, ignore, absolute: true,
  }).catch(() => [] as string[]);

  for (const file of pageFiles) {
    const base = path.basename(file);
    // Skip Next.js special files
    if (/^_/.test(base)) continue;
    // Skip API routes
    if (file.includes(`${path.sep}api${path.sep}`) || file.includes('/api/')) continue;

    const { urlPath, isDynamic } = fileToUrlPath(file, pagesDir);
    candidates.push({ path: urlPath, filePath: file, isDynamic, confidence: 0.95, source: 'pages-dir' });
  }

  // App router: app/**/page.{tsx,jsx}
  const appDir = path.join(root, 'app');
  const appFiles = await glob('**/page.{tsx,jsx,ts,js}', {
    cwd: appDir, ignore, absolute: true,
  }).catch(() => [] as string[]);

  for (const file of appFiles) {
    const dir = path.dirname(file);
    const { urlPath, isDynamic } = fileToUrlPath(dir, appDir);
    const cleaned = urlPath === '/page' ? '/' : urlPath;
    candidates.push({ path: cleaned || '/', filePath: file, isDynamic, confidence: 0.95, source: 'app-dir' });
  }

  return candidates;
}

async function discoverNuxtRoutes(root: string, ignore: string[]): Promise<RouteCandidate[]> {
  const pagesDir = path.join(root, 'pages');
  const files = await glob('**/*.vue', { cwd: pagesDir, ignore, absolute: true }).catch(() => [] as string[]);
  return files.map((file) => {
    const { urlPath, isDynamic } = fileToUrlPath(file, pagesDir);
    return { path: urlPath, filePath: file, isDynamic, confidence: 0.9, source: 'pages-dir' as const };
  });
}

async function discoverVueRoutes(root: string, ignore: string[]): Promise<RouteCandidate[]> {
  const candidates: RouteCandidate[] = [];

  // File-based: src/views/ or src/pages/
  for (const dir of ['views', 'pages']) {
    const base  = path.join(root, 'src', dir);
    const files = await glob('**/*.vue', { cwd: base, ignore, absolute: true }).catch(() => [] as string[]);
    for (const file of files) {
      const { urlPath, isDynamic } = fileToUrlPath(file, base);
      candidates.push({ path: urlPath, filePath: file, isDynamic, confidence: 0.8, source: 'views-dir' });
    }
  }

  return candidates;
}

async function discoverReactRoutes(root: string, ignore: string[]): Promise<RouteCandidate[]> {
  const candidates: RouteCandidate[] = [];

  // Convention: src/pages/ or src/routes/
  for (const dir of ['pages', 'routes']) {
    const base  = path.join(root, 'src', dir);
    const files = await glob('**/*.{tsx,jsx}', { cwd: base, ignore, absolute: true }).catch(() => [] as string[]);
    for (const file of files) {
      const { urlPath, isDynamic } = fileToUrlPath(file, base);
      candidates.push({ path: urlPath, filePath: file, isDynamic, confidence: 0.75, source: 'pages-dir' });
    }
  }

  // Fallback: scan for React Router <Route path="..."> patterns in source
  if (candidates.length === 0) {
    const srcDir = path.join(root, 'src');
    const sourceFiles = await glob('**/*.{tsx,jsx,ts,js}', {
      cwd: srcDir, ignore, absolute: true,
    }).catch(() => [] as string[]);

    const ROUTE_RE = /path=["']([^"']+)["']/g;
    for (const file of sourceFiles) {
      const content = await readFile(file, 'utf-8').catch(() => '');
      let m: RegExpExecArray | null;
      ROUTE_RE.lastIndex = 0;
      while ((m = ROUTE_RE.exec(content)) !== null) {
        const p = m[1]!;
        if (p.startsWith('/') || p === '*') {
          candidates.push({
            path:       p,
            filePath:   file,
            isDynamic:  p.includes(':') || p.includes('*'),
            confidence: 0.65,
            source:     'router-config',
          });
        }
      }
    }
  }

  return candidates;
}

async function discoverAngularRoutes(root: string, ignore: string[]): Promise<RouteCandidate[]> {
  const candidates: RouteCandidate[] = [];
  const srcDir = path.join(root, 'src');
  const routingFiles = await glob('**/*routing*.ts', {
    cwd: srcDir, ignore, absolute: true,
  }).catch(() => [] as string[]);

  const PATH_RE = /path:\s*["']([^"']+)["']/g;
  for (const file of routingFiles) {
    const content = await readFile(file, 'utf-8').catch(() => '');
    PATH_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PATH_RE.exec(content)) !== null) {
      const p = '/' + m[1]!;
      candidates.push({
        path:       p,
        filePath:   file,
        isDynamic:  p.includes(':') || p === '/**',
        confidence: 0.8,
        source:     'router-config',
      });
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------------
// Component candidates
// ---------------------------------------------------------------------------

async function discoverComponents(root: string, ignore: string[]): Promise<ComponentCandidate[]> {
  const srcDir = path.join(root, 'src');
  const extensions = '{tsx,jsx,vue,svelte}';
  const files = await glob(`**/*.${extensions}`, {
    cwd: srcDir, ignore, absolute: true,
  }).catch(() => [] as string[]);

  return files.map((file) => ({
    filePath: file,
    name: path.basename(file).replace(/\.(tsx?|jsx?|vue|svelte)$/, ''),
  }));
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

function dedupeRoutes(routes: RouteCandidate[]): RouteCandidate[] {
  const seen = new Map<string, RouteCandidate>();
  for (const r of routes) {
    const existing = seen.get(r.path);
    if (!existing || r.confidence > existing.confidence) {
      seen.set(r.path, r);
    }
  }
  return [...seen.values()].sort((a, b) => a.path.localeCompare(b.path));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Perform static project discovery: detect framework, package manager, dev
 * scripts, and enumerate route and component candidates without running the app.
 */
export async function discoverProject(options: DiscoverProjectOptions): Promise<ProjectMap> {
  const { projectRoot, ignore = DEFAULT_IGNORE } = options;

  const [framework, packageManager, scripts] = await Promise.all([
    detectFramework(projectRoot),
    detectPackageManager(projectRoot),
    detectScripts(projectRoot),
  ]);

  let routeCandidates: RouteCandidate[] = [];

  switch (framework) {
    case 'next':    routeCandidates = await discoverNextRoutes(projectRoot, ignore);    break;
    case 'nuxt':    routeCandidates = await discoverNuxtRoutes(projectRoot, ignore);    break;
    case 'vue':     routeCandidates = await discoverVueRoutes(projectRoot, ignore);     break;
    case 'angular': routeCandidates = await discoverAngularRoutes(projectRoot, ignore); break;
    case 'react':
    default:        routeCandidates = await discoverReactRoutes(projectRoot, ignore);   break;
  }

  // Always include "/" if not already present
  if (!routeCandidates.some((r) => r.path === '/')) {
    routeCandidates.unshift({ path: '/', filePath: projectRoot, isDynamic: false, confidence: 0.5, source: 'convention' });
  }

  const componentCandidates = await discoverComponents(projectRoot, ignore);

  return {
    projectRoot,
    framework,
    packageManager,
    ...scripts,
    routeCandidates: dedupeRoutes(routeCandidates),
    componentCandidates,
    generatedAt: new Date().toISOString(),
  };
}
