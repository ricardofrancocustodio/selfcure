import { describe, it, expect } from 'vitest';
import { assessTagMaturity, deriveTestIdSuggestion } from '../src/tml/score.js';
import type { TagMaturityInput } from '../src/tml/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function make(overrides: Partial<TagMaturityInput> = {}): TagMaturityInput {
  return {
    testabilityScore: 75,
    ambiguous:        false,
    bestStrategy:     'aria-label',
    elementType:      'button',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Level 0 — Unusable
// ---------------------------------------------------------------------------

describe('TML 0 — unusable', () => {
  it('assigns TML 0 when testabilityScore ≤ 10', () => {
    const r = assessTagMaturity(make({ testabilityScore: 10, bestStrategy: 'css' }));
    expect(r.level).toBe(0);
    expect(r.label).toBe('unusable');
  });

  it('assigns TML 0 for bare tag (score = 0)', () => {
    const r = assessTagMaturity(make({ testabilityScore: 0, bestStrategy: 'css' }));
    expect(r.level).toBe(0);
  });

  it('includes missing-accessible-name reason at TML 0', () => {
    const r = assessTagMaturity(make({ testabilityScore: 10, bestStrategy: 'css' }));
    expect(r.reasons.some((x) => x.code === 'missing-accessible-name')).toBe(true);
  });

  it('includes add-testid change at TML 0', () => {
    const r = assessTagMaturity(make({ testabilityScore: 10, bestStrategy: 'css' }));
    expect(r.requiredChanges.some((x) => x.type === 'add-testid')).toBe(true);
    expect(r.requiredChanges.find((x) => x.type === 'add-testid')?.priority).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Level 1 — Fragile
// ---------------------------------------------------------------------------

describe('TML 1 — fragile', () => {
  it('assigns TML 1 for CSS-only selector (score > 10)', () => {
    const r = assessTagMaturity(make({ testabilityScore: 35, bestStrategy: 'css' }));
    expect(r.level).toBe(1);
    expect(r.label).toBe('fragile');
  });

  it('assigns TML 1 for XPath selector', () => {
    const r = assessTagMaturity(make({ testabilityScore: 20, bestStrategy: 'xpath' }));
    expect(r.level).toBe(1);
  });

  it('assigns TML 1 when ambiguous (any strategy)', () => {
    const r = assessTagMaturity(make({ ambiguous: true, bestStrategy: 'data-testid', testabilityScore: 40 }));
    expect(r.level).toBe(1);
  });

  it('includes ambiguous-selector reason when ambiguous', () => {
    const r = assessTagMaturity(make({ ambiguous: true, bestStrategy: 'aria-label' }));
    expect(r.reasons.some((x) => x.code === 'ambiguous-selector')).toBe(true);
  });

  it('includes weak-css-selector reason for CSS strategy', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'css', testabilityScore: 35 }));
    expect(r.reasons.some((x) => x.code === 'weak-css-selector')).toBe(true);
  });

  it('add-testid change is high priority at TML 1', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'css', testabilityScore: 35 }));
    expect(r.requiredChanges.find((x) => x.type === 'add-testid')?.priority).toBe('high');
  });
});

// ---------------------------------------------------------------------------
// Level 2 — Usable
// ---------------------------------------------------------------------------

