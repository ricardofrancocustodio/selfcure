import type { A11yElementInfo, A11yFileEvidence } from '@selfcure/crawler';
import { getRuleById, getRulesByLevel } from './rules.js';
import type { WcagLevel } from './rules.js';
import type { AccessibilityFinding } from './schema.js';

export type { A11yFileEvidence, A11yElementInfo };

// ---------------------------------------------------------------------------
// Finding ID generator
// ---------------------------------------------------------------------------

let _seq = 0;

function makeFindingId(): string {
  _seq += 1;
  const ts = Date.now().toString(36);
  const seq = _seq.toString(36).padStart(4, '0');
  return `a11y_${ts}${seq}`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const NON_INTERACTIVE_TAGS = new Set([
  'div', 'span', 'p', 'section', 'article', 'main', 'aside',
  'header', 'footer', 'nav', 'ul', 'ol', 'li',
  'table', 'thead', 'tbody', 'tr', 'td', 'th',
  'figure', 'figcaption', 'blockquote',
]);

const HEADING_TAGS: ReadonlyArray<string> = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];

function hasAccessibleName(el: A11yElementInfo): boolean {
  return Boolean(
    el.hasTextChildren ||
    el.attrs['aria-label'] ||
    el.attrs['aria-labelledby'] ||
    el.attrs['title'],
  );
}

function buildSelector(el: A11yElementInfo): string {
  if (el.attrs['data-testid']) return `[data-testid="${el.attrs['data-testid']}"]`;
  if (el.attrs['id'])          return `#${el.attrs['id']}`;
  if (el.attrs['aria-label'])  return `${el.tag}[aria-label="${el.attrs['aria-label']}"]`;
  return el.tag;
}

function finding(
  ruleId: string,
  el: A11yElementInfo,
  message: string,
): AccessibilityFinding | null {
  const rule = getRuleById(ruleId);
  if (!rule) return null;
  const now = new Date().toISOString();
  return {
    id: makeFindingId(),
    ruleId,
    wcag: rule.wcag,
    level: rule.level,
    severity: rule.severity,
    status: 'open',
    sourceFile: el.filePath,
    line: el.line,
    column: el.column,
    selector: buildSelector(el),
    message,
    remediation: rule.remediation,
    firstSeenAt: now,
    lastSeenAt: now,
  };
}

// ---------------------------------------------------------------------------
// Per-file rule execution
// ---------------------------------------------------------------------------

