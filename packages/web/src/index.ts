import http from 'node:http';
import fs from 'node:fs';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyze, type InteractiveElement } from '@selfcure/analyzer';
import { crawl } from '@selfcure/crawler';
import { PROVIDERS, type ProviderId } from '@selfcure/generator';
import { generateConfig, type InitOptions } from './generator.js';
import { crawlPageHtml } from './crawlPage.js';
import { initPageHtml } from './initPage.js';
import { lintPageHtml } from './lintPage.js';

// Directories that should never appear in the source-folder picker
const IGNORED_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage',
  '.git', '.cache', '.next', '.nuxt', '.svelte-kit',
  'selfcure-tests', 'selfcure-report', '.selfcure',
]);

function listSourceDirs(cwd: string): string[] {
  try {
    return fs.readdirSync(cwd, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORED_DIRS.has(e.name))
      .map((e) => './' + e.name)
      .sort();
  } catch {
    return [];
  }
}

interface ProviderListEntry {
  id: ProviderId;
  label: string;
  envVar: string | null;
  envSet: boolean;
  defaultGenerationModel: string;
  defaultHealingModel: string;
  defaultBaseURL?: string;
  hint: string;
  apiKeyPlaceholder: string;
}

interface WebCrawlConfig {
  rootDir: string;
  include: string[];
  exclude: string[];
  framework?: 'react' | 'vue' | 'angular' | 'auto';
}

interface CrawlRequestBody {
  configPath?: string;
}

async function readJsonBody(req: http.IncomingMessage, limit = 64_000): Promise<unknown> {
  let body = '';

  return new Promise((resolve, reject) => {
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > limit) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });

    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });

    req.on('error', reject);
  });
}

function resolveConfigPath(cwd: string, provided?: string): string {
  if (provided) return path.resolve(cwd, provided);

  const mjs = path.resolve(cwd, 'selfcure.config.mjs');
  if (fs.existsSync(mjs)) return mjs;

  return path.resolve(cwd, 'selfcure.config.js');
}

async function loadCrawlConfig(cwd: string, configPath?: string): Promise<WebCrawlConfig> {
  const resolved = resolveConfigPath(cwd, configPath);
  const { default: config } = await import(`${pathToFileURL(resolved).href}?t=${Date.now()}`);
  return config as WebCrawlConfig;
}

async function runCrawlAnalysis(cwd: string, body: CrawlRequestBody) {
  const config = await loadCrawlConfig(cwd, body.configPath);
  const rootDir = path.resolve(cwd, config.rootDir);
  const components = await crawl({
    rootDir,
    include: config.include,
    exclude: config.exclude,
    framework: config.framework,
  });

  const analysis = await analyze(components);

  return {
    rootDir,
    count: analysis.length,
    components: analysis.map((item) => ({
      filePath: item.component.filePath,
      componentName: item.component.componentName,
      framework: item.component.framework,
      props: item.component.props,
      score: item.score,
      complexity: item.complexity,
      interactiveElements: item.interactiveElements,
    })),
  };
}

// ---------------------------------------------------------------------------
// Lint helpers (mirrors packages/cli/src/lint.ts — no circular dep)
// ---------------------------------------------------------------------------

interface LintRequestBody {
  configPath?: string;
  threshold?: number;
  fix?: boolean;
  pr?: boolean;
}

interface LintIssue {
  filePath:        string;
  componentName:   string;
  element:         InteractiveElement;
  suggestedTestId: string;
  fixApplied?:     boolean;
}

