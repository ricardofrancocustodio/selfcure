import { describe, it, expect } from 'vitest';
import { audit } from '../src/testids/audit.js';
import { checkNaming, isValidTestId } from '../src/testids/naming.js';
import type { TestIdInventory } from '../src/testids/schema.js';
import type { TestIdUsage } from '../src/testids/audit.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInventory(elements: { testId: string; status?: string; owner?: string }[], owner?: string): TestIdInventory {
  return {
    version: '1.0',
    app: 'test-app',
    generatedAt: '2026-05-29T00:00:00.000Z',
    routes: [
      {
        path: '/test',
        owner,
        elements: elements.map((e) => ({
          testId: e.testId,
          status: (e.status as 'active' | 'deprecated' | 'removed') ?? 'active',
          stability: 'stable' as const,
          ...(e.owner ? { owner: e.owner } : {}),
        })),
      },
    ],
  };
}

function fe(value: string, file = 'src/Page.tsx', line = 10): TestIdUsage {
  return { filePath: file, line, column: 1, kind: 'frontend', value };
}

function test_(value: string, file = 'tests/page.spec.ts', line = 5): TestIdUsage {
  return { filePath: file, line, column: 1, kind: 'test', value };
}

// ---------------------------------------------------------------------------
// naming.ts
// ---------------------------------------------------------------------------

describe('checkNaming', () => {
  it('returns null for a valid three-segment name', () => {
    expect(checkNaming('auth.login.submit-button')).toBeNull();
  });

  it('returns null for a valid two-segment name', () => {
    expect(checkNaming('auth.submit')).toBeNull();
  });

  it('flags a single-segment generic name as generic-name', () => {
    const v = checkNaming('button');
    expect(v?.rule).toBe('generic-name');
  });

  it('flags a single-segment non-generic name as invalid-name', () => {
    const v = checkNaming('mything');
    expect(v?.rule).toBe('invalid-name');
  });

  it('flags uppercase segments as invalid-name', () => {
    const v = checkNaming('Auth.Login.Submit');
    expect(v?.rule).toBe('invalid-name');
  });

  it('flags segments with underscores as invalid-name', () => {
    const v = checkNaming('auth.login_page.submit');
    expect(v?.rule).toBe('invalid-name');
  });

  it('flags segments starting with a digit as invalid-name', () => {
    const v = checkNaming('1auth.login.submit');
    expect(v?.rule).toBe('invalid-name');
  });

  it('returns null for kebab-case multi-segment names', () => {
    expect(checkNaming('checkout.payment-method.select')).toBeNull();
    expect(checkNaming('dashboard.filters.date-range-trigger')).toBeNull();
  });
});