describe('TML 2 — usable', () => {
  it('assigns TML 2 for aria-label selector (unique)', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'aria-label', testabilityScore: 75 }));
    expect(r.level).toBe(2);
    expect(r.label).toBe('usable');
  });

  it('assigns TML 2 for id selector', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'id', testabilityScore: 85 }));
    expect(r.level).toBe(2);
  });

  it('assigns TML 2 for name selector', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'name', testabilityScore: 65 }));
    expect(r.level).toBe(2);
  });

  it('includes strong-role-name reason at TML 2', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'aria-label', testabilityScore: 75 }));
    expect(r.reasons.some((x) => x.code === 'strong-role-name')).toBe(true);
  });

  it('includes missing-testid reason at TML 2', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'aria-label', testabilityScore: 75 }));
    expect(r.reasons.some((x) => x.code === 'missing-testid')).toBe(true);
  });

  it('add-testid change is medium priority at TML 2', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'aria-label', testabilityScore: 75 }));
    expect(r.requiredChanges.find((x) => x.type === 'add-testid')?.priority).toBe('medium');
  });

  it('includes add-inventory-entry change', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'aria-label', testabilityScore: 75 }));
    expect(r.requiredChanges.some((x) => x.type === 'add-inventory-entry')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Level 3 — Stable
// ---------------------------------------------------------------------------

describe('TML 3 — stable', () => {
  it('assigns TML 3 for data-testid (no inventory)', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'data-testid', testabilityScore: 100 }));
    expect(r.level).toBe(3);
    expect(r.label).toBe('stable');
  });

  it('includes stable-testid reason', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'data-testid', testabilityScore: 100 }));
    expect(r.reasons.some((x) => x.code === 'stable-testid')).toBe(true);
  });

  it('does NOT include missing-testid reason at TML 3', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'data-testid', testabilityScore: 100 }));
    expect(r.reasons.some((x) => x.code === 'missing-testid')).toBe(false);
  });

  it('still suggests add-inventory-entry to reach TML 4', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'data-testid', testabilityScore: 100 }));
    expect(r.requiredChanges.some((x) => x.type === 'add-inventory-entry')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Level 4 — Governed
// ---------------------------------------------------------------------------

describe('TML 4 — governed', () => {
  const govInventory = { hasOwner: true, hasIntent: true, hasRoute: true, isDeprecated: false, isDuplicate: false, namingValid: true };

  it('assigns TML 4 with data-testid + full inventory', () => {
    const r = assessTagMaturity(make({ bestStrategy: 'data-testid', testabilityScore: 100, inventory: govInventory }));
    expect(r.level).toBe(4);
    expect(r.label).toBe('governed');
  });

  it('caps at TML 2 when testid is duplicated', () => {
    const r = assessTagMaturity(make({
      bestStrategy: 'data-testid', testabilityScore: 100,
      inventory: { ...govInventory, isDuplicate: true },
    }));
    expect(r.level).toBe(2);
    expect(r.reasons.some((x) => x.code === 'duplicate-testid')).toBe(true);
  });

  it('caps at TML 2 when testid is deprecated', () => {
    const r = assessTagMaturity(make({
      bestStrategy: 'data-testid', testabilityScore: 100,
      inventory: { ...govInventory, isDeprecated: true },
    }));
    expect(r.level).toBe(2);
    expect(r.reasons.some((x) => x.code === 'deprecated-testid')).toBe(true);
  });

  it('caps at TML 2 when naming convention is invalid', () => {
    const r = assessTagMaturity(make({
      bestStrategy: 'data-testid', testabilityScore: 100,
      inventory: { ...govInventory, namingValid: false },
    }));
    expect(r.level).toBe(2);
    expect(r.reasons.some((x) => x.code === 'invalid-testid-name')).toBe(true);
  });

  it('caps at TML 3 when owner or intent is missing', () => {
    const r = assessTagMaturity(make({
      bestStrategy: 'data-testid', testabilityScore: 100,
      inventory: { ...govInventory, hasOwner: false },
    }));
    expect(r.level).toBe(3);
    expect(r.reasons.some((x) => x.code === 'missing-owner')).toBe(true);
    expect(r.requiredChanges.some((x) => x.type === 'add-owner')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

describe('confidence', () => {
  it('is > 0 and ≤ 1', () => {
    const r = assessTagMaturity(make());
    expect(r.confidence).toBeGreaterThan(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it('is at least 0.5', () => {
    const r = assessTagMaturity(make({ testabilityScore: 0, bestStrategy: 'css' }));
    expect(r.confidence).toBeGreaterThanOrEqual(0.5);
  });
});

// ---------------------------------------------------------------------------
// deriveTestIdSuggestion
// ---------------------------------------------------------------------------

describe('deriveTestIdSuggestion', () => {
  it('converts label to kebab-case', () => {
    expect(deriveTestIdSuggestion('Add to Cart', 'button')).toBe('add-to-cart');
  });

  it('converts CamelCase label', () => {
    expect(deriveTestIdSuggestion('CheckoutButton', 'button')).toBe('checkout-button');
  });

  it('falls back to type-1 when no label', () => {
    expect(deriveTestIdSuggestion(undefined, 'input')).toBe('input-1');
  });

  it('strips leading and trailing hyphens', () => {
    expect(deriveTestIdSuggestion('  Apply  ', 'button')).toBe('apply');
  });

  it('collapses multiple spaces/hyphens', () => {
    expect(deriveTestIdSuggestion('Add  To  Cart', 'button')).toBe('add-to-cart');
  });
});
