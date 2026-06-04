// ---------------------------------------------------------------------------
// /evolution — Maturity over time (Tela 3)
//
// Free tier: reads .selfcure/history.json (per-machine, per-repo) and renders
// a small SVG line chart of overall score + governed elements over time. If
// no history exists yet, shows an onboarding hint with the command to run.
//
// Paid tier (planned): same UI but backed by a shared cloud store so a whole
// squad can compare branches and track PRs that moved the score.
// ---------------------------------------------------------------------------

export const evolutionPageHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>selfcure · evolution</title>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
:root{
  --bg:#0d1117;--canvas:#0d1117;--canvas-sub:#161b22;--surface:#161b22;
  --text:#c9d1d9;--muted:#8b949e;--border:#30363d;--border-strong:#444c56;
  --accent:#58a6ff;--success:#3fb950;--warning:#d29922;--error:#f85149;
  --mono:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;
  --sans:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
}
@media(prefers-color-scheme:light){
  :root{
    --bg:#ffffff;--canvas:#ffffff;--canvas-sub:#f6f8fa;--surface:#f6f8fa;
    --text:#1f2328;--muted:#656d76;--border:#d1d9e0;--border-strong:#afb8c1;
    --accent:#0969da;--success:#1a7f37;--warning:#9a6700;--error:#cf222e;
  }
}
*{box-sizing:border-box}
body{margin:0;font-family:var(--sans);background:var(--bg);color:var(--text);font-size:14px;line-height:1.5}
nav{display:flex;align-items:center;gap:6px;padding:10px 20px;background:var(--canvas-sub);border-bottom:1px solid var(--border);flex-wrap:wrap}
.nav-brand{font-family:var(--mono);font-size:13px;font-weight:700;color:var(--accent);text-decoration:none;margin-right:8px}
.nav-sep{color:var(--muted);font-size:13px;margin:0 4px}
.nav-link{font-size:13px;padding:4px 10px;border-radius:6px;color:var(--muted);text-decoration:none;transition:background 100ms,color 100ms}
.nav-link:hover{background:var(--canvas-sub);color:var(--text)}
.nav-link.active{background:var(--canvas-sub);color:var(--text);font-weight:600;border:1px solid var(--border)}
main{max-width:1100px;margin:0 auto;padding:28px 24px}
h1{font-size:22px;margin:0 0 6px}
.lede{color:var(--muted);margin:0 0 22px;font-size:14px}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 18px;align-items:center}
.bar label{font-size:12px;color:var(--muted)}
.bar select,.bar button{font-size:13px;padding:5px 10px;border-radius:6px;border:1px solid var(--border-strong);background:var(--canvas);color:var(--text);font-family:var(--sans)}
.bar button{cursor:pointer;background:var(--accent);color:#fff;border-color:var(--accent)}
.bar button:hover{filter:brightness(1.05)}
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:0 0 22px}
.kpi{border:1px solid var(--border);border-radius:10px;background:var(--canvas-sub);padding:14px 16px}
.kpi .label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.kpi .val{font-size:24px;font-weight:700;margin-top:4px}
.kpi .delta{font-size:12px;margin-top:2px;color:var(--muted)}
.kpi .delta.up{color:var(--success)}
.kpi .delta.down{color:var(--error)}
.chart-wrap{border:1px solid var(--border);border-radius:10px;background:var(--canvas-sub);padding:18px;margin:0 0 22px}
.chart-title{margin:0 0 8px;font-size:14px;font-weight:600}
.chart{display:block;width:100%;height:auto}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin-top:8px;font-size:12px;color:var(--muted)}
.legend-item{display:flex;align-items:center;gap:6px}
.swatch{width:14px;height:3px;border-radius:2px;display:inline-block}
.empty{text-align:center;padding:48px 24px;border:1px dashed var(--border-strong);border-radius:10px;background:var(--canvas-sub);color:var(--muted)}
.empty h2{color:var(--text);font-size:18px;margin:0 0 8px}
.empty code{background:var(--surface);padding:2px 6px;border-radius:4px;font-family:var(--mono);font-size:12.5px;color:var(--text);border:1px solid var(--border)}
.runs-table{width:100%;border-collapse:collapse;font-size:13px;background:var(--canvas-sub);border:1px solid var(--border);border-radius:10px;overflow:hidden}
.runs-table th,.runs-table td{padding:8px 12px;text-align:left;border-bottom:1px solid var(--border)}
.runs-table th{background:var(--surface);font-weight:600;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
.runs-table tr:last-child td{border-bottom:none}
.runs-table .num{font-family:var(--mono);text-align:right}
.note{margin-top:24px;padding:14px 16px;border:1px solid var(--border);border-radius:8px;background:var(--canvas-sub);color:var(--muted);font-size:12.5px;line-height:1.6}
.note strong{color:var(--text)}
</style>
</head>
<body>
<nav>
  <a class="nav-brand" href="/">selfcure</a>
  <span class="nav-sep">/</span>
  <a class="nav-link" href="/">dashboard</a>
  <a class="nav-link" href="/map">map</a>
  <a class="nav-link active" href="/evolution">evolution</a>
  <a class="nav-link" href="/crawl">crawl</a>
  <a class="nav-link" href="/tml">TML</a>
  <a class="nav-link" href="/integrations">integrations</a>
</nav>

<main>

<h1>Maturity over time</h1>
<p class="lede">Local history of every <code>selfcure lint</code> / <code>selfcure web</code> run on this machine — overall testability score and number of governed elements.</p>

<div class="bar">
  <label for="period">Period:</label>
  <select id="period">
    <option value="7">Last 7 days</option>
    <option value="30" selected>Last 30 days</option>
    <option value="90">Last 90 days</option>
    <option value="all">All time</option>
  </select>
  <button id="reload" type="button">Reload</button>
  <span id="status" style="color:var(--muted);font-size:12px"></span>
</div>

<div id="content"></div>

<div class="note">
  <strong>Free tier:</strong> history is stored locally in <code>.selfcure/history.json</code> — useful for the developer who runs selfcure on their own machine.
  <strong>Paid tier (planned):</strong> shared cloud history per repo, multi-user, branch comparison and PR markers.
</div>

</main>

<script>
function $(id){return document.getElementById(id)}
function fmtTs(ts){var d=new Date(ts);return d.toLocaleDateString()+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function colourScore(n){if(n>=80)return'var(--success)';if(n>=50)return'var(--warning)';return'var(--error)'}
function emptyState(){
  return '<div class="empty">'+
    '<h2>No runs recorded yet</h2>'+
    '<p>Every time you load the <a href="/" style="color:var(--accent)">dashboard</a> or run <code>selfcure lint</code>, a new entry is appended to <code>.selfcure/history.json</code>.</p>'+
    '<p>Open the dashboard once and come back here.</p>'+
    '</div>';
}
function buildChart(rows){
  if(rows.length===0)return'';
  // Two series, normalised to the same SVG y-axis (0..100 for score; 0..max for governed)
  var W=800,H=240,P=36;
  var xs=rows.map(function(r,i){return P+(W-2*P)*(rows.length===1?0.5:i/(rows.length-1))});
  var maxGov=Math.max.apply(null,rows.map(function(r){return r.governedElements||0}))||1;
  var ysScore=rows.map(function(r){return H-P-((H-2*P)*(r.overallScore||0)/100)});
  var ysGov  =rows.map(function(r){return H-P-((H-2*P)*(r.governedElements||0)/maxGov)});
  function path(ys){var d='';for(var i=0;i<ys.length;i++)d+=(i===0?'M':'L')+xs[i]+' '+ys[i];return d}
  var grid='';
  for(var k=0;k<=4;k++){var y=P+(H-2*P)*k/4;grid+='<line x1="'+P+'" x2="'+(W-P)+'" y1="'+y+'" y2="'+y+'" stroke="var(--border)" stroke-width="1"/>'}
  var labels='<text x="'+P+'" y="'+(H-8)+'" fill="var(--muted)" font-size="11">'+fmtTs(rows[0].ts)+'</text>'+
             '<text x="'+(W-P)+'" y="'+(H-8)+'" fill="var(--muted)" font-size="11" text-anchor="end">'+fmtTs(rows[rows.length-1].ts)+'</text>'+
             '<text x="'+(P-6)+'" y="'+(P+4)+'" fill="var(--muted)" font-size="11" text-anchor="end">100</text>'+
             '<text x="'+(P-6)+'" y="'+(H-P+4)+'" fill="var(--muted)" font-size="11" text-anchor="end">0</text>';
  var dots='';
  for(var i=0;i<xs.length;i++){
    dots+='<circle cx="'+xs[i]+'" cy="'+ysScore[i]+'" r="3" fill="var(--accent)"/>';
    dots+='<circle cx="'+xs[i]+'" cy="'+ysGov[i]+'" r="3" fill="var(--success)"/>';
  }
  return '<svg class="chart" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Score and governed elements over time">'+
    grid+
    '<path d="'+path(ysGov)+'" fill="none" stroke="var(--success)" stroke-width="2"/>'+
    '<path d="'+path(ysScore)+'" fill="none" stroke="var(--accent)" stroke-width="2"/>'+
    dots+labels+
    '</svg>';
}
function buildKpis(rows){
  if(rows.length===0)return'';
  var first=rows[0],last=rows[rows.length-1];
  var dScore=Math.round((last.overallScore||0)-(first.overallScore||0));
  var dGov  =(last.governedElements||0)-(first.governedElements||0);
  var dIss  =(last.totalIssues||0)-(first.totalIssues||0);
  function delta(v){
    if(v>0) return '<div class="delta up">+'+v+' since first run</div>';
    if(v<0) return '<div class="delta down">'+v+' since first run</div>';
    return '<div class="delta">no change</div>';
  }
  function deltaInverse(v){ // for issues, lower is better
    if(v<0) return '<div class="delta up">'+v+' since first run</div>';
    if(v>0) return '<div class="delta down">+'+v+' since first run</div>';
    return '<div class="delta">no change</div>';
  }
  return '<div class="kpis">'+
    '<div class="kpi"><div class="label">Score</div><div class="val" style="color:'+colourScore(last.overallScore)+'">'+Math.round(last.overallScore||0)+'</div>'+delta(dScore)+'</div>'+
    '<div class="kpi"><div class="label">Governed elements</div><div class="val">'+(last.governedElements||0)+'</div>'+delta(dGov)+'</div>'+
    '<div class="kpi"><div class="label">Open issues</div><div class="val">'+(last.totalIssues||0)+'</div>'+deltaInverse(dIss)+'</div>'+
    '<div class="kpi"><div class="label">Components</div><div class="val">'+(last.totalComponents||0)+'</div></div>'+
    '</div>';
}
function buildTable(rows){
  if(rows.length===0)return'';
  var slice=rows.slice().reverse().slice(0,12);
  var trs=slice.map(function(r){
    return '<tr>'+
      '<td>'+fmtTs(r.ts)+'</td>'+
      '<td class="num" style="color:'+colourScore(r.overallScore)+'">'+Math.round(r.overallScore||0)+'</td>'+
      '<td class="num">'+(r.governedElements||0)+'</td>'+
      '<td class="num">'+(r.totalIssues||0)+'</td>'+
      '<td class="num">'+(r.totalComponents||0)+'</td>'+
    '</tr>';
  }).join('');
  return '<div class="chart-wrap"><div class="chart-title">Recent runs</div>'+
    '<table class="runs-table"><thead><tr><th>When</th><th class="num">Score</th><th class="num">Governed</th><th class="num">Issues</th><th class="num">Components</th></tr></thead><tbody>'+trs+'</tbody></table></div>';
}
function filterByPeriod(rows,period){
  if(period==='all')return rows;
  var days=parseInt(period,10);if(!days)return rows;
  var cutoff=Date.now()-days*24*3600*1000;
  return rows.filter(function(r){return new Date(r.ts).getTime()>=cutoff})
}
async function load(){
  $('status').textContent='Loading…';
  try{
    var r=await fetch('/api/history');
    var data=await r.json();
    if(!Array.isArray(data))data=[];
    data.sort(function(a,b){return new Date(a.ts).getTime()-new Date(b.ts).getTime()});
    var period=$('period').value;
    var filtered=filterByPeriod(data,period);
    if(filtered.length===0){
      $('content').innerHTML=emptyState();
      $('status').textContent='0 runs';
      return;
    }
    var html='';
    html+=buildKpis(filtered);
    html+='<div class="chart-wrap"><div class="chart-title">Score vs governed elements</div>'+buildChart(filtered)+
      '<div class="legend">'+
        '<span class="legend-item"><span class="swatch" style="background:var(--accent)"></span> overall score (0-100)</span>'+
        '<span class="legend-item"><span class="swatch" style="background:var(--success)"></span> governed elements (count)</span>'+
      '</div></div>';
    html+=buildTable(filtered);
    $('content').innerHTML=html;
    $('status').textContent=filtered.length+' run'+(filtered.length===1?'':'s');
  }catch(err){
    $('content').innerHTML='<div class="empty"><h2>Failed to load history</h2><p>'+(err.message||err)+'</p></div>';
    $('status').textContent='';
  }
}
$('period').addEventListener('change',load);
$('reload').addEventListener('click',load);
load();
</script>
</body>
</html>`;