describe('isValidTestId', () => {
  it('returns true for valid names', () => {
    expect(isValidTestId('auth.login.email-input')).toBe(true);
  });

  it('returns false for invalid names', () => {
    expect(isValidTestId('submit')).toBe(false);
    expect(isValidTestId('Submit.Login')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// audit — duplicate-testid (error)
// ---------------------------------------------------------------------------

describe('audit — duplicate-testid', () => {
  it('flags a testId observed in two frontend locations', () => {
    const inventory = makeInventory([{ testId: 'checkout.submit' }], 'team-a');
    const usages = [
      fe('checkout.submit', 'src/CheckoutPage.tsx', 10),
      fe('checkout.submit', 'src/CheckoutFooter.tsx', 5),
    ];
    const result = audit(inventory, usages);
    const issue = result.issues.find((i) => i.rule === 'duplicate-testid');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(issue?.testId).toBe('checkout.submit');
    expect(issue?.locations).toHaveLength(2);
  });

  it('does not flag a testId observed exactly once', () => {
    const inventory = makeInventory([{ testId: 'checkout.submit' }], 'team-a');
    const result = audit(inventory, [fe('checkout.submit')]);
    expect(result.issues.find((i) => i.rule === 'duplicate-testid')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// audit — test-only-selector (error)
// ---------------------------------------------------------------------------

describe('audit — test-only-selector', () => {
  it('flags a getByTestId call with no matching frontend data-testid', () => {
    const inventory = makeInventory([], 'team-a');
    const result = audit(inventory, [test_('checkout.legacy-confirm')]);
    const issue = result.issues.find((i) => i.rule === 'test-only-selector');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(issue?.testId).toBe('checkout.legacy-confirm');
  });

  it('does not flag a getByTestId when a matching data-testid exists', () => {
    const inventory = makeInventory([{ testId: 'checkout.submit' }], 'team-a');
    const usages = [fe('checkout.submit'), test_('checkout.submit')];
    const result = audit(inventory, usages);
    expect(result.issues.find((i) => i.rule === 'test-only-selector')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// audit — missing-inventory (warning)
// ---------------------------------------------------------------------------

describe('audit — missing-inventory', () => {
  it('flags a frontend testId not registered in the inventory', () => {
    const inventory = makeInventory([], 'team-a');
    const result = audit(inventory, [fe('home.hero.cta')]);
    const issue = result.issues.find((i) => i.rule === 'missing-inventory');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
    expect(issue?.testId).toBe('home.hero.cta');
  });

  it('does not flag a testId that is in the inventory', () => {
    const inventory = makeInventory([{ testId: 'home.hero.cta' }], 'team-a');
    const result = audit(inventory, [fe('home.hero.cta')]);
    expect(result.issues.find((i) => i.rule === 'missing-inventory')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// audit — orphaned-inventory (warning)
// ---------------------------------------------------------------------------

describe('audit — orphaned-inventory', () => {
  it('flags an inventory entry not observed in source', () => {
    const inventory = makeInventory([{ testId: 'auth.login.submit' }], 'team-a');
    const result = audit(inventory, []); // nothing scanned
    const issue = result.issues.find((i) => i.rule === 'orphaned-inventory');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('warning');
    expect(issue?.testId).toBe('auth.login.submit');
  });

  it('does not flag a "removed" entry even if unobserved', () => {
    const inventory = makeInventory([{ testId: 'auth.legacy.btn', status: 'removed' }], 'team-a');
    const result = audit(inventory, []);
    expect(result.issues.find((i) => i.rule === 'orphaned-inventory')).toBeUndefined();
  });

  it('does not flag a testId that was observed in source', () => {
    const inventory = makeInventory([{ testId: 'auth.login.submit' }], 'team-a');
    const result = audit(inventory, [fe('auth.login.submit')]);
    expect(result.issues.find((i) => i.rule === 'orphaned-inventory')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// audit — deprecated-used (error)
// ---------------------------------------------------------------------------

describe('audit — deprecated-used', () => {
  it('flags usage of a deprecated testId', () => {
    const inventory = makeInventory([{ testId: 'auth.legacy.btn', status: 'deprecated' }], 'team-a');
    const result = audit(inventory, [fe('auth.legacy.btn')]);
    const issue = result.issues.find((i) => i.rule === 'deprecated-used');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
  });

  it('does not flag usage of an active testId', () => {
    const inventory = makeInventory([{ testId: 'auth.login.submit', status: 'active' }], 'team-a');
    const result = audit(inventory, [fe('auth.login.submit')]);
    expect(result.issues.find((i) => i.rule === 'deprecated-used')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// audit — invalid-name / generic-name (warning)
// ---------------------------------------------------------------------------

describe('audit — naming rules', () => {
  it('flags a single-segment generic name from frontend usage', () => {
    const inventory = makeInventory([], 'team-a');
    const result = audit(inventory, [fe('button')]);
    expect(result.issues.some((i) => i.rule === 'generic-name')).toBe(true);
  });

  it('flags an invalid name with uppercase from test usage', () => {
    const inventory = makeInventory([], 'team-a');
    const result = audit(inventory, [test_('MyPage.submit')]);
    expect(result.issues.some((i) => i.rule === 'invalid-name')).toBe(true);
  });

  it('does not flag a valid name', () => {
    const inventory = makeInventory([{ testId: 'auth.login.submit' }], 'team-a');
    const result = audit(inventory, [fe('auth.login.submit')]);
    const namingIssues = result.issues.filter((i) => i.rule === 'invalid-name' || i.rule === 'generic-name');
    expect(namingIssues).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// audit — missing-owner (warning)
// ---------------------------------------------------------------------------

describe('audit — missing-owner', () => {
  it('flags an inventory element with no owner at element or route level', () => {
    const inventory = makeInventory([{ testId: 'auth.login.submit' }]); // no route owner
    const result = audit(inventory, [fe('auth.login.submit')]);
    expect(result.issues.some((i) => i.rule === 'missing-owner')).toBe(true);
  });

  it('does not flag when route owner is set', () => {
    const inventory = makeInventory([{ testId: 'auth.login.submit' }], 'team-a');
    const result = audit(inventory, [fe('auth.login.submit')]);
    expect(result.issues.find((i) => i.rule === 'missing-owner')).toBeUndefined();
  });

  it('does not flag when element-level owner is set', () => {
    const inventory = makeInventory([{ testId: 'auth.login.submit', owner: 'team-b' }]); // no route owner
    const result = audit(inventory, [fe('auth.login.submit')]);
    expect(result.issues.find((i) => i.rule === 'missing-owner')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// audit — summary counts
// ---------------------------------------------------------------------------

describe('audit — summary', () => {
  it('counts totalObserved from distinct frontend testIds', () => {
    const inventory = makeInventory([], 'team-a');
    const usages = [
      fe('a.b.c', 'src/A.tsx'),
      fe('a.b.c', 'src/B.tsx'), // duplicate of same testId — still 1 unique observed
      fe('d.e.f', 'src/C.tsx'),
    ];
    const result = audit(inventory, usages);
    expect(result.summary.totalObserved).toBe(2);
  });

  it('counts duplicates correctly', () => {
    const inventory = makeInventory([], 'team-a');
    const usages = [
      fe('a.b.c', 'src/A.tsx'),
      fe('a.b.c', 'src/B.tsx'),
    ];
    const result = audit(inventory, usages);
    expect(result.summary.duplicates).toBe(1);
  });

  it('returns zero counts for a clean scan matching a full inventory', () => {
    const inventory = makeInventory([{ testId: 'auth.login.submit' }], 'team-a');
    const usages = [fe('auth.login.submit')];
    const result = audit(inventory, usages);
    expect(result.summary.duplicates).toBe(0);
    expect(result.summary.missingInventory).toBe(0);
    expect(result.summary.orphaned).toBe(0);
    expect(result.summary.testOnlySelectors).toBe(0);
  });
});
