// ---------------------------------------------------------------------------
// TML dashboard page — served at GET /tml
// Loads analysis from /api/tml-analysis and renders the distribution + findings.
// ---------------------------------------------------------------------------

export const tmlPageHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>selfcure — Tag Maturity</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg:     #0f1117; --surface: #1a1d27; --border: #2a2d3a;
      --text:   #e2e8f0; --muted:   #64748b;
      --r:      #ef4444; --y: #eab308; --b: #3b82f6; --c: #22d3ee; --g: #22c55e;
      --radius: 8px;
      --accent: #3b82f6;
      --mono: ui-monospace, SFMono-Regular, Consolas, monospace;
      --nav-h: 44px;
    }
    body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; }
    a { color: var(--b); text-decoration: none; }

    nav { position: sticky; top: 0; z-index: 100; display: flex; align-items: center; gap: 4px; padding: 0 20px; background: var(--surface); border-bottom: 1px solid var(--border); height: var(--nav-h); }
    .nav-brand { font-family: var(--mono); font-size: 13px; font-weight: 700; color: var(--accent); text-decoration: none; margin-right: 8px; }
    .nav-sep { color: var(--muted); margin: 0 2px; }
    .nav-link { font-size: 13px; padding: 4px 10px; border-radius: 6px; color: var(--muted); text-decoration: none; transition: background 100ms, color 100ms; }
    .nav-link:hover { background: rgba(255,255,255,.05); color: var(--text); }
    .nav-link.active { background: rgba(255,255,255,.08); color: var(--text); font-weight: 600; }

    .container { max-width:1100px; margin:0 auto; padding:24px; }
    .page-title { font-size:20px; font-weight:700; margin-bottom:4px; }
    .page-sub   { color:var(--muted); font-size:13px; margin-bottom:24px; }

    .grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:16px; margin-bottom:24px; }
    @media(max-width:700px){ .grid-3 { grid-template-columns:1fr; } }
    .card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); padding:20px; }
    .card-title { font-size:11px; font-weight:600; letter-spacing:.05em; text-transform:uppercase; color:var(--muted); margin-bottom:10px; }
    .stat-value { font-size:28px; font-weight:700; }
    .stat-label { font-size:12px; color:var(--muted); margin-top:2px; }

    .section-title { font-size:15px; font-weight:600; margin:24px 0 12px; }

    .dist-row { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
    .dist-label { font-weight:700; font-size:13px; min-width:52px; }
    .dist-name  { color:var(--muted); font-size:12px; min-width:68px; }
    .bar-track  { flex:1; height:14px; background:var(--border); border-radius:3px; max-width:280px; }
    .bar-fill   { height:100%; border-radius:3px; }
    .dist-count { font-size:13px; min-width:36px; text-align:right; }
    .dist-pct   { color:var(--muted); font-size:12px; min-width:40px; }

    .filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
    .filter-btn { padding:4px 12px; border-radius:999px; border:1px solid var(--border); background:transparent; color:var(--muted); font-size:12px; cursor:pointer; }
    .filter-btn.active { background:var(--b); border-color:var(--b); color:#fff; }
    .filter-btn:hover:not(.active) { border-color:var(--text); color:var(--text); }

    table { width:100%; border-collapse:collapse; background:var(--surface); border-radius:var(--radius); overflow:hidden; border:1px solid var(--border); }
    th { background:#1f2233; font-size:11px; text-transform:uppercase; letter-spacing:.05em; color:var(--muted); font-weight:600; padding:10px 14px; text-align:left; border-bottom:1px solid var(--border); }
    td { padding:10px 14px; border-bottom:1px solid var(--border); font-size:13px; vertical-align:top; }
    tr:last-child td { border-bottom:none; }
    tr:hover td { background:rgba(255,255,255,.02); }
    td.mono { font-family:monospace; font-size:12px; color:var(--muted); max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

    .badge { display:inline-flex; align-items:center; padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; }
    .badge-0 { background:rgba(239,68,68,.15);  color:var(--r); }
    .badge-1 { background:rgba(234,179,8,.15);  color:var(--y); }
    .badge-2 { background:rgba(59,130,246,.15); color:var(--b); }
    .badge-3 { background:rgba(34,211,238,.15); color:var(--c); }
    .badge-4 { background:rgba(34,197,94,.15);  color:var(--g); }
    .change  { font-size:11px; color:var(--muted); display:block; margin-top:2px; }

    .empty { color:var(--muted); text-align:center; padding:32px; font-size:13px; }
    .loading { color:var(--muted); padding:40px; text-align:center; }
    .err { color:var(--r); padding:20px; font-size:13px; }
    .cmd { font-family:monospace; background:#12141f; border:1px solid var(--border); padding:2px 6px; border-radius:4px; font-size:12px; }
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
  <a class="nav-link active" href="/tml">TML</a>
  <a class="nav-link" href="/integrations">integrations</a>
</nav>

<div class="container">
  <div class="page-title">Tag Maturity Level</div>
  <div class="page-sub">Per-element testability contract — from TML-0 (unusable) to TML-4 (governed)</div>
  <div id="root"><div class="loading">Loading TML analysis…</div></div>
</div>

<script>
  const MIN_PARAM = parseInt(new URLSearchParams(location.search).get('min') || '0', 10);

  const TML_LABELS = { 0:'unusable', 1:'fragile', 2:'usable', 3:'stable', 4:'governed' };
  const TML_COLORS = { 0:'var(--r)', 1:'var(--y)', 2:'var(--b)', 3:'var(--c)', 4:'var(--g)' };

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function badge(lvl){ return '<span class="badge badge-'+lvl+'">TML-'+lvl+' '+TML_LABELS[lvl]+'</span>'; }

  let allFindings = [];
  let activeFilter = -1; // -1 = all

  function renderDist(dist, total) {
    if (total === 0) return '<p style="color:var(--muted)">No interactive elements found.</p>';
    return [4,3,2,1,0].map(lvl => {
      const cnt = dist[lvl] || 0;
      if (cnt === 0 && lvl >= 2) return '';
      const pct = total > 0 ? Math.round(cnt/total*100) : 0;
      return '<div class="dist-row"><span class="dist-label" style="color:'+TML_COLORS[lvl]+'">TML-'+lvl+'</span>'+
        '<span class="dist-name">'+TML_LABELS[lvl]+'</span>'+
        '<div class="bar-track"><div class="bar-fill" style="width:'+pct+'%;background:'+TML_COLORS[lvl]+'"></div></div>'+
        '<span class="dist-count">'+cnt+'</span><span class="dist-pct">('+pct+'%)</span></div>';
    }).join('');
  }

  function renderTable(findings) {
    if (findings.length === 0) return '<div class="empty">✓ No elements at this level.</div>';
    return '<table><thead><tr><th>Level</th><th>File</th><th>Element</th><th>Selector</th><th>Score</th><th>Required changes</th></tr></thead><tbody>'+
      findings.map(f => {
        const changes = (f.tml.requiredChanges||[]).slice(0,2)
          .map(c => '<span class="change">→ '+esc(c.description)+'</span>').join('');
        return '<tr>'+
          '<td>'+badge(f.tml.level)+'</td>'+
          '<td class="mono">'+esc(f.filePath.split(/[/\\]/).slice(-2).join('/'))+'</td>'+
          '<td>'+esc(f.elementType)+'</td>'+
          '<td class="mono">'+esc(f.selector.slice(0,40))+'</td>'+
          '<td style="font-weight:700;color:'+(f.score>=50?'var(--y)':'var(--r)')+'">'+f.score+'</td>'+
          '<td>'+changes+'</td>'+
          '</tr>';
      }).join('')+'</tbody></table>';
  }

  function applyFilter(lvl) {
    activeFilter = lvl;
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.lvl) === lvl || (lvl === -1 && b.dataset.lvl === '-1'));
    });
    const filtered = lvl === -1 ? allFindings : allFindings.filter(f => f.tml.level === lvl);
    document.getElementById('findings-table').innerHTML = renderTable(filtered);
  }

  async function render() {
    const root = document.getElementById('root');
    try {
      const resp = await fetch('/api/tml-analysis');
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();

      allFindings = data.findings || [];
      const dist  = data.distribution || {};
      const total = data.totalElements || 0;

      const passRate = total > 0 ? Math.round((total - (data.violations||0)) / total * 100) : 100;
      const rateColor = passRate >= 90 ? 'var(--g)' : passRate >= 70 ? 'var(--y)' : 'var(--r)';

      let html = '';

      html += '<div class="grid-3">'+
        '<div class="card"><div class="card-title">Total Elements</div><div class="stat-value">'+total+'</div></div>'+
        '<div class="card"><div class="card-title">Pass Rate</div><div class="stat-value" style="color:'+rateColor+'">'+passRate+'%</div><div class="stat-label">TML ≥ '+data.minimumLevel+'</div></div>'+
        '<div class="card"><div class="card-title">Violations</div><div class="stat-value" style="color:'+(data.violations>0?'var(--r)':'var(--g)')+'">'+data.violations+'</div></div>'+
        '</div>';

      html += '<div class="section-title">Distribution</div>';
      html += '<div class="card" style="margin-bottom:24px">'+renderDist(dist, total)+'</div>';

      html += '<div class="section-title">Elements</div>';
      html += '<div class="filters">'+
        '<button class="filter-btn active" data-lvl="-1" onclick="applyFilter(-1)">All ('+allFindings.length+')</button>'+
        [0,1,2,3,4].map(lvl => {
          const cnt = allFindings.filter(f=>f.tml.level===lvl).length;
          return '<button class="filter-btn" data-lvl="'+lvl+'" onclick="applyFilter('+lvl+')">TML-'+lvl+' ('+cnt+')</button>';
        }).join('')+
        '</div>';
      html += '<div id="findings-table">'+renderTable(allFindings)+'</div>';

      root.innerHTML = html;
    } catch(err) {
      if (err.message && err.message.includes('404')) {
        root.innerHTML = '<div class="empty">TML analysis not available.<br><br>Run <span class="cmd">selfcure tml scan</span> first, or start the server with a valid config.</div>';
      } else {
        root.innerHTML = '<div class="err">'+esc(String(err))+'</div>';
      }
    }
  }
  render();
</script>
</body>
</html>`;