function runAllRules(evidence: A11yFileEvidence): AccessibilityFinding[] {
  const { elements, allIds } = evidence;
  const results: AccessibilityFinding[] = [];
  const idSet = new Set(allIds);

  // Build label associations: htmlFor value → true
  const labelHtmlFors = new Set(
    elements
      .filter((e) => e.tag === 'label' && e.attrs['htmlFor'] && e.attrs['htmlFor'] !== '__dynamic__')
      .map((e) => e.attrs['htmlFor']!),
  );

  // For duplicate-id: track first occurrence per id
  const seenIds = new Map<string, number>(); // id → line of first occurrence

  // For heading-order: track levels in document order
  const headingStack: number[] = [];

  for (const el of elements) {
    // ── a11y.button-accessible-name ──────────────────────────────────────────
    if (el.tag === 'button' && !hasAccessibleName(el)) {
      const f = finding('a11y.button-accessible-name', el, 'Button has no accessible name.');
      if (f) results.push(f);
    }

    // ── a11y.link-accessible-name ─────────────────────────────────────────────
    if (el.tag === 'a' && !hasAccessibleName(el)) {
      const f = finding('a11y.link-accessible-name', el, 'Link has no accessible name.');
      if (f) results.push(f);
    }

    // ── a11y.input-associated-label ───────────────────────────────────────────
    if (el.tag === 'input' && el.attrs['type'] !== 'hidden') {
      const hasDirectName = el.attrs['aria-label'] || el.attrs['aria-labelledby'];
      const linkedByLabel = el.attrs['id'] && labelHtmlFors.has(el.attrs['id']!);
      if (!hasDirectName && !linkedByLabel) {
        const f = finding('a11y.input-associated-label', el, 'Input has no associated label.');
        if (f) results.push(f);
      }
    }

    // ── a11y.img-alt-text ─────────────────────────────────────────────────────
    // Missing alt entirely is an error. alt="" is intentional (decorative) and valid.
    if (el.tag === 'img' && !('alt' in el.attrs)) {
      const f = finding('a11y.img-alt-text', el, 'Image is missing an alt attribute.');
      if (f) results.push(f);
    }

    // ── a11y.aria-invalid-reference ───────────────────────────────────────────
    for (const ariaAttr of ['aria-labelledby', 'aria-describedby', 'aria-controls'] as const) {
      const val = el.attrs[ariaAttr];
      if (val && val !== '__dynamic__') {
        for (const refId of val.split(/\s+/).filter(Boolean)) {
          if (!idSet.has(refId)) {
            const f = finding(
              'a11y.aria-invalid-reference',
              el,
              `${ariaAttr}="${refId}" references an ID that does not exist in this file.`,
            );
            if (f) results.push(f);
          }
        }
      }
    }

    // ── a11y.positive-tabindex ────────────────────────────────────────────────
    const rawTab = el.attrs['tabIndex'] ?? el.attrs['tabindex'];
    if (rawTab !== undefined && rawTab !== '__dynamic__' && rawTab !== '') {
      const idx = Number(rawTab);
      if (!isNaN(idx) && idx > 0) {
        const f = finding(
          'a11y.positive-tabindex',
          el,
          `tabIndex="${rawTab}" disrupts natural focus order — use 0 or -1 instead.`,
        );
        if (f) results.push(f);
      }
    }

    // ── a11y.noninteractive-click-handler ─────────────────────────────────────
    if (NON_INTERACTIVE_TAGS.has(el.tag) && el.attrs['onClick'] !== undefined) {
      const hasRole     = el.attrs['role'] !== undefined;
      const hasTabIndex = el.attrs['tabIndex'] !== undefined || el.attrs['tabindex'] !== undefined;
      if (!hasRole || !hasTabIndex) {
        const f = finding(
          'a11y.noninteractive-click-handler',
          el,
          `<${el.tag}> has onClick but lacks role and/or tabIndex — keyboard users cannot activate it.`,
        );
        if (f) results.push(f);
      }
    }

    // ── a11y.missing-dialog-name ──────────────────────────────────────────────
    const role = el.attrs['role'];
    if (role === 'dialog' || role === 'alertdialog') {
      if (!el.attrs['aria-label'] && !el.attrs['aria-labelledby']) {
        const f = finding(
          'a11y.missing-dialog-name',
          el,
          `Dialog (role="${role}") has no accessible name — add aria-label or aria-labelledby.`,
        );
        if (f) results.push(f);
      }
    }

    // ── a11y.heading-order ────────────────────────────────────────────────────
    if (HEADING_TAGS.includes(el.tag)) {
      const level = parseInt(el.tag[1]!, 10);
      if (headingStack.length > 0) {
        const prev = headingStack[headingStack.length - 1]!;
        if (level > prev + 1) {
          const f = finding(
            'a11y.heading-order',
            el,
            `Heading level skipped: <${el.tag}> follows <h${prev}> (expected at most h${prev + 1}).`,
          );
          if (f) results.push(f);
        }
      }
      headingStack.push(level);
    }

    // ── a11y.duplicate-id ─────────────────────────────────────────────────────
    const elId = el.attrs['id'];
    if (elId && elId !== '__dynamic__' && elId !== '') {
      if (seenIds.has(elId)) {
        const f = finding(
          'a11y.duplicate-id',
          el,
          `ID "${elId}" is already used at line ${seenIds.get(elId)} — IDs must be unique.`,
        );
        if (f) results.push(f);
      } else {
        seenIds.set(elId, el.line);
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface StaticAnalysisOptions {
  /** WCAG target level — rules above this level are excluded. Default: 'AA'. */
  level?: WcagLevel;
}

/**
 * Run static accessibility analysis against JSX/TSX evidence extracted by the crawler.
 * Returns findings sorted by file path then line number.
 */
export function runStaticAnalysis(
  evidenceList: A11yFileEvidence[],
  opts: StaticAnalysisOptions = {},
): AccessibilityFinding[] {
  const { level = 'AA' } = opts;
  const enabledIds = new Set(getRulesByLevel(level).map((r) => r.id));

  return evidenceList
    .flatMap(runAllRules)
    .filter((f) => enabledIds.has(f.ruleId))
    .sort((a, b) => a.sourceFile.localeCompare(b.sourceFile) || a.line - b.line);
}
