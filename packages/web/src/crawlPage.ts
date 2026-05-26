// ---------------------------------------------------------------------------
// selfcure crawl — web page
// Layout: dev-tool minimalist, two-column (filters sidebar + results), light + auto-dark.
// Self-contained <style> block; no external CSS framework.
// ---------------------------------------------------------------------------

export const crawlPageHtml = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>selfcure — crawl</title>
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
      --warning:   #d97706;
      --warning-bg:#fffbeb;
      --error:     #dc2626;
      --error-bg:  #fef2f2;
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
        --warning:   #f59e0b;
        --warning-bg:#1c1407;
        --error:     #f87171;
        --error-bg:  #1a0e0e;
        --code-bg:   #161616;
        --score-low: #f87171;
        --score-mid: #fbbf24;
        --score-high:#4ade80;
      }
    }
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; height: 100%; }
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
      display: flex; align-items: center; gap: 10px;
      padding: 12px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
    }
    .run-bar label { font-size: 12px; color: var(--muted); white-space: nowrap; }
    .run-bar input {
      flex: 1; min-width: 0;
      font-family: var(--mono); font-size: 13px;
      color: var(--text); background: var(--bg);
      border: 1px solid var(--border-strong); border-radius: 5px;
      padding: 6px 10px;
    }
    .run-bar input:focus { outline: none; border-color: var(--accent); }
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
    .run-status {
      font-size: 12px; color: var(--muted); white-space: nowrap;
    }
    .run-error {
      font-size: 12px; color: var(--error);
      background: var(--error-bg); border-radius: 4px;
      padding: 4px 10px;
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
    .stat-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }

    /* ── Layout ──────────────────────────────────────────────────────────── */
    .layout {
      display: flex; align-items: flex-start;
      min-height: calc(100vh - 44px - 49px - 58px);
    }

    /* ── Sidebar ─────────────────────────────────────────────────────────── */
    .sidebar {
      width: 220px; flex-shrink: 0;
      padding: 16px 14px;
      border-right: 1px solid var(--border);
      position: sticky; top: 44px;
      max-height: calc(100vh - 44px);
      overflow-y: auto;
    }
    .sidebar-title {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted);
      margin: 0 0 10px;
    }
    .filter-group { margin-bottom: 14px; }
    .filter-label {
      display: block; font-size: 12px; font-weight: 500;
      color: var(--muted); margin-bottom: 4px;
    }
    .filter-input {
      width: 100%; font-family: var(--sans); font-size: 13px;
      color: var(--text); background: var(--bg);
      border: 1px solid var(--border-strong); border-radius: 5px;
      padding: 6px 8px;
    }
    .filter-input:focus { outline: none; border-color: var(--accent); }
    select.filter-input {
      appearance: none; -webkit-appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
                        linear-gradient(135deg, var(--muted) 50%, transparent 50%);
      background-position: calc(100% - 12px) 50%, calc(100% - 7px) 50%;
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
      padding-right: 28px;
    }
    .filter-check {
      display: flex; align-items: flex-start; gap: 7px;
      font-size: 12px; color: var(--muted); cursor: pointer;
    }
    .filter-check input { margin: 2px 0 0; accent-color: var(--accent); flex-shrink: 0; }
    .sidebar-divider { border: none; border-top: 1px solid var(--border); margin: 12px 0; }

    /* ── Results ─────────────────────────────────────────────────────────── */
    .results-area { flex: 1; min-width: 0; padding: 16px 20px; }
    .results-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12px;
    }
    .results-count { font-size: 13px; color: var(--muted); }
    .no-results {
      text-align: center; padding: 60px 24px;
      color: var(--muted); font-size: 13px;
    }
    .empty-icon { font-size: 32px; margin-bottom: 8px; }

    /* ── Cards ───────────────────────────────────────────────────────────── */
    .card-list { display: flex; flex-direction: column; gap: 8px; }
    .card {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--surface);
      overflow: hidden;
      transition: border-color 120ms;
    }
    .card:hover { border-color: var(--border-strong); }
    .card summary {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px;
      cursor: pointer; list-style: none; user-select: none;
    }
    .card summary::-webkit-details-marker { display: none; }
    .card-chevron {
      flex-shrink: 0; width: 16px; height: 16px;
      color: var(--muted); transition: transform 180ms ease;
    }
    details[open] .card-chevron { transform: rotate(90deg); }
    .card-name {
      flex: 1; min-width: 0;
      font-weight: 600; font-size: 13px;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .card-path {
      flex: 2; min-width: 0;
      font-family: var(--mono); font-size: 11px; color: var(--muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .card-meta { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

    /* ── Badges ──────────────────────────────────────────────────────────── */
    .badge {
      display: inline-flex; align-items: center;
      font-size: 11px; font-weight: 500; border-radius: 4px;
      padding: 2px 7px; white-space: nowrap;
    }
    .badge-framework { background: var(--surface2); color: var(--muted); }
    .badge-low      { background: var(--success-bg); color: var(--success); }
    .badge-medium   { background: var(--warning-bg); color: var(--warning); }
    .badge-high     { background: var(--error-bg);   color: var(--error);   }
    .badge-tags {
      background: var(--surface2); color: var(--text);
      font-family: var(--mono);
    }

    /* ── Score ───────────────────────────────────────────────────────────── */
    .score-pill {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: 11px; font-weight: 600; font-family: var(--mono);
      border-radius: 4px; padding: 2px 7px; white-space: nowrap;
    }
    .score-low  { background: var(--error-bg);   color: var(--score-low);  }
    .score-mid  { background: var(--warning-bg); color: var(--score-mid);  }
    .score-high { background: var(--success-bg); color: var(--score-high); }

    /* ── Card body ───────────────────────────────────────────────────────── */
    .card-body {
      padding: 0 14px 14px;
      border-top: 1px solid var(--border);
    }
    .card-section-title {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--muted);
      margin: 12px 0 6px;
    }
    table {
      width: 100%; border-collapse: collapse;
      font-size: 12px;
    }
    th {
      text-align: left; padding: 5px 8px;
      background: var(--surface2); color: var(--muted);
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--border);
    }
    th:first-child { border-radius: 4px 0 0 0; }
    th:last-child  { border-radius: 0 4px 0 0; }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--surface2); }
    code {
      font-family: var(--mono); font-size: 0.9em;
      background: var(--code-bg); padding: 1px 5px; border-radius: 3px;
    }
    .action-pills { display: flex; flex-wrap: wrap; gap: 3px; }
    .action-pill {
      font-size: 10px; font-weight: 500;
      background: var(--surface2); color: var(--muted);
      border-radius: 3px; padding: 1px 5px;
      font-family: var(--mono);
    }
    .empty-msg { font-size: 12px; color: var(--muted); font-style: italic; padding: 4px 0; }

    /* ── Legend ─────────────────────────────────────────────────────────── */
    .legend { margin-top: 4px; }
    .legend-toggle {
      font-size: 11px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--muted);
      cursor: pointer; list-style: none; user-select: none;
      display: flex; align-items: center; justify-content: space-between;
    }
    .legend-toggle::-webkit-details-marker { display: none; }
    .legend-toggle::after { content: '›'; font-size: 13px; transition: transform 150ms; }
    details.legend[open] .legend-toggle::after { transform: rotate(90deg); }
    .legend-body { padding-top: 10px; display: flex; flex-direction: column; gap: 8px; }
    .legend-section {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--border-strong);
      margin: 4px 0 2px;
    }
    .legend-row {
      display: flex; align-items: flex-start; gap: 6px;
      font-size: 11px; color: var(--muted); line-height: 1.4;
    }
    .legend-row .badge,
    .legend-row .score-pill { flex-shrink: 0; }
    .legend-desc { font-size: 11px; color: var(--muted); }

    /* ── Export dropdown ─────────────────────────────────────────────────── */
    .export-wrap { position: relative; }
    .btn-sm {
      font-size: 12px; padding: 5px 12px; border-radius: 5px;
      border: 1px solid var(--border-strong); background: var(--surface);
      color: var(--text); cursor: pointer; display: inline-flex;
      align-items: center; gap: 5px; font-family: var(--sans);
      font-weight: 500; transition: background 120ms;
    }
    .btn-sm:hover { background: var(--surface2); }
    .btn-sm:disabled { opacity: 0.4; cursor: not-allowed; }
    .export-menu {
      position: absolute; right: 0; top: calc(100% + 4px); z-index: 200;
      background: var(--surface); border: 1px solid var(--border-strong);
      border-radius: 7px; padding: 4px; min-width: 200px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.12);
      display: none;
    }
    .export-menu.open { display: block; }
    .export-item {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 10px; border-radius: 4px;
      font-size: 12px; color: var(--text); cursor: pointer;
      user-select: none; transition: background 100ms;
    }
    .export-item:hover { background: var(--surface2); }
    .export-sep { border: none; border-top: 1px solid var(--border); margin: 3px 0; }
    .export-tag {
      margin-left: auto; font-size: 10px; font-family: var(--mono);
      background: var(--surface2); color: var(--muted);
      border-radius: 3px; padding: 1px 5px;
    }

    /* ── Sortable table headers ──────────────────────────────────────────── */
    th.sortable { cursor: pointer; user-select: none; }
    th.sortable:hover { background: var(--border-strong); color: var(--text); }
    th.sort-asc::after  { content: ' ↑'; font-weight: 400; }
    th.sort-desc::after { content: ' ↓'; font-weight: 400; }

    /* ── Selector strategies ─────────────────────────────────────────────── */
    .sel-list { display: flex; flex-direction: column; gap: 3px; }
    .sel-row  { display: flex; align-items: baseline; gap: 5px; }
    .sel-value {
      font-family: var(--mono); font-size: 10px; color: var(--text);
      overflow: hidden; text-overflow: ellipsis; max-width: 220px;
      display: inline-block; background: none; padding: 0;
    }
    .sel-strategy {
      display: inline-block; padding: 1px 5px; border-radius: 3px;
      font-size: 9px; font-weight: 700; letter-spacing: .2px;
      white-space: nowrap; flex-shrink: 0; font-family: var(--mono);
    }
    .s-datatestid { background: var(--success-bg); color: var(--success); }
    .s-id         { background: #dbeafe; color: #1e40af; }
    .s-arialabel  { background: #ede9fe; color: #5b21b6; }
    .s-name       { background: var(--warning-bg); color: var(--warning); }
    .s-css        { background: var(--error-bg); color: var(--error); }
    .s-xpath      { background: var(--surface2); color: var(--muted); }
    @media (prefers-color-scheme: dark) {
      .s-id      { background: #1e3a5f; color: #93c5fd; }
      .s-arialabel { background: #2e1065; color: #c4b5fd; }
    }
    .elem-score {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 50%;
      font-size: 9px; font-weight: 700; font-family: var(--mono); flex-shrink: 0;
    }
    .es-high { background: var(--success-bg); color: var(--score-high); }
    .es-mid  { background: var(--warning-bg); color: var(--score-mid); }
    .es-low  { background: var(--error-bg);   color: var(--score-low); }

    /* ── Element detail drawer ───────────────────────────────────────────── */
    .elem-row { cursor: pointer; }
    .elem-row:hover > td { background: var(--surface2); }
    .elem-detail-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,.35);
      z-index: 300; backdrop-filter: blur(2px);
    }
    .elem-detail-drawer {
      position: fixed; top: 0; right: 0; bottom: 0; width: min(420px, 92vw);
      background: var(--bg); border-left: 1px solid var(--border);
      z-index: 301; display: flex; flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,.18);
      transform: translateX(100%);
      transition: transform .2s cubic-bezier(.4,0,.2,1);
      overflow: hidden;
    }
    .elem-detail-drawer.open { transform: translateX(0); }
    .drawer-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 16px; border-bottom: 1px solid var(--border);
      background: var(--surface); flex-shrink: 0;
    }
    .drawer-title { font-size: 13px; font-weight: 700; color: var(--text); }
    .drawer-close {
      background: none; border: none; cursor: pointer;
      color: var(--muted); font-size: 16px; padding: 2px 6px;
      border-radius: 4px; line-height: 1;
    }
    .drawer-close:hover { background: var(--surface2); color: var(--text); }
    .drawer-body {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .drawer-hero { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .drawer-label { font-size: 13px; color: var(--text); font-family: var(--mono); }
    .drawer-section { display: flex; flex-direction: column; gap: 8px; }
    .drawer-section-title {
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .6px; color: var(--muted);
      display: flex; align-items: center; gap: 6px;
    }
    .drawer-count {
      background: var(--surface2); border-radius: 10px; padding: 1px 6px;
      font-size: 10px; font-weight: 600; color: var(--muted);
      text-transform: none; letter-spacing: 0;
    }
    .drawer-score-row { display: flex; align-items: center; gap: 10px; }
    .drawer-score-desc { font-size: 12px; color: var(--muted); }
    .drawer-strats { display: flex; flex-direction: column; gap: 8px; }
    .drawer-strat-card {
      border: 1px solid var(--border); border-radius: 6px; padding: 10px 12px;
      display: flex; flex-direction: column; gap: 6px; background: var(--surface);
    }
    .drawer-strat-card.is-best { border-color: var(--success); background: var(--success-bg); }
    .drawer-strat-head { display: flex; align-items: center; gap: 6px; }
    .best-badge { font-size: 10px; font-weight: 700; color: var(--success); }
    .strat-score { font-size: 11px; color: var(--muted); margin-left: auto; font-family: var(--mono); }
    .drawer-strat-value { display: flex; align-items: center; gap: 8px; }
    .strat-code {
      font-family: var(--mono); font-size: 11px; color: var(--text);
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      background: var(--surface2); padding: 4px 8px; border-radius: 4px;
    }
    .copy-btn {
      flex-shrink: 0; font-size: 10px; font-weight: 600;
      padding: 3px 8px; border-radius: 4px; cursor: pointer;
      background: var(--surface2); border: 1px solid var(--border);
      color: var(--text); transition: background .15s, color .15s, border-color .15s;
    }
    .copy-btn:hover { background: var(--surface); }
    .copy-btn.copy-ok { background: var(--success-bg); color: var(--success); border-color: var(--success); }

    /* ── Initial state (no results) ──────────────────────────────────────── */
    .welcome {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      min-height: 300px; gap: 8px; color: var(--muted);
      text-align: center; padding: 40px;
    }
    .welcome-icon { font-size: 40px; }
    .welcome h2 { font-size: 16px; margin: 0; color: var(--text); }
    .welcome p  { font-size: 13px; margin: 0; max-width: 320px; }
  </style>
</head>
<body>

<nav>
  <a class="nav-brand" href="/">selfcure</a>
  <span class="nav-sep">/</span>
  <a class="nav-link" href="/">init</a>
  <a class="nav-link active" href="/crawl">crawl</a>
  <a class="nav-link" href="/lint">lint</a>
</nav>

<form id="crawlForm">
  <div class="run-bar">
    <label for="configPath">Config</label>
    <input id="configPath" name="configPath" type="text" value="selfcure.config.mjs" autocomplete="off" spellcheck="false">
    <button class="btn btn-primary" type="submit" id="runBtn">
      <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M3 2.5a.5.5 0 0 1 .765-.424l10 5.5a.5.5 0 0 1 0 .848l-10 5.5A.5.5 0 0 1 3 13.5v-11z"/>
      </svg>
      Run crawler
    </button>
    <span class="run-status" id="status" role="status"></span>
    <span class="run-error" id="errorMsg" role="alert" hidden></span>
  </div>
</form>

<div class="stats-bar" id="statsBar" hidden>
  <div class="stat-item">
    <span class="stat-value" id="statPages">—</span>
    <span class="stat-label">Pages found</span>
  </div>
  <div class="stat-item">
    <span class="stat-value" id="statTags">—</span>
    <span class="stat-label">Interactive tags</span>
  </div>
  <div class="stat-item">
    <span class="stat-value" id="statProps">—</span>
    <span class="stat-label">Props</span>
  </div>
  <div class="stat-item">
    <span class="stat-value" id="statAvgScore">—</span>
    <span class="stat-label">Avg. testability score</span>
  </div>
</div>

<div class="layout">
  <aside class="sidebar" id="sidebar" hidden>
    <p class="sidebar-title">Filters</p>

    <div class="filter-group">
      <label class="filter-label" for="searchText">Search</label>
      <input class="filter-input" id="searchText" type="search"
             placeholder="name, file, selector…" autocomplete="off">
    </div>

    <div class="filter-group">
      <label class="filter-label" for="frameworkFilter">Framework</label>
      <select class="filter-input" id="frameworkFilter">
        <option value="">All</option>
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="complexityFilter">Complexity</label>
      <select class="filter-input" id="complexityFilter">
        <option value="">All</option>
        <option value="low">Low</option>
        <option value="medium">Medium</option>
        <option value="high">High</option>
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="tagFilter">Element type</label>
      <select class="filter-input" id="tagFilter">
        <option value="">All</option>
      </select>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="minScore">Min. score: <strong id="minScoreVal">0</strong></label>
      <input class="filter-input" id="minScore" type="range" min="0" max="100" value="0"
             style="padding:0;border:none;background:transparent;cursor:pointer;accent-color:var(--accent);">
    </div>

    <hr class="sidebar-divider">

    <div class="filter-group">
      <label class="filter-check">
        <input id="onlyWithTags" type="checkbox">
        <span>Only with interactive tags</span>
      </label>
    </div>

    <div class="filter-group">
      <label class="filter-label" for="sortBy">Sort by</label>
      <select class="filter-input" id="sortBy">
        <option value="tagsDesc">Most interactive tags</option>
        <option value="scoreDesc">Score, high to low</option>
        <option value="scoreAsc">Score, low to high</option>
        <option value="componentName">Name (A–Z)</option>
        <option value="filePath">File path</option>
      </select>
    </div>

    <hr class="sidebar-divider">

    <details class="legend">
      <summary class="legend-toggle">Legend</summary>
      <div class="legend-body">

        <p class="legend-section">Complexity</p>
        <div class="legend-row">
          <span class="badge badge-low">low</span>
          <span class="legend-desc">0–2 interactive elements — simple page</span>
        </div>
        <div class="legend-row">
          <span class="badge badge-medium">medium</span>
          <span class="legend-desc">3–6 elements — moderate interactions</span>
        </div>
        <div class="legend-row">
          <span class="badge badge-high">high</span>
          <span class="legend-desc">&gt; 6 elements — many test scenarios</span>
        </div>

        <p class="legend-section">Score (0–100)</p>
        <div class="legend-row">
          <span class="score-pill score-high">75+</span>
          <span class="legend-desc">Strong — data-testid / id / aria-label present</span>
        </div>
        <div class="legend-row">
          <span class="score-pill score-mid">55–74</span>
          <span class="legend-desc">Moderate — name attribute used as selector</span>
        </div>
        <div class="legend-row">
          <span class="score-pill score-low">&lt;55</span>
          <span class="legend-desc">Fragile — only tag or type available</span>
        </div>
        <div class="legend-row" style="font-size:10px;color:var(--muted);margin-top:2px">
          Average of per-element selector testability scores
        </div>

        <p class="legend-section">Selector strategies</p>
        <div class="legend-row"><span class="sel-strategy s-datatestid">data-testid</span><span class="legend-desc">100 pts — explicit test contract, most stable</span></div>
        <div class="legend-row"><span class="sel-strategy s-id">id</span><span class="legend-desc">85 pts — unique DOM identifier</span></div>
        <div class="legend-row"><span class="sel-strategy s-arialabel">aria-label</span><span class="legend-desc">75 pts — accessible label, ARIA-aware</span></div>
        <div class="legend-row"><span class="sel-strategy s-name">name</span><span class="legend-desc">65 pts — form field name</span></div>
        <div class="legend-row"><span class="sel-strategy s-css">css</span><span class="legend-desc">10–35 pts — structural, may break on refactor</span></div>
        <div class="legend-row"><span class="sel-strategy s-xpath">xpath</span><span class="legend-desc">20 pts — last resort, always generated</span></div>

        <p class="legend-section">Element types</p>
        <div class="legend-row"><code>button</code><span class="legend-desc">Clickable button</span></div>
        <div class="legend-row"><code>input</code><span class="legend-desc">Text / checkbox / radio</span></div>
        <div class="legend-row"><code>link</code><span class="legend-desc">Anchor &lt;a&gt; tag</span></div>
        <div class="legend-row"><code>select</code><span class="legend-desc">Dropdown list</span></div>
        <div class="legend-row"><code>textarea</code><span class="legend-desc">Multi-line text area</span></div>
        <div class="legend-row"><code>form</code><span class="legend-desc">Form container</span></div>

        <p class="legend-section">Actions (Playwright)</p>
        <div class="legend-row"><code>click</code><span class="legend-desc">Click the element</span></div>
        <div class="legend-row"><code>fill</code><span class="legend-desc">Type text into field</span></div>
        <div class="legend-row"><code>clear</code><span class="legend-desc">Clear field content</span></div>
        <div class="legend-row"><code>press</code><span class="legend-desc">Send a keyboard key</span></div>
        <div class="legend-row"><code>check</code><span class="legend-desc">Check a checkbox</span></div>
        <div class="legend-row"><code>select</code><span class="legend-desc">Choose a dropdown option</span></div>

      </div>
    </details>
  </aside>

  <div id="mainArea" style="flex:1;min-width:0;">
    <div class="welcome" id="welcome">
      <div class="welcome-icon">🔍</div>
      <h2>No results yet</h2>
      <p>Press <strong>Run crawler</strong> to scan your project and detect pages, components, and interactive elements.</p>
    </div>

    <div class="results-area" id="resultsArea" hidden>
      <div class="results-header">
        <span class="results-count" id="resultsCount"></span>
        <div class="export-wrap">
          <button class="btn-sm" id="exportBtn" disabled>
            Export
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><path d="M4 6L0 2h8z"/></svg>
          </button>
          <div class="export-menu" id="exportMenu">
            <div class="export-item" data-fmt="csv" data-scope="filtered">&#x1F4C4; CSV &mdash; current view <span class="export-tag">csv</span></div>
            <div class="export-item" data-fmt="csv" data-scope="all">&#x1F4C4; CSV &mdash; all results <span class="export-tag">csv</span></div>
            <hr class="export-sep">
            <div class="export-item" data-fmt="xls" data-scope="filtered">&#x1F4CA; XLS &mdash; current view <span class="export-tag">xls</span></div>
            <div class="export-item" data-fmt="xls" data-scope="all">&#x1F4CA; XLS &mdash; all results <span class="export-tag">xls</span></div>
            <hr class="export-sep">
            <div class="export-item" data-fmt="pdf" data-scope="filtered">&#x1F5A8; PDF &mdash; current view <span class="export-tag">pdf</span></div>
            <div class="export-item" data-fmt="pdf" data-scope="all">&#x1F5A8; PDF &mdash; all results <span class="export-tag">pdf</span></div>
          </div>
        </div>
      </div>
      <div class="card-list" id="componentList"></div>
      <div class="no-results" id="noResults" hidden>
        <div class="empty-icon">🚫</div>
        <p>No components match the current filters.</p>
      </div>
    </div>
  </div>
</div>

<div id="elemDetailOverlay" class="elem-detail-overlay" hidden></div>
<aside id="elemDetailDrawer" class="elem-detail-drawer" hidden
  aria-modal="true" role="dialog" aria-labelledby="elemDrawerTitle">
  <div class="drawer-header">
    <div class="drawer-title" id="elemDrawerTitle">Element details</div>
    <button class="drawer-close" id="elemDrawerClose" aria-label="Close">&#x2715;</button>
  </div>
  <div class="drawer-body" id="elemDrawerBody"></div>
</aside>

<script>
  let crawlData = [];
  const cardSortState = {};

  const form        = document.getElementById('crawlForm');
  const runBtn      = document.getElementById('runBtn');
  const statusEl    = document.getElementById('status');
  const errorMsg    = document.getElementById('errorMsg');
  const statsBar    = document.getElementById('statsBar');
  const sidebar     = document.getElementById('sidebar');
  const welcome     = document.getElementById('welcome');
  const resultsArea = document.getElementById('resultsArea');
  const componentList = document.getElementById('componentList');
  const resultsCount  = document.getElementById('resultsCount');
  const noResults     = document.getElementById('noResults');
  const minScoreInput = document.getElementById('minScore');
  const minScoreVal   = document.getElementById('minScoreVal');
  const exportBtn     = document.getElementById('exportBtn');
  const exportMenu    = document.getElementById('exportMenu');

  minScoreInput.addEventListener('input', () => {
    minScoreVal.textContent = minScoreInput.value;
    render();
  });

  const filterIds = ['searchText','frameworkFilter','complexityFilter','tagFilter','onlyWithTags','sortBy'];
  filterIds.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input',  render);
    el.addEventListener('change', render);
  });

  function esc(v) {
    return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  function uniqueSorted(vals) {
    return [...new Set(vals.filter(Boolean))].sort((a,b) => a.localeCompare(b));
  }

  function setOptions(selectId, values) {
    const sel = document.getElementById(selectId);
    const cur = sel.value;
    sel.innerHTML = '<option value="">All</option>' + values
      .map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
    if (values.includes(cur)) sel.value = cur;
  }

  function refreshFilterOptions() {
    setOptions('frameworkFilter', uniqueSorted(crawlData.map(d => d.framework)));
    setOptions('tagFilter', uniqueSorted(crawlData.flatMap(d => d.interactiveElements.map(e => e.type))));
  }

  function getFiltered() {
    const query = document.getElementById('searchText').value.trim().toLowerCase();
    const fw    = document.getElementById('frameworkFilter').value;
    const cx    = document.getElementById('complexityFilter').value;
    const tag   = document.getElementById('tagFilter').value;
    const min   = Number(minScoreInput.value || 0);
    const only  = document.getElementById('onlyWithTags').checked;
    const sort  = document.getElementById('sortBy').value;

    const filtered = crawlData.filter(d => {
      if (fw && d.framework !== fw) return false;
      if (cx && d.complexity !== cx) return false;
      if (tag && !d.interactiveElements.some(e => e.type === tag)) return false;
      if (Number(d.score) < min) return false;
      if (only && d.interactiveElements.length === 0) return false;
      if (query) {
        const hay = [d.componentName, d.filePath, d.framework, d.complexity,
          ...d.props.flatMap(p => [p.name, p.type]),
          ...d.interactiveElements.flatMap(e => [e.type, e.selector, e.label, ...(e.actions||[])]),
        ].join(' ').toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    filtered.sort((a,b) => {
      if (sort === 'componentName') return a.componentName.localeCompare(b.componentName);
      if (sort === 'scoreDesc')    return b.score - a.score;
      if (sort === 'scoreAsc')     return a.score - b.score;
      if (sort === 'tagsDesc')     return b.interactiveElements.length - a.interactiveElements.length;
      return a.filePath.localeCompare(b.filePath);
    });

    return filtered;
  }

  function scorePill(score) {
    const cls = score >= 75 ? 'score-high' : score >= 55 ? 'score-mid' : 'score-low';
    const tip = score >= 75 ? 'Good testability — most elements are labeled'
              : score >= 55 ? 'Fair — some elements lack labels or IDs'
              : 'Fragile — selectors may break; add aria-label or id attributes';
    return '<span class="score-pill ' + cls + '" title="Score ' + score + '/100: ' + tip + '">' + esc(score) + '</span>';
  }

  function complexityBadge(cx) {
    const tips = {
      low:    '0–2 interactive elements — simple page, easy to write tests for',
      medium: '3–6 interactive elements — moderate number of test scenarios',
      high:   'More than 6 interactive elements — complex page with many test scenarios',
    };
    return '<span class="badge badge-' + esc(cx) + '" title="Complexity: ' + (tips[cx] || cx) + '">' + esc(cx) + '</span>';
  }

  function renderElements(elements, filePath, sortCol, sortDir) {
    if (!elements.length) return '<p class="empty-msg">No interactive elements found in this page.</p>';
    let sorted = elements;
    if (sortCol) {
      sorted = [...elements].sort((a, b) => {
        const va = String(a[sortCol] != null ? a[sortCol] : '').toLowerCase();
        const vb = String(b[sortCol] != null ? b[sortCol] : '').toLowerCase();
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }
    const thCls = col => {
      const active = sortCol === col;
      return 'class="sortable' + (active ? ' sort-' + sortDir : '') + '" data-col="' + esc(col) + '"';
    };
    const stratBadge = s => {
      const cls = { 'data-testid': 's-datatestid', id: 's-id', 'aria-label': 's-arialabel', name: 's-name', css: 's-css', xpath: 's-xpath' }[s] || 's-css';
      return '<span class="sel-strategy ' + cls + '">' + esc(s) + '</span>';
    };
    const elemScore = score => {
      if (score == null) return '<span class="elem-score es-low" title="No selector data">?</span>';
      const cls = score >= 75 ? 'es-high' : score >= 50 ? 'es-mid' : 'es-low';
      const tip = score >= 75 ? 'Strong selector' : score >= 50 ? 'Moderate selector stability' : 'Fragile — add data-testid or id';
      return '<span class="elem-score ' + cls + '" title="Selector score: ' + score + '/100 — ' + tip + '">' + score + '</span>';
    };
    const renderSelectors = ranking => {
      if (!ranking || !ranking.length) return '<span class="sel-value">—</span>';
      return '<div class="sel-list">' +
        ranking.map(c =>
          '<div class="sel-row">' + stratBadge(c.strategy) +
          '<span class="sel-value" title="Score: ' + c.score + '/100">' + esc(c.value) + '</span>' +
          '</div>'
        ).join('') +
      '</div>';
    };
    return '<table class="elem-table" data-path="' + esc(filePath || '') + '">' +
      '<thead><tr>' +
      '<th ' + thCls('type') + '>Type</th>' +
      '<th ' + thCls('testabilityScore') + '>Score</th>' +
      '<th>Selectors</th>' +
      '<th ' + thCls('label') + '>Label</th>' +
      '<th>Actions</th>' +
      '</tr></thead><tbody>' +
      sorted.map(el =>
        '<tr class="elem-row" data-elem="' + encodeURIComponent(JSON.stringify(el)) + '">' +
        '<td><span class="badge badge-framework">' + esc(el.type) + '</span></td>' +
        '<td>' + elemScore(el.testabilityScore) + '</td>' +
        '<td>' + renderSelectors(el.selectorRanking) + '</td>' +
        '<td>' + esc(el.label || '—') + '</td>' +
        '<td><div class="action-pills">' +
          (el.actions||[]).map(a => '<span class="action-pill">' + esc(a) + '</span>').join('') +
        '</div></td>' +
        '</tr>'
      ).join('') +
      '</tbody></table>';
  }

  function renderProps(props) {
    if (!props.length) return '';
    return '<p class="card-section-title">Props</p>' +
      '<table><thead><tr><th>Name</th><th>Type</th><th>Required</th></tr></thead><tbody>' +
      props.map(p =>
        '<tr>' +
        '<td><code>' + esc(p.name) + '</code></td>' +
        '<td><code>' + esc(p.type) + '</code></td>' +
        '<td>' + (p.required ? 'yes' : 'no') + '</td>' +
        '</tr>'
      ).join('') +
      '</tbody></table>';
  }

  function renderCard(item) {
    const tagCount = item.interactiveElements.length;
    return '<article class="card">' +
      '<details>' +
        '<summary>' +
          '<svg class="card-chevron" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5V3z"/></svg>' +
          '<span class="card-name">' + esc(item.componentName) + '</span>' +
          '<span class="card-path">' + esc(item.filePath) + '</span>' +
          '<div class="card-meta">' +
            '<span class="badge badge-framework">' + esc(item.framework) + '</span>' +
            complexityBadge(item.complexity) +
            '<span class="badge badge-tags">' + tagCount + ' tag' + (tagCount !== 1 ? 's' : '') + '</span>' +
            scorePill(item.score) +
          '</div>' +
        '</summary>' +
        '<div class="card-body">' +
          '<p class="card-section-title">Interactive elements</p>' +
          renderElements(item.interactiveElements, item.filePath, cardSortState[item.filePath] && cardSortState[item.filePath].col, cardSortState[item.filePath] && cardSortState[item.filePath].dir) +
          renderProps(item.props) +
        '</div>' +
      '</details>' +
    '</article>';
  }

  function updateStats() {
    const total   = crawlData.length;
    const tags    = crawlData.reduce((s,d) => s + d.interactiveElements.length, 0);
    const props   = crawlData.reduce((s,d) => s + d.props.length, 0);
    const avg     = total ? Math.round(crawlData.reduce((s,d) => s + d.score, 0) / total) : 0;
    document.getElementById('statPages').textContent    = total;
    document.getElementById('statTags').textContent     = tags;
    document.getElementById('statProps').textContent    = props;
    document.getElementById('statAvgScore').textContent = avg;
  }

  function render() {
    const filtered = getFiltered();
    resultsCount.textContent = filtered.length + ' of ' + crawlData.length + ' page(s)';
    if (filtered.length === 0) {
      componentList.innerHTML = '';
      noResults.hidden = false;
    } else {
      noResults.hidden = true;
      componentList.innerHTML = filtered.map(renderCard).join('');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorMsg.hidden = true;
    errorMsg.textContent = '';
    statusEl.textContent = 'Crawling…';
    runBtn.disabled = true;

    try {
      const configPath = document.getElementById('configPath').value.trim();
      const resp = await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configPath }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Crawler failed');

      crawlData = data.components || [];
      refreshFilterOptions();
      updateStats();
      render();
      exportBtn.disabled = false;
      Object.keys(cardSortState).forEach(k => delete cardSortState[k]);

      statsBar.hidden = false;
      sidebar.hidden  = false;
      welcome.hidden  = true;
      resultsArea.hidden = false;

      statusEl.textContent = crawlData.length + ' page(s) found · ' + (data.rootDir || '');
    } catch (err) {
      errorMsg.textContent = err.message || String(err);
      errorMsg.hidden = false;
      statusEl.textContent = '';
    } finally {
      runBtn.disabled = false;
    }
  });

  // ── Export ────────────────────────────────────────────────────────────────
  const EXPORT_HEADERS = ['Component','Framework','Complexity','Score','File Path','Type','Best Selector','Strategy','data-testid','id','aria-label','name','CSS','XPath','Elem. Score','Label','Actions'];

  function flattenRows(data) {
    const rows = [];
    for (const d of data) {
      const empty = ['','','','','','','','','','',''];
      if (d.interactiveElements.length === 0) {
        rows.push([d.componentName, d.framework, d.complexity, d.score, d.filePath, ...empty, '', '']);
      } else {
        for (const el of d.interactiveElements) {
          const best = (el.selectorRanking && el.selectorRanking[0]) || null;
          const sels = el.selectors || {};
          rows.push([d.componentName, d.framework, d.complexity, d.score, d.filePath,
            el.type, el.selector, best ? best.strategy : '',
            sels.dataTestId || '', sels.id || '', sels.ariaLabel || '', sels.name || '',
            sels.cssSelector || '', sels.xpath || '',
            el.testabilityScore != null ? el.testabilityScore : '',
            el.label || '', (el.actions||[]).join(', ')]);
        }
      }
    }
    return rows;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function() { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
  }

  function exportData(data, fmt, suffix) {
    const date = new Date().toISOString().slice(0, 10);
    const name = 'selfcure-crawl-' + suffix + '-' + date;
    if (fmt === 'csv') {
      const csvEsc = function(v) {
        const s = String(v != null ? v : '');
        const needsQuote = s.indexOf(',') >= 0 || s.indexOf('"') >= 0 || s.indexOf(String.fromCharCode(10)) >= 0;
        return needsQuote ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const BOM  = String.fromCharCode(65279);
      const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
      const lines = [EXPORT_HEADERS].concat(flattenRows(data)).map(function(r) { return r.map(csvEsc).join(','); });
      downloadBlob(new Blob([BOM + lines.join(CRLF)], { type: 'text/csv;charset=utf-8;' }), name + '.csv');
    } else if (fmt === 'xls') {
      const rows = [EXPORT_HEADERS].concat(flattenRows(data));
      const htmlRows = rows.map(function(row, i) {
        const tag = i === 0 ? 'th' : 'td';
        return '<tr>' + row.map(function(v) { return '<' + tag + '>' + esc(String(v != null ? v : '')) + '</' + tag + '>'; }).join('') + '</tr>';
      }).join('');
      const BOM = String.fromCharCode(65279);
      const xls = '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
        '<head><meta charset="UTF-8"></head><body><table>' + htmlRows + '</table></body></html>';
      downloadBlob(new Blob([BOM + xls], { type: 'application/vnd.ms-excel;charset=utf-8;' }), name + '.xls');
    } else if (fmt === 'pdf') {
      const rows = [EXPORT_HEADERS].concat(flattenRows(data));
      const htmlRows = rows.map(function(row, i) {
        const tag = i === 0 ? 'th' : 'td';
        return '<tr>' + row.map(function(v) { return '<' + tag + '>' + esc(String(v != null ? v : '')) + '</' + tag + '>'; }).join('') + '</tr>';
      }).join('');
      const win = window.open('', '_blank');
      if (!win) { alert('Allow pop-ups to export PDF'); return; }
      win.document.write(
        '<!DOCTYPE html><html><head><title>selfcure crawl</title>' +
        '<style>body{font:12px/1.5 Arial,sans-serif;padding:16px;color:#111}' +
        'h1{font-size:13px;font-family:monospace;margin:0 0 10px}' +
        'table{width:100%;border-collapse:collapse;font-size:11px}' +
        'th,td{border:1px solid #ccc;padding:4px 8px;text-align:left}' +
        'th{background:#f3f4f6;font-weight:600}' +
        'tr:nth-child(even) td{background:#fafafa}' +
        '@media print{@page{size:landscape;margin:8mm}button{display:none}}' +
        '</style></head>' +
        '<body onload="window.print()">' +
        '<h1>selfcure &middot; crawl export &middot; ' + new Date().toLocaleDateString() + ' &middot; ' + data.length + ' page(s)</h1>' +
        '<table><tbody>' + htmlRows + '</tbody></table>' +
        '</body></html>'
      );
      win.document.close();
    }
  }

  exportBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    exportMenu.classList.toggle('open');
  });
  document.addEventListener('click', function() { exportMenu.classList.remove('open'); });
  exportMenu.addEventListener('click', function(e) {
    const item = e.target.closest('.export-item');
    if (!item) return;
    const data   = item.dataset.scope === 'all' ? crawlData : getFiltered();
    const suffix = item.dataset.scope === 'all' ? 'all' : 'view';
    exportData(data, item.dataset.fmt, suffix);
    exportMenu.classList.remove('open');
  });

  // ── Per-card column sorting ───────────────────────────────────────────────
  componentList.addEventListener('click', function(e) {
    const th = e.target.closest('th.sortable');
    if (!th) return;
    const table = th.closest('table.elem-table');
    if (!table) return;
    const path = table.dataset.path;
    const col  = th.dataset.col;
    const cur  = cardSortState[path];
    const dir  = (cur && cur.col === col && cur.dir === 'asc') ? 'desc' : 'asc';
    cardSortState[path] = { col: col, dir: dir };
    const item = crawlData.find(function(d) { return d.filePath === path; });
    if (!item) return;
    table.outerHTML = renderElements(item.interactiveElements, path, col, dir);
  });

  // ── Element detail drawer ─────────────────────────────────────────────────
  const detailOverlay = document.getElementById('elemDetailOverlay');
  const detailDrawer  = document.getElementById('elemDetailDrawer');
  const drawerBody    = document.getElementById('elemDrawerBody');
  const drawerClose   = document.getElementById('elemDrawerClose');

  function closeDrawer() {
    detailDrawer.classList.remove('open');
    setTimeout(function() {
      detailOverlay.hidden = true;
      detailDrawer.hidden  = true;
    }, 210);
  }

  function openDrawer(el) {
    const stratBadge = function(s) {
      const cls = { 'data-testid': 's-datatestid', id: 's-id', 'aria-label': 's-arialabel', name: 's-name', css: 's-css', xpath: 's-xpath' }[s] || 's-css';
      return '<span class="sel-strategy ' + cls + '">' + esc(s) + '</span>';
    };
    const score    = el.testabilityScore != null ? el.testabilityScore : null;
    const scoreCls = score >= 75 ? 'es-high' : score >= 50 ? 'es-mid' : 'es-low';
    const scoreTip = score >= 75 ? 'Strong — stable selector' : score >= 50 ? 'Moderate — name attribute' : 'Fragile — add data-testid or id';
    let html = '';

    html += '<div class="drawer-hero">' +
      '<span class="badge badge-framework">' + esc(el.type) + '</span>' +
      (el.label ? '<span class="drawer-label">' + esc(el.label) + '</span>' : '') +
      '</div>';

    html += '<div class="drawer-section">' +
      '<div class="drawer-section-title">Testability Score</div>' +
      '<div class="drawer-score-row">' +
        '<span class="elem-score ' + scoreCls + '" style="width:36px;height:36px;font-size:12px">' +
          (score != null ? score : '?') +
        '</span>' +
        '<span class="drawer-score-desc">' + esc(scoreTip) + '</span>' +
      '</div>' +
      '</div>';

    if (el.actions && el.actions.length) {
      html += '<div class="drawer-section">' +
        '<div class="drawer-section-title">Actions</div>' +
        '<div class="action-pills">' +
          el.actions.map(function(a) { return '<span class="action-pill">' + esc(a) + '</span>'; }).join('') +
        '</div>' +
        '</div>';
    }

    if (el.selectorRanking && el.selectorRanking.length) {
      html += '<div class="drawer-section">' +
        '<div class="drawer-section-title">Selector strategies ' +
          '<span class="drawer-count">' + el.selectorRanking.length + '</span>' +
        '</div>' +
        '<div class="drawer-strats">' +
          el.selectorRanking.map(function(c, i) {
            const best = i === 0;
            return '<div class="drawer-strat-card' + (best ? ' is-best' : '') + '">' +
              '<div class="drawer-strat-head">' +
                stratBadge(c.strategy) +
                (best ? '<span class="best-badge">&#x2605; best</span>' : '') +
                '<span class="strat-score">' + c.score + '/100</span>' +
              '</div>' +
              '<div class="drawer-strat-value">' +
                '<code class="strat-code" title="' + esc(c.value) + '">' + esc(c.value) + '</code>' +
                '<button class="copy-btn" data-copy="' + esc(c.value) + '">Copy</button>' +
              '</div>' +
              '</div>';
          }).join('') +
        '</div>' +
        '</div>';
    }

    drawerBody.innerHTML = html;

    drawerBody.querySelectorAll('.copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        navigator.clipboard.writeText(btn.dataset.copy || '').then(function() {
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          btn.classList.add('copy-ok');
          setTimeout(function() { btn.textContent = orig; btn.classList.remove('copy-ok'); }, 1500);
        });
      });
    });

    detailOverlay.hidden = false;
    detailDrawer.hidden  = false;
    requestAnimationFrame(function() { detailDrawer.classList.add('open'); });
  }

  drawerClose.addEventListener('click', closeDrawer);
  detailOverlay.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeDrawer(); });

  componentList.addEventListener('click', function(e) {
    if (e.target.closest('th.sortable')) return;
    if (e.target.closest('.copy-btn')) return;
    const row = e.target.closest('tr.elem-row');
    if (!row || !row.dataset.elem) return;
    try {
      openDrawer(JSON.parse(decodeURIComponent(row.dataset.elem)));
    } catch (_) {}
  });
</script>
</body>
</html>
`;
