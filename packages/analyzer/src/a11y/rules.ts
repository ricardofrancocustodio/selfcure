import type { AccessibilityRule, WcagLevel, A11ySeverity } from './schema.js';
export type { AccessibilityRule, WcagLevel, A11ySeverity };

/** Severity levels in ascending order. */
export const SEVERITY_ORDER: ReadonlyArray<A11ySeverity> = ['info', 'minor', 'major', 'critical'];

/**
 * WCAG level hierarchy: targeting AA means checking A + AA rules.
 * Targeting AAA means checking all levels.
 */
export const LEVEL_HIERARCHY: Readonly<Record<WcagLevel, ReadonlyArray<WcagLevel>>> = {
  A:   ['A'],
  AA:  ['A', 'AA'],
  AAA: ['A', 'AA', 'AAA'],
};

// ---------------------------------------------------------------------------
// Initial rule catalog — 10 static MVP rules
// ---------------------------------------------------------------------------

export const accessibilityRules: ReadonlyArray<AccessibilityRule> = [
  // ── Level A — perceivable ─────────────────────────────────────────────────
  {
    id: 'a11y.img-alt-text',
    wcag: ['1.1.1'],
    level: 'A',
    category: 'perceivable',
    severity: 'major',
    source: 'static',
    paid: true,
    title: 'Image must have alternative text',
    description:
      'Images must have an alt attribute. Informative images need descriptive alt text. ' +
      'Decorative images must use alt="" so assistive technology skips them.',
    remediation:
      'Add an alt attribute with descriptive text for informative images (alt="User profile photo") ' +
      'or alt="" for decorative images.',
  },
  {
    id: 'a11y.input-associated-label',
    wcag: ['1.3.1', '3.3.2', '4.1.2'],
    level: 'A',
    category: 'perceivable',
    severity: 'critical',
    source: 'static',
    paid: true,
    title: 'Input must have an associated label',
    description:
      'Form inputs must be associated with a label element via htmlFor/for or element wrapping, ' +
      'or provide aria-label/aria-labelledby so assistive technology can identify the field.',
    remediation:
      'Add <label htmlFor="inputId">, wrap the input inside a <label>, ' +
      'or add an aria-label or aria-labelledby attribute.',
  },

  // ── Level A — operable ────────────────────────────────────────────────────
  {
    id: 'a11y.positive-tabindex',
    wcag: ['2.4.3'],
    level: 'A',
    category: 'operable',
    severity: 'major',
    source: 'static',
    paid: true,
    title: 'tabIndex must not be positive',
    description:
      'Positive tabIndex values (tabIndex > 0) disrupt the natural focus order of the page ' +
      'and create a confusing keyboard navigation experience for keyboard-only users.',
    remediation:
      'Remove the positive tabIndex or use tabIndex={0} to include the element in the natural tab order. ' +
      'Control focus sequence with DOM order and CSS instead.',
  },
  {
    id: 'a11y.noninteractive-click-handler',
    wcag: ['2.1.1', '4.1.2'],
    level: 'A',
    category: 'operable',
    severity: 'major',
    source: 'static',
    paid: true,
    title: 'Non-interactive element must not have a click handler without keyboard support',
    description:
      'Adding onClick to a non-interactive element (div, span, p) without a keyboard equivalent ' +
      'means keyboard-only users and screen reader users cannot trigger the action.',
    remediation:
      'Use an interactive element like <button> or <a>. If a div must be clickable, also add ' +
      'role="button", tabIndex={0}, and an onKeyDown handler for Enter and Space.',
  },
  {
    id: 'a11y.link-accessible-name',
    wcag: ['4.1.2', '2.4.4'],
    level: 'A',
    category: 'operable',
    severity: 'critical',
    source: 'static',
    paid: true,
    title: 'Link must have an accessible name',
    description:
      'Anchor elements used for navigation must have descriptive link text, aria-label, ' +
      'or aria-labelledby so users understand where the link leads.',
    remediation:
      'Add descriptive text content inside the <a> element, or use aria-label to provide an accessible name. ' +
      'Avoid generic text like "click here" or "read more".',
  },

  // ── Level A — robust ──────────────────────────────────────────────────────
  {
    id: 'a11y.button-accessible-name',
    wcag: ['4.1.2', '2.5.3'],
    level: 'A',
    category: 'robust',
    severity: 'critical',
    source: 'static',
    paid: true,
    title: 'Button must have an accessible name',
    description:
      'Interactive buttons need visible text, aria-label, aria-labelledby, or an equivalent ' +
      'accessible name so screen readers and voice control users can identify and activate them.',
    remediation:
      'Add visible text inside the button element, or an explicit aria-label or aria-labelledby ' +
      'attribute that matches the visible label or user-facing intent.',
  },
  {
    id: 'a11y.aria-invalid-reference',
    wcag: ['4.1.2'],
    level: 'A',
    category: 'robust',
    severity: 'critical',
    source: 'static',
    paid: true,
    title: 'ARIA attribute must reference a valid element ID',
    description:
      'Attributes like aria-labelledby, aria-describedby, and aria-controls must reference IDs ' +
      'that exist in the DOM. Broken references are silently ignored by assistive technology.',
    remediation:
      'Ensure the referenced ID exists and is spelled correctly. If the referenced element is ' +
      'conditionally rendered, handle the absent case explicitly.',
  },
  {
    id: 'a11y.missing-dialog-name',
    wcag: ['4.1.2'],
    level: 'A',
    category: 'robust',
    severity: 'critical',
    source: 'static',
    paid: true,
    title: 'Dialog must have an accessible name',
    description:
      'Elements with role="dialog" or role="alertdialog" must have aria-label or aria-labelledby ' +
      'so screen reader users understand the purpose of the dialog when it opens.',
    remediation:
      'Add aria-labelledby pointing to the dialog title element, ' +
      'or add aria-label with a descriptive name.',
  },
  {
    id: 'a11y.duplicate-id',
    wcag: ['4.1.1'],
    level: 'A',
    category: 'robust',
    severity: 'critical',
    source: 'static',
    paid: true,
    title: 'ID attribute must be unique within a page',
    description:
      'Duplicate IDs break ARIA references, label associations, and fragment links. ' +
      'Assistive technology behaviour when encountering duplicate IDs is undefined.',
    remediation:
      'Ensure all id attributes are unique within a rendered page. ' +
      'Generate IDs dynamically (e.g. useId()) for list items and reusable components.',
  },

  // ── Level AA — perceivable ────────────────────────────────────────────────
  {
    id: 'a11y.heading-order',
    wcag: ['1.3.1', '2.4.6'],
    level: 'AA',
    category: 'perceivable',
    severity: 'minor',
    source: 'static',
    paid: true,
    title: 'Headings must follow a logical order',
    description:
      'Heading levels (h1–h6) must not skip levels. An h4 following an h2 without an h3 in ' +
      'between breaks the document outline that screen readers use for navigation.',
    remediation:
      'Ensure headings follow a sequential order. ' +
      'Never use heading elements purely for visual styling — use CSS instead.',
  },
];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getRuleById(id: string): AccessibilityRule | undefined {
  return accessibilityRules.find((r) => r.id === id);
}

