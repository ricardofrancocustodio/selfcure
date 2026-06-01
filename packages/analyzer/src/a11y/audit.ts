import { SEVERITY_ORDER } from './rules.js';
import type { A11ySeverity } from './rules.js';
import type { FindingInventory, AccessibilityFinding } from './schema.js';

export type { A11ySeverity, FindingInventory, AccessibilityFinding };

export type SeverityCounts = Record<A11ySeverity, number>;

export interface AuditCounts {
  open:        number;
  resolved:    number;
  suppressed:  number;
  bySeverity:  SeverityCounts;
}

export interface AuditResult {
  /** All findings (open + resolved + suppressed) from the inventory. */
  findings:     AccessibilityFinding[];
  counts:       AuditCounts;
  /**
   * True when at least one open finding has severity >= failOn.
   * Use this to decide the CI exit code.
   */
  wouldFailCI:  boolean;
}

export interface AuditOptions {
  /**
   * Minimum severity that triggers a CI failure.
   * Findings below this threshold are reported but do not fail.
   * Default: 'major'.
   */
  failOn?: A11ySeverity;
}

/**
 * Audit a findings inventory: compute lifecycle counts and determine whether
 * the build should fail in CI mode.
 */
export function runAudit(inventory: FindingInventory, opts: AuditOptions = {}): AuditResult {
  const { failOn = 'major' } = opts;
  const failOnIdx = SEVERITY_ORDER.indexOf(failOn);

  const open       = inventory.findings.filter((f) => f.status === 'open');
  const resolved   = inventory.findings.filter((f) => f.status === 'resolved');
  const suppressed = inventory.findings.filter((f) => f.status === 'suppressed');

  const bySeverity: SeverityCounts = { critical: 0, major: 0, minor: 0, info: 0 };
  for (const f of open) bySeverity[f.severity]++;

  const wouldFailCI = open.some(
    (f) => SEVERITY_ORDER.indexOf(f.severity) >= failOnIdx,
  );

  return {
    findings: inventory.findings,
    counts: {
      open:       open.length,
      resolved:   resolved.length,
      suppressed: suppressed.length,
      bySeverity,
    },
    wouldFailCI,
  };
}
