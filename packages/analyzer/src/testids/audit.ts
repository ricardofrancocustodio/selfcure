import type { TestIdInventory } from './schema.js';
import type { TestIdUsage } from '@selfcure/crawler';
import { checkNaming } from './naming.js';

export type { TestIdInventory };
export type { TestIdUsage };

export type AuditRuleId =
  | 'duplicate-testid'
  | 'missing-inventory'
  | 'orphaned-inventory'
  | 'test-only-selector'
  | 'invalid-name'
  | 'generic-name'
  | 'missing-owner'
  | 'deprecated-used';

export type IssueSeverity = 'error' | 'warning';

export interface AuditIssue {
  rule: AuditRuleId;
  severity: IssueSeverity;
  testId: string;
  locations?: string[];
  message?: string;
}

export interface AuditSummary {
  totalObserved: number;
  duplicates: number;
  missingInventory: number;
  orphaned: number;
  testOnlySelectors: number;
  invalidNames: number;
}

export interface AuditResult {
  summary: AuditSummary;
  issues: AuditIssue[];
}

const SEVERITY: Record<AuditRuleId, IssueSeverity> = {
  'duplicate-testid':   'error',
  'test-only-selector': 'error',
  'deprecated-used':    'error',
  'missing-inventory':  'warning',
  'orphaned-inventory': 'warning',
  'invalid-name':       'warning',
  'generic-name':       'warning',
  'missing-owner':      'warning',
};

interface ElementMeta {
  status: string;
  owner: string | undefined;
}

/**
 * Audit a scanned set of usages against a governed inventory.
 * Returns all detected issues plus a summary.
 */
export function audit(inventory: TestIdInventory, usages: TestIdUsage[]): AuditResult {
  const issues: AuditIssue[] = [];

  // Build per-kind location maps: testId → ["file:line", ...]
  const frontendMap = new Map<string, string[]>();
  const testMap     = new Map<string, string[]>();

  for (const u of usages) {
    const loc = `${u.filePath}:${u.line}`;
    const map = u.kind === 'frontend' ? frontendMap : testMap;
    const locs = map.get(u.value) ?? [];
    locs.push(loc);
    map.set(u.value, locs);
  }

  // Build inventory lookup
  const inventoryMeta = new Map<string, ElementMeta>();
  for (const route of inventory.routes) {
    for (const el of route.elements) {
      inventoryMeta.set(el.testId, {
        status: el.status,
        owner: el.owner ?? route.owner,
      });
    }
  }

  // ── Rule: duplicate-testid ────────────────────────────────────────────────
  // Same testId observed in two or more distinct locations in frontend source.
  for (const [testId, locs] of frontendMap) {
    if (locs.length > 1) {
      issues.push({
        rule: 'duplicate-testid',
        severity: SEVERITY['duplicate-testid'],
        testId,
        locations: locs,
      });
    }
  }

  // ── Rule: test-only-selector ──────────────────────────────────────────────
  // getByTestId() call references a testId with no matching data-testid in source.
  for (const [testId, locs] of testMap) {
    if (!frontendMap.has(testId)) {
      issues.push({
        rule: 'test-only-selector',
        severity: SEVERITY['test-only-selector'],
        testId,
        locations: locs,
      });
    }
  }

  // ── Rule: missing-inventory ───────────────────────────────────────────────
  // Observed frontend testId not registered in the inventory.
  for (const [testId, locs] of frontendMap) {
    if (!inventoryMeta.has(testId)) {
      issues.push({
        rule: 'missing-inventory',
        severity: SEVERITY['missing-inventory'],
        testId,
        locations: locs,
      });
    }
  }

  // ── Rule: orphaned-inventory ──────────────────────────────────────────────
  // Inventory entry not observed in any frontend source (skip 'removed' entries).
  for (const [testId, meta] of inventoryMeta) {
    if (meta.status === 'removed') continue;
    if (!frontendMap.has(testId)) {
      issues.push({
        rule: 'orphaned-inventory',
        severity: SEVERITY['orphaned-inventory'],
        testId,
      });
    }
  }

  // ── Rule: deprecated-used ─────────────────────────────────────────────────
  // Inventory marks this testId as deprecated but it still appears in source.
  for (const [testId, locs] of frontendMap) {
    const meta = inventoryMeta.get(testId);
    if (meta?.status === 'deprecated') {
      issues.push({
        rule: 'deprecated-used',
        severity: SEVERITY['deprecated-used'],
        testId,
        locations: locs,
      });
    }
  }

  // ── Rule: invalid-name / generic-name ────────────────────────────────────
  // Check all observed testIds (frontend + test) against the naming convention.
  const allObserved = new Set([...frontendMap.keys(), ...testMap.keys()]);
  for (const testId of allObserved) {
    const violation = checkNaming(testId);
    if (violation) {
      issues.push({
        rule: violation.rule,
        severity: SEVERITY[violation.rule],
        testId,
        message: violation.reason,
      });
    }
  }

  // ── Rule: missing-owner ───────────────────────────────────────────────────
  // Inventory element (or its route) has no team ownership set.
  for (const [testId, meta] of inventoryMeta) {
    if (!meta.owner) {
      issues.push({
        rule: 'missing-owner',
        severity: SEVERITY['missing-owner'],
        testId,
      });
    }
  }

  const summary: AuditSummary = {
    totalObserved: frontendMap.size,
    duplicates:       count(issues, 'duplicate-testid'),
    missingInventory: count(issues, 'missing-inventory'),
    orphaned:         count(issues, 'orphaned-inventory'),
    testOnlySelectors: count(issues, 'test-only-selector'),
    invalidNames:     count(issues, 'invalid-name') + count(issues, 'generic-name'),
  };

  return { summary, issues };
}

function count(issues: AuditIssue[], rule: AuditRuleId): number {
  return issues.filter((i) => i.rule === rule).length;
}
