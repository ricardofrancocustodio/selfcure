// ---------------------------------------------------------------------------
// selfcure lint — web page  (GitHub "Files changed" style)
// Layout: sticky file sidebar + collapsible diff cards per file.
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
      /* GitHub light palette */
      --bg:          #ffffff;
      --canvas:      #f6f8fa;
      --canvas-sub:  #eaeef2;
      --text:        #1f2328;
      --muted:       #656d76;
      --border:      #d0d7de;
      --border-hi:   #afb8c1;
      --accent:      #0969da;
      --success:     #1a7f37;
      --success-bg:  #dafbe1;
      --success-em:  #acf2bd;
      --warning:     #9a6700;
      --warning-bg:  #fff8c5;
      --error:       #cf222e;
      --error-bg:    #ffebe9;
      --error-em:    #ffd7d5;
      --hunk-bg:     #ddf4ff;
      --hunk-ln:     #b6e3ff;
      --hunk-text:   #0550ae;
      --del-bg:      #ffebe9;
      --del-ln:      #ffd7d5;
      --del-mk:      #cf222e;
      --add-bg:      #dafbe1;
      --add-ln:      #acf2bd;
      --add-mk:      #1a7f37;
      --pro:         #8250df;
      --pro-bg:      #fbefff;
      --pro-bdr:     #d8b9f8;
      --sc-low:      #cf222e;
      --sc-mid:      #9a6700;
      --sc-hi:       #1a7f37;
      --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
      --nav-h: 44px;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg:          #0d1117;
        --canvas:      #161b22;
        --canvas-sub:  #21262d;
        --text:        #e6edf3;
        --muted:       #7d8590;
        --border:      #30363d;
        --border-hi:   #6e7681;
        --accent:      #4493f8;
        --success:     #3fb950;
        --success-bg:  #0f2c18;
        --success-em:  #196c2e;
        --warning:     #d29922;
        --warning-bg:  #2d1f00;
        --error:       #f85149;
        --error-bg:    #2d0f0f;
        --error-em:    #6e2020;
        --hunk-bg:     #0c2d6b;
        --hunk-ln:     #0c2d6b;
        --hunk-text:   #79c0ff;
        --del-bg:      #2d0f0f;
        --del-ln:      #6e2020;
        --del-mk:      #f85149;
        --add-bg:      #0f2c18;
        --add-ln:      #196c2e;
        --add-mk:      #3fb950;
        --pro:         #a371f7;
        --pro-bg:      #1e1533;
        --pro-bdr:     #6e40c9;
        --sc-low:      #f85149;
        --sc-mid:      #d29922;
        --sc-hi:       #3fb950;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--sans); font-size: 14px; line-height: 1.5; -webkit-font-smoothing: antialiased; }

    /* ── Nav ─────────────────────────────────────────────────────────────── */
    nav { position: sticky; top: 0; z-index: 200; display: flex; align-items: center; gap: 4px; padding: 0 16px; background: var(--canvas); border-bottom: 1px solid var(--border); height: var(--nav-h); }
    .nav-brand { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); text-decoration: none; margin-right: 8px; }
    .nav-sep { color: var(--border-hi); margin: 0 2px; }
    .nav-link { font-size: 13px; padding: 4px 10px; border-radius: 6px; color: var(--muted); text-decoration: none; transition: background 100ms, color 100ms; }
    .nav-link:hover { background: var(--canvas-sub); color: var(--text); }
    .nav-link.active { background: var(--canvas-sub); color: var(--text); font-weight: 600; }

    /* ── Run bar ─────────────────────────────────────────────────────────── */
    .run-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg); }
    .run-bar label { font-size: 12px; color: var(--muted); white-space: nowrap; }
    .run-bar input[type="text"] { flex: 1; min-width: 180px; font-family: var(--mono); font-size: 12px; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; }
    .run-bar input[type="text"]:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(9,105,218,0.12); }
    .thr-wrap { display: flex; align-items: center; gap: 6px; }
    .thr-wrap input[type="number"] { width: 58px; text-align: center; font-family: var(--mono); font-size: 12px; color: var(--text); background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: 5px 8px; }
    .thr-wrap input[type="number"]:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(9,105,218,0.12); }
    .btn { display: inline-flex; align-items: center; gap: 6px; font-family: var(--sans); font-size: 13px; font-weight: 500; padding: 6px 14px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; transition: filter 100ms; white-space: nowrap; }
    .btn-run { background: var(--success); color: #fff; border-color: rgba(27,31,36,0.15); }
    .btn-run:hover { filter: brightness(0.9); }
    .btn-run:disabled { opacity: 0.55; cursor: not-allowed; }
    .run-status { font-size: 12px; color: var(--muted); }
    .run-error { font-size: 12px; color: var(--error); background: var(--error-bg); border: 1px solid var(--error); border-radius: 6px; padding: 4px 10px; }

    /* ── Pro bar ─────────────────────────────────────────────────────────── */
    .pro-bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; padding: 8px 16px; background: var(--pro-bg); border-bottom: 1px solid var(--pro-bdr); }
    .pro-label { font-size: 11px; font-weight: 700; color: var(--pro); text-transform: uppercase; letter-spacing: 0.08em; }
    .pro-opt { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; }
    .pro-opt input { cursor: pointer; accent-color: var(--pro); }
    .pro-hint { font-size: 12px; color: var(--muted); }

    /* ── Diff summary bar ───────────────────────────────────────────────── */
    .diff-sum { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 10px 16px; border-bottom: 1px solid var(--border); font-size: 13px; background: var(--bg); }
    .ds-stat { font-weight: 600; }
    .ds-stat.red   { color: var(--error); }
    .ds-stat.green { color: var(--success); }
    .ds-sep { color: var(--border-hi); }
    .sq-row { display: inline-flex; gap: 2px; align-items: center; }
    .sq { width: 10px; height: 10px; border-radius: 2px; }
    .sq.s-del   { background: var(--error); }
    .sq.s-ok    { background: var(--success); }
    .sq.s-empty { background: var(--border-hi); opacity: 0.35; }
    .btn-ghost { margin-left: auto; background: none; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--muted); padding: 4px 10px; cursor: pointer; }
    .btn-ghost:hover { background: var(--canvas-sub); color: var(--text); }

    /* ── Page layout ─────────────────────────────────────────────────────── */
    .page-wrap { display: flex; align-items: flex-start; }

    /* ── File sidebar ────────────────────────────────────────────────────── */
    .file-sidebar { width: 256px; flex-shrink: 0; border-right: 1px solid var(--border); position: sticky; top: var(--nav-h); max-height: calc(100vh - var(--nav-h)); overflow-y: auto; background: var(--bg); }
    .sb-head { padding: 10px 12px; font-size: 11px; font-weight: 700; color: var(--muted); text-transform: uppercase; letter-spacing: 0.07em; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; }
    .sb-filter { padding: 8px 10px; border-bottom: 1px solid var(--border); }
    .sb-filter input { width: 100%; font-size: 12px; padding: 4px 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
    .sb-filter input:focus { outline: none; border-color: var(--accent); }
    .fn-item { display: flex; align-items: center; gap: 8px; padding: 7px 12px; text-decoration: none; border-left: 3px solid transparent; transition: background 80ms; }
    .fn-item:hover { background: var(--canvas-sub); border-left-color: var(--border-hi); }
    .fn-name { flex: 1; font-size: 12px; font-family: var(--mono); color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .fn-badge { font-size: 11px; font-weight: 600; border-radius: 20px; padding: 1px 7px; }
    .fn-badge.err { color: var(--error);   background: var(--error-bg); }
    .fn-badge.ok  { color: var(--success); background: var(--success-bg); }

    /* ── Diff content area ───────────────────────────────────────────────── */
    .diff-area { flex: 1; min-width: 0; padding: 16px 16px 60px; }

    /* ── Diff card (per file) ────────────────────────────────────────────── */
    .diff-card { border: 1px solid var(--border); border-radius: 6px; margin-bottom: 16px; overflow: hidden; }
    .diff-head { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--canvas); border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; }
    .diff-head:hover { background: var(--canvas-sub); }
    .caret { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 10px; padding: 2px 4px; line-height: 1; flex-shrink: 0; }
    .diff-fp { flex: 1; font-family: var(--mono); font-size: 12px; }
    .diff-fp-dir  { color: var(--muted); }
    .diff-fp-name { color: var(--text); font-weight: 600; }
    .issue-pill { font-size: 11px; font-weight: 600; border-radius: 20px; padding: 2px 9px; white-space: nowrap; border: 1px solid; }
    .issue-pill.open    { color: var(--error);   background: var(--error-bg);   border-color: rgba(207,34,46,0.3); }
    .issue-pill.patched { color: var(--success); background: var(--success-bg); border-color: rgba(26,127,55,0.3); }
    .card-btn { background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font-size: 11px; padding: 3px 8px; cursor: pointer; white-space: nowrap; }
    .card-btn:hover { background: var(--canvas-sub); color: var(--text); border-color: var(--border-hi); }
    .diff-body.collapsed { display: none; }

    /* ── Diff table ──────────────────────────────────────────────────────── */
    .diff-tbl { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 12px; line-height: 1.6; }
    .diff-tbl tbody + tbody { border-top: 1px solid var(--border); }
    .ln { width: 44px; min-width: 44px; text-align: right; padding: 2px 10px 2px 8px; color: var(--muted); user-select: none; vertical-align: top; opacity: 0.7; }
    .mk { width: 22px; min-width: 22px; text-align: center; padding: 2px 4px; font-weight: 700; vertical-align: top; user-select: none; }
    .cd { padding: 2px 14px 2px 8px; vertical-align: top; }
    /* hunk */
    .r-hunk .ln { background: var(--hunk-ln); }
    .r-hunk .mk { background: var(--hunk-ln); color: var(--hunk-text); }
    .r-hunk .cd { background: var(--hunk-bg); color: var(--hunk-text); white-space: normal; }
    /* del */
    .r-del .ln { background: var(--del-ln); }
    .r-del .mk { background: var(--del-ln); color: var(--del-mk); }
    .r-del .cd { background: var(--del-bg); color: var(--error); }
    /* add */
    .r-add .ln { background: var(--add-ln); }
    .r-add .mk { background: var(--add-ln); color: var(--add-mk); }
    .r-add .cd { background: var(--add-bg); color: var(--success); font-weight: 500; }
    /* detail */
    .r-detail .ln { background: var(--bg); }
    .r-detail .mk { background: var(--bg); color: var(--muted); font-size: 10px; }
    .r-detail .cd { background: var(--bg); padding-top: 5px; padding-bottom: 5px; }
    /* hunk inline */
    .h-type { display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 20px; margin-right: 6px; background: rgba(9,105,218,0.12); color: var(--accent); }
    .h-score { font-weight: 700; margin: 0 3px; }
    .h-score.low { color: var(--sc-low); }
    .h-score.mid { color: var(--sc-mid); }
    .h-score.hi  { color: var(--sc-hi);  }
    .pips { display: inline-flex; gap: 2px; margin: 0 4px; vertical-align: middle; }
    .pip { display: inline-block; width: 8px; height: 8px; border-radius: 1px; }
    .pip.low-f { background: var(--sc-low); }
    .pip.mid-f { background: var(--sc-mid); }
    .pip.hi-f  { background: var(--sc-hi); }
    .pip.empty { background: var(--border-hi); opacity: 0.35; }
    .h-comp { opacity: 0.75; font-size: 11px; }
    .h-acts { opacity: 0.65; font-size: 11px; margin-left: 4px; }
    /* strategy tags */
    .stag { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle; }
    .stag-ok  { background: rgba(26,127,55,0.1);  color: var(--success); border: 1px solid rgba(26,127,55,0.25); }
    .stag-mid { background: rgba(154,103,0,0.1);  color: var(--warning); border: 1px solid rgba(154,103,0,0.25); }
    .stag-bad { background: rgba(207,34,46,0.1);  color: var(--error);   border: 1px solid rgba(207,34,46,0.25); }
    /* selector candidates */
    .cands { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 3px 0; }
    .cands-lbl { font-size: 11px; color: var(--muted); flex-shrink: 0; }
    .cand { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 2px 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--canvas); }
    .cand .cs { color: var(--muted); font-size: 10px; }
    .cand .cv { color: var(--text); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cand .csc { font-weight: 700; margin-left: 3px; font-size: 10px; }
    .cand.c-ok  { background: var(--success-bg); border-color: rgba(26,127,55,0.35); }
    .cand.c-mid { background: var(--warning-bg); border-color: rgba(154,103,0,0.35); }
    .cand.c-bad { background: var(--error-bg);   border-color: rgba(207,34,46,0.35); }
    .cand-miss  { opacity: 0.65; font-style: italic; }
    /* states */
    .state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 12px; text-align: center; }
    .state-icon  { font-size: 42px; }
    .state-title { font-size: 15px; font-weight: 600; }
    .state-body  { font-size: 13px; color: var(--muted); max-width: 380px; }
    .state-ok .state-title { color: var(--success); }
    /* PR banner */
    .pr-banner { display: flex; align-items: center; gap: 10px; background: var(--success-bg); border: 1px solid var(--success); border-radius: 6px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; }
    .pr-banner a { color: var(--accent); font-weight: 600; }
    /* spinner */
    .spinner { display: inline-block; width: 12px; height: 12px; border: 2px solid var(--border-hi); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; }
    @keyframes spin { to { transform: rotate(360deg); } }
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

