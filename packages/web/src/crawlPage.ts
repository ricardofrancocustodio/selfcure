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
      </div>
      <div class="card-list" id="componentList"></div>
      <div class="no-results" id="noResults" hidden>
        <div class="empty-icon">🚫</div>
        <p>No components match the current filters.</p>
      </div>
    </div>
  </div>
</div>

<script>
  let crawlData = [];

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
    return '<span class="score-pill ' + cls + '">' + esc(score) + '</span>';
  }

  function complexityBadge(cx) {
    return '<span class="badge badge-' + esc(cx) + '">' + esc(cx) + '</span>';
  }

  function renderElements(elements) {
    if (!elements.length) return '<p class="empty-msg">No interactive elements found in this page.</p>';
    return '<table><thead><tr><th>Type</th><th>Selector</th><th>Label</th><th>Actions</th></tr></thead><tbody>' +
      elements.map(el =>
        '<tr>' +
        '<td><span class="badge badge-framework">' + esc(el.type) + '</span></td>' +
        '<td><code>' + esc(el.selector) + '</code></td>' +
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
          renderElements(item.interactiveElements) +
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
</script>
</body>
</html>
`;
