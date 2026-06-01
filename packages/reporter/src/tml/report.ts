import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { AnalysisResult, TagMaturityLevel, TagMaturityResult } from '@selfcure/analyzer';
import { TML_LABELS } from '@selfcure/analyzer';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TmlReportOptions {
  outputDir:     string;
  minimumLevel?: TagMaturityLevel;
  title?:        string;
}

export interface TmlFinding {
  filePath:     string;
  componentName:string;
  elementType:  string;
  selector:     string;
  score:        number;
  tml:          TagMaturityResult;
}

export interface TmlReportSummary {
  generatedAt:    string;
  minimumLevel:   TagMaturityLevel;
  totalElements:  number;
  distribution:   Record<TagMaturityLevel, number>;
  violations:     number;
  findings:       TmlFinding[];
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

function collectFindings(results: AnalysisResult[], minimumLevel: TagMaturityLevel): TmlFinding[] {
  const out: TmlFinding[] = [];
  for (const r of results) {
    for (const el of r.interactiveElements) {
      if (!el.tml || el.tml.level >= minimumLevel) continue;
      out.push({
        filePath:      r.component.filePath,
        componentName: r.component.componentName,
        elementType:   el.type,
        selector:      el.selector,
        score:         el.testabilityScore,
        tml:           el.tml,
      });
    }
  }
  return out;
}

function buildDistribution(results: AnalysisResult[]): Record<TagMaturityLevel, number> {
  const dist: Record<TagMaturityLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of results) {
    for (const el of r.interactiveElements) {
      if (el.tml) dist[el.tml.level]++;
    }
  }
  return dist;
}

// ---------------------------------------------------------------------------
// HTML report
// ---------------------------------------------------------------------------

