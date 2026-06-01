// Naming convention: <domain>.<screen-or-flow>.<element>[.<role-or-action>]
// Each segment: lowercase letters, digits, hyphens; must start with a letter.
// Minimum two segments (one dot) required; three or more is preferred.

const SEGMENT_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

// Single-segment names that are inherently too generic to be stable selectors.
const GENERIC_SINGLE_SEGMENTS = new Set([
  'button', 'submit', 'close', 'open', 'cancel', 'confirm', 'save',
  'input', 'form', 'link', 'modal', 'dialog', 'dropdown', 'menu',
  'tab', 'panel', 'card', 'item', 'row', 'cell', 'table', 'list',
]);

// Multi-segment names that are still too generic (common patterns to flag).
const GENERIC_MULTI = new Set([
  'button-submit', 'modal-close', 'input-email', 'submit-button',
  'close-button', 'cancel-button', 'confirm-button', 'save-button',
]);

export interface NamingViolation {
  testId: string;
  rule: 'invalid-name' | 'generic-name';
  reason: string;
}

/**
 * Validate a single testId against the naming convention.
 * Returns null when the name is valid, or a violation descriptor when not.
 */
export function checkNaming(testId: string): NamingViolation | null {
  const segments = testId.split('.');

  // Generic: no dots at all and the name is in the known-bad set
  if (segments.length === 1) {
    if (GENERIC_SINGLE_SEGMENTS.has(testId) || GENERIC_MULTI.has(testId)) {
      return { testId, rule: 'generic-name', reason: 'Single-segment name is too generic to be stable' };
    }
    // Any single-segment name violates the convention
    return { testId, rule: 'invalid-name', reason: 'Must use dot-separated segments: <domain>.<screen>.<element>' };
  }

  // Validate each segment
  for (const segment of segments) {
    if (!SEGMENT_RE.test(segment)) {
      return {
        testId,
        rule: 'invalid-name',
        reason: `Segment "${segment}" is invalid — use lowercase letters, digits, and hyphens only`,
      };
    }
  }

  // Flag known generic multi-segment names
  if (GENERIC_MULTI.has(testId)) {
    return { testId, rule: 'generic-name', reason: 'Name is too generic to be stable' };
  }

  return null;
}

/** Return true when the testId conforms to the naming convention. */
export function isValidTestId(testId: string): boolean {
  return checkNaming(testId) === null;
}
