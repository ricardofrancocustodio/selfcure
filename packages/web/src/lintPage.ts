// ---------------------------------------------------------------------------
// selfcure lint — web page
// Layout: dev-tool minimalist, full-width results list, light + auto-dark.
// Self-contained <style> block; no external CSS framework.
// ---------------------------------------------------------------------------

export const lintPageHtml = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>selfcure — lint</title>
  <style>
    :root {
      --bg:        #ffffff;
      --surface:   #fafafa;
      --surface2:  #f3f4f6;
      --text:      #0a0a0a;
      --muted:     #6b7280;
      --border:    #e5e7eb;
      --border-strong: #d1d5db;
      --accent:    #2563eb;
      --accent-fg: #ffffff;
      --accent-hover: #1d4ed8;
      --success:   #16a34a;
      --success-bg:#f0fdf4;
      --success-border: #bbf7d0;
      --warning:   #d97706;
      --warning-bg:#fffbeb;
      --warning-border: #fde68a;
      --error:     #dc2626;
      --error-bg:  #fef2f2;
      --error-border: #fecaca;
      --pro:       #7c3aed;
      --pro-bg:    #f5f3ff;
      --pro-border:#ddd6fe;
      --code-bg:   #f3f4f6;
      --score-low: #dc2626;
      --score-mid: #d97706;
      --score-high:#16a34a;
      --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg:        #0a0a0a;
        --surface:   #111111;
        --surface2:  #161616;
        --text:      #fafafa;
        --muted:     #9ca3af;
        --border:    #1f1f1f;
        --border-strong: #2a2a2a;
        --accent:    #3b82f6;
        --accent-fg: #ffffff;
        --accent-hover: #60a5fa;
        --success:   #22c55e;
        --success-bg:#052e16;
        --success-border: #14532d;
        --warning:   #f59e0b;
        --warning-bg:#1c1407;
        --warning-border: #78350f;
        --error:     #f87171;
        --error-bg:  #1a0e0e;
        --error-border: #7f1d1d;
        --pro:       #a78bfa;
        --pro-bg:    #13101f;
        --pro-border:#3b1f7a;
        --code-bg:   #161616;
        --score-low: #f87171;
        --score-mid: #fbbf24;
        --score-high:#4ade80;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--sans);
      font-size: 14px;
      line-height: 1.55;
      -webkit-font-smoothing: antialiased;
    }

    /* ── Nav ─────────────────────────────────────────────────────────────── */
    nav {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; gap: 4px;
      padding: 0 20px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      height: 44px;
    }
    .nav-brand {
      font-family: var(--mono); font-size: 13px; font-weight: 700;
      color: var(--accent); text-decoration: none; margin-right: 8px;
    }
    .nav-sep { color: var(--border-strong); margin: 0 2px; }
    .nav-link {
      font-size: 13px; padding: 4px 10px; border-radius: 5px;
      color: var(--muted); text-decoration: none;
      transition: background 120ms, color 120ms;
    }
    .nav-link:hover { background: var(--surface2); color: var(--text); }
    .nav-link.active { background: var(--surface2); color: var(--text); font-weight: 500; }

    /* ── Run bar ─────────────────────────────────────────────────────────── */
    .run-bar {
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .run-bar label { font-size: 12px; color: var(--muted); white-space: nowrap; }
    .run-bar input[type="text"] {
      flex: 1; min-width: 160px;
      font-family: var(--mono); font-size: 13px;
      color: var(--text); background: var(--bg);
      border: 1px solid var(--border-strong); border-radius: 5px;
      padding: 6px 10px;
    }
    .run-bar input[type="text"]:focus { outline: none; border-color: var(--accent); }
    .threshold-wrap {
      display: flex; align-items: center; gap: 6px;
    }
    .threshold-wrap input[type="number"] {
      width: 58px; font-family: var(--mono); font-size: 13px;
      color: var(--text); background: var(--bg);
      border: 1px solid var(--border-strong); border-radius: 5px;
      padding: 6px 8px; text-align: center;
    }
    .threshold-wrap input[type="number"]:focus { outline: none; border-color: var(--accent); }
    .threshold-wrap span { font-size: 12px; color: var(--muted); }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      font-family: var(--sans); font-size: 13px; font-weight: 500;
      padding: 7px 16px; border-radius: 5px; border: none; cursor: pointer;
      transition: background 120ms, opacity 120ms;
      white-space: nowrap;
    }
    .btn-primary { background: var(--accent); color: var(--accent-fg); }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .run-status { font-size: 12px; color: var(--muted); white-space: nowrap; }
    .run-error {
      font-size: 12px; color: var(--error);
      background: var(--error-bg); border: 1px solid var(--error-border);
      border-radius: 4px; padding: 4px 10px;
    }

    /* ── Pro options bar ─────────────────────────────────────────────────── */
    .pro-bar {
      display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
      padding: 10px 20px;
      background: var(--pro-bg);
      border-bottom: 1px solid var(--pro-border);
    }
    .pro-bar-label {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--pro); white-space: nowrap;
    }
    .pro-option {
      display: flex; align-items: center; gap: 6px; cursor: pointer;
    }
    .pro-option input[type="checkbox"] { cursor: pointer; accent-color: var(--pro); }
    .pro-option-label { font-size: 13px; color: var(--text); }
    .pro-option-hint  { font-size: 12px; color: var(--muted); }
    .pro-badge {
      font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
      background: var(--pro); color: #fff;
      border-radius: 3px; padding: 1px 5px;
      vertical-align: middle; margin-left: 2px;
    }

    /* ── Stats bar ───────────────────────────────────────────────────────── */
    .stats-bar {
      display: flex; gap: 0;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .stat-item {
      flex: 1; padding: 12px 20px;
      display: flex; flex-direction: column; gap: 2px;
      border-right: 1px solid var(--border);
    }
    .stat-item:last-child { border-right: none; }
    .stat-value {
      font-size: 22px; font-weight: 700; line-height: 1;
      font-family: var(--mono); color: var(--text);
    }
    .stat-value.ok    { color: var(--score-high); }
    .stat-value.warn  { color: var(--score-mid);  }
    .stat-value.bad   { color: var(--score-low);  }
    .stat-label {
      font-size: 11px; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.06em;
    }

    /* ── Main content ────────────────────────────────────────────────────── */
    .content { max-width: 960px; margin: 0 auto; padding: 24px 20px 60px; }

    /* ── Empty / placeholder state ────────────────────────────────────────── */
    .placeholder {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 80px 20px; gap: 12px;
      color: var(--muted); text-align: center;
    }
    .placeholder-icon { font-size: 36px; line-height: 1; }
    .placeholder-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .placeholder-body  { font-size: 13px; max-width: 380px; }

    /* ── All-clear state ─────────────────────────────────────────────────── */
    .all-clear {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 80px 20px; gap: 10px; text-align: center;
    }
    .all-clear-icon {
      font-size: 42px; line-height: 1;
    }
    .all-clear-title {
      font-size: 16px; font-weight: 700; color: var(--success);
    }
    .all-clear-body { font-size: 13px; color: var(--muted); max-width: 380px; }

    /* ── File group ──────────────────────────────────────────────────────── */
    .file-group { margin-bottom: 24px; }
    .file-header {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 0 6px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2px;
    }
    .file-icon { font-size: 14px; }
    .file-path {
      font-family: var(--mono); font-size: 13px;
      font-weight: 600; color: var(--text);
    }
    .file-count {
      font-size: 11px; color: var(--muted);
      background: var(--surface2); border-radius: 10px;
      padding: 1px 7px; margin-left: 4px;
    }

    /* ── Issue row ───────────────────────────────────────────────────────── */
    .issue-row {
      display: grid;
      grid-template-columns: 70px 1fr 80px auto;
      align-items: center; gap: 10px;
      padding: 8px 10px;
      border-radius: 5px;
      transition: background 80ms;
    }
    .issue-row:hover { background: var(--surface2); }
    .issue-row.patched { background: var(--success-bg); border: 1px solid var(--success-border); margin: 2px 0; }
    .issue-type {
      font-family: var(--mono); font-size: 12px;
      color: var(--accent); font-weight: 600;
    }
    .issue-selector {
      font-family: var(--mono); font-size: 12px;
      color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .issue-score {
      font-family: var(--mono); font-size: 12px; font-weight: 700; text-align: right;
    }
    .issue-score.low  { color: var(--score-low); }
    .issue-score.mid  { color: var(--score-mid); }
    .issue-suggestion {
      font-size: 12px; display: flex; align-items: center; gap: 6px;
    }
    .testid-chip {
      font-family: var(--mono); font-size: 11px;
      background: var(--code-bg); border: 1px solid var(--border);
      border-radius: 4px; padding: 2px 6px;
      color: var(--text); white-space: nowrap;
    }
    .issue-patch-note {
      font-size: 11px; color: var(--success); font-weight: 600;
    }

    /* ── PR banner ───────────────────────────────────────────────────────── */
    .pr-banner {
      margin-top: 24px;
      background: var(--success-bg); border: 1px solid var(--success-border);
      border-radius: 8px; padding: 14px 18px;
      display: flex; align-items: center; gap: 12px;
    }
    .pr-banner-icon { font-size: 20px; }
    .pr-banner-text { font-size: 13px; }
    .pr-banner-link {
      color: var(--accent); font-weight: 600; text-decoration: none;
    }
    .pr-banner-link:hover { text-decoration: underline; }

    /* ── Summary bar ─────────────────────────────────────────────────────── */
    .summary-bar {
      margin-top: 24px; padding: 12px 16px;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 7px; font-size: 13px;
      display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    }
    .summary-ok   { color: var(--success); font-weight: 600; }
    .summary-info { color: var(--muted); }
    .summary-pro  { color: var(--pro); font-weight: 600; }

    /* ── Spinner ─────────────────────────────────────────────────────────── */
    .spinner {
      display: inline-block; width: 14px; height: 14px;
      border: 2px solid var(--border-strong);
      border-top-color: var(--accent);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Threshold slider visual ─────────────────────────────────────────── */
    .threshold-visual {
      font-size: 11px; color: var(--muted);
      background: var(--surface2); border-radius: 3px;
      padding: 2px 6px; font-family: var(--mono);
    }
  </style>
</head>
<body>

<nav>
  <a class="nav-brand" href="/">selfcure</a>
  <span class="nav-sep">/</span>
  <a class="nav-link" href="/">init</a>
  <a class="nav-link" href="/crawl">crawl</a>
  <a class="nav-link active" href="/lint">lint</a>
</nav>

<form id="lintForm">
  <div class="run-bar">
    <label for="configPath">Config</label>
    <input id="configPath" name="configPath" type="text"
      value="selfcure.config.mjs" autocomplete="off" spellcheck="false">

    <div class="threshold-wrap">
      <label for="threshold" style="white-space:nowrap">Threshold</label>
      <input id="threshold" name="threshold" type="number"
        min="1" max="100" value="65">
      <span class="threshold-visual" id="thresholdLabel">score &lt; 65</span>
    </div>

    <button class="btn btn-primary" type="submit" id="runBtn">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M3 2.5a.5.5 0 0 1 .765-.424l10 5.5a.5.5 0 0 1 0 .848l-10 5.5A.5.5 0 0 1 3 13.5v-11z"/>
      </svg>
      Run lint
    </button>
    <span class="run-status" id="status" role="status"></span>
    <span class="run-error" id="errorMsg" role="alert" hidden></span>
  </div>
</form>

<div class="pro-bar">
  <span class="pro-bar-label">&#9670; Pro</span>
  <label class="pro-option" id="fixOption">
    <input type="checkbox" id="fixCheck">
    <span class="pro-option-label">Auto-fix <span class="pro-badge">PRO</span></span>
    <span class="pro-option-hint">— inject data-testid into source files</span>
  </label>
  <label class="pro-option" id="prOption">
    <input type="checkbox" id="prCheck" disabled>
    <span class="pro-option-label">Open GitHub PR <span class="pro-badge">PRO</span></span>
    <span class="pro-option-hint">— commit fixes and create a PR (requires --fix)</span>
  </label>
</div>

<div class="stats-bar" id="statsBar" hidden>
  <div class="stat-item">
    <span class="stat-value" id="statFiles">—</span>
    <span class="stat-label">Files scanned</span>
  </div>
  <div class="stat-item">
    <span class="stat-value" id="statIssues">—</span>
    <span class="stat-label">Issues found</span>
  </div>
  <div class="stat-item">
    <span class="stat-value" id="statFixed">—</span>
    <span class="stat-label">Patched</span>
  </div>
  <div class="stat-item">
    <span class="stat-value" id="statSkipped">—</span>
    <span class="stat-label">Skipped (no id)</span>
  </div>
</div>

<div class="content" id="content">
  <div class="placeholder" id="placeholder">
    <div class="placeholder-icon">&#128270;</div>
    <div class="placeholder-title">Ready to lint</div>
    <div class="placeholder-body">
      Configure the threshold score (1–100). Elements below this score lack a stable
      selector and will be flagged. Default: <strong>65</strong> (no data-testid, id, or aria-label).
    </div>
  </div>
</div>

<div id="elemDetailOverlay" class="elem-detail-overlay" hidden></div>

<script>
(function () {
  'use strict';

  const form        = document.getElementById('lintForm');
  const runBtn      = document.getElementById('runBtn');
  const configInput = document.getElementById('configPath');
  const threshInput = document.getElementById('threshold');
  const threshLabel = document.getElementById('thresholdLabel');
  const statusEl    = document.getElementById('status');
  const errorEl     = document.getElementById('errorMsg');
  const statsBar    = document.getElementById('statsBar');
  const content     = document.getElementById('content');
  const placeholder = document.getElementById('placeholder');
  const fixCheck    = document.getElementById('fixCheck');
  const prCheck     = document.getElementById('prCheck');

  // Live threshold label
  threshInput.addEventListener('input', () => {
    threshLabel.textContent = 'score < ' + (threshInput.value || '65');
  });

  // PR checkbox requires fix checkbox
  fixCheck.addEventListener('change', () => {
    prCheck.disabled = !fixCheck.checked;
    if (!fixCheck.checked) prCheck.checked = false;
  });

  // ── Run ──────────────────────────────────────────────────────────────────
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    runBtn.disabled = true;
    statusEl.innerHTML = '<span class="spinner"></span> Running lint\u2026';
    errorEl.hidden  = true;
    statsBar.hidden = true;
    content.innerHTML = '';

    const body = {
      configPath: configInput.value.trim() || 'selfcure.config.mjs',
      threshold:  Number(threshInput.value) || 65,
      fix:        fixCheck.checked,
      pr:         prCheck.checked && fixCheck.checked,
    };

    try {
      const res = await fetch('/api/lint', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lint failed');
      render(data, body.threshold);
    } catch (err) {
      errorEl.textContent = String(err.message || err);
      errorEl.hidden = false;
    } finally {
      runBtn.disabled = false;
      statusEl.textContent = '';
    }
  });

  // ── Render results ────────────────────────────────────────────────────────
  function scoreClass(s) { return s < 35 ? 'low' : s < 65 ? 'mid' : ''; }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function render(data, threshold) {
    const { issues, totalFiles, fixedCount, skippedCount, prUrl } = data;

    // ── Stats ──────────────────────────────────────────────────────────────
    const statFiles   = document.getElementById('statFiles');
    const statIssues  = document.getElementById('statIssues');
    const statFixed   = document.getElementById('statFixed');
    const statSkipped = document.getElementById('statSkipped');

    statFiles.textContent   = totalFiles;
    statFiles.className     = 'stat-value';

    statIssues.textContent  = issues.length;
    statIssues.className    = 'stat-value ' + (issues.length === 0 ? 'ok' : issues.length > 10 ? 'bad' : 'warn');

    statFixed.textContent   = fixedCount;
    statFixed.className     = 'stat-value ' + (fixedCount > 0 ? 'ok' : '');

    statSkipped.textContent = skippedCount;
    statSkipped.className   = 'stat-value ' + (skippedCount > 0 ? 'warn' : '');

    statsBar.hidden = false;

    // ── All-clear ──────────────────────────────────────────────────────────
    if (issues.length === 0) {
      content.innerHTML =
        '<div class="all-clear">' +
          '<div class="all-clear-icon">&#10003;</div>' +
          '<div class="all-clear-title">No issues found</div>' +
          '<div class="all-clear-body">' + totalFiles + ' file(s) scanned &mdash; ' +
          'all elements have a testability score &ge; ' + threshold + '.</div>' +
        '</div>';
      return;
    }

    // ── Group by file ──────────────────────────────────────────────────────
    const byFile = new Map();
    for (const issue of issues) {
      if (!byFile.has(issue.filePath)) byFile.set(issue.filePath, []);
      byFile.get(issue.filePath).push(issue);
    }

    let html = '';

    // PR banner
    if (prUrl) {
      html +=
        '<div class="pr-banner">' +
          '<div class="pr-banner-icon">&#128279;</div>' +
          '<div class="pr-banner-text">' +
            'PR opened: <a class="pr-banner-link" href="' + esc(prUrl) + '" target="_blank" rel="noreferrer">' +
            esc(prUrl) + '</a>' +
          '</div>' +
        '</div>';
    }

    html += '<div style="margin-bottom:12px;font-size:13px;color:var(--muted)">' +
      issues.length + ' issue(s) across ' + byFile.size + ' file(s) &nbsp;&middot;&nbsp; ' +
      'threshold: <strong>' + threshold + '</strong>/100' +
      '</div>';

    for (const [filePath, fileIssues] of byFile) {
      html +=
        '<div class="file-group">' +
          '<div class="file-header">' +
            '<span class="file-icon">&#128196;</span>' +
            '<span class="file-path">' + esc(filePath) + '</span>' +
            '<span class="file-count">' + fileIssues.length + '</span>' +
          '</div>';

      for (const issue of fileIssues) {
        const score     = issue.element.testabilityScore;
        const sClass    = scoreClass(score);
        const selector  = issue.element.selector || issue.element.selectors?.css || '';
        const patched   = issue.fixApplied === true;

        html +=
          '<div class="issue-row' + (patched ? ' patched' : '') + '">' +
            '<span class="issue-type">' + esc(issue.element.type) + '</span>' +
            '<span class="issue-selector" title="' + esc(selector) + '">' + esc(selector) + '</span>' +
            '<span class="issue-score ' + sClass + '">' + score + '/100</span>' +
            '<span class="issue-suggestion">' +
              (patched
                ? '<span class="issue-patch-note">&#10003; patched</span>'
                : 'add <span class="testid-chip">data-testid=&quot;' + esc(issue.suggestedTestId) + '&quot;</span>') +
            '</span>' +
          '</div>';
      }

      html += '</div>'; // .file-group
    }

    // ── Summary bar ──────────────────────────────────────────────────────
    html += '<div class="summary-bar">';
    if (fixedCount > 0) {
      html += '<span class="summary-ok">&#10003; ' + fixedCount + ' element(s) patched</span>';
      if (skippedCount > 0) {
        html += '<span class="summary-info">&nbsp;&middot;&nbsp; ' + skippedCount + ' skipped (no unique id/name/aria-label)</span>';
      }
    } else if (!fixCheck.checked) {
      html +=
        '<span class="summary-pro">&#9670; Enable Auto-fix (Pro) to inject data-testid into source files</span>';
    }
    html += '</div>';

    content.innerHTML = html;
  }
})();
</script>
</body>
</html>
`;
