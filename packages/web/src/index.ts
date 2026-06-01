import http from 'node:http';
import fs from 'node:fs';
import { readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyze, type InteractiveElement } from '@selfcure/analyzer';
import { crawl } from '@selfcure/crawler';
import { PROVIDERS, type ProviderId } from '@selfcure/generator';
import { generateConfig, type InitOptions, loadSession, clearSession, envKeyIsSet } from './generator.js';
import { crawlPageHtml } from './crawlPage.js';
import {
  disconnectProvider,
  getOAuthStartUrl,
  getProviderStatus,
  handleManagedOAuthCallback,
  handleOAuthCallback,
  isScmProviderId,
} from './integrations.js';
import { integrationsPageHtml } from './integrationsPage.js';
import { initPageHtml } from './initPage.js';
import { lintPageHtml }  from './lintPage.js';
import { a11yPageHtml }      from './a11yPage.js';
import { discoveryPageHtml } from './discoveryPage.js';
import { tmlPageHtml }       from './tmlPage.js';
import { detectProvider } from './git-providers.js';

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
  /** Enables Pro features (auto-fix, open PR) without the SELFCURE_PRO env var. */
  pro?: boolean;
  /** Optional linter settings (PR base branch, git provider override). */
  lint?: { prBaseBranch?: string; gitProvider?: 'github' | 'gitlab' | 'auto' };
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

// ---------------------------------------------------------------------------
// Element-in-source search (find which file/component a DOM element belongs to)
// ---------------------------------------------------------------------------

/** Generic framework/CSS classes that carry no locating value. */
const GENERIC_CLASSES = new Set([
  'btn', 'btn-primary', 'btn-secondary', 'btn-default', 'btn-link', 'btn-danger',
  'btn-success', 'btn-warning', 'btn-info', 'btn-xs', 'btn-sm', 'btn-md', 'btn-lg',
  'btn-block', 'row', 'col', 'container', 'container-fluid', 'active', 'disabled',
  'open', 'show', 'hide', 'hidden', 'd-flex', 'd-none', 'd-block', 'text-center',
  'pull-right', 'pull-left', 'clearfix', 'form-control', 'form-group', 'input-group',
  'ng-star-inserted', 'ng-untouched', 'ng-pristine', 'ng-valid',
]);

interface SearchToken { label: string; value: string }

/** Extract distinctive, locatable tokens from a pasted DOM element snippet. */
function extractElementTokens(raw: string): SearchToken[] {
  const tokens: SearchToken[] = [];
  const seen   = new Set<string>();
  const push = (label: string, value: string) => {
    const v = value.trim();
    if (v.length >= 2 && !seen.has(v)) { seen.add(v); tokens.push({ label, value: v }); }
  };

  // attribute="value" or attribute='value'
  const attrRe = /([a-zA-Z_:@()[\]*.-]+)\s*=\s*"([^"]*)"|([a-zA-Z_:@()[\]*.-]+)\s*=\s*'([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = attrRe.exec(raw)) !== null) {
    const name  = (m[1] ?? m[3] ?? '').toLowerCase();
    const value = (m[2] ?? m[4] ?? '');
    if (!value) continue;
    if (name === 'class') {
      for (const cls of value.split(/\s+/)) {
        if (cls && !GENERIC_CLASSES.has(cls) && !/^col-/.test(cls)) push('class', cls);
      }
    } else if (name === 'data-testid')                          push('data-testid', value);
    else if (name === 'id')                                     push('id', value);
    else if (name.includes('click'))                            push('handler', value);
    else if (name === 'ng-if' || name === '*ngif')             push('ng-if', value);
    else if (name === 'aria-label')                             push('aria-label', value);
    else if (name === 'formcontrolname')                        push('formControlName', value);
    else if (name === 'name')                                   push('name', value);
    else if (name === 'ng-model' || name === '[(ngmodel)]')    push('ng-model', value);
  }

  // visible inner text: >text<
  const textRe = />([^<>{}]+)</g;
  while ((m = textRe.exec(raw)) !== null) {
    const t = (m[1] ?? '').trim();
    if (t.length >= 3 && !/^[\W\d]+$/.test(t)) push('text', t);
  }

  // No HTML detected → treat the whole thing as a literal search term
  if (tokens.length === 0 && raw.trim().length >= 2) push('literal', raw.trim());

  return tokens;
}

