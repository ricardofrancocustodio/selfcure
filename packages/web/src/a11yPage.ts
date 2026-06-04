export const a11yPageHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>selfcure — Accessibility</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --canvas:#0d1117;--canvas-sub:#161b22;--border:#30363d;--text:#e6edf3;--muted:#8b949e;
  --error:#f85149;--error-bg:#3d1a1a;--warning:#d29922;--warning-bg:#2d2100;
  --info:#58a6ff;--info-bg:#1c2c43;--success:#3fb950;--success-bg:#122620;
  --minor:#58a6ff;--minor-bg:#1c2c43;
  --radius:6px;--font:system-ui,-apple-system,sans-serif;--mono:'SFMono-Regular',Consolas,'Liberation Mono',monospace;--accent:#58a6ff;--border-hi:#6e7681;--nav-h:44px;
}
body{font-family:var(--font);background:var(--canvas);color:var(--text);min-height:100vh}
a{color:var(--info);text-decoration:none}
a:hover{text-decoration:underline}

/* ── nav ─────────────────────────────────────────────────────────────────── */
nav{position:sticky;top:0;z-index:200;display:flex;align-items:center;gap:4px;padding:0 16px;background:var(--canvas-sub);border-bottom:1px solid var(--border);height:var(--nav-h)}
.nav-brand{font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent);text-decoration:none;margin-right:8px}
.nav-sep{color:var(--border-hi);margin:0 2px}
.nav-link{font-size:13px;padding:4px 10px;border-radius:6px;color:var(--muted);text-decoration:none;transition:background 100ms,color 100ms}
.nav-link:hover{background:rgba(255,255,255,.08);color:var(--text)}
.nav-link.active{background:rgba(255,255,255,.1);color:var(--text);font-weight:600}

/* ── layout ──────────────────────────────────────────────────────────────── */
.wrap{max-width:1100px;margin:0 auto;padding:1.5rem 1rem 3rem}

