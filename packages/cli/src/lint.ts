// ---------------------------------------------------------------------------
// selfcure lint — testability linter + optional auto-fix + PR creation
// Pro plan feature: --fix applies data-testid patches; --pr opens a GitHub PR.
// ---------------------------------------------------------------------------

import { crawl, extractA11yEvidenceFromAll }    from '@selfcure/crawler';
import { analyze, runStaticAnalysis }           from '@selfcure/analyzer';
import type { AnalysisResult, InteractiveElement, AccessibilityFinding, WcagLevel } from '@selfcure/analyzer';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import os           from 'node:os';
import path         from 'node:path';
import { execSync } from 'node:child_process';
import { detectProvider } from './git-providers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal config subset required by the linter */
export interface LintConfig {
  rootDir:    string;
  include:    string[];
  exclude:    string[];
  framework?: 'react' | 'vue' | 'angular' | 'auto';
  /** Set to true in selfcure.config.mjs to enable Pro features without env var */
  pro?:       boolean;
  /** Optional linter block — currently only `prBaseBranch`. */
  lint?:      { prBaseBranch?: string; gitProvider?: 'github' | 'gitlab' | 'auto' };
}

export interface LintIssue {
  filePath:        string;
  componentName:   string;
  element:         InteractiveElement;
  suggestedTestId: string;
  /**
   * Why this element was flagged:
   *   • `'ambiguous'` — best selector matches more than one element in the
   *     same component (Playwright would resolve to multiple nodes).
   *   • `'low-score'` — testability score is below the configured threshold.
   * An ambiguous element is always also low-score (it has been penalised),
   * but `'ambiguous'` wins because the required fix is different: instead of
   * adding a data-testid, the existing one (or sibling-shared anchor) must
   * be rewritten to a unique value.
   */
  kind:            'ambiguous' | 'low-score';
  /** Set when kind === 'ambiguous'; mirrored from element.ambiguityReason */
  ambiguityReason?: string;
  /** Populated after --fix runs */
  fixApplied?:     boolean;
}