/** Return all rules applicable to the given WCAG target level (inclusive of lower levels). */
export function getRulesByLevel(targetLevel: WcagLevel): AccessibilityRule[] {
  const included = LEVEL_HIERARCHY[targetLevel];
  return accessibilityRules.filter((r) => included.includes(r.level));
}

/** Return all rules at or above the given severity. */
export function getRulesBySeverity(minSeverity: A11ySeverity): AccessibilityRule[] {
  const minIdx = SEVERITY_ORDER.indexOf(minSeverity);
  return accessibilityRules.filter((r) => SEVERITY_ORDER.indexOf(r.severity) >= minIdx);
}

export interface RuleFilterOptions {
  /** Include only rules applicable to this WCAG level and below. */
  level?: WcagLevel;
  /** Include only rules at or above this severity. */
  minSeverity?: A11ySeverity;
  /** Filter by paid status. */
  paid?: boolean;
  /** Filter by analysis source (static / dynamic / hybrid). */
  source?: AccessibilityRule['source'];
  /** Filter by WCAG principle category. */
  category?: AccessibilityRule['category'];
}

export function filterRules(opts: RuleFilterOptions = {}): AccessibilityRule[] {
  let rules: AccessibilityRule[] = [...accessibilityRules];

  if (opts.level !== undefined) {
    const included = LEVEL_HIERARCHY[opts.level];
    rules = rules.filter((r) => included.includes(r.level));
  }
  if (opts.minSeverity !== undefined) {
    const minIdx = SEVERITY_ORDER.indexOf(opts.minSeverity);
    rules = rules.filter((r) => SEVERITY_ORDER.indexOf(r.severity) >= minIdx);
  }
  if (opts.paid !== undefined) {
    rules = rules.filter((r) => r.paid === opts.paid);
  }
  if (opts.source !== undefined) {
    rules = rules.filter((r) => r.source === opts.source);
  }
  if (opts.category !== undefined) {
    rules = rules.filter((r) => r.category === opts.category);
  }

  return rules;
}