/* ── run-bar ─────────────────────────────────────────────────────────────── */
.run-bar{display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;background:var(--canvas-sub);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:1.25rem;flex-wrap:wrap}
.run-bar label{font-size:.8rem;color:var(--muted)}
.run-bar input[type=text]{background:var(--canvas);border:1px solid var(--border);color:var(--text);padding:.35rem .6rem;border-radius:var(--radius);font-size:.82rem;width:260px}
.btn{padding:.35rem .85rem;border-radius:var(--radius);font-size:.82rem;cursor:pointer;border:none;font-weight:600}
.btn-primary{background:var(--success-bg);color:var(--success);border:1px solid var(--success)}
.btn-primary:hover{background:var(--success);color:#000}
.status{font-size:.78rem;color:var(--muted);margin-left:auto}

/* ── summary bar ─────────────────────────────────────────────────────────── */
.summary-bar{display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1.25rem}
.stat-card{background:var(--canvas-sub);border:1px solid var(--border);border-radius:var(--radius);padding:.6rem 1rem;min-width:90px;text-align:center}
.stat-card .num{font-size:1.5rem;font-weight:700}
.stat-card .lbl{font-size:.72rem;color:var(--muted);margin-top:.1rem}
.num-critical{color:var(--error)}
.num-major{color:var(--warning)}
.num-minor{color:var(--minor)}
.num-ok{color:var(--success)}
.num-muted{color:var(--muted)}

/* ── filters ─────────────────────────────────────────────────────────────── */
.filters{display:flex;gap:.5rem;align-items:center;margin-bottom:1rem;flex-wrap:wrap}
.filters label{font-size:.8rem;color:var(--muted)}
.filters select{background:var(--canvas-sub);border:1px solid var(--border);color:var(--text);padding:.3rem .5rem;border-radius:var(--radius);font-size:.8rem}
.filter-count{font-size:.78rem;color:var(--muted);margin-left:auto}

/* ── file group ──────────────────────────────────────────────────────────── */
.file-group{background:var(--canvas-sub);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:.75rem;overflow:hidden}
.file-header{display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;background:var(--canvas-sub);border-bottom:1px solid var(--border);cursor:pointer;user-select:none}
.file-header:hover{background:#1c2128}
.file-path{font-family:var(--mono);font-size:.78rem;color:var(--text);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.file-badge{font-size:.72rem;padding:.1rem .4rem;border-radius:3px;font-weight:700}
.badge-critical{background:var(--error-bg);color:var(--error)}
.badge-major{background:var(--warning-bg);color:var(--warning)}
.badge-minor{background:var(--minor-bg);color:var(--minor)}
.badge-mixed{background:#2d2d3d;color:var(--muted)}
.chevron{color:var(--muted);font-size:.7rem;transition:transform .15s}
.chevron.open{transform:rotate(90deg)}

/* ── finding row ─────────────────────────────────────────────────────────── */
.finding{display:grid;grid-template-columns:80px 1fr;gap:0;border-bottom:1px solid var(--border)}
.finding:last-child{border-bottom:none}
.finding-sev{display:flex;align-items:flex-start;justify-content:center;padding:.6rem .5rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
.sev-critical{color:var(--error);background:var(--error-bg)}
.sev-major{color:var(--warning);background:var(--warning-bg)}
.sev-minor{color:var(--minor);background:var(--minor-bg)}
.sev-info{color:var(--muted);background:var(--canvas)}
.finding-body{padding:.6rem .75rem;display:grid;gap:.2rem}
.finding-rule{font-family:var(--mono);font-size:.78rem;color:var(--text);font-weight:600}
.finding-msg{font-size:.82rem;color:var(--text)}
.finding-rem{font-size:.78rem;color:var(--muted)}
.finding-loc{font-family:var(--mono);font-size:.72rem;color:var(--muted)}
.finding-wcag{font-size:.72rem;color:var(--muted)}
.finding-wcag a{color:var(--info);font-size:.72rem}

/* ── empty / loading ─────────────────────────────────────────────────────── */
.empty{text-align:center;padding:4rem 2rem;color:var(--muted)}
.empty h3{font-size:1rem;color:var(--text);margin-bottom:.5rem}
.empty code{font-family:var(--mono);font-size:.82rem;background:var(--canvas-sub);padding:.2rem .4rem;border-radius:3px}
.all-clear{text-align:center;padding:3rem;color:var(--success)}

/* ── status pill ─────────────────────────────────────────────────────────── */
.status-pill{font-size:.7rem;padding:.1rem .35rem;border-radius:3px;font-weight:700;text-transform:uppercase}
.pill-open{background:var(--error-bg);color:var(--error)}
.pill-resolved{background:var(--success-bg);color:var(--success)}
.pill-suppressed{background:#2d2d3d;color:var(--muted)}
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

<div class="wrap">
  <div class="run-bar">
    <label>Findings file</label>
    <input type="text" id="findingsPath" value=".selfcure/a11y-findings.json" placeholder=".selfcure/a11y-findings.json"/>
    <button class="btn btn-primary" id="loadBtn">Load</button>
    <span class="status" id="status"></span>
  </div>

  <div id="summary-bar" class="summary-bar" style="display:none"></div>

  <div id="filters" class="filters" style="display:none">
    <label>Severity</label>
    <select id="sevFilter">
      <option value="all">All</option>
      <option value="critical">Critical</option>
      <option value="major">Major</option>
      <option value="minor">Minor</option>
      <option value="info">Info</option>
    </select>
    <label>Status</label>
    <select id="statusFilter">
      <option value="open">Open</option>
      <option value="resolved">Resolved</option>
      <option value="suppressed">Suppressed</option>
      <option value="all">All</option>
    </select>
    <span class="filter-count" id="filterCount"></span>
  </div>

  <div id="findings" ></div>
</div>

<script>
(function(){
  var $ = function(id){ return document.getElementById(id); };
  var state = { findings: [], wcagLevel: 'AA', app: '' };

  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function sevClass(s){
    if(s==='critical') return 'sev-critical';
    if(s==='major')    return 'sev-major';
    if(s==='minor')    return 'sev-minor';
    return 'sev-info';
  }

  function badgeClass(findings){
    var sevs = findings.map(function(f){ return f.severity; });
    if(sevs.includes('critical')) return 'badge-critical';
    if(sevs.includes('major'))    return 'badge-major';
    if(sevs.includes('minor'))    return 'badge-minor';
    return 'badge-mixed';
  }

  function statusPill(status){
    var cls = status === 'open' ? 'pill-open' : status === 'resolved' ? 'pill-resolved' : 'pill-suppressed';
    return '<span class="status-pill ' + cls + '">' + esc(status) + '</span>';
  }

  function renderFinding(f){
    var wcagLinks = f.wcag.map(function(w){
      return '<a href="https://www.w3.org/WAI/WCAG21/Understanding/" target="_blank" rel="noreferrer">' + esc(w) + '</a>';
    }).join(', ');
    return '<div class="finding">' +
      '<div class="finding-sev ' + sevClass(f.severity) + '">' + esc(f.severity) + '</div>' +
      '<div class="finding-body">' +
        '<div class="finding-rule">' + esc(f.ruleId.replace('a11y.','')); +
          '&nbsp;&nbsp;' + statusPill(f.status) + '</div>' +
        '<div class="finding-msg">' + esc(f.message) + '</div>' +
        '<div class="finding-rem">' + esc(f.remediation) + '</div>' +
        '<div class="finding-loc">' + esc(f.sourceFile) + ':' + f.line + (f.column ? ':' + f.column : '') + '</div>' +
        '<div class="finding-wcag">WCAG ' + wcagLinks + '</div>' +
      '</div>' +
    '</div>';
  }

  function renderGroup(fp, findings){
    var id = 'grp-' + Math.random().toString(36).slice(2);
    var badge = '<span class="file-badge ' + badgeClass(findings) + '">' + findings.length + '</span>';
    var rows  = findings.map(renderFinding).join('');
    return '<div class="file-group">' +
      '<div class="file-header" onclick="toggleGroup(\'' + id + '\')">' +
        '<span class="chevron open" id="chev-' + id + '">▶</span>' +
        '<span class="file-path">' + esc(fp) + '</span>' +
        badge +
      '</div>' +
      '<div id="' + id + '">' + rows + '</div>' +
    '</div>';
  }

  window.toggleGroup = function(id){
    var el   = document.getElementById(id);
    var chev = document.getElementById('chev-' + id);
    if(!el) return;
    var hidden = el.style.display === 'none';
    el.style.display    = hidden ? '' : 'none';
    chev.className = hidden ? 'chevron open' : 'chevron';
  };

  function render(){
    var sev    = $('sevFilter').value;
    var status = $('statusFilter').value;

    var filtered = state.findings.filter(function(f){
      if(sev    !== 'all' && f.severity !== sev)   return false;
      if(status !== 'all' && f.status   !== status) return false;
      return true;
    });

    $('filterCount').textContent = filtered.length + ' of ' + state.findings.length + ' findings';

    if(filtered.length === 0){
      $('findings').innerHTML = '<div class="all-clear"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="8,12 11,15 16,9"/></svg><p>No findings match the current filters.</p></div>';
      return;
    }

    var byFile = new Map();
    filtered.forEach(function(f){
      var list = byFile.get(f.sourceFile) || [];
      list.push(f);
      byFile.set(f.sourceFile, list);
    });

    var html = '';
    byFile.forEach(function(fds, fp){ html += renderGroup(fp, fds); });
    $('findings').innerHTML = html;
  }

  function renderSummary(inventory){
    var open  = inventory.findings.filter(function(f){ return f.status === 'open'; });
    var res   = inventory.findings.filter(function(f){ return f.status === 'resolved'; });
    var supp  = inventory.findings.filter(function(f){ return f.status === 'suppressed'; });
    var crit  = open.filter(function(f){ return f.severity === 'critical'; }).length;
    var major = open.filter(function(f){ return f.severity === 'major'; }).length;
    var minor = open.filter(function(f){ return f.severity === 'minor'; }).length;

    var bar = $('summary-bar');
    bar.style.display = 'flex';
    bar.innerHTML =
      '<div class="stat-card"><div class="num num-critical">' + crit  + '</div><div class="lbl">Critical</div></div>' +
      '<div class="stat-card"><div class="num num-major">'    + major + '</div><div class="lbl">Major</div></div>' +
      '<div class="stat-card"><div class="num num-minor">'    + minor + '</div><div class="lbl">Minor</div></div>' +
      '<div class="stat-card"><div class="num num-muted">'    + open.length + '</div><div class="lbl">Open</div></div>' +
      '<div class="stat-card"><div class="num num-ok">'       + res.length  + '</div><div class="lbl">Resolved</div></div>' +
      '<div class="stat-card"><div class="num num-muted">'    + supp.length + '</div><div class="lbl">Suppressed</div></div>' +
      '<div class="stat-card"><div class="num" style="font-size:1rem;padding-top:.3rem;">' + esc(inventory.targetLevel) + '</div><div class="lbl">WCAG Level</div></div>';
  }

  function load(){
    var fp = $('findingsPath').value.trim() || '.selfcure/a11y-findings.json';
    $('status').textContent = 'Loading…';
    $('summary-bar').style.display = 'none';
    $('filters').style.display = 'none';
    $('findings').innerHTML = '';

    fetch('/api/a11y-findings?path=' + encodeURIComponent(fp))
      .then(function(r){ return r.json(); })
      .then(function(data){
        if(data.error){
          $('status').textContent = data.error;
          $('findings').innerHTML = '<div class="empty"><h3>No findings file found</h3><p>Run <code>selfcure a11y scan</code> to generate it, then reload.</p></div>';
          return;
        }
        state.findings    = data.findings || [];
        state.wcagLevel   = data.targetLevel || 'AA';
        state.app         = data.app || '';
        $('status').textContent = data.app + ' · WCAG ' + data.targetLevel + ' · ' + state.findings.length + ' total findings';
        renderSummary(data);
        $('filters').style.display = 'flex';
        render();
      })
      .catch(function(err){
        $('status').textContent = String(err);
      });
  }

  $('loadBtn').addEventListener('click', load);
  $('sevFilter').addEventListener('change', render);
  $('statusFilter').addEventListener('change', render);
  load();
})();
</script>
</body>
</html>`;