<form id="lintForm"><div class="run-bar">
  <label for="configPath">Config</label>
  <input id="configPath" type="text" value="selfcure.config.mjs" autocomplete="off" spellcheck="false">
  <div class="thr-wrap">
    <label for="threshold">Threshold</label>
    <input id="threshold" type="number" min="1" max="100" value="65">
    <span id="thrLabel" style="font-size:12px;color:var(--muted)">score &lt; 65</span>
  </div>
  <button class="btn btn-run" type="submit" id="runBtn">
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3 2.5a.5.5 0 0 1 .765-.424l10 5.5a.5.5 0 0 1 0 .848l-10 5.5A.5.5 0 0 1 3 13.5z"/>
    </svg>
    Run lint
  </button>
  <span id="runStatus" class="run-status" role="status"></span>
  <span id="errorMsg" class="run-error" role="alert" hidden></span>
</div></form>

<div class="pro-bar">
  <span class="pro-label">&#9670; Pro</span>
  <label class="pro-opt">
    <input type="checkbox" id="fixCheck">
    <span>Auto-fix</span>
    <span class="pro-hint">— inject data-testid into source files</span>
  </label>
  <label class="pro-opt">
    <input type="checkbox" id="prCheck" disabled>
    <span>Open GitHub PR</span>
    <span class="pro-hint">— requires Auto-fix</span>
  </label>
