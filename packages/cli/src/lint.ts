// ---------------------------------------------------------------------------
// selfcure lint — testability linter + optional auto-fix + PR creation
// Pro plan feature: --fix applies data-testid patches; --pr opens a GitHub PR.
// ---------------------------------------------------------------------------

import { crawl }    from '@selfcure/crawler';
import { analyze }  from '@selfcure/analyzer';
import type { AnalysisResult, InteractiveElement } from '@selfcure/analyzer';
import { readFile, writeFile } from 'node:fs/promises';
import path         from 'node:path';
import { execSync } from 'node:child_process';

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
  issues:       LintIssue[];
  totalFiles:   number;
  fixedCount:   number;
  skippedCount: number;
  prUrl?:       string;
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
  opts: { threshold: number; fix: boolean; pr: boolean },
): Promise<LintSummary> {
  // ── 1. Crawl + analyse ────────────────────────────────────────────────────
  const components = await crawl({
    rootDir:   config.rootDir,
    include:   config.include,
    exclude:   config.exclude,
    framework: config.framework,
  });

  const results: AnalysisResult[] = await analyze(components);

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
    const cwd    = path.resolve(config.rootDir);
    const branch = `selfcure/lint-fix-${Date.now()}`;

    const applied      = issues.filter(i => i.fixApplied);
    const ambiguousCnt = applied.filter(i => i.kind === 'ambiguous').length;
    const lowScoreCnt  = applied.length - ambiguousCnt;

    const summary: string[] = [];
    if (lowScoreCnt > 0) {
      summary.push(
        `- **${lowScoreCnt}** element(s) with unstable selectors ` +
        `(testability score < ${opts.threshold}/100) — added \`data-testid\`.`,
      );
    }
    if (ambiguousCnt > 0) {
      summary.push(
        `- **${ambiguousCnt}** ambiguous locator(s) — rewrote \`data-testid\` ` +
        `(or added one) so each element resolves to exactly one node.`,
      );
    }

    const body = [
      '## selfcure lint — automated `data-testid` patches',
      '',
      `Total elements patched: **${fixedCount}**.`,
      '',
      ...summary,
      '',
      '### Changes',
      ...applied.map(
        i => `- \`${path.relative(cwd, i.filePath)}\` — \`${i.element.type}\` ` +
             `→ \`data-testid="${i.suggestedTestId}"\`` +
             (i.kind === 'ambiguous' ? ' _(ambiguous)_' : ''),
      ),
      '',
      '> _Generated automatically by [selfcure](https://github.com/ricardofrancocustodio/selfcure)_',
    ].join('\n');

    // Escape double-quotes for shell argument safety
    const safeBody = body.replace(/"/g, '\\"');

    execSync(`git checkout -b "${branch}"`,      { cwd, stdio: 'pipe' });
    execSync('git add -A',                        { cwd, stdio: 'pipe' });
    execSync(
      `git commit -m "chore(testids): add data-testid attributes via selfcure lint\n\n${fixedCount} element(s) patched"`,
      { cwd, stdio: 'pipe' },
    );
    execSync(`git push -u origin "${branch}"`,   { cwd, stdio: 'pipe' });

    const result = execSync(
      `gh pr create --title "chore(testids): add data-testid attributes (selfcure lint)" --body "${safeBody}" --head "${branch}"`,
      { cwd, stdio: 'pipe', encoding: 'utf-8' },
    ) as string;

    prUrl = result.trim();
  }

  return { issues, totalFiles: results.length, fixedCount, skippedCount, prUrl };
}
