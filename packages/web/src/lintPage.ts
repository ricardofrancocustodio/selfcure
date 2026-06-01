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
    .diff-card { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 40px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .diff-head { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--canvas); border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; }
    .diff-head:hover { background: var(--canvas-sub); }
    .caret { background: none; border: none; cursor: pointer; color: var(--muted); font-size: 10px; padding: 2px 4px; line-height: 1; flex-shrink: 0; }
    .diff-fp { flex: 1; font-family: var(--mono); font-size: 12px; min-width: 0; }
    .diff-fp-dir  { color: var(--muted); font-size: 11px; }
    .diff-fp-name { color: var(--text); font-weight: 700; font-size: 13px; }
    .issue-pill { font-size: 11px; font-weight: 600; border-radius: 20px; padding: 3px 10px; white-space: nowrap; border: 1px solid; }
    .issue-pill.open    { color: var(--error);   background: var(--error-bg);   border-color: rgba(207,34,46,0.3); }
    .issue-pill.patched { color: var(--success); background: var(--success-bg); border-color: rgba(26,127,55,0.3); }
    .card-btn { background: none; border: 1px solid var(--border); border-radius: 6px; color: var(--muted); font-size: 11px; padding: 3px 8px; cursor: pointer; white-space: nowrap; }
    .card-btn:hover { background: var(--canvas-sub); color: var(--text); border-color: var(--border-hi); }
    .diff-body.collapsed { display: none; }

    /* ── Diff table ──────────────────────────────────────────────────────── */
    .diff-tbl { width: 100%; border-collapse: collapse; font-family: var(--mono); font-size: 12px; line-height: 1.6; }
    .ln { width: 44px; min-width: 44px; text-align: right; padding: 2px 10px 2px 8px; color: var(--muted); user-select: none; vertical-align: top; opacity: 0.7; }
    .mk { width: 26px; min-width: 26px; text-align: center; padding: 2px 4px; font-weight: 700; vertical-align: top; user-select: none; font-size: 14px; }
    .cd { padding: 4px 14px 4px 10px; vertical-align: top; }
    /* hunk */
    .r-hunk .ln { background: var(--hunk-ln); }
    .r-hunk .mk { background: var(--hunk-ln); color: var(--hunk-text); }
    .r-hunk .cd { background: var(--hunk-bg); color: var(--hunk-text); white-space: normal; padding: 8px 14px 8px 10px; }
    /* del */
    .r-del .ln { background: var(--del-ln); }
    .r-del .mk { background: var(--del-ln); color: var(--del-mk); }
    .r-del .cd { background: var(--del-bg); color: var(--error); padding: 6px 14px 6px 10px; display: flex; align-items: baseline; gap: 0; }
    /* add */
    .r-add .ln { background: var(--add-ln); }
    .r-add .mk { background: var(--add-ln); color: var(--add-mk); }
    .r-add .cd { background: var(--add-bg); color: var(--success); font-weight: 500; padding: 6px 14px 6px 10px; display: flex; align-items: baseline; }
    /* detail */
    .r-detail .ln { background: var(--bg); }
    .r-detail .mk { background: var(--bg); color: var(--muted); font-size: 10px; }
    .r-detail .cd { background: var(--canvas); padding: 8px 14px 8px 10px; border-top: 1px dashed var(--border); border-bottom: 1px dashed var(--border); }
    /* hunk inline */
    .h-type { display: inline-flex; align-items: center; font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 20px; background: rgba(9,105,218,0.15); color: var(--accent); border: 1px solid rgba(9,105,218,0.2); }
    .h-score { font-weight: 700; margin: 0 4px; }
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
    .h-acts { opacity: 0.65; font-size: 11px; }
    /* strategy tags */
    .stag { display: inline-block; font-size: 10px; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle; }
    .stag-ok  { background: rgba(26,127,55,0.1);  color: var(--success); border: 1px solid rgba(26,127,55,0.25); }
    .stag-mid { background: rgba(154,103,0,0.1);  color: var(--warning); border: 1px solid rgba(154,103,0,0.25); }
    .stag-bad { background: rgba(207,34,46,0.1);  color: var(--error);   border: 1px solid rgba(207,34,46,0.25); }
    /* row labels (Current / Fix) */
    .row-lbl { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; margin-right: 10px; width: 52px; flex-shrink: 0; }
    .r-del .row-lbl { color: var(--del-mk); }
    .r-add .row-lbl { color: var(--add-mk); }
    /* hunk element info lines */
    .h-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .h-bot { margin-top: 3px; font-size: 11px; color: var(--hunk-text); opacity: 0.8; padding-left: 2px; }
    /* issue group separator */
    .diff-tbl tbody { border-top: 2px solid var(--border); }
    .diff-tbl tbody:first-child { border-top: none; }
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
    /* tag syntax highlight */
    .tag-disp { font-family: var(--mono); font-size: 12px; line-height: 1.5; word-break: break-all; }
    .tok-bracket { color: var(--muted); }
    .tok-tag  { color: var(--accent); font-weight: 700; }
    .tok-attr { color: var(--text); opacity: 0.85; }
    .tok-val  { color: var(--warning); }
    .tok-text { color: var(--muted); font-style: italic; }
    .tok-new  { color: var(--add-mk); font-weight: 700; background: rgba(26,127,55,0.18); border-radius: 3px; padding: 0 3px; }
    .r-del .tok-tag { color: var(--del-mk); }
    .r-del .tok-bracket { color: var(--del-mk); opacity: 0.5; }
    /* states */
    .state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 12px; text-align: center; }
    .state-icon  { font-size: 42px; }
    .state-title { font-size: 15px; font-weight: 600; }
    .state-body  { font-size: 13px; color: var(--muted); max-width: 380px; }
    .state-ok .state-title { color: var(--success); }
    /* PR action bar — primary CTA after lint runs */
    .pr-action { position: sticky; top: var(--nav-h); z-index: 150; display: flex; align-items: center; gap: 14px; padding: 10px 16px; background: var(--success-bg); border-bottom: 1px solid rgba(26,127,55,0.35); }
    .pr-action-info { flex: 1; min-width: 0; }
    .pr-action-title { font-size: 13px; font-weight: 600; color: var(--text); }
    .pr-action-sub { font-size: 12px; color: var(--muted); margin-top: 2px; }
    .pr-action-sub code { background: var(--canvas-sub); padding: 1px 5px; border-radius: 3px; font-size: 11px; }
    .btn-open-pr { background: var(--success); color: #fff; border: none; border-radius: 6px; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
    .btn-open-pr:hover { opacity: 0.9; }
    .btn-open-pr:disabled { opacity: 0.5; cursor: not-allowed; }
    .pr-success { display: flex; align-items: center; gap: 10px; background: var(--success-bg); border: 1px solid var(--success); border-radius: 6px; padding: 12px 16px; margin: 16px 16px 0; font-size: 13px; }
    .pr-success a { color: var(--accent); font-weight: 600; }
    .pr-error { font-size: 12px; color: var(--error); background: var(--error-bg); border: 1px solid var(--error); border-radius: 6px; padding: 6px 12px; }
    /* checkboxes — issue / file / global */
    .issue-pick { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; margin-right: 8px; }
    .issue-pick input { cursor: pointer; accent-color: var(--success); width: 14px; height: 14px; }
    .file-pick { display: inline-flex; align-items: center; gap: 4px; cursor: pointer; user-select: none; margin-right: 10px; }
    .file-pick input { cursor: pointer; accent-color: var(--success); width: 14px; height: 14px; }
    .global-pick { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; margin-right: 6px; font-size: 12px; color: var(--muted); }
    .global-pick input { cursor: pointer; accent-color: var(--success); width: 14px; height: 14px; }
    tbody.r-unselected .cd { opacity: 0.4; }
    tbody.r-unselected .tag-disp { text-decoration: line-through; }
    /* sidebar selection feedback */
    .fn-item.fn-none .fn-name { opacity: 0.4; text-decoration: line-through; }
    .fn-badge.partial { color: var(--warning); background: var(--warning-bg); }
    .fn-badge.dim     { color: var(--muted);   background: var(--canvas-sub); }
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
  <a class="nav-link" href="/a11y">a11y</a>
  <a class="nav-link" href="/discovery">discovery</a>
  <a class="nav-link" href="/tml">TML</a>
  <a class="nav-link" href="/integrations">integrations</a>
</nav>

<!-- Lookup bar: URL → componente  OR  elemento HTML → arquivo -->
<div id="urlLookup" style="display:flex;align-items:flex-start;gap:8px;padding:8px 16px;background:var(--canvas);border-bottom:1px solid var(--border);">
  <span style="font-size:12px;color:var(--muted);white-space:nowrap;padding-top:6px">🔍 Buscar:</span>
  <textarea id="urlInput" rows="1" placeholder="Cole uma URL (/retail), OU cole o elemento HTML (&lt;button class=...&gt;) para achar o arquivo"
    style="flex:1;padding:6px 8px;font-size:12px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text);font-family:var(--mono);resize:vertical;min-height:32px;"
    autocomplete="off" spellcheck="false"></textarea>
  <button onclick="runLookup()" style="padding:6px 12px;font-size:12px;border-radius:6px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;white-space:nowrap">
    Buscar
  </button>
  <button onclick="clearLookup()" style="padding:6px 8px;font-size:12px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer">
    ✕
  </button>
</div>
<div id="urlResult" style="display:none;padding:10px 16px;background:var(--hunk-bg);border-bottom:1px solid var(--hunk-ln);font-size:12px;font-family:var(--mono);"></div>

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

<div id="prAction" class="pr-action" hidden>
  <div class="pr-action-info">
    <div class="pr-action-title">
      <span id="prSelInfo">0 of 0 issues selected</span>
    </div>
    <div class="pr-action-sub" id="prSubInfo">Pick which fixes go into the PR. We branch, commit, push and open it on GitHub in one shot.</div>
  </div>
  <span id="prInlineError" class="pr-error" role="alert" hidden></span>
  <button id="openPrBtn" class="btn-open-pr">
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z"/></svg>
    Open pull request
  </button>
</div>
<div id="prSuccess" hidden></div>

<div id="diffSum" class="diff-sum" hidden>
  <label class="global-pick" title="Select / deselect all issues">
    <input type="checkbox" id="globalPick" checked>
    <span id="globalLabel">All</span>
  </label>
  <span class="ds-sep" style="margin:0 2px">·</span>
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
// Global helpers (available to both IIFE and URL-lookup functions below)
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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

  const prAction       = $('prAction');
  const prSelInfo      = $('prSelInfo');
  const prSubInfo      = $('prSubInfo');
  const openPrBtn      = $('openPrBtn');
  const prInlineError  = $('prInlineError');
  const prSuccess      = $('prSuccess');
  const globalPick     = $('globalPick');
  const globalLabel    = $('globalLabel');

  let allExpanded = true;
  let lastResult  = null;
  let lastIsPro   = false;
  const selected  = new Set();
  const allKeys   = new Set();
  let prInFlight  = null;

  function issueKey(fp, tid) { return fp + '|' + tid; }
  function cssEsc(s) { return String(s).replace(/(["\\\\])/g, '\\\\$1'); }

  thrInput.addEventListener('input', () => {
    thrLabel.textContent = 'score < ' + (thrInput.value || '65');
  });

  toggleAll.addEventListener('click', () => {
    allExpanded = !allExpanded;
    document.querySelectorAll('.diff-body').forEach(b => b.classList.toggle('collapsed', !allExpanded));
    document.querySelectorAll('.caret').forEach(c => { c.textContent = allExpanded ? '▼' : '▶'; });
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
    runStatus.innerHTML = '<span class="spinner"></span> Running…';
    errorMsg.hidden     = true;
    diffSum.hidden      = true;
    sidebar.hidden      = true;
    prAction.hidden     = true;
    prSuccess.hidden    = true;
    prSuccess.innerHTML = '';
    diffArea.innerHTML  = '';
    selected.clear();
    allKeys.clear();

    const body = {
      configPath: cfgInput.value.trim() || 'selfcure.config.mjs',
      threshold:  Number(thrInput.value) || 65,
    };

    try {
      const res  = await fetch('/api/lint', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lint failed');
      lastResult = data;
      lastIsPro  = data.pro === true;
      render(data, body.threshold);
      maybeShowPrAction(data);
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
  function splitFp(fp) {
    const parts = fp.replace(/\\\\/g, '/').split('/');
    const name  = parts.pop();
    return { dir: parts.length ? parts.join('/') + '/' : '', name };
  }

  /* Build a syntax-highlighted tag snippet from element data.
     isFix=true adds data-testid as the first (highlighted) attribute. */
  function buildTagHtml(el, suggestedTestId, isFix) {
    const tag = el.type === 'link' ? 'a' : el.type === 'input' ? 'input' : el.type === 'form' ? 'form' : 'button';
    const isVoid = tag === 'input';

    const a = {};
    function attrVal(v, attr) {
      const needle = '[' + attr + '="';
      const si = v.indexOf(needle);
      if (si === -1) return null;
      const ei = v.indexOf('"', si + needle.length);
      return ei === -1 ? null : v.slice(si + needle.length, ei);
    }
    for (const c of (el.selectorRanking || [])) {
      const v = c.value;
      if (c.strategy === 'id' && v.startsWith('#'))   { a.id = v.slice(1); }
      else if (c.strategy === 'aria-label') { const x = attrVal(v, 'aria-label'); if (x !== null) a['aria-label'] = x; }
      else if (c.strategy === 'name')       { const x = attrVal(v, 'name');       if (x !== null) a.name = x; }
      else if (c.strategy === 'css')        { const x = attrVal(v, 'type');       if (x !== null) a.type = x; }
    }

    let attrsHtml = '';
    if (isFix) {
      attrsHtml += ' <span class="tok-new">data-testid=&quot;' + esc(suggestedTestId) + '&quot;</span>';
    }
    for (const k of ['id', 'aria-label', 'name', 'type']) {
      if (a[k]) attrsHtml += ' <span class="tok-attr">' + esc(k) + '=</span><span class="tok-val">&quot;' + esc(a[k]) + '&quot;</span>';
    }

    const br  = (t) => '<span class="tok-bracket">' + t + '</span>';
    const tg  = (t) => '<span class="tok-tag">'     + t + '</span>';
    const open = br('&lt;') + tg(tag) + attrsHtml + br('&gt;');
    if (isVoid) return '<span class="tag-disp">' + open + '</span>';
    const text  = el.label ? '<span class="tok-text">' + esc(el.label) + '</span>' : '<span class="tok-text">&hellip;</span>';
    const close = br('&lt;/') + tg(tag) + br('&gt;');
    return '<span class="tag-disp">' + open + text + close + '</span>';
  }

  /* ── render ──────────────────────────────────────────────────────────── */
  function render(data, threshold) {
    const { issues, totalFiles } = data;

    sumFiles.textContent  = totalFiles;
    sumIssues.textContent = issues.length;
    sumFixed.textContent  = '';

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
          '<div class="state-body">' + totalFiles + ' file(s) scanned — all elements score ≥ ' + threshold + '/100.</div>' +
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
      nav +=
        '<a class="fn-item" href="#f' + idx + '" data-fp="' + esc(fp) + '">' +
          '<span class="fn-name" title="' + esc(fp) + '">' + esc(name) + '</span>' +
          '<span class="fn-badge err">' + fi.length + '</span>' +
        '</a>';
      idx++;
    }
    navList.innerHTML = nav;
    sbCount.textContent = byFile.size + ' file' + (byFile.size !== 1 ? 's' : '');
    sidebar.hidden = false;

    /* diff cards */
    let html = '';

    idx = 0;
    for (const [fp, fi] of byFile) {
      const { dir, name } = splitFp(fp);
      const cnt   = fi.length;

      html +=
        '<div class="diff-card" id="f' + idx + '" data-file-card="' + esc(fp) + '">' +
        '<div class="diff-head" onclick="toggleCard(event, this)">' +
          '<label class="file-pick" onclick="event.stopPropagation()" title="Select all in this file">' +
            '<input type="checkbox" class="js-file-pick" data-fp="' + esc(fp) + '" checked>' +
          '</label>' +
          '<button class="caret" aria-label="collapse">&#9660;</button>' +
          '<span class="diff-fp">' +
            '<span class="diff-fp-dir">'  + esc(dir)  + '</span>' +
            '<span class="diff-fp-name">' + esc(name) + '</span>' +
          '</span>' +
          '<span class="issue-pill open">' + cnt + ' issue' + (cnt !== 1 ? 's' : '') + '</span>' +
          '<button class="card-btn" onclick="copyFp(event,' + JSON.stringify(fp).replace(/"/g, '&quot;') + ')">&#8984; Copy path</button>' +
        '</div>' +
        '<div class="diff-body">' +
        '<table class="diff-tbl">';

      let ln = 1;
      for (const issue of fi) {
        const key = issueKey(issue.filePath, issue.suggestedTestId);
        allKeys.add(key);
        selected.add(key);
        const el      = issue.element;
        const score   = el.testabilityScore;
        const cls     = scCls(score);
        const acts    = (el.actions || []).join(', ') || 'click';
        const ranking = el.selectorRanking || [];
        const hasTestid = ranking.some(r => r.strategy === 'data-testid');

        /* hunk */
        html +=
          '<tbody data-issue-key="' + esc(key) + '">' +
          '<tr class="r-hunk">' +
            '<td class="ln" colspan="2" style="font-size:10px;text-align:center;color:var(--hunk-text);opacity:0.6">@@</td>' +
            '<td class="cd">' +
              '<div class="h-top">' +
                '<label class="issue-pick" title="Include in pull request">' +
                  '<input type="checkbox" class="js-issue-pick" data-key="' + esc(key) + '" checked>' +
                '</label>' +
                '<span class="h-type">' + esc(el.type) + '</span>' +
                pips(score) +
                '<span class="h-score ' + cls + '">' + score + '/100</span>' +
                (issue.kind === 'ambiguous' ? '<span class="stag stag-bad" title="' + esc(issue.ambiguityReason || '') + '">ambiguous</span>' : '') +
                (el.label ? '<span style="color:var(--hunk-text);opacity:0.9">&middot; <em>' + esc(el.label) + '</em></span>' : '') +
              '</div>' +
              '<div class="h-bot">' +
                '<span class="h-comp">&#128196; ' + esc(issue.componentName) + '</span>' +
                ' &nbsp;&middot;&nbsp; <span class="h-acts">&#9654; ' + esc(acts) + '</span>' +
              '</div>' +
            '</td>' +
          '</tr>';

        /* del — current tag */
        html +=
          '<tr class="r-del">' +
            '<td class="ln">' + ln + '</td>' +
            '<td class="mk">&#8722;</td>' +
            '<td class="cd">' +
              '<span class="row-lbl">Current</span>' +
              buildTagHtml(el, null, false) +
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

        /* add — proposed fix */
        html +=
          '<tr class="r-add">' +
            '<td class="ln">' + (ln + 1) + '</td>' +
            '<td class="mk">+</td>' +
            '<td class="cd">' +
              '<span class="row-lbl">Fix</span>' +
              buildTagHtml(el, issue.suggestedTestId, true) +
              '<span class="stag stag-ok">proposed</span>' +
            '</td>' +
          '</tr>';

        html += '</tbody>';
        ln += 2;
      }

      html += '</table></div></div>';
      idx++;
    }

    diffArea.innerHTML = html;
    syncGlobal();
    syncSidebar();
  }

  /* ── PR action bar ──────────────────────────────────────────────────── */
  function maybeShowPrAction(data) {
    if (!data || (data.issues || []).length === 0) {
      prAction.hidden = true;
      return;
    }
    prAction.hidden = false;
    prSuccess.hidden = true;
    prInlineError.hidden = true;
    if (!lastIsPro) {
      openPrBtn.disabled  = true;
      openPrBtn.title     = 'Open pull request requires Pro. Set pro: true in selfcure.config.mjs or SELFCURE_PRO=1.';
      prSubInfo.innerHTML = '<strong>Pro feature.</strong> Enable with <code>pro: true</code> in selfcure.config.mjs or <code>SELFCURE_PRO=1</code>.';
    } else {
      openPrBtn.disabled  = false;
      openPrBtn.title     = '';
      prSubInfo.innerHTML = 'Pick which fixes go into the PR. We branch, commit, push and open it on GitHub in one shot.';
    }
    updateSelInfo();
  }

  function updateSelInfo() {
    prSelInfo.textContent = selected.size + ' of ' + allKeys.size + ' issues selected';
    const noneSelected = selected.size === 0;
    if (lastIsPro) openPrBtn.disabled = noneSelected || prInFlight !== null;
  }

  function syncFilePicks() {
    diffArea.querySelectorAll('[data-file-card]').forEach(function (card) {
      const boxes   = card.querySelectorAll('.js-issue-pick');
      const checked = card.querySelectorAll('.js-issue-pick:checked').length;
      const master  = card.querySelector('.js-file-pick');
      if (!master) return;
      master.checked       = checked === boxes.length && boxes.length > 0;
      master.indeterminate = checked > 0 && checked < boxes.length;
    });
  }

  function syncGlobal() {
    const total = allKeys.size;
    const sel   = selected.size;
    globalPick.checked       = sel === total && total > 0;
    globalPick.indeterminate = sel > 0 && sel < total;
    globalLabel.textContent  = sel === total ? 'All' : sel === 0 ? 'None' : sel + '/' + total;
  }

  function syncSidebar() {
    document.querySelectorAll('.fn-item').forEach(function (item) {
      const fp   = item.dataset.fp;
      const card = diffArea.querySelector('[data-file-card="' + cssEsc(fp) + '"]');
      if (!card) return;
      const total   = card.querySelectorAll('.js-issue-pick').length;
      const checked = card.querySelectorAll('.js-issue-pick:checked').length;
      item.classList.toggle('fn-none', checked === 0);
      const badge = item.querySelector('.fn-badge');
      if (!badge) return;
      if (checked === 0) {
        badge.textContent = '0/' + total;
        badge.className   = 'fn-badge dim';
      } else if (checked === total) {
        badge.textContent = String(total);
        badge.className   = 'fn-badge err';
      } else {
        badge.textContent = checked + '/' + total;
        badge.className   = 'fn-badge partial';
      }
    });
  }

  globalPick.addEventListener('change', function () {
    const shouldCheck = globalPick.checked;
    diffArea.querySelectorAll('.js-issue-pick').forEach(function (cb) {
      if (cb.checked === shouldCheck) return;
      cb.checked = shouldCheck;
      const key  = cb.getAttribute('data-key');
      if (shouldCheck) selected.add(key);
      else             selected.delete(key);
      const body = cb.closest('tbody');
      if (body) body.classList.toggle('r-unselected', !shouldCheck);
    });
    syncFilePicks();
    syncSidebar();
    globalLabel.textContent = shouldCheck ? 'All' : 'None';
    updateSelInfo();
  });

  /* Delegated checkbox handling — per-issue + per-file master. */
  diffArea.addEventListener('change', function (e) {
    const t = e.target;
    if (!t) return;
    if (t.classList && t.classList.contains('js-issue-pick')) {
      const key  = t.getAttribute('data-key');
      const body = t.closest('tbody');
      if (t.checked) selected.add(key);
      else           selected.delete(key);
      if (body) body.classList.toggle('r-unselected', !t.checked);
      syncFilePicks();
      syncGlobal();
      syncSidebar();
      updateSelInfo();
    } else if (t.classList && t.classList.contains('js-file-pick')) {
      const fp   = t.getAttribute('data-fp');
      const card = diffArea.querySelector('[data-file-card="' + cssEsc(fp) + '"]');
      if (!card) return;
      card.querySelectorAll('.js-issue-pick').forEach(function (cb) {
        if (cb.checked === t.checked) return;
        cb.checked = t.checked;
        const k = cb.getAttribute('data-key');
        if (t.checked) selected.add(k);
        else           selected.delete(k);
        const body = cb.closest('tbody');
        if (body) body.classList.toggle('r-unselected', !t.checked);
      });
      syncGlobal();
      syncSidebar();
      updateSelInfo();
    }
  });

  /** Single-click PR flow with pre-opened tab to dodge popup blockers. */
  openPrBtn.addEventListener('click', async function () {
    if (!lastResult || selected.size === 0 || prInFlight) return;

    // Open the new tab IMMEDIATELY inside the click handler so popup blockers allow it.
    const tab = window.open('about:blank', '_blank');
    if (tab) {
      try {
        tab.document.write(
          '<!doctype html><html><head><title>Opening pull request…</title>' +
          '<style>body{font:14px/1.5 -apple-system,Segoe UI,sans-serif;background:#0d1117;color:#e6edf3;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}' +
          'div{display:flex;align-items:center;gap:12px}' +
          '.s{width:18px;height:18px;border:3px solid #30363d;border-top-color:#3fb950;border-radius:50%;animation:r .8s linear infinite}' +
          '@keyframes r{to{transform:rotate(360deg)}}</style></head>' +
          '<body><div><span class="s"></span><span>selfcure is opening your pull request…</span></div></body></html>'
        );
      } catch (_) { /* ignore */ }
    }

    prInFlight            = true;
    openPrBtn.disabled    = true;
    openPrBtn.textContent = ' Creating…';
    prInlineError.hidden  = true;
    prSuccess.hidden      = true;

    const payload = {
      configPath:   cfgInput.value.trim() || 'selfcure.config.mjs',
      threshold:    Number(thrInput.value) || 65,
      selectedKeys: Array.from(selected),
    };

    try {
      const resp = await fetch('/api/pr', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'PR creation failed');

      // Redirect the pre-opened tab to the PR.
      if (tab && !tab.closed) {
        try { tab.location.href = data.prUrl; } catch (_) { /* cross-origin */ }
      }

      // Inline confirmation with the link (works even if popup was blocked).
      prSuccess.hidden    = false;
      prSuccess.innerHTML =
        '<div class="pr-success">' +
          '<svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" style="color:var(--success);flex-shrink:0" aria-hidden="true"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"/></svg>' +
          '<div>' +
            '<div style="font-weight:600">' + (data.prKindLabel ? data.prKindLabel.charAt(0).toUpperCase() + data.prKindLabel.slice(1) : 'Pull request') + ' created' + (data.baseBranch ? ' against <code>' + esc(data.baseBranch) + '</code>' : '') + '</div>' +
            '<div style="margin-top:2px"><a href="' + esc(data.prUrl) + '" target="_blank" rel="noreferrer">' + esc(data.prUrl) + '</a> &middot; <span style="color:var(--muted)">' + data.fixedCount + ' element(s) patched on branch <code>' + esc(data.branch) + '</code></span></div>' +
          '</div>' +
        '</div>';

      // Stamp selected issues as "in PR" in the UI.
      selected.forEach(function (k) {
        const body = diffArea.querySelector('tbody[data-issue-key="' + cssEsc(k) + '"]');
        if (body) {
          const pill = body.querySelector('.stag.stag-ok');
          if (pill) pill.textContent = '✓ in PR';
        }
      });
    } catch (err) {
      if (tab && !tab.closed) { try { tab.close(); } catch (_) { /* ignore */ } }
      prInlineError.textContent = String(err.message || err);
      prInlineError.hidden      = false;
    } finally {
      prInFlight            = null;
      openPrBtn.textContent = ' Open pull request';
      updateSelInfo();
    }
  });

  window.toggleCard = function (e, hd) {
    if (e && e.target && (e.target.tagName === 'INPUT' || (e.target.closest && e.target.closest('.file-pick')))) return;
    const body = hd.nextElementSibling;
    const btn  = hd.querySelector('.caret');
    const c    = body.classList.toggle('collapsed');
    btn.textContent = c ? '▶' : '▼';
  };

  window.copyFp = function (e, fp) {
    e.stopPropagation();
    navigator.clipboard.writeText(fp).catch(() => {});
    const btn  = e.currentTarget;
    const orig = btn.innerHTML;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  };

  // Highlight + scroll to a file card by best-effort path match (basename or suffix).
  // Called from the element/URL lookup above the IIFE. Pass null to clear.
  window._filterByFile = function (targetPath) {
    diffArea.querySelectorAll('[data-file-card]').forEach(function (card) {
      card.style.outline = '';
      card.style.opacity = '';
    });
    if (!targetPath) return;
    const norm = String(targetPath).replace(/\\\\/g, '/');
    const base = norm.split('/').pop();
    const cards = Array.prototype.slice.call(diffArea.querySelectorAll('[data-file-card]'));
    let hit = null;
    for (const card of cards) {
      const fp = (card.getAttribute('data-file-card') || '').replace(/\\\\/g, '/');
      if (fp === norm || fp.endsWith(norm) || norm.endsWith(fp) || (base && fp.split('/').pop() === base)) {
        hit = card;
        break;
      }
    }
    if (hit) {
      hit.style.outline = '2px solid var(--accent)';
      hit.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

})();

// ---------------------------------------------------------------------------
// URL → Component lookup
// ---------------------------------------------------------------------------

function extractRoutePath(raw) {
  try {
    const url = new URL(raw);
    // Hash-based router: #/path → /path
    if (url.hash && url.hash.startsWith('#/')) {
      const hash = url.hash.slice(1); // remove #
      const pathPart = hash.split('?')[0];
      return pathPart || '/';
    }
    return url.pathname || raw;
  } catch(_e) {
    // Not a full URL — treat as raw path
    return raw.trim().startsWith('/') ? raw.trim() : '/' + raw.trim();
  }
}

function stripDynamicSegments(p) {
  // Remove numeric IDs from path segments: /1000002718/retail → /retail
  // NOTE: this string is served inside a JS template literal, so we build the
  // RegExp from a backslash-free string to avoid template-escape mangling.
  return p.replace(new RegExp('/[0-9]{5,}', 'g'), '');
}

async function lookupUrl() {
  const raw   = document.getElementById('urlInput').value.trim();
  if (!raw) return;
  const route = extractRoutePath(raw);
  const clean = stripDynamicSegments(route);
  const box   = document.getElementById('urlResult');

  box.style.display = 'block';
  box.innerHTML = '<span style="color:var(--muted)">Buscando…</span>';

  try {
    const resp = await fetch('/api/url-to-component?route=' + encodeURIComponent(clean));
    const data = await resp.json();

    if (data.error || !data.componentFile) {
      box.innerHTML =
        '<span style="color:var(--error)">Nenhum componente encontrado para: <b>' + esc(clean) + '</b></span>' +
        (data.candidates ? '<br>Rotas próximas: ' + data.candidates.map(c => '<code>' + esc(c) + '</code>').join(', ') : '');
      return;
    }

    const els = (data.elements || []);
    const rows = els.length === 0
      ? '<i style="color:var(--muted)">Nenhum elemento interativo encontrado neste componente.</i>'
      : els.map(e => {
          const sc = e.testabilityScore;
          const col = sc >= 65 ? 'var(--success)' : sc >= 35 ? 'var(--warning)' : 'var(--error)';
          const tml = e.tml ? ' <span style="color:' + col + '">[TML-' + e.tml.level + ':' + e.tml.label + ']</span>' : '';
          return '<div style="margin:4px 0;display:flex;gap:12px;align-items:center">' +
            '<span style="min-width:60px;color:var(--accent)">' + esc(e.type) + '</span>' +
            '<code style="flex:1;overflow:hidden;text-overflow:ellipsis">' + esc(e.selector) + '</code>' +
            '<span style="color:' + col + ';min-width:60px">score: ' + sc + '</span>' +
            tml +
            (e.suggestedTestId ? '<span style="color:var(--muted)">→ data-testid="' + esc(e.suggestedTestId) + '"</span>' : '') +
            '</div>';
        }).join('');

    box.innerHTML =
      '<div style="margin-bottom:6px">' +
        '<b>Rota:</b> <code>' + esc(data.matchedRoute || clean) + '</code>' +
        ' &nbsp;→&nbsp; ' +
        '<b>Componente:</b> <code style="color:var(--accent)">' + esc(data.componentFile) + '</code>' +
        ' &nbsp;<span style="color:var(--muted)">(' + els.length + ' elemento(s) interativo(s))</span>' +
      '</div>' +
      '<div style="border-top:1px solid var(--hunk-ln);padding-top:6px">' + rows + '</div>';

    // Also filter the lint results to show only this file
    if (data.componentFile && window._filterByFile) {
      window._filterByFile(data.componentFile);
    }
  } catch (err) {
    box.innerHTML = '<span style="color:var(--error)">Erro: ' + esc(String(err)) + '</span>';
  }
}

// Element-in-source search: paste a DOM element, find which file/component it lives in
async function findElement(raw) {
  const box = document.getElementById('urlResult');
  box.style.display = 'block';
  box.innerHTML = '<span style="color:var(--muted)">Procurando o elemento no source…</span>';

  try {
    const resp = await fetch('/api/find-element?q=' + encodeURIComponent(raw));
    const data = await resp.json();

    if (data.error || !data.matches || data.matches.length === 0) {
      box.innerHTML =
        '<span style="color:var(--error)">Elemento não encontrado no source.</span>' +
        (data.tokens && data.tokens.length
          ? '<br><span style="color:var(--muted)">Tokens buscados: ' +
            data.tokens.map(t => '<code>' + esc(t.value) + '</code>').join(', ') + '</span>'
          : '');
      if (window._filterByFile) window._filterByFile(null);
      return;
    }

    const best    = data.matches[0];
    const bestLine = best.hits.reduce((lo, h) => Math.min(lo, h.line), Infinity);

    // Primary answer banner — the source location (works for ANY tag, incl. <div>)
    const tagNote = data.searchedTag
      ? '<span style="color:var(--muted)">&lt;' + esc(data.searchedTag) + '&gt;</span> '
      : '';
    const interactiveNote = (data.searchedTag && !data.interactive)
      ? '<div style="margin-top:6px;color:var(--warning)">⚠ Este é um <code>&lt;' + esc(data.searchedTag) +
        '&gt;</code> não-semântico — não aparece no lint (apenas button/input/a/form são analisados). ' +
        'Localização mostrada pelo source. Para tratá-lo como testável, considere runtime discovery ou adicionar um data-testid.</div>'
      : '';
    const routeBadge = best.route
      ? ' <span style="background:var(--hunk-ln);color:var(--hunk-text);padding:1px 6px;border-radius:4px">rota: ' + esc(best.route) + '</span>'
      : '';

    const banner =
      '<div style="margin-bottom:8px;padding:8px;border-radius:6px;background:var(--add-bg);border:1px solid var(--add-ln)">' +
        '<div>' + tagNote + 'Encontrado em: <b style="color:var(--accent)">' + esc(best.file) + '</b>' +
        ' <span style="color:var(--muted)">linha ' + (bestLine === Infinity ? '?' : bestLine) + '</span>' +
        (best.strong ? '' : ' <span style="color:var(--warning)">(match fraco — confira abaixo)</span>') +
        routeBadge + '</div>' +
        interactiveNote +
      '</div>';

    const tokensLine = '<div style="color:var(--muted);margin-bottom:6px">Tokens buscados: ' +
      data.tokens.map(t => '<code title="' + esc(t.label) + ' (peso ' + t.weight + ')">' + esc(t.value) + '</code>').join(' ') +
      ' &nbsp;·&nbsp; ' + data.scannedFiles + ' arquivos varridos</div>';

    const rows = data.matches.map((m, i) => {
      const isBest = i === 0;
      const hitChips = m.hits.map(h =>
        '<span style="background:var(--add-bg);color:var(--add-mk);padding:1px 6px;border-radius:4px;margin-right:4px;font-size:11px" title="peso ' + h.weight + '">' +
        esc(h.token) + ':' + esc(h.value) + ' <span style="opacity:.6">L' + h.line + '</span></span>'
      ).join('');
      const routeB = m.route
        ? '<span style="background:var(--hunk-ln);color:var(--hunk-text);padding:1px 6px;border-radius:4px;margin-left:6px">rota: ' + esc(m.route) + '</span>'
        : '';
      const strongB = m.strong ? '' : '<span style="color:var(--warning);margin-left:6px;font-size:11px">fraco</span>';
      return '<div style="margin:6px 0;padding:8px;border-radius:6px;' +
        (isBest ? 'background:var(--add-bg);border:1px solid var(--add-ln)' : 'background:var(--bg);border:1px solid var(--border)') + '">' +
        '<div style="margin-bottom:4px">' +
          (isBest ? '⭐ ' : '') +
          '<b style="color:var(--accent)">' + esc(m.file) + '</b>' +
          '<span style="color:var(--muted);margin-left:8px">' + m.hits.length + ' match(es), score ' + m.score + '</span>' +
          strongB + routeB +
        '</div>' +
        '<div>' + hitChips + '</div>' +
      '</div>';
    }).join('');

    box.innerHTML = banner + tokensLine + rows;

    // Only scroll/highlight the lint card when the searched element is interactive
    // (a <div> won't have a lint card — it isn't a flagged interactive element).
    if (data.interactive && best && window._filterByFile) {
      window._filterByFile(best.file);
    } else if (window._filterByFile) {
      window._filterByFile(null);
    }
  } catch (err) {
    box.innerHTML = '<span style="color:var(--error)">Erro: ' + esc(String(err)) + '</span>';
  }
}

// Auto-detect: HTML element snippet → findElement; URL/path → lookupUrl
function runLookup() {
  const raw = document.getElementById('urlInput').value.trim();
  if (!raw) return;
  const looksLikeHtml = raw.includes('<') || /\b(class|ng-click|data-testid|aria-label|formcontrolname|ng-if)\s*=/i.test(raw);
  if (looksLikeHtml) findElement(raw);
  else lookupUrl();
}

function clearLookup() {
  document.getElementById('urlInput').value = '';
  document.getElementById('urlResult').style.display = 'none';
  if (window._filterByFile) window._filterByFile(null);
}

document.getElementById('urlInput').addEventListener('keydown', e => {
  // Enter (without Shift) triggers search; Shift+Enter inserts newline
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runLookup(); }
});
</script>
</body>
</html>
`;
