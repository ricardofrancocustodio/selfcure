import { describe, it, expect } from 'vitest';
import {
  accessibilityRules,
  getRuleById,
  getRulesByLevel,
  getRulesBySeverity,
  filterRules,
  SEVERITY_ORDER,
  LEVEL_HIERARCHY,
} from '../src/a11y/rules.js';

// ---------------------------------------------------------------------------
// Catalog integrity
// ---------------------------------------------------------------------------

describe('accessibilityRules — catalog integrity', () => {
  it('contains 10 initial rules', () => {
    expect(accessibilityRules).toHaveLength(10);
  });

  it('every rule has all required fields', () => {
    const REQUIRED: Array<keyof (typeof accessibilityRules)[0]> = [
      'id', 'wcag', 'level', 'category', 'severity', 'source',
      'paid', 'title', 'description', 'remediation',
    ];
    for (const rule of accessibilityRules) {
      for (const field of REQUIRED) {
        expect(rule[field], `${rule.id} missing field "${field}"`).toBeTruthy();
      }
    }
  });

  it('every rule id follows the a11y.<kebab-case> format', () => {
    const ID_RE = /^a11y\.[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
    for (const rule of accessibilityRules) {
      expect(rule.id, `invalid id: ${rule.id}`).toMatch(ID_RE);
    }
  });

  it('every rule id is unique', () => {
    const ids = accessibilityRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every rule has at least one WCAG reference', () => {
    for (const rule of accessibilityRules) {
      expect(rule.wcag.length, `${rule.id} has no WCAG refs`).toBeGreaterThan(0);
    }
  });

  it('every WCAG ref has the pattern N.N.N', () => {
    const WCAG_RE = /^\d+\.\d+(\.\d+)?$/;
    for (const rule of accessibilityRules) {
      for (const ref of rule.wcag) {
        expect(ref, `invalid WCAG ref "${ref}" in ${rule.id}`).toMatch(WCAG_RE);
      }
    }
  });

  it('every rule level is A, AA, or AAA', () => {
    const validLevels = new Set(['A', 'AA', 'AAA']);
    for (const rule of accessibilityRules) {
      expect(validLevels.has(rule.level), `invalid level in ${rule.id}`).toBe(true);
    }
  });

  it('every rule severity is in SEVERITY_ORDER', () => {
    const validSeverities = new Set(SEVERITY_ORDER);
    for (const rule of accessibilityRules) {
      expect(validSeverities.has(rule.severity), `invalid severity in ${rule.id}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Spot-check key rules
// ---------------------------------------------------------------------------

describe('accessibilityRules — specific rule content', () => {
  it('button-accessible-name targets WCAG 4.1.2 and 2.5.3 at Level A', () => {
    const rule = getRuleById('a11y.button-accessible-name');
    expect(rule).toBeDefined();
    expect(rule?.wcag).toContain('4.1.2');
    expect(rule?.wcag).toContain('2.5.3');
    expect(rule?.level).toBe('A');
    expect(rule?.severity).toBe('critical');
  });

  it('heading-order is Level AA (not A)', () => {
    const rule = getRuleById('a11y.heading-order');
    expect(rule?.level).toBe('AA');
    expect(rule?.severity).toBe('minor');
  });

  it('img-alt-text is major severity', () => {
    const rule = getRuleById('a11y.img-alt-text');
    expect(rule?.severity).toBe('major');
    expect(rule?.wcag).toContain('1.1.1');
  });
});

// ---------------------------------------------------------------------------
// getRuleById
// ---------------------------------------------------------------------------

describe('getRuleById', () => {
  it('returns the matching rule', () => {
    const rule = getRuleById('a11y.input-associated-label');
    expect(rule?.id).toBe('a11y.input-associated-label');
  });

  it('returns undefined for an unknown id', () => {
    expect(getRuleById('a11y.nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getRulesByLevel — WCAG level hierarchy
// ---------------------------------------------------------------------------

describe('getRulesByLevel', () => {
  it('level A returns only Level-A rules', () => {
    const rules = getRulesByLevel('A');
    expect(rules.every((r) => r.level === 'A')).toBe(true);
    // heading-order is AA — must not appear
    expect(rules.find((r) => r.id === 'a11y.heading-order')).toBeUndefined();
  });

  it('level AA includes both A and AA rules', () => {
    const rules = getRulesByLevel('AA');
    const levels = new Set(rules.map((r) => r.level));
    expect(levels.has('A')).toBe(true);
    expect(levels.has('AA')).toBe(true);
    // heading-order (AA) must appear
    expect(rules.find((r) => r.id === 'a11y.heading-order')).toBeDefined();
  });

  it('level AAA includes A, AA, and AAA rules', () => {
    const rules = getRulesByLevel('AAA');
    const levels = new Set(rules.map((r) => r.level));
    // At least A and AA are present in the catalog
    expect(levels.has('A')).toBe(true);
    expect(levels.has('AA')).toBe(true);
    // Total must be >= AA count
    expect(rules.length).toBeGreaterThanOrEqual(getRulesByLevel('AA').length);
  });

  it('AA has more rules than A', () => {
    expect(getRulesByLevel('AA').length).toBeGreaterThan(getRulesByLevel('A').length);
  });

  it('LEVEL_HIERARCHY entries are consistent with actual rule counts', () => {
    for (const level of Object.keys(LEVEL_HIERARCHY) as Array<keyof typeof LEVEL_HIERARCHY>) {
      const filtered = getRulesByLevel(level);
      // All returned rules must be within the included levels
      const included = new Set(LEVEL_HIERARCHY[level]);
      expect(filtered.every((r) => included.has(r.level))).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getRulesBySeverity
// ---------------------------------------------------------------------------

describe('getRulesBySeverity', () => {
  it('critical returns only critical rules', () => {
    const rules = getRulesBySeverity('critical');
    expect(rules.every((r) => r.severity === 'critical')).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('major includes major and critical rules', () => {
    const rules = getRulesBySeverity('major');
    const severities = new Set(rules.map((r) => r.severity));
    expect(severities.has('major')).toBe(true);
    expect(severities.has('critical')).toBe(true);
    expect(severities.has('minor')).toBe(false);
    expect(severities.has('info')).toBe(false);
  });

  it('minor includes minor, major, and critical', () => {
    const rules = getRulesBySeverity('minor');
    const severities = new Set(rules.map((r) => r.severity));
    expect(severities.has('minor')).toBe(true);
    expect(severities.has('major')).toBe(true);
    expect(severities.has('critical')).toBe(true);
  });

  it('info returns all rules', () => {
    expect(getRulesBySeverity('info').length).toBe(accessibilityRules.length);
  });

  it('returns more rules as threshold decreases', () => {
    expect(getRulesBySeverity('info').length).toBeGreaterThanOrEqual(getRulesBySeverity('minor').length);
    expect(getRulesBySeverity('minor').length).toBeGreaterThanOrEqual(getRulesBySeverity('major').length);
    expect(getRulesBySeverity('major').length).toBeGreaterThanOrEqual(getRulesBySeverity('critical').length);
  });
});

// ---------------------------------------------------------------------------
// filterRules — combined filtering
// ---------------------------------------------------------------------------

describe('filterRules', () => {
  it('returns all rules with no options', () => {
    expect(filterRules()).toHaveLength(accessibilityRules.length);
  });

  it('filters by level', () => {
    const aOnly = filterRules({ level: 'A' });
    expect(aOnly.every((r) => r.level === 'A')).toBe(true);
  });

  it('filters by minSeverity', () => {
    const criticalOnly = filterRules({ minSeverity: 'critical' });
    expect(criticalOnly.every((r) => r.severity === 'critical')).toBe(true);
  });

  it('filters by source', () => {
    const staticRules = filterRules({ source: 'static' });
    expect(staticRules.every((r) => r.source === 'static')).toBe(true);
    // All MVP rules are static
    expect(staticRules.length).toBe(accessibilityRules.length);
  });

  it('filters by category', () => {
    const robust = filterRules({ category: 'robust' });
    expect(robust.every((r) => r.category === 'robust')).toBe(true);
    expect(robust.length).toBeGreaterThan(0);
  });

  it('filters by paid status', () => {
    const paidRules = filterRules({ paid: true });
    // All current rules are paid
    expect(paidRules.length).toBe(accessibilityRules.length);

    const freeRules = filterRules({ paid: false });
    expect(freeRules.length).toBe(0);
  });

  it('combines level + minSeverity', () => {
    const rules = filterRules({ level: 'A', minSeverity: 'critical' });
    expect(rules.every((r) => r.level === 'A')).toBe(true);
    expect(rules.every((r) => r.severity === 'critical')).toBe(true);
  });

  it('returns empty array when no rules match', () => {
    const rules = filterRules({ paid: false, minSeverity: 'critical' });
    expect(rules).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// SEVERITY_ORDER
// ---------------------------------------------------------------------------

describe('SEVERITY_ORDER', () => {
  it('has four entries in ascending order', () => {
    expect(SEVERITY_ORDER).toEqual(['info', 'minor', 'major', 'critical']);
  });

  it('critical is the highest severity index', () => {
    expect(SEVERITY_ORDER.indexOf('critical')).toBe(3);
  });
});
