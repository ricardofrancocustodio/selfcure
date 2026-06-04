// ---------------------------------------------------------------------------
// Discovery dashboard page — served at GET /discovery
// Shows project-map.json, route-map.json, testability-report.json, llm-hints.json
// from the .selfcure/ artifact directory.
// ---------------------------------------------------------------------------

export const discoveryPageHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>selfcure — Discovery</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:      #0f1117;
      --surface: #1a1d27;
      --border:  #2a2d3a;
      --text:    #e2e8f0;
      --muted:   #64748b;
      --green:   #22c55e;
      --yellow:  #eab308;
      --red:     #ef4444;
      --blue:    #3b82f6;
      --purple:  #a855f7;
      --radius:  8px;
      --accent:  #3b82f6;
      --mono:    ui-monospace, SFMono-Regular, Consolas, monospace;
      --nav-h:   44px;
    }
    body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; }
    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; gap: 4px; padding: 0 20px; background: var(--surface); border-bottom: 1px solid var(--border); height: var(--nav-h); }
    .nav-brand { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); text-decoration: none; margin-right: 8px; }
    .nav-sep { color: var(--muted); margin: 0 2px; }
    .nav-link { font-size: 13px; padding: 4px 10px; border-radius: 6px; color: var(--muted); text-decoration: none; transition: background 100ms, color 100ms; }
    .nav-link:hover { background: rgba(255,255,255,.05); color: var(--text); }
    .nav-link.active { background: rgba(255,255,255,.08); color: var(--text); font-weight: 600; }

    .container { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .page-title { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
    .page-sub   { color: var(--muted); font-size: 13px; margin-bottom: 24px; }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
    @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr; } }

    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
    .card-title { font-size: 12px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }
    .stat-value { font-size: 28px; font-weight: 700; }
    .stat-label { font-size: 12px; color: var(--muted); margin-top: 2px; }

    .meta-row { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 24px; }
    .meta-item { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; }
    .meta-item .label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: 4px; }
    .meta-item .value { font-size: 14px; font-weight: 600; font-family: monospace; }

    .section-title { font-size: 15px; font-weight: 600; margin-bottom: 12px; margin-top: 24px; }

    table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: var(--radius); overflow: hidden; border: 1px solid var(--border); }
    th { background: #1f2233; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 600; padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); }
    td { padding: 10px 14px; border-bottom: 1px solid var(--border); font-size: 13px; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255,255,255,.02); }

    .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .badge-green  { background: rgba(34,197,94,.15);  color: var(--green); }
    .badge-yellow { background: rgba(234,179,8,.15);  color: var(--yellow); }
    .badge-red    { background: rgba(239,68,68,.15);  color: var(--red); }
    .badge-blue   { background: rgba(59,130,246,.15); color: var(--blue); }
    .badge-muted  { background: rgba(100,116,139,.15);color: var(--muted); }
    .badge-purple { background: rgba(168,85,247,.15); color: var(--purple); }

    .score-bar { display: flex; align-items: center; gap: 8px; }
    .bar-track { flex: 1; height: 6px; background: var(--border); border-radius: 3px; max-width: 80px; }
    .bar-fill  { height: 100%; border-radius: 3px; transition: width .3s; }
    .score-num { font-weight: 600; min-width: 32px; text-align: right; }

    .conf-pct { font-size: 12px; color: var(--muted); }

    .hints-box { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--purple); border-radius: var(--radius); padding: 16px 20px; margin-top: 24px; }
    .hints-box .ht { font-size: 13px; font-weight: 600; color: var(--purple); margin-bottom: 10px; }
    .hint-row { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 8px; font-size: 13px; }
    .hint-route { font-family: monospace; color: var(--blue); min-width: 140px; }
    .hint-trigger { color: var(--muted); }

    .needs-hint { background: var(--surface); border: 1px solid var(--border); border-left: 3px solid var(--yellow); border-radius: var(--radius); padding: 16px 20px; margin-top: 24px; }
    .needs-hint .ht { font-size: 13px; font-weight: 600; color: var(--yellow); margin-bottom: 10px; }
    .needs-route { font-family: monospace; font-size: 13px; color: var(--text); margin-bottom: 6px; }
    .needs-note  { font-size: 12px; color: var(--muted); margin-bottom: 12px; }

    .empty { color: var(--muted); text-align: center; padding: 32px; font-size: 13px; }
    .cmd  { font-family: monospace; background: #12141f; border: 1px solid var(--border); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
    .loading { color: var(--muted); padding: 40px; text-align: center; }
    .err { color: var(--red); padding: 20px; font-size: 13px; }
  </style>
</head>
<body>
<nav>
  <a class="nav-brand" href="/">selfcure</a>
  <span class="nav-sep">/</span>
  <a class="nav-link" href="/">dashboard</a>
  <a class="nav-link" href="/map">map</a>
  <a class="nav-link" href="/evolution">evolution</a>
  <a class="nav-link" href="/crawl">crawl</a>
  <a class="nav-link" href="/tml">TML</a>
  <a class="nav-link" href="/integrations">integrations</a>
</nav>

<div class="container">
  <div class="page-title">Agentic Discovery</div>
  <div class="page-sub">Static project map · runtime route evidence · testability scores · LLM hints</div>

  <div id="root"><div class="loading">Loading discovery artifacts…</div></div>
</div>

<script>
  const PATH_PARAM = new URLSearchParams(location.search).get('path') || '.selfcure';

  function scoreColor(s) {
    if (s >= 80) return 'var(--green)';
    if (s >= 60) return 'var(--yellow)';
    return 'var(--red)';
  }
  function scoreBadgeClass(s) {
    if (s >= 80) return 'badge-green';
    if (s >= 60) return 'badge-yellow';
    return 'badge-red';
  }
  function statusBadge(status) {
    const m = { reachable: ['badge-green','✓ reachable'], error: ['badge-red','✗ error'], timeout: ['badge-red','✗ timeout'], 'auth-required': ['badge-yellow','⚠ auth'], undefined: ['badge-muted','—'] };
    const [cls, txt] = m[status] ?? m[undefined];
    return '<span class="badge ' + cls + '">' + txt + '</span>';
  }
  function confBar(c) {
    const pct = Math.round(c * 100);
    const col = pct >= 90 ? 'var(--green)' : pct >= 70 ? 'var(--yellow)' : 'var(--red)';
    return '<span class="conf-pct">' + pct + '%</span>';
  }
  function scoreBar(s) {
    const col = scoreColor(s);
    return '<div class="score-bar"><div class="bar-track"><div class="bar-fill" style="width:' + s + '%;background:' + col + '"></div></div><span class="score-num" style="color:' + col + '">' + s + '</span></div>';
  }
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function loadJson(file) {
    const r = await fetch('/api/discovery-artifact?dir=' + encodeURIComponent(PATH_PARAM) + '&file=' + encodeURIComponent(file));
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  async function render() {
    const root = document.getElementById('root');
    try {
      const [map, rtResult, trReport, llmHints] = await Promise.all([
        loadJson('project-map.json'),
        loadJson('route-map.json'),
        loadJson('testability-report.json'),
        loadJson('llm-hints.json'),
      ]);

      if (!map) {
        root.innerHTML = '<div class="empty">No discovery artifacts found.<br><br>Run <span class="cmd">selfcure discover</span> to generate them.</div>';
        return;
      }

      let html = '';

      // ── Meta row ─────────────────────────────────────────────────────────
      html += '<div class="meta-row">';
      html += '<div class="meta-item"><div class="label">Framework</div><div class="value">' + esc(map.framework) + '</div></div>';
      html += '<div class="meta-item"><div class="label">Package manager</div><div class="value">' + esc(map.packageManager) + '</div></div>';
      if (map.devCommand)   html += '<div class="meta-item"><div class="label">Dev command</div><div class="value">' + esc(map.devCommand) + '</div></div>';
      if (map.buildCommand) html += '<div class="meta-item"><div class="label">Build command</div><div class="value">' + esc(map.buildCommand) + '</div></div>';
      html += '</div>';

      // ── Summary cards ─────────────────────────────────────────────────────
      const rtRoutes = rtResult ? rtResult.routes : [];
      const reachable = rtRoutes.filter(r => r.status === 'reachable').length;
      const overallScore = trReport ? trReport.overall.score : null;

      html += '<div class="grid-2">';
      html += '<div class="card"><div class="card-title">Route Candidates</div><div class="stat-value">' + map.routeCandidates.length + '</div><div class="stat-label">detected statically</div></div>';
      if (rtResult) {
        html += '<div class="card"><div class="card-title">Reachable Routes</div><div class="stat-value">' + reachable + ' / ' + rtResult.scannedRoutes + '</div><div class="stat-label">via headless runtime scan</div></div>';
      } else {
        html += '<div class="card"><div class="card-title">Components</div><div class="stat-value">' + map.componentCandidates.length + '</div><div class="stat-label">source files found in src/</div></div>';
      }
      html += '</div>';

      // ── Route table ───────────────────────────────────────────────────────
      html += '<div class="section-title">Routes</div>';
      html += '<table><thead><tr><th>Path</th><th>Source</th><th>Confidence</th>';
      if (rtResult) html += '<th>Status</th>';
      if (trReport) html += '<th>Score</th><th>Elements</th>';
      html += '</tr></thead><tbody>';

      for (const r of map.routeCandidates) {
        const rtRow = rtRoutes.find(x => x.route === r.path);
        const trRow = trReport ? trReport.routes.find(x => x.route === r.path) : null;
        const dynBadge = r.isDynamic ? ' <span class="badge badge-muted" style="font-size:10px">dynamic</span>' : '';

        html += '<tr>';
        html += '<td><code>' + esc(r.path) + '</code>' + dynBadge + '</td>';
        html += '<td><span class="badge badge-muted">' + esc(r.source) + '</span></td>';
        html += '<td>' + confBar(r.confidence) + '</td>';
        if (rtResult) html += '<td>' + (rtRow ? statusBadge(rtRow.status) : statusBadge(undefined)) + '</td>';
        if (trReport) {
          html += '<td>' + (trRow ? scoreBar(trRow.score) : '—') + '</td>';
          html += '<td>' + (trRow ? trRow.totalElements + (trRow.flaggedCount > 0 ? ' <span class="badge badge-red">' + trRow.flaggedCount + ' flagged</span>' : '') : '—') + '</td>';
        }
        html += '</tr>';
      }
      html += '</tbody></table>';

      // ── Needs-hint panel (unreachable routes) ─────────────────────────────
      const unreachable = rtRoutes.filter(r => r.status !== 'reachable');
      if (unreachable.length > 0) {
        html += '<div class="needs-hint">';
        html += '<div class="ht">⚠ Routes needing authentication or route hints</div>';
        for (const r of unreachable) {
          html += '<div class="needs-route">' + esc(r.route) + ' <span class="badge badge-' + (r.status === 'auth-required' ? 'yellow' : 'red') + '">' + esc(r.status) + '</span></div>';
          html += '<div class="needs-note">Add to <code>discovery.routeHints</code> with a <code>storageState</code> for authenticated routes.</div>';
        }
        html += '</div>';
      }

      // ── LLM hints panel ───────────────────────────────────────────────────
      if (llmHints) {
        html += '<div class="hints-box">';
        html += '<div class="ht">✦ LLM discovery hints (confidence: ' + Math.round(llmHints.confidence * 100) + '%)</div>';
        if (llmHints.routesToVisit && llmHints.routesToVisit.length > 0) {
          html += '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">Prioritised routes:</div>';
          for (const r of llmHints.routesToVisit) {
            html += '<div class="hint-row"><span class="hint-route">' + esc(r) + '</span></div>';
          }
        }
        if (llmHints.hiddenStatesToExplore && llmHints.hiddenStatesToExplore.length > 0) {
          html += '<div style="font-size:12px;color:var(--muted);margin:10px 0 8px">Hidden states to explore:</div>';
          for (const h of llmHints.hiddenStatesToExplore) {
            html += '<div class="hint-row"><span class="hint-route">' + esc(h.route) + '</span><span class="hint-trigger">→ ' + esc(h.triggerHint) + '</span></div>';
          }
        }
        if (llmHints.notes && llmHints.notes.length > 0) {
          html += '<div style="font-size:12px;color:var(--muted);margin:10px 0 4px">Notes:</div>';
          for (const n of llmHints.notes) html += '<div style="font-size:12px;color:var(--muted);margin-bottom:4px">' + esc(n) + '</div>';
        }
        html += '</div>';
      }

      root.innerHTML = html;
    } catch (err) {
      root.innerHTML = '<div class="err">Failed to load discovery artifacts: ' + esc(String(err)) + '</div>';
    }
  }

  render();
</script>
</body>
</html>`;
