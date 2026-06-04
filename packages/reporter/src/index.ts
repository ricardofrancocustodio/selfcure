import fs from 'fs-extra';
import path from 'node:path';
import chalk from 'chalk';
import type { TestResult } from '@selfcure/runner';
import type { HealResult } from '@selfcure/selfcure';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ReportOptions {
  /** Directory where the HTML report and evidence files are written */
  outputDir: string;
  title?: string;
}

export interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  healed: number;
  /** Absolute path to the generated index.html */
  reportPath: string;
}

// ---------------------------------------------------------------------------
// HTML template
// ---------------------------------------------------------------------------

function renderRow(result: TestResult, healResult?: HealResult): string {
  const status = result.passed
    ? `<td class="pass">PASS</td>`
    : healResult?.healed
      ? `<td class="healed">HEALED (${healResult.attempts} attempt${healResult.attempts > 1 ? 's' : ''})</td>`
      : `<td class="fail">FAIL</td>`;

  const error = result.error
    ? `<pre class="error">${result.error.replace(/</g, '&lt;')}</pre>`
    : '';

  const patch = healResult?.patchApplied
    ? `<details><summary>Applied diff</summary><pre>${healResult.patchApplied.replace(/</g, '&lt;')}</pre></details>`
    : '';

  return `
    <tr>
      <td>${path.basename(result.filePath)}</td>
      ${status}
      <td>${result.durationMs}ms</td>
      <td>${error}${patch}</td>
    </tr>`;
}

function renderHtml(
  title: string,
  results: TestResult[],
  healResults: HealResult[],
  summary: Omit<ReportSummary, 'reportPath'>,
): string {
  const healMap = new Map(healResults.map((h) => [h.filePath, h]));
  const rows = results.map((r) => renderRow(r, healMap.get(r.filePath))).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 2rem; background: #f8f9fa; }
    h1 { color: #212529; }
    .summary { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
    .badge { padding: .4rem .8rem; border-radius: 4px; font-weight: 700; }
    .pass-badge { background: #d1fadf; color: #166534; }
    .fail-badge { background: #ffe4e6; color: #9f1239; }
    .healed-badge { background: #fef9c3; color: #854d0e; }
    table { width: 100%; border-collapse: collapse; background: #fff; }
    th, td { padding: .6rem 1rem; border: 1px solid #dee2e6; text-align: left; }
    th { background: #e9ecef; }
    td.pass { color: #166534; font-weight: 700; }
    td.fail { color: #9f1239; font-weight: 700; }
    td.healed { color: #854d0e; font-weight: 700; }
    pre.error { background: #ffe4e6; padding: .5rem; font-size: .8rem; overflow-x: auto; }
    details pre { background: #f0fdf4; padding: .5rem; font-size: .8rem; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div class="summary">
    <span class="badge pass-badge">PASSED ${summary.passed}</span>
    <span class="badge fail-badge">FAILED ${summary.failed}</span>
    <span class="badge healed-badge">HEALED ${summary.healed}</span>
    <span class="badge">TOTAL ${summary.total}</span>
  </div>
  <table>
    <thead><tr><th>Test file</th><th>Status</th><th>Duration</th><th>Details</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Merge test results with healing outcomes and generate an HTML report + a
 * machine-readable JSON summary inside {@link ReportOptions.outputDir}.
 */
export async function report(
  results: TestResult[],
  healResults: HealResult[],
  options: ReportOptions,
): Promise<ReportSummary> {
  await fs.ensureDir(options.outputDir);

  const healedPaths = new Set(healResults.filter((h) => h.healed).map((h) => h.filePath));

  const summary: Omit<ReportSummary, 'reportPath'> = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed && !healedPaths.has(r.filePath)).length,
    healed: healedPaths.size,
  };

  const title = options.title ?? 'Selfcure Report';
  const html = renderHtml(title, results, healResults, summary);
  const reportPath = path.join(options.outputDir, 'index.html');

  await fs.writeFile(reportPath, html, 'utf-8');
  await fs.writeJson(path.join(options.outputDir, 'summary.json'), summary, { spaces: 2 });

  // Terminal summary
  console.log(chalk.bold('\n── Selfcure Report ──────────────────────'));
  console.log(chalk.green(`  Passed : ${summary.passed}`));
  console.log(chalk.red(`  Failed : ${summary.failed}`));
  console.log(chalk.yellow(`  Healed : ${summary.healed}`));
  console.log(`  Report : ${reportPath}\n`);

  return { ...summary, reportPath };
}

export default report;

export type { TmlReportOptions, TmlFinding, TmlReportSummary } from './tml/report.js';
export { reportTml } from './tml/report.js';

// SonarQube Generic Issue Import Format exporter
export type {
  WcagLevel,
  SonarIssueKind,
  SelfcureSonarIssue,
  SonarSeverity,
  SonarType,
  SonarIssue,
  SonarQubeReport,
  SonarExportOptions,
} from './sonarqube.js';
export { toSonarQubeReport, exportSonarQube } from './sonarqube.js';
