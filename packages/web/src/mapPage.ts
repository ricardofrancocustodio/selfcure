// ---------------------------------------------------------------------------
// /map — Risk view (Tela 2 / Fase 23 — planejado)
//
// Shows a screenshot of a component with coloured overlay highlighting
// critical, warning and OK elements. The screenshot pipeline is paid
// (@selfcure/screenshot, Fase 23.5). This page renders a placeholder that
// mirrors the planned layout so users understand the value before the
// feature ships.
// ---------------------------------------------------------------------------

export const mapPageHtml = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>selfcure · risk map</title>
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
main{max-width:1200px;margin:0 auto;padding:32px 24px}
h1{font-size:22px;margin:0 0 8px}
.lede{color:var(--muted);margin:0 0 24px;font-size:14px}
.banner{background:color-mix(in srgb,var(--warning) 10%,transparent);border:1px solid color-mix(in srgb,var(--warning) 35%,transparent);border-radius:8px;padding:14px 18px;margin:0 0 28px;font-size:13px}
.banner strong{color:var(--warning)}
.wireframe{border:1px solid var(--border);border-radius:10px;background:var(--canvas-sub);padding:0;overflow:hidden;font-family:var(--mono);font-size:12px}
.wf-head{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:var(--surface);border-bottom:1px solid var(--border)}
.wf-title{font-weight:700}
.wf-score{font-family:var(--mono);font-size:14px;color:var(--error);font-weight:700}
.wf-grid{display:grid;grid-template-columns:1.6fr 1fr;min-height:480px}
.wf-canvas{position:relative;background:#1c2128;display:flex;align-items:center;justify-content:center;color:var(--muted);font-family:var(--sans);text-align:center;padding:40px}
@media(prefers-color-scheme:light){.wf-canvas{background:#eef2f6}}
.wf-canvas-inner{display:flex;flex-direction:column;gap:14px;align-items:center}
.wf-canvas-icon{font-size:48px;opacity:.45}
.wf-canvas-text{font-size:13px;max-width:300px;line-height:1.6}
.wf-overlay{position:absolute;border-radius:3px;border:2px solid;font-family:var(--mono);font-size:10px;font-weight:700;padding:2px 5px;background:rgba(0,0,0,.5);color:#fff}
.ov-red   {top:42%;left:18%;width:120px;height:34px;border-color:var(--error);  background:color-mix(in srgb,var(--error) 35%,transparent)}
.ov-yellow{top:55%;left:48%;width:100px;height:28px;border-color:var(--warning);background:color-mix(in srgb,var(--warning) 35%,transparent)}
.ov-green {top:72%;left:30%;width:90px;height:30px; border-color:var(--success);background:color-mix(in srgb,var(--success) 35%,transparent)}
.wf-side{padding:18px 20px;border-left:1px solid var(--border);background:var(--canvas);display:flex;flex-direction:column;gap:18px;font-family:var(--sans)}
.wf-side h3{margin:0 0 8px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600}
.wf-elements{display:flex;flex-direction:column;gap:6px}
.wf-elem{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-radius:6px;background:var(--canvas-sub);font-family:var(--mono);font-size:12px}
.wf-elem .name{display:flex;align-items:center;gap:6px}
.wf-elem .ico-ok{color:var(--success)}
.wf-elem .ico-warn{color:var(--warning)}
.wf-elem .ico-bad{color:var(--error)}
.wf-elem .score{color:var(--muted)}
.wf-section{padding-top:14px;border-top:1px solid var(--border)}
.wf-section ul{margin:6px 0 0;padding-left:18px;color:var(--muted)}
.wf-section li{margin:3px 0;font-size:12.5px}
.wf-source{font-family:var(--mono);font-size:12px;color:var(--muted)}
.wf-actions{display:flex;gap:8px;margin-top:8px}
.wf-actions a{font-size:11.5px;padding:5px 10px;border-radius:5px;border:1px solid var(--border);color:var(--text);text-decoration:none;cursor:pointer}
.legend{display:flex;flex-wrap:wrap;gap:14px;margin:18px 0 0;font-size:12px;color:var(--muted)}
.legend-item{display:flex;align-items:center;gap:6px}
.dot{width:10px;height:10px;border-radius:50%;display:inline-block}
.dot.red{background:var(--error)}
.dot.yellow{background:var(--warning)}
.dot.green{background:var(--success)}
.cta{margin-top:32px;padding:24px;border:1px dashed var(--border-strong);border-radius:10px;text-align:center;background:var(--canvas-sub)}
.cta h3{margin:0 0 8px;font-size:16px}
.cta p{margin:0 0 0;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<nav>
  <a class="nav-brand" href="/">selfcure</a>
  <span class="nav-sep">/</span>
  <a class="nav-link" href="/">dashboard</a>
  <a class="nav-link active" href="/map">map</a>
  <a class="nav-link" href="/evolution">evolution</a>
  <a class="nav-link" href="/crawl">crawl</a>
  <a class="nav-link" href="/tml">TML</a>
  <a class="nav-link" href="/integrations">integrations</a>
</nav>

<main>

<h1>Risk map</h1>
<p class="lede">Visual heat-map of every component: screenshots overlaid with colour-coded testability risk per element, plus accessibility violations and a one-click <em>copy prompt to IDE</em> action.</p>

<div class="banner">
  <strong>Coming soon.</strong> The risk map needs a screenshot pipeline (<code>@selfcure/screenshot</code>) which ships in <strong>Phase 23.5</strong>. The free tier will support Playwright / Cypress / Selenium / TestCafe / WebdriverIO when one of them is already installed in your project. The paid tier bundles Chromium so you don't need any test runner at all.
</div>

<div class="wireframe" aria-label="Mockup of the risk map screen">
  <div class="wf-head">
    <span class="wf-title">CheckoutPage.tsx</span>
    <span class="wf-score">Score: 38 / 100</span>
  </div>
  <div class="wf-grid">
    <div class="wf-canvas">
      <div class="wf-canvas-inner">
        <div class="wf-canvas-icon">📷</div>
        <div class="wf-canvas-text">Screenshot of the rendered component, with each interactive element framed by its testability score.</div>
      </div>
      <div class="wf-overlay ov-red">    input-cpf · 12</div>
      <div class="wf-overlay ov-yellow"> select-payment · 45</div>
      <div class="wf-overlay ov-green">  btn-finish · 92</div>
    </div>
    <div class="wf-side">
      <div>
        <h3>Detected elements (12)</h3>
        <div class="wf-elements">
          <div class="wf-elem"><span class="name"><span class="ico-ok">✓</span>btn-finalizar</span><span class="score">92</span></div>
          <div class="wf-elem"><span class="name"><span class="ico-warn">⚠</span>select-pagamento</span><span class="score">45</span></div>
          <div class="wf-elem"><span class="name"><span class="ico-bad">✗</span>input-cpf</span><span class="score">12</span></div>
          <div class="wf-elem"><span class="name"><span class="ico-bad">✗</span>select-estado</span><span class="score">8</span></div>
        </div>
      </div>

      <div class="wf-section">
        <h3>Accessibility</h3>
        <ul>
          <li>3 violações WCAG AA</li>
          <li>2 elementos sem aria-label</li>
        </ul>
      </div>

      <div class="wf-section">
        <h3>Source</h3>
        <div class="wf-source">src/pages/Checkout.tsx:42</div>
        <div class="wf-actions">
          <a>view code</a>
          <a>copy prompt</a>
        </div>
      </div>

      <div class="wf-section">
        <h3>Suggested changes</h3>
        <ul>
          <li>Add <code>data-testid</code> to ambiguous selects</li>
          <li>Add <code>aria-label</code> to inputs without labels</li>
        </ul>
      </div>
    </div>
  </div>
</div>

<div class="legend">
  <span class="legend-item"><span class="dot red"></span> critical (score &lt; 30)</span>
  <span class="legend-item"><span class="dot yellow"></span> warning (30 – 65)</span>
  <span class="legend-item"><span class="dot green"></span> ok (≥ 65)</span>
</div>

<div class="cta">
  <h3>Want this today?</h3>
  <p>The current <a href="/" style="color:var(--accent)">dashboard</a> already exposes every element + score that the risk map will use. Pull requests welcome.</p>
</div>

</main>
</body>
</html>`;
