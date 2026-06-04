// ---------------------------------------------------------------------------
// SonarQube exporter — Generic Issue Import Format
//
// Turns selfcure's testability / accessibility findings into a JSON file that
// SonarQube ingests via `sonar.externalIssuesReportPaths`. This is how selfcure
// reaches the enterprise audience (architects, tech leads) who already live in
// the SonarQube dashboard — no native Java plugin to maintain.
//
// Format reference (classic Generic Issue Data, type + severity variant):
//   https://docs.sonarsource.com/latest/analyzing-source-code/importing-external-issues/generic-issue-import-format/
// ---------------------------------------------------------------------------

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

/** WCAG conformance level — mirrors @selfcure/analyzer's WcagLevel. */
export type WcagLevel = 'A' | 'AA' | 'AAA';

/** The four selfcure issue kinds that map onto SonarQube issues. */
export type SonarIssueKind =
  | 'ambiguous'       // best selector matches multiple siblings
  | 'low-score'       // element has no stable selector (score below threshold)
  | 'missing-testid'  // governed data-testid contract entry has no source usage
  | 'a11y-violation'; // WCAG accessibility finding

/**
 * Normalised selfcure issue, framework-agnostic. The `export` command builds
 * these from lint issues (ambiguous / low-score), the testids audit
 * (missing-testid) and a11y findings (a11y-violation), then feeds them here.
 */
export interface SelfcureSonarIssue {
  kind: SonarIssueKind;
  /** Absolute or relative path; relativised against `projectBaseDir` on export. */
  filePath: string;
  /** 1-based line. Defaults to 1 (file-level) when the source location is unknown. */
  line?: number;
  /** Human-readable description shown in the SonarQube issue. */
  message: string;
  /** Overrides the default ruleId derived from `kind`. Used for WCAG rule keys. */
  ruleId?: string;
  /** Only for `a11y-violation` — drives the severity. */
  wcagLevel?: WcagLevel;
}

// ── SonarQube output schema ────────────────────────────────────────────────

export type SonarSeverity = 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
export type SonarType     = 'BUG' | 'VULNERABILITY' | 'CODE_SMELL';

export interface SonarTextRange {
  startLine: number;
  endLine: number;
}

export interface SonarPrimaryLocation {
  message: string;
  filePath: string;
  textRange: SonarTextRange;
}

export interface SonarIssue {
  engineId: string;
  ruleId: string;
  severity: SonarSeverity;
  type: SonarType;
  primaryLocation: SonarPrimaryLocation;
}

export interface SonarQubeReport {
  issues: SonarIssue[];
}

export interface SonarExportOptions {
  /**
   * Base directory the SonarQube scanner runs from (`sonar.projectBaseDir`).
   * filePaths in the output are made relative to it. Defaults to `process.cwd()`.
   */
  projectBaseDir?: string;
  /** engineId stamped on every issue. Defaults to `'selfcure'`. */
  engineId?: string;
}

const ENGINE_ID = 'selfcure';

/**
 * Per-kind mapping to SonarQube's `type` + `severity`. Mirrors the table in
 * `docs/integrations/sonarqube.md` — keep the two in sync.
 *
 *   ambiguous      → BUG        / MAJOR
 *   low-score      → CODE_SMELL / MAJOR
 *   missing-testid → CODE_SMELL / MINOR
 *   a11y-violation → BUG        / by WCAG level (see WCAG_SEVERITY)
 */
const KIND_MAP: Record<
  Exclude<SonarIssueKind, 'a11y-violation'>,
  { type: SonarType; severity: SonarSeverity; ruleId: string }
> = {
  'ambiguous':      { type: 'BUG',        severity: 'MAJOR', ruleId: 'ambiguous-selector' },
  'low-score':      { type: 'CODE_SMELL', severity: 'MAJOR', ruleId: 'low-testability' },
  'missing-testid': { type: 'CODE_SMELL', severity: 'MINOR', ruleId: 'missing-testid' },
};

/**
 * WCAG level → severity. Level A failures are the most fundamental compliance
 * gaps, so they map to the highest severity.
 */
const WCAG_SEVERITY: Record<WcagLevel, SonarSeverity> = {
  A:   'CRITICAL',
  AA:  'MAJOR',
  AAA: 'MINOR',
};

/** Normalise a path to forward slashes, relative to the project base dir. */
function relativise(filePath: string, baseDir: string): string {
  const rel = path.isAbsolute(filePath) ? path.relative(baseDir, filePath) : filePath;
  return rel.replace(/\\/g, '/');
}

function mapIssue(issue: SelfcureSonarIssue, engineId: string, baseDir: string): SonarIssue {
  const line = issue.line && issue.line > 0 ? issue.line : 1;

  let type: SonarType;
  let severity: SonarSeverity;
  let ruleId: string;

  if (issue.kind === 'a11y-violation') {
    type     = 'BUG';
    severity = WCAG_SEVERITY[issue.wcagLevel ?? 'AA'];
    ruleId   = issue.ruleId ?? 'a11y-violation';
  } else {
    const m  = KIND_MAP[issue.kind];
    type     = m.type;
    severity = m.severity;
    ruleId   = issue.ruleId ?? m.ruleId;
  }

  return {
    engineId,
    ruleId,
    severity,
    type,
    primaryLocation: {
      message:   issue.message,
      filePath:  relativise(issue.filePath, baseDir),
      textRange: { startLine: line, endLine: line },
    },
  };
}

/**
 * Build the SonarQube Generic Issue Import report from normalised selfcure
 * issues. Pure — no I/O. Use {@link exportSonarQube} to also write the file.
 */
export function toSonarQubeReport(
  issues: SelfcureSonarIssue[],
  opts: SonarExportOptions = {},
): SonarQubeReport {
  const baseDir  = opts.projectBaseDir ?? process.cwd();
  const engineId = opts.engineId ?? ENGINE_ID;
  return { issues: issues.map((i) => mapIssue(i, engineId, baseDir)) };
}

/**
 * Build the report and write it to `outPath` as pretty-printed JSON.
 * Creates the parent directory if needed. Returns the report object.
 */
export async function exportSonarQube(
  issues: SelfcureSonarIssue[],
  outPath: string,
  opts: SonarExportOptions = {},
): Promise<SonarQubeReport> {
  const report = toSonarQubeReport(issues, opts);
  await mkdir(path.dirname(path.resolve(outPath)), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2) + '\n', 'utf-8');
  return report;
}