function toKebab(s: string): string {
  return s.trim()
    .replace(/([A-Z])/g, '-$1')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function suggestTestId(el: InteractiveElement, index: number): string {
  if (el.label)              return toKebab(el.label);
  if (el.selectors?.id)      return toKebab(el.selectors.id.replace(/^#/, ''));
  if (el.selectors?.name) {
    const m = el.selectors.name.match(/\[name=["']?([^"'\]]+)["']?\]/);
    if (m) return toKebab(m[1]);
  }
  if (el.selectors?.ariaLabel) {
    const m = el.selectors.ariaLabel.match(/\[aria-label=["']?([^"'\]]+)["']?\]/);
    if (m) return toKebab(m[1]);
  }
  return `${el.type}-${index + 1}`;
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchSource(source: string, issue: LintIssue, testId: string): string {
  const sels = issue.element.selectors;
  let attr: string | undefined;
  let val: string | undefined;

  if (sels.id) {
    attr = 'id'; val = sels.id.replace(/^#/, '');
  } else if (sels.name) {
    const m = sels.name.match(/\[name=["']?([^"'\]]+)["']?\]/);
    if (m) { attr = 'name'; val = m[1]; }
  } else if (sels.ariaLabel) {
    const m = sels.ariaLabel.match(/\[aria-label=["']?([^"'\]]+)["']?\]/);
    if (m) { attr = 'aria-label'; val = m[1]; }
  }

  if (!attr || !val) return source;

  const pat = new RegExp(
    `(<[a-zA-Z][^>]*?\\b${escRe(attr)}=["']${escRe(val)}["'][^>]*?)(?=\\s*/?>)`,
    'g',
  );
  let patched = false;
  return source.replace(pat, (match) => {
    if (patched || match.includes('data-testid')) return match;
    patched = true;
    return `${match} data-testid="${testId}"`;
  });
}

async function runLintAnalysis(cwd: string, body: LintRequestBody) {
  const config = await loadCrawlConfig(cwd, body.configPath);
  const rootDir = path.resolve(cwd, config.rootDir);
  const threshold = body.threshold ?? 65;

  const components = await crawl({
    rootDir,
    include: config.include,
    exclude: config.exclude,
    framework: config.framework,
  });

  const results = await analyze(components);

  const issues: LintIssue[] = [];
  for (const r of results) {
    r.interactiveElements.forEach((el, i) => {
      if (el.testabilityScore < threshold) {
        issues.push({
          filePath:        r.component.filePath,
          componentName:   r.component.componentName,
          element:         el,
          suggestedTestId: suggestTestId(el, i),
        });
      }
    });
  }

  let fixedCount   = 0;
  let skippedCount = 0;

  if (body.fix && issues.length > 0) {
    const byFile = new Map<string, LintIssue[]>();
    for (const issue of issues) {
      if (!byFile.has(issue.filePath)) byFile.set(issue.filePath, []);
      byFile.get(issue.filePath)!.push(issue);
    }

    for (const [filePath, fileIssues] of byFile) {
      let source  = await readFile(filePath, 'utf-8');
      let updated = source;

      for (const issue of fileIssues) {
        const patched = patchSource(updated, issue, issue.suggestedTestId);
        if (patched !== updated) {
          updated = patched;
          issue.fixApplied = true;
          fixedCount++;
        } else {
          skippedCount++;
        }
      }

      if (updated !== source) {
        await writeFile(filePath, updated, 'utf-8');
      }
    }
  }

  return {
    issues,
    totalFiles:   results.length,
    fixedCount,
    skippedCount,
    prUrl: undefined, // PR creation not supported from web UI (requires git + gh CLI auth)
  };
}

// ---------------------------------------------------------------------------
// PR creation (mirrors packages/cli/src/lint.ts — no circular dep allowed)
// ---------------------------------------------------------------------------

interface PrRequestBody {
  patchedFiles: string[];   // absolute paths of already-patched files
  fixedCount:   number;
  branch:       string;
  title:        string;
  body:         string;    // markdown body, pre-formatted by the client
}

async function runCreatePr(cwd: string, reqBody: PrRequestBody): Promise<{ prUrl: string }> {
  const { patchedFiles, branch, title, body } = reqBody;

  if (!patchedFiles || patchedFiles.length === 0) {
    throw new Error('No patched files provided. Run lint with Auto-fix first.');
  }
  if (!branch || !title) {
    throw new Error('Branch name and title are required.');
  }

  // 1. Find git root (may differ from cwd if server was started in a subdir)
  let gitRoot: string;
  try {
    gitRoot = execSync('git rev-parse --show-toplevel', { cwd, encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    throw new Error('Not a git repository. Initialize git first: git init && git remote add origin <url>');
  }

  // 2. Verify gh CLI is authenticated
  try {
    execSync('gh auth status', { cwd: gitRoot, encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    throw new Error('GitHub CLI not authenticated. Run: gh auth login');
  }

  // 3. Validate that patched files still exist on disk
  const missing = patchedFiles.filter((f) => !fs.existsSync(f));
  if (missing.length > 0) {
    throw new Error(`Patched file(s) not found on disk: ${missing.join(', ')}`);
  }

  // 4. Create the new branch
  try {
    execSync(`git checkout -b ${JSON.stringify(branch)}`, { cwd: gitRoot, encoding: 'utf-8', stdio: 'pipe' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create branch "${branch}": ${msg}`);
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'selfcure-pr-'));
  let prUrl: string;
  try {
    const bodyFile = path.join(tmpDir, 'pr-body.md');
    await writeFile(bodyFile, body, 'utf-8');

    // Stage only the specific patched files (relative to git root)
    const relFiles = patchedFiles.map((f) => path.relative(gitRoot, f));
    execSync(
      `git add -- ${relFiles.map((f) => JSON.stringify(f)).join(' ')}`,
      { cwd: gitRoot, encoding: 'utf-8', stdio: 'pipe' },
    );

    // Commit using the PR title as the commit message
    execSync(
      `git commit -m ${JSON.stringify(title)}`,
      { cwd: gitRoot, encoding: 'utf-8', stdio: 'pipe' },
    );

    // Push the new branch
    execSync(
      `git push -u origin ${JSON.stringify(branch)}`,
      { cwd: gitRoot, encoding: 'utf-8', stdio: 'pipe' },
    );

    // Create the PR and capture the URL
    const raw = execSync(
      `gh pr create --title ${JSON.stringify(title)} --body-file ${JSON.stringify(bodyFile)} --head ${JSON.stringify(branch)}`,
      { cwd: gitRoot, encoding: 'utf-8', stdio: 'pipe' },
    ).trim();
    prUrl = raw.split('\n').filter((l) => l.startsWith('https://')).pop() ?? raw;
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }

  return { prUrl };
}

function listProviders(): {
  providers: ProviderListEntry[];
  suggested: ProviderId;
} {
  const providers: ProviderListEntry[] = (Object.values(PROVIDERS) as Array<typeof PROVIDERS[ProviderId]>)
    .map((p) => ({
      id: p.id,
      label: p.label,
      envVar: p.envVar,
      envSet: p.envVar ? Boolean(process.env[p.envVar]) : true,
      defaultGenerationModel: p.defaultGenerationModel,
      defaultHealingModel: p.defaultHealingModel,
      defaultBaseURL: p.defaultBaseURL,
      hint: p.hint,
      apiKeyPlaceholder: p.apiKeyPlaceholder,
    }));

  // Suggest the first provider whose env var is already set; fall back to anthropic
  const suggested =
    providers.find((p) => p.envVar && p.envSet)?.id
    ?? providers[0]?.id
    ?? 'anthropic';

  return { providers, suggested };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type { InitOptions, InitAIOptions, GenerateResult } from './generator.js';
export { buildConfigContent, generateConfig, FRAMEWORK_EXTENSIONS } from './generator.js';

/**
 * Start the selfcure web UI server.
 *
 * Routes:
 *   GET  /              → init wizard HTML page
 *   GET  /crawl         → crawler/analyzer results page
 *   GET  /api/dirs      → cwd + immediate subdirs (for the source-folder picker)
 *   GET  /api/providers → supported LLM providers + which env vars are already set
 *   POST /api/init      → generate selfcure.config.mjs + .env, return JSON
 *   POST /api/crawl     → run crawler + analyzer and return serializable JSON
 *
 * @param port - Port to listen on (default: 3333)
 * @param cwd  - Working directory where config + .env are written (default: process.cwd())
 */
export function startWebServer(
  port = 3333,
  cwd = process.cwd(),
): http.Server {
  const server = http.createServer((req, res) => {
    const parsed = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
    const pathname = parsed.pathname;

    if (req.method === 'GET' && pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(initPageHtml);
      return;
    }

    if (req.method === 'GET' && pathname === '/crawl') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(crawlPageHtml);
      return;
    }

    if (req.method === 'GET' && pathname === '/lint') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(lintPageHtml);
      return;
    }

    if (req.method === 'GET' && pathname === '/api/dirs') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cwd, dirs: listSourceDirs(cwd) }));
      return;
    }

    if (req.method === 'GET' && pathname === '/api/providers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(listProviders()));
      return;
    }

    if (req.method === 'POST' && pathname === '/api/init') {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        // Guard against unexpectedly large payloads
        if (body.length > 64_000) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });
      req.on('end', async () => {
        try {
          const options: InitOptions = JSON.parse(body);

          if (!options.rootDir || !options.baseURL) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'rootDir and baseURL are required' }));
            return;
          }

          if (!options.ai || !options.ai.provider) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ai.provider is required' }));
            return;
          }

          const meta = PROVIDERS[options.ai.provider];
          if (!meta) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unknown provider: ${options.ai.provider}` }));
            return;
          }

          // Providers that need a key must have one — either typed by the user
          // or available in the server's env when useExistingEnv was checked.
          if (meta.envVar) {
            const hasTyped = Boolean(options.ai.apiKey);
            const hasEnv = options.ai.useExistingEnv && Boolean(process.env[meta.envVar]);
            if (!hasTyped && !hasEnv) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: `Provider "${options.ai.provider}" needs ${meta.envVar} — enter it or set the env var.`,
              }));
              return;
            }
          }

          const result = await generateConfig(options, cwd);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/crawl') {
      readJsonBody(req)
        .then((rawBody) => runCrawlAnalysis(cwd, rawBody as CrawlRequestBody))
        .then((result) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/lint') {
      readJsonBody(req)
        .then((rawBody) => runLintAnalysis(cwd, rawBody as LintRequestBody))
        .then((result) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/pr') {
      readJsonBody(req)
        .then((rawBody) => runCreatePr(cwd, rawBody as PrRequestBody))
        .then((result) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`selfcure web  →  http://localhost:${port}`);
    console.log('Press Ctrl+C to stop.');
  });

  const shutdown = () => {
    process.stdout.write('\nselfcure web  →  shutting down…\n');
    server.close(() => process.exit(0));
    // Force-exit if keep-alive connections prevent clean close
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}