/** File extensions to scan, derived from the config's include globs. */
function extensionsFromInclude(include?: string[]): string[] {
  const globs = include ?? ['**/*.html', '**/*.ts', '**/*.tsx', '**/*.jsx', '**/*.vue'];
  const exts  = globs
    .map((g) => { const mm = g.match(/\.([a-z0-9]+)$/i); return mm ? `.${mm[1].toLowerCase()}` : null; })
    .filter((x): x is string => Boolean(x));
  return exts.length ? [...new Set(exts)] : ['.html', '.ts'];
}

const WALK_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.next', '.nuxt', '.svelte-kit', '.angular']);

/** Recursively list files under `dir` matching one of `exts`. */
async function walkSourceFiles(dir: string, exts: string[], limit = 5000): Promise<string[]> {
  const out: string[] = [];
  async function rec(d: string): Promise<void> {
    if (out.length >= limit) return;
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (out.length >= limit) return;
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (WALK_SKIP_DIRS.has(e.name)) continue;
        await rec(full);
      } else if (exts.some((x) => e.name.toLowerCase().endsWith(x))) {
        out.push(full);
      }
    }
  }
  await rec(dir);
  return out;
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
}

interface LintIssue {
  filePath:        string;
  componentName:   string;
  element:         InteractiveElement;
  suggestedTestId: string;
  /** See packages/cli/src/lint.ts → LintIssue.kind for semantics */
  kind:            'ambiguous' | 'low-score';
  ambiguityReason?: string;
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

function unwrap(sel: string | undefined, attr: 'name' | 'aria-label'): string | undefined {
  if (!sel) return undefined;
  const m = sel.match(new RegExp(`\\[${attr}=["']?([^"'\\]]+)["']?\\]`));
  return m?.[1];
}

function existingTestId(el: InteractiveElement): string | undefined {
  const m = el.selectors.dataTestId?.match(/\[data-testid=["']?([^"'\]]+)["']?\]/);
  return m?.[1];
}

/** Make every suggested testId unique within its file (see CLI counterpart). */
function dedupeTestIdsPerFile(issuesByFile: Map<string, LintIssue[]>): void {
  for (const fileIssues of issuesByFile.values()) {
    const used = new Map<string, number>();
    for (const issue of fileIssues) {
      const base = issue.suggestedTestId;
      const n = (used.get(base) ?? 0) + 1;
      used.set(base, n);
      if (n > 1) issue.suggestedTestId = `${base}-${n}`;
    }
  }
}

function patchSource(source: string, issue: LintIssue, testId: string): string {
  // REPLACE: ambiguous element already has a (shared) data-testid → rewrite value.
  const existing = existingTestId(issue.element);
  if (issue.kind === 'ambiguous' && existing && existing !== testId) {
    const pat = new RegExp(`(\\bdata-testid=["'])${escRe(existing)}(["'])`, 'g');
    let done = false;
    return source.replace(pat, (m, pre, post) => {
      if (done) return m;
      done = true;
      return `${pre}${testId}${post}`;
    });
  }

  // ADD: inject data-testid using an identifying attribute as anchor.
  const sels = issue.element.selectors;
  let attr: 'id' | 'name' | 'aria-label' | undefined;
  let val:  string | undefined;

  if (sels.id) {
    attr = 'id';
    val  = sels.id.replace(/^#/, '');
  } else if ((val = unwrap(sels.name, 'name'))) {
    attr = 'name';
  } else if ((val = unwrap(sels.ariaLabel, 'aria-label'))) {
    attr = 'aria-label';
  }

  if (!attr || !val) return source;

  const pat = new RegExp(
    `(<[a-zA-Z][^>]*?\\b${escRe(attr)}=["']${escRe(val)}["'][^>]*?)(?=\\s*/?>)`,
    'g',
  );
  let done = false;
  return source.replace(pat, (match) => {
    if (done || match.includes('data-testid')) return match;
    done = true;
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
      const isAmbiguous = el.ambiguous;
      const isLowScore  = el.testabilityScore < threshold;
      if (!isAmbiguous && !isLowScore) return;
      issues.push({
        filePath:        r.component.filePath,
        componentName:   r.component.componentName,
        element:         el,
        suggestedTestId: suggestTestId(el, i),
        kind:            isAmbiguous ? 'ambiguous' : 'low-score',
        ambiguityReason: el.ambiguityReason,
      });
    });
  }

  // Group + dedupe suggested test-ids per file so ambiguous siblings get
  // distinct values (otherwise --fix would replace one ambiguity with another).
  const byFile = new Map<string, LintIssue[]>();
  for (const issue of issues) {
    if (!byFile.has(issue.filePath)) byFile.set(issue.filePath, []);
    byFile.get(issue.filePath)!.push(issue);
  }
  dedupeTestIdsPerFile(byFile);

  let fixedCount   = 0;
  let skippedCount = 0;

  if (body.fix && issues.length > 0) {
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

  // Pro is a UI hint — the actual gate lives on /api/pr where it matters.
  const isPro = config.pro === true || process.env['SELFCURE_PRO'] === '1';

  return {
    issues,
    totalFiles:   results.length,
    fixedCount,
    skippedCount,
    pro: isPro,
  };
}

// ---------------------------------------------------------------------------
// One-shot PR flow — mirrors packages/cli/src/lint.ts (no circular dep allowed)
//
// Client sends the issue keys it wants to include. We rerun lint server-side,
// apply patches only for the selected issues, then branch/commit/push/PR in
// one atomic operation. The user never edits branch/title/body locally — they
// edit on GitHub after the redirect.
// ---------------------------------------------------------------------------

interface OpenPrRequestBody {
  configPath?: string;
  threshold?:  number;
  /** Stable issue keys (`filePath|suggestedTestId`) the user selected. */
  selectedKeys: string[];
}

function issueKey(filePath: string, suggestedTestId: string): string {
  return `${filePath}|${suggestedTestId}`;
}

function buildPrBody(
  applied: LintIssue[],
  threshold: number,
  patchedFiles: string[],
  gitRoot: string,
): string {
  const ambiguousCnt = applied.filter((i) => i.kind === 'ambiguous').length;
  const lowScoreCnt  = applied.length - ambiguousCnt;

  const fileRows = patchedFiles.map((f) => {
    const rel  = path.relative(gitRoot, f).replace(/\\/g, '/');
    const fIss = applied.filter((i) => i.filePath === f);
    const ids  = fIss.map((i) => `\`data-testid="${i.suggestedTestId}"\``).join(', ');
    return `| \`${rel}\` | ${fIss.length} | ${ids} |`;
  });

  const why: string[] = [];
  if (lowScoreCnt > 0) {
    why.push(
      `- **${lowScoreCnt}** element(s) had no stable selector ` +
      `(score < ${threshold}/100) — \`data-testid\` added.`,
    );
  }
  if (ambiguousCnt > 0) {
    why.push(
      `- **${ambiguousCnt}** locator(s) matched multiple elements in the same component ` +
      `— \`data-testid\` rewritten to a unique value.`,
    );
  }

  return [
    '## selfcure lint — automated `data-testid` patches',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Files changed | ${patchedFiles.length} |`,
    `| Elements patched | ${applied.length} |`,
    `| Unstable selectors fixed | ${lowScoreCnt} |`,
    `| Ambiguous locators fixed | ${ambiguousCnt} |`,
    '',
    '### Changed files',
    '',
    '| File | Elements | Attributes added |',
    '|------|----------|-----------------|',
    ...fileRows,
    '',
    '### Why these changes?',
    '',
    ...why,
    '',
    '> **Review before merging** — rename any `data-testid` value that does not match ' +
    "your project's naming convention.",
    '> _Generated automatically by [selfcure](https://github.com/ricardofrancocustodio/selfcure)._',
  ].join('\n');
}

async function runOpenPr(cwd: string, reqBody: OpenPrRequestBody): Promise<{
  prUrl: string;
  fixedCount: number;
  baseBranch?: string;
  branch: string;
  provider: 'github' | 'gitlab';
  prKindLabel: string;
}> {
  const config    = await loadCrawlConfig(cwd, reqBody.configPath);
  const threshold = reqBody.threshold ?? 65;
  const selected  = new Set(reqBody.selectedKeys ?? []);

  if (selected.size === 0) {
    throw new Error('No issues selected. Tick at least one issue before opening a pull request.');
  }

  // ── 1. Pre-flight: git + gh ────────────────────────────────────────────
  let gitRoot: string;
  try {
    gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd, encoding: 'utf-8', stdio: 'pipe',
    }).trim();
  } catch {
    throw new Error(
      'Not a git repository. Open this folder inside a checked-out git repo ' +
      'before creating a pull request.',
    );
  }

  // Detect provider (GitHub vs GitLab) and verify its CLI is ready.
  const earlyProvider = detectProvider(gitRoot, config.lint?.gitProvider ?? 'auto');
  earlyProvider.ensureReady(gitRoot);

  // ── 2. Re-run lint to get the authoritative issue list ─────────────────
  const rootDir = path.resolve(cwd, config.rootDir);
  const components = await crawl({
    rootDir,
    include: config.include,
    exclude: config.exclude,
    framework: config.framework,
  });
  const results = await analyze(components);

  const allIssues: LintIssue[] = [];
  for (const r of results) {
    r.interactiveElements.forEach((el, i) => {
      const isAmbiguous = el.ambiguous;
      const isLowScore  = el.testabilityScore < threshold;
      if (!isAmbiguous && !isLowScore) return;
      allIssues.push({
        filePath:        r.component.filePath,
        componentName:   r.component.componentName,
        element:         el,
        suggestedTestId: suggestTestId(el, i),
        kind:            isAmbiguous ? 'ambiguous' : 'low-score',
        ambiguityReason: el.ambiguityReason,
      });
    });
  }

  const byFile = new Map<string, LintIssue[]>();
  for (const issue of allIssues) {
    if (!byFile.has(issue.filePath)) byFile.set(issue.filePath, []);
    byFile.get(issue.filePath)!.push(issue);
  }
  dedupeTestIdsPerFile(byFile);

  // ── 3. Apply patches ONLY for selected issues ──────────────────────────
  const selectedIssues: LintIssue[] = [];
  for (const fileIssues of byFile.values()) {
    for (const issue of fileIssues) {
      if (selected.has(issueKey(issue.filePath, issue.suggestedTestId))) {
        selectedIssues.push(issue);
      }
    }
  }

  if (selectedIssues.length === 0) {
    throw new Error(
      'The selected issues no longer match the current source — re-run lint and try again.',
    );
  }

  const selectedByFile = new Map<string, LintIssue[]>();
  for (const issue of selectedIssues) {
    if (!selectedByFile.has(issue.filePath)) selectedByFile.set(issue.filePath, []);
    selectedByFile.get(issue.filePath)!.push(issue);
  }

  let fixedCount = 0;
  const patchedFiles: string[] = [];
  for (const [filePath, fileIssues] of selectedByFile) {
    let source  = await readFile(filePath, 'utf-8');
    let updated = source;
    for (const issue of fileIssues) {
      const patched = patchSource(updated, issue, issue.suggestedTestId);
      if (patched !== updated) {
        updated = patched;
        issue.fixApplied = true;
        fixedCount++;
      }
    }
    if (updated !== source) {
      await writeFile(filePath, updated, 'utf-8');
      patchedFiles.push(filePath);
    }
  }

  if (fixedCount === 0) {
    throw new Error(
      'Nothing to patch — selected elements already have a unique data-testid ' +
      'or could not be located in the source.',
    );
  }

  // ── 4. Resolve provider + base branch + remember current branch ────────
  const provider = detectProvider(gitRoot, config.lint?.gitProvider ?? 'auto');
  // Provider readiness was already checked at step 1; re-check after a fresh
  // import (auth tokens expire, etc.) — fail loudly before mutating the repo.
  try {
    provider.ensureReady(gitRoot);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
  const baseBranch = provider.resolveBaseBranch(config.lint?.prBaseBranch, gitRoot);

  let originalBranch: string | undefined;
  try {
    const out = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: gitRoot, encoding: 'utf-8', stdio: 'pipe',
    }).trim();
    if (out && out !== 'HEAD') originalBranch = out;
  } catch { /* keep undefined */ }

  // ── 5. Branch + commit + push + gh pr create ───────────────────────────
  const date   = new Date().toISOString().slice(0, 10);
  const short  = Date.now().toString(36).slice(-4);
  const branch = `selfcure/lint-fix-${date}-${short}`;
  const applied = selectedIssues.filter((i) => i.fixApplied);
  const ambiguousCnt = applied.filter((i) => i.kind === 'ambiguous').length;
  const title  =
    `chore(testids): ${fixedCount} unique data-testid` +
    (ambiguousCnt > 0 ? ` (incl. ${ambiguousCnt} ambiguous)` : '') +
    ' — selfcure lint';

  const body = buildPrBody(applied, threshold, patchedFiles, gitRoot);

  const tmpDir   = await mkdtemp(path.join(os.tmpdir(), 'selfcure-pr-'));
  const bodyFile = path.join(tmpDir, 'pr-body.md');

  let prUrl: string;
  try {
    await writeFile(bodyFile, body, 'utf-8');

    execSync(`git checkout -b ${JSON.stringify(branch)}`, { cwd: gitRoot, stdio: 'pipe' });

    const relPaths = patchedFiles
      .map((f) => JSON.stringify(path.relative(gitRoot, f)))
      .join(' ');
    execSync(`git add -- ${relPaths}`, { cwd: gitRoot, stdio: 'pipe' });

    const commitMsg =
      `chore(testids): add data-testid via selfcure lint\n\n` +
      `Patched ${fixedCount} element(s) across ${patchedFiles.length} file(s).\n` +
      `Threshold: ${threshold}/100`;
    execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { cwd: gitRoot, stdio: 'pipe' });

    execSync(`git push -u origin ${JSON.stringify(branch)}`, { cwd: gitRoot, stdio: 'pipe' });

    prUrl = provider.openPr({ gitRoot, branch, baseBranch, title, bodyFile });
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
    // Best-effort: return user to their original branch so they're not stranded.
    if (originalBranch) {
      try {
        execSync(`git checkout ${JSON.stringify(originalBranch)}`, { cwd: gitRoot, stdio: 'pipe' });
      } catch { /* non-fatal */ }
    }
  }

  return {
    prUrl,
    fixedCount,
    baseBranch,
    branch,
    provider:    provider.id,
    prKindLabel: provider.prKindLabel,
  };
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
 *   GET  /integrations  → SCM OAuth connection page (GitHub/GitLab/Bitbucket)
 *   GET  /oauth/connect/:provider  → start OAuth flow and redirect
 *   GET  /oauth/managed/callback/:provider → cloud connector callback
 *   GET  /oauth/callback/:provider → handle OAuth callback and persist token
 *   GET  /api/dirs      → cwd + immediate subdirs (for the source-folder picker)
 *   GET  /api/providers → supported LLM providers + which env vars are already set
 *   GET  /api/integrations         → connection status for SCM providers
 *   DELETE /api/integrations/:provider → disconnect provider and delete saved token
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

    if (req.method === 'GET' && pathname === '/integrations') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(integrationsPageHtml);
      return;
    }

    if (req.method === 'GET' && pathname === '/a11y') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(a11yPageHtml);
      return;
    }

    if (req.method === 'GET' && pathname === '/discovery') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(discoveryPageHtml);
      return;
    }

    if (req.method === 'GET' && pathname === '/tml') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(tmlPageHtml);
      return;
    }

    // ── Element → Component search ──────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/find-element') {
      const q = parsed.searchParams.get('q') ?? '';
      (async () => {
        try {
          const config  = await loadCrawlConfig(cwd);
          const rootDir = path.resolve(cwd, config.rootDir);
          const tokens  = extractElementTokens(q);

          if (tokens.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No searchable tokens extracted from input' }));
            return;
          }

          const exts  = extensionsFromInclude(config.include);
          const files = await walkSourceFiles(rootDir, exts);

          // Load project-map for route cross-reference
          let routeCandidates: Array<{ path: string; filePath: string }> = [];
          try {
            const mapRaw = await readFile(path.join(cwd, '.selfcure', 'project-map.json'), 'utf-8');
            routeCandidates = (JSON.parse(mapRaw).routeCandidates ?? []) as typeof routeCandidates;
          } catch { /* no map yet */ }

          interface FileMatch { file: string; absFile: string; score: number; hits: Array<{ token: string; value: string; line: number }>; route?: string }
          const matches: FileMatch[] = [];

          for (const abs of files) {
            const content = await readFile(abs, 'utf-8').catch(() => '');
            if (!content) continue;
            const hits: FileMatch['hits'] = [];
            for (const t of tokens) {
              const idx = content.indexOf(t.value);
              if (idx >= 0) {
                const line = content.slice(0, idx).split('\n').length;
                hits.push({ token: t.label, value: t.value, line });
              }
            }
            if (hits.length > 0) {
              // weight: data-testid/id/handler/class hits count more than plain text
              const weight = hits.reduce((s, h) => s + (['data-testid', 'id', 'handler', 'class'].includes(h.token) ? 2 : 1), 0);
              const rel    = path.relative(cwd, abs);
              const route  = routeCandidates.find((r) => path.resolve(r.filePath) === abs)?.path;
              matches.push({ file: rel, absFile: abs, score: weight, hits, route });
            }
          }

          matches.sort((a, b) => b.score - a.score || b.hits.length - a.hits.length);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            tokens: tokens.map((t) => ({ label: t.label, value: t.value })),
            scannedFiles: files.length,
            matches: matches.slice(0, 12).map(({ absFile, ...rest }) => rest),
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      })();
      return;
    }

    // ── URL → Component lookup ──────────────────────────────────────────────
    if (req.method === 'GET' && pathname === '/api/url-to-component') {
      const rawRoute = parsed.searchParams.get('route') ?? '/';
      (async () => {
        try {
          const { analyze } = await import('@selfcure/analyzer');
          const { enrichTmlWithInventory, loadInventory } = await import('@selfcure/analyzer');
          const { crawl } = await import('@selfcure/crawler');
          const { discoverProject } = await import('@selfcure/crawler');

          const config    = await loadCrawlConfig(cwd);
          const rootDir   = path.resolve(cwd, config.rootDir);

          // Load project-map to get route candidates
          const mapFile = path.join(cwd, '.selfcure', 'project-map.json');
          let routeCandidates: Array<{ path: string; filePath: string }> = [];
          try {
            const mapRaw = await readFile(mapFile, 'utf-8');
            const map    = JSON.parse(mapRaw) as { routeCandidates: typeof routeCandidates };
            routeCandidates = map.routeCandidates ?? [];
          } catch {
            // Fall back to fresh discovery
            const map = await discoverProject({ projectRoot: rootDir });
            routeCandidates = map.routeCandidates;
          }

          // Match route — try exact, then partial (last segment), then closest
          const normalize = (p: string) => p.toLowerCase().replace(/\/$/, '') || '/';
          const target    = normalize(rawRoute);
          let matched = routeCandidates.find((r) => normalize(r.path) === target);
          if (!matched) {
            // Try matching last segment: /1000002718/retail → find /retail
            const last = '/' + target.split('/').filter(Boolean).pop();
            matched = routeCandidates.find((r) => normalize(r.path) === last);
          }
          if (!matched) {
            // Partial substring match
            matched = routeCandidates.find((r) => normalize(r.path).includes(target) || target.includes(normalize(r.path)));
          }

          if (!matched) {
            const candidates = routeCandidates.slice(0, 6).map((r) => r.path);
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No route matched', route: rawRoute, candidates }));
            return;
          }

          // Crawl only the matched component file
          const components = await crawl({
            rootDir,
            include:   [path.relative(rootDir, matched.filePath).replace(/\\/g, '/')],
            exclude:   config.exclude,
            framework: config.framework,
          });

          const results = await analyze(components);

          // Enrich with inventory
          const invPath   = path.join(cwd, '.selfcure', 'testid-inventory.json');
          const invResult = await loadInventory(invPath).catch(() => null);
          if (invResult?.ok) enrichTmlWithInventory(results, invResult.inventory!);

          // Collect elements
          const elements: unknown[] = [];
          for (const r of results) {
            r.interactiveElements.forEach((el, i) => {
              const label = el.label ?? el.selectors?.ariaLabel ?? el.selectors?.id ?? '';
              const suggested = label
                ? label.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
                : `${el.type}-${i + 1}`;
              elements.push({
                type:             el.type,
                selector:         el.selector,
                label:            el.label,
                testabilityScore: el.testabilityScore,
                ambiguous:        el.ambiguous,
                suggestedTestId:  suggested,
                tml:              el.tml ? { level: el.tml.level, label: el.tml.label } : undefined,
              });
            });
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            route:         rawRoute,
            matchedRoute:  matched.path,
            componentFile: path.relative(cwd, matched.filePath),
            elements,
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      })();
      return;
    }

    if (req.method === 'GET' && pathname === '/api/tml-analysis') {
      // Run TML analysis in-process using the server's loaded config
      (async () => {
        try {
          const { analyze } = await import('@selfcure/analyzer');
          const { enrichTmlWithInventory, loadInventory } = await import('@selfcure/analyzer');
          const { crawl } = await import('@selfcure/crawler');
          const config = await loadCrawlConfig(cwd);
          const rootDir = path.resolve(cwd, config.rootDir);
          const components = await crawl({
            rootDir,
            include:   config.include ?? ['**/*.tsx', '**/*.jsx'],
            exclude:   config.exclude ?? [],
            framework: config.framework,
          });
          const results = await analyze(components);
          const invPath = path.join(cwd, '.selfcure', 'testid-inventory.json');
          const invResult = await loadInventory(invPath).catch(() => null);
          if (invResult?.ok) enrichTmlWithInventory(results, invResult.inventory!);

          // Collect distribution + findings
          const dist: Record<string, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
          const findings: unknown[] = [];
          for (const r of results) {
            for (const el of r.interactiveElements) {
              if (!el.tml) continue;
              dist[el.tml.level]++;
              findings.push({ filePath: r.component.filePath, componentName: r.component.componentName, elementType: el.type, selector: el.selector, score: el.testabilityScore, tml: el.tml });
            }
          }
          const total = Object.values(dist).reduce((s, n) => s + n, 0);
          const minimumLevel = 2;
          const violations = findings.filter((f: any) => f.tml.level < minimumLevel).length;

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ totalElements: total, violations, minimumLevel, distribution: dist, findings }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      })();
      return;
    }

    if (req.method === 'GET' && pathname === '/api/discovery-artifact') {
      const dir  = parsed.searchParams.get('dir')  ?? '.selfcure';
      const file = parsed.searchParams.get('file') ?? '';
      if (!file || file.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid file parameter' }));
        return;
      }
      const absPath = path.resolve(cwd, dir, file);
      readFile(absPath, 'utf-8')
        .then((raw) => {
          try {
            const data = JSON.parse(raw);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON in artifact file' }));
          }
        })
        .catch(() => {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Artifact not found' }));
        });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/a11y-findings') {
      const filePath = parsed.searchParams.get('path') ?? '.selfcure/a11y-findings.json';
      const absPath  = path.resolve(cwd, filePath);
      readFile(absPath, 'utf-8')
        .then((raw) => {
          try {
            const data = JSON.parse(raw);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON in findings file' }));
          }
        })
        .catch(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Findings file not found — run selfcure a11y scan first', findings: [] }));
        });
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/oauth/connect/')) {
      const providerRaw = pathname.slice('/oauth/connect/'.length);
      if (!isScmProviderId(providerRaw)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Unknown provider');
        return;
      }

      const start = getOAuthStartUrl(cwd, providerRaw, port);
      if (start.error || !start.redirectTo) {
        const err = encodeURIComponent(start.error ?? 'Unable to start OAuth flow');
        res.writeHead(302, { Location: `/integrations?error=${err}` });
        res.end();
        return;
      }

      res.writeHead(302, { Location: start.redirectTo });
      res.end();
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/oauth/callback/')) {
      const providerRaw = pathname.slice('/oauth/callback/'.length);
      if (!isScmProviderId(providerRaw)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Unknown provider');
        return;
      }

      handleOAuthCallback(cwd, port, providerRaw, parsed.searchParams)
        .then((result) => {
          if (result.ok) {
            const ok = encodeURIComponent(providerRaw);
            res.writeHead(302, { Location: `/integrations?connected=${ok}` });
            res.end();
            return;
          }
          const err = encodeURIComponent(result.error ?? 'OAuth callback failed');
          res.writeHead(302, { Location: `/integrations?error=${err}` });
          res.end();
        })
        .catch((err) => {
          const msg = encodeURIComponent(err instanceof Error ? err.message : String(err));
          res.writeHead(302, { Location: `/integrations?error=${msg}` });
          res.end();
        });
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/oauth/managed/callback/')) {
      const providerRaw = pathname.slice('/oauth/managed/callback/'.length);
      if (!isScmProviderId(providerRaw)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Unknown provider');
        return;
      }

      handleManagedOAuthCallback(cwd, providerRaw, parsed.searchParams)
        .then((result) => {
          if (result.ok) {
            const ok = encodeURIComponent(providerRaw);
            res.writeHead(302, { Location: `/integrations?connected=${ok}` });
            res.end();
            return;
          }
          const err = encodeURIComponent(result.error ?? 'OAuth callback failed');
          res.writeHead(302, { Location: `/integrations?error=${err}` });
          res.end();
        })
        .catch((err) => {
          const msg = encodeURIComponent(err instanceof Error ? err.message : String(err));
          res.writeHead(302, { Location: `/integrations?error=${msg}` });
          res.end();
        });
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

    if (req.method === 'GET' && pathname === '/api/integrations') {
      getProviderStatus(cwd)
        .then((result) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        });
      return;
    }

    if (req.method === 'DELETE' && pathname.startsWith('/api/integrations/')) {
      const providerRaw = pathname.slice('/api/integrations/'.length);
      if (!isScmProviderId(providerRaw)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unknown provider' }));
        return;
      }

      disconnectProvider(cwd, providerRaw)
        .then(() => {
          res.writeHead(204);
          res.end();
        })
        .catch((err) => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/session') {
      (async () => {
        const session = await loadSession(cwd);
        let keyIsSet = false;
        if (session?.ai?.provider) {
          const meta = PROVIDERS[session.ai.provider as ProviderId];
          if (meta?.envVar) {
            keyIsSet =
              Boolean(process.env[meta.envVar]) ||
              (await envKeyIsSet(cwd, meta.envVar));
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ session, keyIsSet }));
      })().catch(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ session: null, keyIsSet: false }));
      });
      return;
    }

    if (req.method === 'DELETE' && pathname === '/api/session') {
      clearSession(cwd)
        .then(() => { res.writeHead(204); res.end(); })
        .catch(() => { res.writeHead(500); res.end(); });
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
        .then(async (rawBody) => {
          const body = rawBody as OpenPrRequestBody;
          // Pro gate — same logic as /api/lint, enforced here because this
          // endpoint actually mutates the repo (creates branch, opens PR).
          const cfg   = await loadCrawlConfig(cwd, body.configPath);
          const isPro = cfg.pro === true || process.env['SELFCURE_PRO'] === '1';
          if (!isPro) {
            throw new Error(
              'Open pull request is a Pro feature. Enable it by setting ' +
              "`pro: true` in selfcure.config.mjs or `SELFCURE_PRO=1` in the environment.",
            );
          }
          return runOpenPr(cwd, body);
        })
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

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nError: port ${port} is already in use.\nRun this to free it:\n  npx kill-port ${port}\nor use a different port:\n  npx selfcure web --port ${port + 1}\n`);
      process.exit(1);
    }
    throw err;
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