</div>

<div id="diffSum" class="diff-sum" hidden>
  <span id="sumFiles" class="ds-stat">—</span>
  <span class="ds-sep">files &nbsp;·&nbsp;</span>
  <span id="sumIssues" class="ds-stat red">—</span>
  <span class="ds-sep">issues</span>
  <span id="sumFixed" class="ds-stat green"></span>
  <div id="sqRow" class="sq-row"></div>
  <button id="toggleAll" class="btn-ghost">Collapse all</button>
</div>

<div class="page-wrap">
  <aside id="sidebar" class="file-sidebar" hidden>
    <div class="sb-head">
      <span>Jump to file</span>
      <span id="sbCount" style="font-weight:400"></span>
    </div>
    <div class="sb-filter">
      <input id="fileFilter" type="text" placeholder="Filter files…">
    </div>
    <div id="navList"></div>
  </aside>
  <div id="diffArea" class="diff-area">
    <div id="placeholder" class="state">
      <div class="state-icon">&#128270;</div>
      <div class="state-title">Ready to lint</div>
      <div class="state-body">
        Threshold (1–100): elements scoring below this are flagged as having no stable selector.
        Default <strong>65</strong> — those without data-testid, id, or aria-label.
      </div>
    </div>
  </div>
</div>

<script>
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const form      = $('lintForm');
  const runBtn    = $('runBtn');
  const cfgInput  = $('configPath');
  const thrInput  = $('threshold');
  const thrLabel  = $('thrLabel');
  const runStatus = $('runStatus');
  const errorMsg  = $('errorMsg');
  const fixCheck  = $('fixCheck');
  const prCheck   = $('prCheck');
  const diffSum   = $('diffSum');
  const sumFiles  = $('sumFiles');
  const sumIssues = $('sumIssues');
  const sumFixed  = $('sumFixed');
  const sqRow     = $('sqRow');
  const toggleAll = $('toggleAll');
  const sidebar   = $('sidebar');
  const sbCount   = $('sbCount');
  const navList   = $('navList');
  const fileFilter= $('fileFilter');
  const diffArea  = $('diffArea');

  let allExpanded = true;

  thrInput.addEventListener('input', () => {
    thrLabel.textContent = 'score < ' + (thrInput.value || '65');
  });

  fixCheck.addEventListener('change', () => {
    prCheck.disabled = !fixCheck.checked;
    if (!fixCheck.checked) prCheck.checked = false;
  });

  toggleAll.addEventListener('click', () => {
    allExpanded = !allExpanded;
    document.querySelectorAll('.diff-body').forEach(b => b.classList.toggle('collapsed', !allExpanded));
    document.querySelectorAll('.caret').forEach(c => { c.textContent = allExpanded ? '\u25bc' : '\u25b6'; });
    toggleAll.textContent = allExpanded ? 'Collapse all' : 'Expand all';
  });

  fileFilter.addEventListener('input', () => {
    const q = fileFilter.value.toLowerCase();
    document.querySelectorAll('.fn-item').forEach(it => {
      it.style.display = it.dataset.fp.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    runBtn.disabled = true;
    runStatus.innerHTML = '<span class="spinner"></span> Running\u2026';
    errorMsg.hidden = true;
    diffSum.hidden  = true;
    sidebar.hidden  = true;
    diffArea.innerHTML = '';

    const body = {
      configPath: cfgInput.value.trim() || 'selfcure.config.mjs',
      threshold:  Number(thrInput.value) || 65,
      fix:  fixCheck.checked,
      pr:   prCheck.checked && fixCheck.checked,
    };

    try {
      const res  = await fetch('/api/lint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lint failed');
      render(data, body.threshold);
    } catch (err) {
      errorMsg.textContent = String(err.message || err);
      errorMsg.hidden = false;
    } finally {
      runBtn.disabled  = false;
      runStatus.textContent = '';
    }
  });

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function scCls(n)  { return n < 35 ? 'low' : n < 65 ? 'mid' : 'hi'; }
  function pips(score) {
    const f = Math.round(score / 10), c = scCls(score);
    let s = '<span class="pips">';
    for (let i = 0; i < 10; i++) s += '<span class="pip ' + (i < f ? c + '-f' : 'empty') + '"></span>';
    return s + '</span>';
  }
  function stratCls(st) {
    return ['data-testid','aria-label','id','name'].includes(st) ? 'stag-ok' : 'stag-bad';
  }
  function splitFp(fp) {
    const parts = fp.replace(/\\/g, '/').split('/');
    const name  = parts.pop();
    return { dir: parts.length ? parts.join('/') + '/' : '', name };
  }

  /* ── render ──────────────────────────────────────────────────────────── */
  function render(data, threshold) {
    const { issues, totalFiles, fixedCount, prUrl } = data;

    sumFiles.textContent  = totalFiles;
    sumIssues.textContent = issues.length;
    sumFixed.textContent  = fixedCount > 0 ? '(' + fixedCount + ' patched)' : '';

    /* score squares — proportion of flagged files */
    const rc = Math.max(0, Math.min(10, Math.round(10 * issues.length / Math.max(totalFiles, 1))));
    let sv = '';
    for (let i = 0; i < 10; i++) sv += '<span class="sq ' + (i < rc ? 's-del' : 's-empty') + '"></span>';
    sqRow.innerHTML = sv;
    diffSum.hidden  = false;
    allExpanded     = true;
    toggleAll.textContent = 'Collapse all';

    if (issues.length === 0) {
      diffArea.innerHTML =
        '<div class="state state-ok">' +
          '<div class="state-icon">&#10003;</div>' +
          '<div class="state-title">No issues found</div>' +
          '<div class="state-body">' + totalFiles + ' file(s) scanned \u2014 all elements score \u2265 ' + threshold + '/100.</div>' +
        '</div>';
      sidebar.hidden = true;
      return;
    }

    /* group by file */
    const byFile = new Map();
    for (const issue of issues) {
      if (!byFile.has(issue.filePath)) byFile.set(issue.filePath, []);
      byFile.get(issue.filePath).push(issue);
    }

    /* sidebar */
    let nav = '', idx = 0;
    for (const [fp, fi] of byFile) {
      const { name } = splitFp(fp);
      const allOk    = fi.every(i => i.fixApplied);
      nav +=
        '<a class="fn-item" href="#f' + idx + '" data-fp="' + esc(fp) + '">' +
          '<span class="fn-name" title="' + esc(fp) + '">' + esc(name) + '</span>' +
          '<span class="fn-badge ' + (allOk ? 'ok' : 'err') + '">' + fi.length + '</span>' +
        '</a>';
      idx++;
    }
    navList.innerHTML = nav;
    sbCount.textContent = byFile.size + ' file' + (byFile.size !== 1 ? 's' : '');
    sidebar.hidden = false;

    /* diff cards */
    let html = '';
    if (prUrl) html += '<div class="pr-banner">&#128279; PR: <a href="' + esc(prUrl) + '" target="_blank" rel="noreferrer">' + esc(prUrl) + '</a></div>';

    idx = 0;
    for (const [fp, fi] of byFile) {
      const { dir, name } = splitFp(fp);
      const allOk = fi.every(i => i.fixApplied);
      const cnt   = fi.length;

      html +=
        '<div class="diff-card" id="f' + idx + '">' +
        '<div class="diff-head" onclick="toggleCard(this)">' +
          '<button class="caret" aria-label="collapse">&#9660;</button>' +
          '<span class="diff-fp">' +
            '<span class="diff-fp-dir">'  + esc(dir)  + '</span>' +
            '<span class="diff-fp-name">' + esc(name) + '</span>' +
          '</span>' +
          '<span class="issue-pill ' + (allOk ? 'patched' : 'open') + '">' +
            (allOk ? '&#10003; ' : '') + cnt + ' issue' + (cnt !== 1 ? 's' : '') +
          '</span>' +
          '<button class="card-btn" onclick="copyFp(event,' + JSON.stringify(fp).replace(/"/g, '&quot;') + ')">&#8984; Copy path</button>' +
        '</div>' +
        '<div class="diff-body">' +
        '<table class="diff-tbl">';

      let ln = 1;
      for (const issue of fi) {
        const el      = issue.element;
        const score   = el.testabilityScore;
        const cls     = scCls(score);
        const sel     = el.selector || el.selectors?.cssSelector || '';
        const acts    = (el.actions || []).join(', ') || 'click';
        const ranking = el.selectorRanking || [];
        const patched = issue.fixApplied === true;
        const bestSt  = ranking[0] ? ranking[0].strategy : 'css';
        const sTagCls = stratCls(bestSt);
        const hasTestid = ranking.some(r => r.strategy === 'data-testid');

        /* hunk */
        html +=
          '<tbody>' +
          '<tr class="r-hunk">' +
            '<td class="ln" colspan="2">@@</td>' +
            '<td class="cd">' +
              '<span class="h-type">' + esc(el.type) + '</span>' +
              pips(score) +
              '<span class="h-score ' + cls + '">' + score + '/100</span>' +
              (el.label ? ' &middot; <em>' + esc(el.label) + '</em>' : '') +
              ' &middot; <span class="h-comp">' + esc(issue.componentName) + '</span>' +
              '<span class="h-acts"> &middot; ' + esc(acts) + '</span>' +
            ' @@</td>' +
          '</tr>';

        /* del — current best selector */
        html +=
          '<tr class="r-del">' +
            '<td class="ln">' + ln + '</td>' +
            '<td class="mk">-</td>' +
            '<td class="cd">' +
              esc(sel) +
              '<span class="stag ' + sTagCls + '">' + esc(bestSt) + '</span>' +
            '</td>' +
          '</tr>';

        /* detail — all selector candidates */
        let candsHtml = '<div class="cands"><span class="cands-lbl">Selectors:</span>';
        for (const c of ranking.slice(0, 6)) {
          const cc = c.score >= 70 ? 'c-ok' : c.score >= 40 ? 'c-mid' : 'c-bad';
          candsHtml +=
            '<span class="cand ' + cc + '">' +
              '<span class="cs">' + esc(c.strategy) + '</span>' +
              '<span class="cv" title="' + esc(c.value) + '">' + esc(c.value) + '</span>' +
              '<span class="csc">' + c.score + '</span>' +
            '</span>';
        }
        if (!hasTestid) {
          candsHtml += '<span class="cand c-bad cand-miss"><span class="cs">data-testid</span><span class="cv">not found</span></span>';
        }
        candsHtml += '</div>';
        html +=
          '<tr class="r-detail">' +
            '<td class="ln"></td>' +
            '<td class="mk" style="color:var(--muted)">&#8597;</td>' +
            '<td class="cd">' + candsHtml + '</td>' +
          '</tr>';

        /* add — suggested fix */
        if (patched) {
          html +=
            '<tr class="r-add">' +
              '<td class="ln">' + (ln + 1) + '</td>' +
              '<td class="mk">+</td>' +
              '<td class="cd">&#10003; patched &mdash; data-testid=&quot;' + esc(issue.suggestedTestId) + '&quot;<span class="stag stag-ok">applied</span></td>' +
            '</tr>';
        } else {
          html +=
            '<tr class="r-add">' +
              '<td class="ln">' + (ln + 1) + '</td>' +
              '<td class="mk">+</td>' +
              '<td class="cd">data-testid=&quot;' + esc(issue.suggestedTestId) + '&quot;<span class="stag stag-ok">suggested</span></td>' +
            '</tr>';
        }

        html += '</tbody>';
        ln += 2;
      }

      html += '</table></div></div>';
      idx++;
    }

    diffArea.innerHTML = html;
  }

  window.toggleCard = function (hd) {
    const body = hd.nextElementSibling;
    const btn  = hd.querySelector('.caret');
    const c    = body.classList.toggle('collapsed');
    btn.textContent = c ? '\u25b6' : '\u25bc';
  };

  window.copyFp = function (e, fp) {
    e.stopPropagation();
    navigator.clipboard.writeText(fp).catch(() => {});
    const btn  = e.currentTarget;
    const orig = btn.innerHTML;
    btn.textContent = '\u2713 Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  };

})();
</script>
</body>
</html>
`;

