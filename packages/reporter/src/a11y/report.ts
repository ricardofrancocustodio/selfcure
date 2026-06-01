import fs   from 'fs-extra';
import path from 'node:path';
import type { FindingInventory, AccessibilityFinding, A11ySeverity } from '@selfcure/analyzer';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface A11yReportOptions {
  outputDir: string;
  title?: string;
}

export interface A11yReportSummary {
  total:      number;
  open:       number;
  resolved:   number;
  suppressed: number;
  bySeverity: Record<A11ySeverity, number>;
  reportPath: string;
  jsonPath:   string;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

const SEVERITY_COLOR: Record<A11ySeverity, string> = {
  critical: '#dc2626',
  major:    '#d97706',
  minor:    '#2563eb',
  info:     '#6b7280',
};

const SEVERITY_BG: Record<A11ySeverity, string> = {
  critical: '#fef2f2',
  major:    '#fffbeb',
  minor:    '#eff6ff',
  info:     '#f9fafb',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function badge(label: string, color: string, bg: string): string {
  return `<span style="background:${bg};color:${color};padding:.2rem .5rem;border-radius:4px;font-size:.78rem;font-weight:700;">${label}</span>`;
}

function renderFinding(f: AccessibilityFinding): string {
  const color = SEVERITY_COLOR[f.severity];
  const bg    = SEVERITY_BG[f.severity];
  const loc   = `${path.basename(f.sourceFile)}:${f.line}${f.column ? `:${f.column}` : ''}`;
  const wcag  = f.wcag.map((w) => `<a href="https://www.w3.org/WAI/WCAG21/Understanding/" target="_blank" rel="noreferrer" style="color:#2563eb;">${w}</a>`).join(', ');

  return `
    <tr>
      <td style="vertical-align:top;padding:.5rem .75rem;">
        ${badge(f.severity, color, bg)}
      </td>
      <td style="vertical-align:top;padding:.5rem .75rem;font-family:monospace;font-size:.82rem;">
        ${esc(f.ruleId.replace('a11y.', ''))}
      </td>
      <td style="vertical-align:top;padding:.5rem .75rem;">
        <div style="font-size:.88rem;">${esc(f.message)}</div>
        <div style="font-size:.78rem;color:#6b7280;margin-top:.2rem;">${esc(f.remediation)}</div>
      </td>
      <td style="vertical-align:top;padding:.5rem .75rem;font-family:monospace;font-size:.8rem;color:#374151;">${esc(loc)}</td>
      <td style="vertical-align:top;padding:.5rem .75rem;font-size:.8rem;color:#6b7280;">${wcag}</td>
    </tr>`;
}

function renderFileGroup(filePath: string, findings: AccessibilityFinding[], rootDir: string): string {
  const rel  = path.relative(rootDir, filePath);
  const rows = findings.map(renderFinding).join('');
  return `
    <div style="margin-bottom:1.5rem;">
      <h3 style="font-size:.9rem;font-family:monospace;background:#f3f4f6;padding:.4rem .75rem;border-radius:4px 4px 0 0;margin:0;border:1px solid #e5e7eb;border-bottom:none;">
        ${esc(rel)} <span style="font-weight:400;color:#6b7280;">${findings.length} finding${findings.length > 1 ? 's' : ''}</span>
      </h3>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#f9fafb;font-size:.78rem;color:#6b7280;">
            <th style="padding:.4rem .75rem;text-align:left;width:90px;">Severity</th>
            <th style="padding:.4rem .75rem;text-align:left;width:220px;">Rule</th>
            <th style="padding:.4rem .75rem;text-align:left;">Message &amp; Remediation</th>
            <th style="padding:.4rem .75rem;text-align:left;width:160px;">Location</th>
            <th style="padding:.4rem .75rem;text-align:left;width:100px;">WCAG</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function summaryCard(label: string, value: number, color: string): string {
  return `
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:1rem 1.25rem;min-width:110px;text-align:center;">
      <div style="font-size:1.8rem;font-weight:700;color:${color};">${value}</div>
      <div style="font-size:.78rem;color:#6b7280;margin-top:.2rem;">${label}</div>
    </div>`;
}

function renderHtml(
  inventory: FindingInventory,
  summary:   Omit<A11yReportSummary, 'reportPath' | 'jsonPath'>,
  title:     string,
): string {
  const open      = inventory.findings.filter((f) => f.status === 'open');
  const resolved  = inventory.findings.filter((f) => f.status === 'resolved');

  // Group open findings by file
  const byFile = new Map<string, AccessibilityFinding[]>();
  for (const f of open) {
    const list = byFile.get(f.sourceFile) ?? [];
    list.push(f);
    byFile.set(f.sourceFile, list);
  }

  // rootDir guess — common prefix of all sourceFiles
  const allFiles = open.map((f) => f.sourceFile);
  const rootDir  = allFiles.length > 0 ? path.dirname(allFiles[0]!) : '';

  const fileGroups = [...byFile.entries()]
    .map(([fp, fds]) => renderFileGroup(fp, fds, rootDir))
    .join('');

  const resolvedRows = resolved.slice(0, 20).map((f) => `
    <tr style="color:#9ca3af;">
      <td style="padding:.3rem .75rem;font-family:monospace;font-size:.8rem;">${esc(f.ruleId.replace('a11y.', ''))}</td>
      <td style="padding:.3rem .75rem;font-size:.82rem;">${esc(path.basename(f.sourceFile))}:${f.line}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #f9fafb; color: #111827; margin: 0; padding: 0; }
    .header { background: #111827; color: #f9fafb; padding: 1.25rem 2rem; }
    .header h1 { margin: 0; font-size: 1.1rem; font-weight: 600; }
    .header .meta { font-size: .8rem; color: #9ca3af; margin-top: .3rem; }
    .container { max-width: 1200px; margin: 2rem auto; padding: 0 2rem; }
    .cards { display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 2rem; }
    h2 { font-size: 1rem; font-weight: 600; color: #374151; margin: 0 0 1rem 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${esc(title)}</h1>
    <div class="meta">
      ${esc(inventory.app)} · WCAG ${inventory.targetLevel} · Generated ${new Date(inventory.generatedAt).toLocaleString()}
    </div>
  </div>

  <div class="container">
    <div class="cards">
      ${summaryCard('Open',       summary.open,                      '#dc2626')}
      ${summaryCard('Resolved',   summary.resolved,                  '#059669')}
      ${summaryCard('Suppressed', summary.suppressed,                '#6b7280')}
      ${summaryCard('Critical',   summary.bySeverity.critical,       '#dc2626')}
      ${summaryCard('Major',      summary.bySeverity.major,          '#d97706')}
      ${summaryCard('Minor',      summary.bySeverity.minor,          '#2563eb')}
    </div>

    ${open.length > 0 ? `<h2>Open findings (${open.length})</h2>${fileGroups}` : '<p style="color:#059669;font-weight:600;">✔ No open accessibility findings.</p>'}

    ${resolved.length > 0 ? `
      <h2 style="margin-top:2rem;">Recently resolved (${resolved.length}${resolved.length > 20 ? ', showing 20' : ''})</h2>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;background:#fff;font-size:.85rem;">
        <thead><tr style="background:#f3f4f6;"><th style="padding:.4rem .75rem;text-align:left;">Rule</th><th style="padding:.4rem .75rem;text-align:left;">Location</th></tr></thead>
        <tbody>${resolvedRows}</tbody>
      </table>` : ''}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function reportA11y(
  inventory: FindingInventory,
  options:   A11yReportOptions,
): Promise<A11yReportSummary> {
  await fs.ensureDir(options.outputDir);

  const open       = inventory.findings.filter((f) => f.status === 'open');
  const resolved   = inventory.findings.filter((f) => f.status === 'resolved');
  const suppressed = inventory.findings.filter((f) => f.status === 'suppressed');

  const bySeverity: Record<A11ySeverity, number> = { critical: 0, major: 0, minor: 0, info: 0 };
  for (const f of open) bySeverity[f.severity]++;

  const summary: Omit<A11yReportSummary, 'reportPath' | 'jsonPath'> = {
    total: inventory.findings.length,
    open: open.length,
    resolved: resolved.length,
    suppressed: suppressed.length,
    bySeverity,
  };

  const title = options.title ?? `Accessibility Report — ${inventory.app}`;
  const html  = renderHtml(inventory, summary, title);

  const reportPath = path.join(options.outputDir, 'a11y.html');
  const jsonPath   = path.join(options.outputDir, 'a11y-summary.json');

  await fs.writeFile(reportPath, html, 'utf-8');
  await fs.writeJson(jsonPath, { ...summary, app: inventory.app, targetLevel: inventory.targetLevel, generatedAt: new Date().toISOString() }, { spaces: 2 });

  return { ...summary, reportPath, jsonPath };
}