const LEVEL_COLORS: Record<TagMaturityLevel, string> = {
  0: '#ef4444',
  1: '#eab308',
  2: '#3b82f6',
  3: '#22d3ee',
  4: '#22c55e',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderDistributionBars(dist: Record<TagMaturityLevel, number>, total: number): string {
  if (total === 0) return '<p style="color:#64748b">No interactive elements found.</p>';
  return (([4, 3, 2, 1, 0] as TagMaturityLevel[]).map((lvl) => {
    const cnt = dist[lvl];
    if (cnt === 0 && lvl >= 2) return '';
    const pct   = total > 0 ? Math.round((cnt / total) * 100) : 0;
    const width = pct;
    const col   = LEVEL_COLORS[lvl];
    const label = TML_LABELS[lvl];
    return `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
      <span style="color:${col};font-weight:700;min-width:60px;font-size:13px">TML-${lvl}</span>
      <span style="color:#94a3b8;min-width:72px;font-size:12px">${label}</span>
      <div style="flex:1;background:#1f2233;border-radius:4px;height:16px;max-width:300px">
        <div style="width:${width}%;background:${col};height:100%;border-radius:4px;transition:width .3s"></div>
      </div>
      <span style="color:#e2e8f0;min-width:40px;font-size:13px">${cnt}</span>
      <span style="color:#64748b;font-size:12px">(${pct}%)</span>
    </div>`;
  }).join(''));
}

function renderFindings(findings: TmlFinding[]): string {
  if (findings.length === 0) {
    return '<p style="color:#22c55e;text-align:center;padding:32px">✓ All elements meet the minimum TML level.</p>';
  }

  const byFile = new Map<string, TmlFinding[]>();
  for (const f of findings) {
    if (!byFile.has(f.filePath)) byFile.set(f.filePath, []);
    byFile.get(f.filePath)!.push(f);
  }

  return [...byFile.entries()].map(([fp, items]) => `
  <div style="margin-bottom:24px">
    <div style="font-family:monospace;font-size:12px;color:#94a3b8;margin-bottom:8px;padding:6px 12px;background:#12141f;border-radius:4px">${esc(fp)}</div>
    <table style="width:100%;border-collapse:collapse;background:#1a1d27;border:1px solid #2a2d3a;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#1f2233">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Level</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Element</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Selector</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Score</th>
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.05em">Required changes</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((f) => {
          const col   = LEVEL_COLORS[f.tml.level];
          const changes = f.tml.requiredChanges.slice(0, 2).map((c) =>
            `<div style="font-size:11px;color:#94a3b8;margin-bottom:2px">→ ${esc(c.description)}</div>`
          ).join('');
          return `
        <tr style="border-top:1px solid #2a2d3a">
          <td style="padding:10px 12px">
            <span style="color:${col};font-weight:700;font-size:12px">TML-${f.tml.level}</span>
            <span style="color:#64748b;font-size:11px;display:block">${esc(f.tml.label)}</span>
          </td>
          <td style="padding:10px 12px;font-size:13px;color:#e2e8f0">${esc(f.elementType)}</td>
          <td style="padding:10px 12px;font-family:monospace;font-size:12px;color:#94a3b8;max-width:200px;overflow:hidden;text-overflow:ellipsis">${esc(f.selector)}</td>
          <td style="padding:10px 12px;font-weight:600;color:${f.score >= 50 ? '#eab308' : '#ef4444'}">${f.score}</td>
          <td style="padding:10px 12px">${changes || '<span style="color:#64748b;font-size:12px">—</span>'}</td>
        </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`).join('');
}

function buildHtml(summary: TmlReportSummary, title: string): string {
  const passRate = summary.totalElements > 0
    ? Math.round(((summary.totalElements - summary.violations) / summary.totalElements) * 100)
    : 100;
  const overallColor = passRate >= 90 ? '#22c55e' : passRate >= 70 ? '#eab308' : '#ef4444';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0f1117; color: #e2e8f0; font-family: system-ui, sans-serif; font-size: 14px; padding: 32px; }
    h1  { font-size: 22px; font-weight: 700; margin-bottom: 4px; }
    h2  { font-size: 15px; font-weight: 600; margin: 24px 0 12px; }
    .muted { color: #64748b; font-size: 12px; }
    .card { background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 8px; padding: 20px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-value { font-size: 32px; font-weight: 700; }
    .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
  </style>
</head>
<body>
  <h1>${esc(title)}</h1>
  <p class="muted">Generated ${new Date(summary.generatedAt).toLocaleString()} · minimum level: TML-${summary.minimumLevel}</p>

  <div class="grid" style="margin-top:24px">
    <div class="card">
      <div class="stat-value">${summary.totalElements}</div>
      <div class="stat-label">Total elements</div>
    </div>
    <div class="card">
      <div class="stat-value" style="color:${overallColor}">${passRate}%</div>
      <div class="stat-label">Meet minimum TML-${summary.minimumLevel}</div>
    </div>
    <div class="card">
      <div class="stat-value" style="color:${summary.violations > 0 ? '#ef4444' : '#22c55e'}">${summary.violations}</div>
      <div class="stat-label">Violations</div>
    </div>
  </div>

  <h2>TML Distribution</h2>
  <div class="card" style="margin-bottom:24px">
    ${renderDistributionBars(summary.distribution, summary.totalElements)}
  </div>

  <h2>Findings (below TML-${summary.minimumLevel})</h2>
  ${renderFindings(summary.findings)}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function reportTml(
  results: AnalysisResult[],
  options: TmlReportOptions,
): Promise<TmlReportSummary> {
  const { outputDir, minimumLevel = 2, title = 'selfcure — Tag Maturity Report' } = options;

  await mkdir(outputDir, { recursive: true });

  const distribution = buildDistribution(results);
  const findings     = collectFindings(results, minimumLevel);
  const totalElements = Object.values(distribution).reduce((s, n) => s + n, 0);

  const summary: TmlReportSummary = {
    generatedAt:   new Date().toISOString(),
    minimumLevel,
    totalElements,
    distribution,
    violations:    findings.length,
    findings,
  };

  const htmlPath = path.join(outputDir, 'tml-report.html');
  const jsonPath = path.join(outputDir, 'tml-report.json');

  await Promise.all([
    writeFile(htmlPath, buildHtml(summary, title), 'utf-8'),
    writeFile(jsonPath, JSON.stringify(summary, null, 2), 'utf-8'),
  ]);

  return summary;
}