export interface LintSummary {
  issues:         LintIssue[];
  totalFiles:     number;
  fixedCount:     number;
  skippedCount:   number;
  prUrl?:         string;
  a11yFindings?:  AccessibilityFinding[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toKebab(s: string): string {
  return s
    .trim()
    .replace(/([A-Z])/g, '-$1')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function suggestTestId(el: InteractiveElement, index: number): string {
  // 1. Prefer a human-readable label
  if (el.label) return toKebab(el.label);
  // 2. Pull bare id value
  if (el.selectors?.id) return toKebab(el.selectors.id.replace(/^#/, ''));
  // 3. Pull name value from 'tag[name="value"]'
  if (el.selectors?.name) {
    const m = el.selectors.name.match(/\[name=["']?([^"'\]]+)["']?\]/);
    if (m) return toKebab(m[1]);
  }
  // 4. Pull aria-label value
  if (el.selectors?.ariaLabel) {
    const m = el.selectors.ariaLabel.match(/\[aria-label=["']?([^"'\]]+)["']?\]/);
    if (m) return toKebab(m[1]);
  }
  // 5. Fall back to type + sequential index
  return `${el.type}-${index + 1}`;
}

function escRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Pull the bare value out of a CSS-style selector fragment like `[aria-label="x"]`. */
function unwrap(sel: string | undefined, attr: 'name' | 'aria-label'): string | undefined {
  if (!sel) return undefined;
  const m = sel.match(new RegExp(`\\[${attr}=["']?([^"'\\]]+)["']?\\]`));
  return m?.[1];
}

function existingTestId(el: InteractiveElement): string | undefined {
  const m = el.selectors.dataTestId?.match(/\[data-testid=["']?([^"'\]]+)["']?\]/);
  return m?.[1];
}

/**
 * Make every issue's `suggestedTestId` unique within its file by appending a
 * numeric suffix (`-2`, `-3`, …) when collisions occur. Without this, two
 * ambiguous siblings with the same label would both be patched to the SAME
 * data-testid — leaving the locator ambiguous after the "fix".
 */
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

/**
 * Patch the source for a single issue. Two modes:
 *
 *   • REPLACE — when an ambiguous element already has a `data-testid` (the
 *     ambiguity *is* the shared testid), rewrite the value of that attribute
 *     to the new unique id.
 *   • ADD — locate the element via a reliable identifying attribute
 *     (`id` / `name` / `aria-label`) and inject `data-testid="<id>"`.
 *
 * Both modes patch exactly ONE occurrence per call (via the `done` flag), so
 * iterating over sibling issues that share the same identifying attribute
 * naturally walks down the source one element at a time.
 */
function patchSource(source: string, issue: LintIssue, testId: string): string {
  // ── REPLACE: ambiguous data-testid → rewrite value ─────────────────────
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

  // ── ADD: inject a new data-testid via an identifying attr+val pair ─────
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

  if (!attr || !val) return source; // cannot safely locate element

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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runLint(
  config: LintConfig,
  opts: { threshold: number; fix: boolean; pr: boolean; a11y?: boolean; wcag?: WcagLevel },
): Promise<LintSummary> {
  // ── 1. Crawl + analyse ────────────────────────────────────────────────────
  const components = await crawl({
    rootDir:   config.rootDir,
    include:   config.include,
    exclude:   config.exclude,
    framework: config.framework,
  });

  const results: AnalysisResult[] = await analyze(components);

  // ── 1b. Accessibility analysis (opt-in, same crawl result) ───────────────
  let a11yFindings: AccessibilityFinding[] | undefined;
  if (opts.a11y) {
    const evidenceList = extractA11yEvidenceFromAll(components);
    a11yFindings = runStaticAnalysis(evidenceList, { level: opts.wcag ?? 'AA' });
  }

  // ── 2. Collect lint issues ────────────────────────────────────────────────
  const issues: LintIssue[] = [];

  for (const r of results) {
    r.interactiveElements.forEach((el, i) => {
      const isAmbiguous = el.ambiguous;
      const isLowScore  = el.testabilityScore < opts.threshold;
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

  // Ensure no two issues in the same file end up with the same suggestedTestId —
  // otherwise --fix would replace one ambiguity with a new one.
  const byFile = new Map<string, LintIssue[]>();
  for (const issue of issues) {
    if (!byFile.has(issue.filePath)) byFile.set(issue.filePath, []);
    byFile.get(issue.filePath)!.push(issue);
  }
  dedupeTestIdsPerFile(byFile);

  let fixedCount   = 0;
  let skippedCount = 0;

  // ── 3. Apply patches (Pro: --fix) ─────────────────────────────────────────
  if (opts.fix && issues.length) {
    for (const [filePath, fileIssues] of byFile) {
      let source  = await readFile(filePath, 'utf-8');
      let updated = source;

      for (const issue of fileIssues) {
        const patched = patchSource(updated, issue, issue.suggestedTestId);
        if (patched !== updated) {
          updated            = patched;
          issue.fixApplied   = true;
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

  // ── 4. Create PR (Pro: --pr) ──────────────────────────────────────────────
  let prUrl: string | undefined;

  if (opts.pr && fixedCount > 0) {
    // ── 4a. Localizar raiz do git (pode ser diferente de rootDir) ────────────
    const cwd = path.resolve(config.rootDir);
    let gitRoot: string;
    try {
      gitRoot = (execSync('git rev-parse --show-toplevel', {
        cwd, stdio: 'pipe', encoding: 'utf-8',
      }) as string).trim();
    } catch {
      throw new Error(
        '[selfcure --pr] Not inside a git repository. ' +
        'Run selfcure from a directory tracked by git.',
      );
    }

    // ── 4b. Detectar provider (GitHub / GitLab) e validar CLI dele ───────────
    const provider = detectProvider(gitRoot, config.lint?.gitProvider ?? 'auto');
    try {
      provider.ensureReady(gitRoot);
    } catch (err) {
      throw new Error(`[selfcure --pr] ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── 4b'. Resolver branch base (config → provider default branch) ────────
    const baseBranch = provider.resolveBaseBranch(config.lint?.prBaseBranch, gitRoot);

    // ── 4b''. Lembrar branch atual para restaurar no final ────────────────────
    let originalBranch: string | undefined;
    try {
      originalBranch = (execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: gitRoot, stdio: 'pipe', encoding: 'utf-8',
      }) as string).trim();
      if (originalBranch === 'HEAD') originalBranch = undefined; // detached
    } catch { /* keep undefined */ }

    // ── 4c. Coletar APENAS os arquivos que o selfcure efetivamente tocou ──────
    const patchedFiles = [...byFile.keys()]
      .filter(f => byFile.get(f)!.some(i => i.fixApplied));

    // ── 4d. Avisar sobre arquivos sujos não relacionados (não serão incluídos) ─
    try {
      const statusOut = (execSync('git status --porcelain', {
        cwd: gitRoot, stdio: 'pipe', encoding: 'utf-8',
      }) as string).trim();
      if (statusOut) {
        const patchedSet = new Set(
          patchedFiles.map(f => path.relative(gitRoot, f).replace(/\\/g, '/')),
        );
        const dirtyUnrelated = statusOut
          .split('\n')
          .map(l => l.slice(3).trim())
          .filter(f => !patchedSet.has(f));
        if (dirtyUnrelated.length > 0) {
          console.warn(
            `[selfcure --pr] Warning: ${dirtyUnrelated.length} unrelated file(s) have uncommitted ` +
            `changes — they will NOT be included in the PR:\n` +
            dirtyUnrelated.map(f => `  • ${f}`).join('\n'),
          );
        }
      }
    } catch { /* non-fatal */ }

    // ── 4e. Construir título e body da PR ─────────────────────────────────────
    const applied      = issues.filter(i => i.fixApplied);
    const ambiguousCnt = applied.filter(i => i.kind === 'ambiguous').length;
    const lowScoreCnt  = applied.length - ambiguousCnt;

    const fileRows = patchedFiles.map(f => {
      const rel        = path.relative(gitRoot, f).replace(/\\/g, '/');
      const fileIssues = byFile.get(f)!.filter(i => i.fixApplied);
      const ids        = fileIssues.map(i => `\`data-testid="${i.suggestedTestId}"\``).join(', ');
      return `| \`${rel}\` | ${fileIssues.length} | ${ids} |`;
    });

    const whySummary: string[] = [];
    if (lowScoreCnt > 0) {
      whySummary.push(
        `- **${lowScoreCnt}** element(s) had no stable selector ` +
        `(score < ${opts.threshold}/100) — \`data-testid\` added.`,
      );
    }
    if (ambiguousCnt > 0) {
      whySummary.push(
        `- **${ambiguousCnt}** locator(s) matched multiple elements in the same component ` +
        `— \`data-testid\` rewritten to a unique value.`,
      );
    }

    const body = [
      '## selfcure lint — automated `data-testid` patches',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| Files changed | ${patchedFiles.length} |`,
      `| Elements patched | ${fixedCount} |`,
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
      ...whySummary,
      '',
      '> **Review before merging** — rename any `data-testid` value that does not match ' +
      "your project's naming convention.",
      '> _Generated automatically by [selfcure](https://github.com/ricardofrancocustodio/selfcure)._',
    ].join('\n');

    // ── 4f. Gravar body em arquivo temp (evita todos os problemas de shell-escaping) ─
    const tmpDir   = await mkdtemp(path.join(os.tmpdir(), 'selfcure-pr-'));
    const bodyFile = path.join(tmpDir, 'body.md');
    await writeFile(bodyFile, body, 'utf-8');

    // ── 4g. Branch → staged only → commit → push → gh pr create ─────────────
    const date   = new Date().toISOString().slice(0, 10);   // YYYY-MM-DD
    const short  = Date.now().toString(36).slice(-4);        // desambiguador curto
    const branch = `selfcure/lint-fix-${date}-${short}`;
    const title  =
      `chore(testids): add data-testid to ${fixedCount} element(s) — selfcure lint`;

    try {
      execSync(`git checkout -b ${JSON.stringify(branch)}`, { cwd: gitRoot, stdio: 'pipe' });

      // Stage SOMENTE os arquivos que o selfcure tocou — nunca changes não-relacionadas
      const relPaths = patchedFiles
        .map(f => JSON.stringify(path.relative(gitRoot, f)))
        .join(' ');
      execSync(`git add -- ${relPaths}`, { cwd: gitRoot, stdio: 'pipe' });

      const commitMsg =
        `chore(testids): add data-testid via selfcure lint\n\n` +
        `Patched ${fixedCount} element(s) across ${patchedFiles.length} file(s).\n` +
        `Threshold: ${opts.threshold}/100`;
      execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { cwd: gitRoot, stdio: 'pipe' });

      execSync(`git push -u origin ${JSON.stringify(branch)}`, { cwd: gitRoot, stdio: 'pipe' });

      // Delegate to the detected provider (GitHub `gh` or GitLab `glab`).
      prUrl = provider.openPr({ gitRoot, branch, baseBranch, title, bodyFile });
    } finally {
      // Remover sempre o arquivo temporário, mesmo em caso de erro
      await rm(tmpDir, { recursive: true, force: true });

      // Best-effort: voltar pro branch original para não deixar o user perdido
      if (originalBranch) {
        try {
          execSync(`git checkout ${JSON.stringify(originalBranch)}`, { cwd: gitRoot, stdio: 'pipe' });
        } catch { /* não-fatal */ }
      }
    }
  }

  return { issues, totalFiles: results.length, fixedCount, skippedCount, prUrl, a11yFindings };
}
