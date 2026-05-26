// ---------------------------------------------------------------------------
// selfcure lint — testability linter + optional auto-fix + PR creation
// Pro plan feature: --fix applies data-testid patches; --pr opens a GitHub PR.
// ---------------------------------------------------------------------------

import { crawl }    from '@selfcure/crawler';
import { analyze }  from '@selfcure/analyzer';
import type { AnalysisResult, InteractiveElement } from '@selfcure/analyzer';
import fse          from 'fs-extra';
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

/**
 * Try to inject `data-testid="<id>"` into the source text at the element's location.
 * Matches based on the best available identifying attribute (id, name, aria-label).
 * Returns the (possibly unchanged) source string.
 */
function patchSource(source: string, issue: LintIssue, testId: string): string {
  const sels = issue.element.selectors;

  // Resolve a reliable identifying attribute+value pair
  let attr: string | undefined;
  let val:  string | undefined;

  if (sels.id) {
    attr = 'id';
    val  = sels.id.replace(/^#/, '');
  } else if (sels.name) {
    const m = sels.name.match(/\[name=["']?([^"'\]]+)["']?\]/);
    if (m) { attr = 'name'; val = m[1]; }
  } else if (sels.ariaLabel) {
    const m = sels.ariaLabel.match(/\[aria-label=["']?([^"'\]]+)["']?\]/);
    if (m) { attr = 'aria-label'; val = m[1]; }
  }

  if (!attr || !val) return source; // cannot safely locate element

  // Match an opening HTML/JSX tag that contains this attr="val" without data-testid
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
      if (el.testabilityScore < opts.threshold) {
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

  // ── 3. Apply patches (Pro: --fix) ─────────────────────────────────────────
  if (opts.fix && issues.length) {
    const byFile = new Map<string, LintIssue[]>();
    for (const issue of issues) {
      if (!byFile.has(issue.filePath)) byFile.set(issue.filePath, []);
      byFile.get(issue.filePath)!.push(issue);
    }

    for (const [filePath, fileIssues] of byFile) {
      let source  = await fse.readFile(filePath, 'utf-8');
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
        await fse.writeFile(filePath, updated, 'utf-8');
      }
    }
  }

  // ── 4. Create PR (Pro: --pr) ──────────────────────────────────────────────
  let prUrl: string | undefined;

  if (opts.pr && fixedCount > 0) {
    const cwd    = path.resolve(config.rootDir);
    const branch = `selfcure/lint-fix-${Date.now()}`;

    const applied = issues.filter(i => i.fixApplied);
    const body = [
      '## selfcure lint — automated `data-testid` patches',
      '',
      `Adds \`data-testid\` attributes to **${fixedCount}** interactive element(s) ` +
      `detected by \`selfcure lint\` as having unstable selectors ` +
      `(testability score < ${opts.threshold}/100).`,
      '',
      '### Changes',
      ...applied.map(
        i => `- \`${path.relative(cwd, i.filePath)}\` — \`${i.element.type}\` ` +
             `→ \`data-testid="${i.suggestedTestId}"\``,
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
