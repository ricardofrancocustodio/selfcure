export type WcagLevel    = 'A' | 'AA' | 'AAA';
export type A11ySeverity = 'info' | 'minor' | 'major' | 'critical';
export type A11yCategory = 'perceivable' | 'operable' | 'understandable' | 'robust';
export type A11ySource   = 'static' | 'dynamic' | 'hybrid';
export type FindingStatus = 'open' | 'resolved' | 'suppressed';

export interface AccessibilityRule {
  id: string;
  wcag: string[];
  level: WcagLevel;
  category: A11yCategory;
  severity: A11ySeverity;
  source: A11ySource;
  paid: boolean;
  title: string;
  description: string;
  remediation: string;
}

export interface AccessibilityFinding {
  id: string;
  ruleId: string;
  wcag: string[];
  level: WcagLevel;
  severity: A11ySeverity;
  status: FindingStatus;
  route?: string;
  component?: string;
  sourceFile: string;
  line: number;
  column: number;
  selector?: string;
  testId?: string;
  accessibleName?: string;
  message: string;
  remediation: string;
  firstSeenAt: string;
  lastSeenAt: string;
  owner?: string;
}

export interface FindingInventory {
  version: string;
  app: string;
  standard: 'WCAG';
  targetLevel: WcagLevel;
  generatedAt: string;
  findings: AccessibilityFinding[];
}

/** Requires a reason, owner, and expiration — suppressions without expiry are invalid in CI mode. */
export interface FindingSuppression {
  findingId: string;
  reason: string;
  owner: string;
  expiresAt: string;
}
