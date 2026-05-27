// ---------------------------------------------------------------------------
// selfcure init — web page
// Layout: dev-tool minimalist, single column, light + auto-dark.
// Self-contained <style> block; no external CSS framework, no inline styles.
// ---------------------------------------------------------------------------

export const initPageHtml = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>selfcure — init</title>
  <style>
    :root {
      --bg:        #ffffff;
      --surface:   #fafafa;
      --text:      #0a0a0a;
      --muted:     #6b7280;
      --border:    #e5e7eb;
      --border-strong: #d1d5db;
      --accent:    #2563eb;
      --accent-fg: #ffffff;
      --accent-hover: #1d4ed8;
      --success:   #16a34a;
      --error:     #dc2626;
      --error-bg:  #fef2f2;
      --code-bg:   #f3f4f6;
      --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg:        #0a0a0a;
        --surface:   #111111;
        --text:      #fafafa;
        --muted:     #9ca3af;
        --border:    #1f1f1f;
        --border-strong: #2a2a2a;
        --accent:    #3b82f6;
        --accent-fg: #ffffff;
        --accent-hover: #60a5fa;
        --success:   #22c55e;
        --error:     #f87171;
        --error-bg:  #1a0e0e;
        --code-bg:   #161616;
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
    .nav-link:hover { background: var(--code-bg); color: var(--text); }
    .nav-link.active { background: var(--code-bg); color: var(--text); font-weight: 500; }

    main {
      max-width: 640px;
      margin: 0 auto;
      padding: 40px 24px 96px;
    }

    h1 { font-size: 20px; font-weight: 600; letter-spacing: -0.01em; margin: 0 0 4px; }
    h1::before { content: "›"; color: var(--accent); margin-right: 8px; font-family: var(--mono); }
    h2 { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
    h3 {
      font-size: 12px; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.06em; color: var(--muted); margin: 24px 0 8px;
    }
    p { margin: 0 0 12px; }
    .lede { color: var(--muted); margin: 0 0 32px; }

    code {
      font-family: var(--mono);
      font-size: 0.9em;
      background: var(--code-bg);
      padding: 1px 5px;
      border-radius: 3px;
    }

    small { color: var(--muted); font-size: 12px; }

    fieldset {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 20px 20px 8px;
      margin: 0 0 16px;
      background: var(--surface);
    }

    legend {
      font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.08em;
      color: var(--muted); padding: 0 6px;
    }

    label {
      display: inline-block;
      font-weight: 500;
      font-size: 13px;
      margin-bottom: 6px;
    }

    input[type="text"],
    input[type="url"],
    input[type="password"],
    select {
      width: 100%;
      font-family: var(--sans);
      font-size: 14px;
      color: var(--text);
      background: var(--bg);
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      padding: 8px 10px;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    input[type="text"],
    input[type="url"],
    input[type="password"] {
      font-family: var(--mono);
    }

    input:focus,
    select:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
    }

    input:disabled {
      background: var(--code-bg);
      color: var(--muted);
      cursor: not-allowed;
    }

    select {
      appearance: none;
      -webkit-appearance: none;
      background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%),
                        linear-gradient(135deg, var(--muted) 50%, transparent 50%);
      background-position: calc(100% - 16px) 50%, calc(100% - 11px) 50%;
      background-size: 5px 5px, 5px 5px;
      background-repeat: no-repeat;
      padding-right: 32px;
    }

    #extensionChecks {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 4px;
    }

    #extensionChecks label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border: 1px solid var(--border-strong);
      border-radius: 4px;
      padding: 5px 9px;
      margin: 0;
      cursor: pointer;
      font-weight: 400;
      background: var(--bg);
      transition: border-color 120ms ease, background 120ms ease;
    }

    #extensionChecks label:hover { border-color: var(--accent); }
    #extensionChecks input[type="checkbox"] { margin: 0; accent-color: var(--accent); }
    #extensionChecks code { background: transparent; padding: 0; font-size: 12px; }

    .checkbox-row {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-weight: 400;
      margin: 0;
      cursor: pointer;
    }
    .checkbox-row input[type="checkbox"] {
      margin: 2px 0 0;
      accent-color: var(--accent);
      flex-shrink: 0;
    }
    .checkbox-row span { line-height: 1.45; }

    .provider-hint {
      color: var(--muted);
      font-size: 12px;
      margin: -4px 0 14px;
    }

    .env-badge {
      display: inline-block;
      font-family: var(--mono);
      font-size: 11px;
      color: var(--success);
      margin-left: 6px;
    }

    button,
    a#downloadLink {
      font-family: var(--sans);
      font-size: 14px;
      font-weight: 500;
      border-radius: 5px;
      padding: 9px 16px;
      cursor: pointer;
      transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
      display: inline-block;
      text-decoration: none;
      line-height: 1.2;
    }

    button[type="submit"] {
      background: var(--accent);
      color: var(--accent-fg);
      border: 1px solid var(--accent);
      width: 100%;
      padding: 11px 16px;
      margin-top: 8px;
    }

    button[type="submit"]:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
    button[type="submit"]:focus-visible {
      outline: none;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent);
    }

    button[type="button"],
    a#downloadLink {
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border-strong);
    }

    button[type="button"]:hover,
    a#downloadLink:hover {
      border-color: var(--accent);
      color: var(--accent);
    }

    #errorMsg {
      color: var(--error);
      background: var(--error-bg);
      border: 1px solid color-mix(in srgb, var(--error) 35%, transparent);
      border-radius: 5px;
      padding: 8px 12px;
      font-size: 13px;
      margin: 12px 0 0;
    }

    #result h2::before {
      content: "✓";
      color: var(--accent);
      margin-right: 8px;
    }

    pre {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 14px 16px;
      font-family: var(--mono);
      font-size: 12.5px;
      line-height: 1.55;
      overflow-x: auto;
      margin: 0 0 12px;
    }

    #result p:has(#copyBtn) {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    /* ── Session banner ───────────────────────────────────────────────────── */
    #sessionBanner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: color-mix(in srgb, var(--accent) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
      border-radius: 5px;
      padding: 7px 12px;
      margin-bottom: 20px;
      font-size: 12px;
      color: var(--muted);
    }
    #sessionBanner strong { color: var(--text); font-size: 12px; }
    #clearSession {
      background: none; border: none; padding: 0;
      font-size: 12px; font-family: var(--sans);
      color: var(--accent); cursor: pointer; text-decoration: underline;
    }
    .key-saved-note {
      font-size: 12px; color: var(--success); margin: -4px 0 14px;
    }
  </style>
</head>
<body>

<nav>
  <a class="nav-brand" href="/">selfcure</a>
  <span class="nav-sep">/</span>
  <a class="nav-link active" href="/">init</a>
  <a class="nav-link" href="/crawl">crawl</a>
  <a class="nav-link" href="/lint">lint</a>
  <a class="nav-link" href="/integrations">integrations</a>
</nav>

<main>

<h1>selfcure init</h1>
<p class="lede">Fill in the details below to generate <code>selfcure.config.mjs</code> and <code>.env</code> in your project root.</p>

<form id="initForm" novalidate>

  <div id="sessionBanner" hidden>
    <span>↩ <strong>Last session restored.</strong> Key already saved in <code>.env</code> — no need to re-enter.</span>
    <button id="clearSession" type="button">clear</button>
  </div>

  <fieldset>
    <legend>Source</legend>

    <p>
      <label for="rootDir">Project source directory</label><br>
      <select id="rootDir" name="rootDir" required>
        <option value="" disabled selected>Loading…</option>
      </select>
    </p>

    <p id="rootDirCustomWrap" hidden>
      <label for="rootDirCustom">Custom path</label><br>
      <input id="rootDirCustom" name="rootDirCustom" type="text" placeholder="./path/to/source" autocomplete="off">
    </p>

    <p id="cwdInfo"><small>Config will be written to <code id="cwdPath">…</code></small></p>

    <p>
      <label for="framework">Framework</label><br>
      <select id="framework" name="framework">
        <option value="react">React</option>
        <option value="vue">Vue</option>
        <option value="angular">Angular</option>
        <option value="auto">HTML / Other</option>
      </select>
    </p>

    <p>
      <label>Component file extensions <small>(check all that apply)</small></label><br>
      <span id="extensionChecks"></span>
    </p>
  </fieldset>

  <fieldset>
    <legend>Tests</legend>

    <p>
      <label for="testsDir">Generated tests directory</label><br>
      <input id="testsDir" name="testsDir" type="text" value="./selfcure-tests" required>
    </p>

    <p>
      <label for="baseURL">Test environment URL</label><br>
      <input id="baseURL" name="baseURL" type="url" value="http://localhost:5000" required>
    </p>
  </fieldset>

  <fieldset>
    <legend>AI provider</legend>

    <p>
      <label for="provider">Provider</label><br>
      <select id="provider" name="provider" required>
        <option value="" disabled selected>Loading…</option>
      </select>
    </p>

    <p id="providerHint" class="provider-hint"></p>

    <p>
      <label for="generationModel">Generation model</label><br>
      <input id="generationModel" name="generationModel" type="text" required autocomplete="off">
    </p>

    <p>
      <label for="healingModel">Healing model</label><br>
      <input id="healingModel" name="healingModel" type="text" required autocomplete="off">
    </p>

    <p id="apiKeyWrap">
      <label for="apiKey"><span id="apiKeyLabel">API key</span></label><br>
      <input id="apiKey" name="apiKey" type="password" placeholder="" autocomplete="off">
    </p>

    <p id="useExistingWrap" hidden>
      <label class="checkbox-row">
        <input type="checkbox" id="useExisting" name="useExisting">
        <span>Use existing <code id="envVarName"></code> from this shell (recommended — value stays out of the browser).</span>
      </label>
    </p>

    <p id="aiBaseURLWrap" hidden>
      <label for="aiBaseURL">Endpoint URL</label><br>
      <input id="aiBaseURL" name="aiBaseURL" type="url" placeholder="" autocomplete="off">
    </p>

    <p><small>The key (when typed) is written only to <code>.env</code> on disk; it is never logged or sent anywhere besides this local server.</small></p>
  </fieldset>

  <p>
    <button type="submit">Generate selfcure.config.mjs</button>
  </p>

  <p id="errorMsg" hidden></p>

</form>

<section id="result" hidden>
  <h2>Done</h2>
  <p><code>selfcure.config.mjs</code> has been written to your project root.</p>
  <p id="envNote"><small></small></p>

  <h3>selfcure.config.mjs</h3>
  <pre id="configOutput"></pre>

  <p>
    <button id="copyBtn" type="button">Copy to clipboard</button>
    <a id="downloadLink" download="selfcure.config.mjs">Download selfcure.config.mjs</a>
  </p>

  <h3>Next step</h3>
  <p>Run the crawler on a specific component:</p>
  <pre id="crawlHint"></pre>
</section>

<script>
  // ── Framework + extensions ──────────────────────────────────────────────
  const EXTENSIONS = {
    react:   ['**/*.tsx', '**/*.jsx'],
    vue:     ['**/*.vue'],
    angular: ['**/*.component.ts', '**/*.component.html'],
    auto:    ['**/*.html'],
  };

  function renderExtensions(framework) {
    const checks = document.getElementById('extensionChecks');
    const exts = EXTENSIONS[framework] || EXTENSIONS.react;
    checks.innerHTML = exts.map(ext =>
      \`<label><input type="checkbox" name="include" value="\${ext}" checked> <code>\${ext}</code></label> \`
    ).join('');
  }

  const frameworkSel = document.getElementById('framework');
  frameworkSel.addEventListener('change', () => renderExtensions(frameworkSel.value));
  renderExtensions(frameworkSel.value);

  // ── Source folder picker ────────────────────────────────────────────────
  const rootDirSel    = document.getElementById('rootDir');
  const rootDirCustom = document.getElementById('rootDirCustom');
  const rootDirWrap   = document.getElementById('rootDirCustomWrap');

  function toggleRootDirCustom(show) {
    rootDirWrap.hidden = !show;
    if (show) {
      if (!rootDirCustom.value) rootDirCustom.value = './src';
      rootDirCustom.focus();
      rootDirCustom.select();
    }
  }

  rootDirSel.addEventListener('change', () => {
    toggleRootDirCustom(rootDirSel.value === '__custom__');
  });

  const dirsReady = (async function loadDirs() {
    try {
      const res  = await fetch('/api/dirs');
      const data = await res.json();
      document.getElementById('cwdPath').textContent = data.cwd || '';

      const opts = [];
      if (Array.isArray(data.dirs) && data.dirs.length > 0) {
        for (const dir of data.dirs) {
          opts.push(\`<option value="\${dir}">\${dir}</option>\`);
        }
      }
      opts.push('<option value="__custom__">Other…</option>');
      rootDirSel.innerHTML = opts.join('');

      const preferred = ['./src', './app', './lib', './source'];
      const found = preferred.find(p => (data.dirs || []).includes(p));
      if (found) {
        rootDirSel.value = found;
      } else if ((data.dirs || []).length === 0) {
        rootDirSel.value = '__custom__';
        toggleRootDirCustom(true);
      }
    } catch (err) {
      rootDirSel.innerHTML = '<option value="__custom__" selected>Custom path…</option>';
      toggleRootDirCustom(true);
    }
  })();

  // ── AI provider picker ──────────────────────────────────────────────────
  const providerSel       = document.getElementById('provider');
  const providerHint      = document.getElementById('providerHint');
  const generationModel   = document.getElementById('generationModel');
  const healingModel      = document.getElementById('healingModel');
  const apiKeyInput       = document.getElementById('apiKey');
  const apiKeyLabel       = document.getElementById('apiKeyLabel');
  const apiKeyWrap        = document.getElementById('apiKeyWrap');
  const envVarName        = document.getElementById('envVarName');
  const useExistingChk    = document.getElementById('useExisting');
  const useExistingWrap   = document.getElementById('useExistingWrap');
  const aiBaseURLInput    = document.getElementById('aiBaseURL');
  const aiBaseURLWrap     = document.getElementById('aiBaseURLWrap');

  let providerMap = {};

  function applyProvider(id) {
    const meta = providerMap[id];
    if (!meta) return;

    providerHint.textContent = meta.hint || '';
    generationModel.value    = meta.defaultGenerationModel;
    healingModel.value       = meta.defaultHealingModel;

    if (meta.envVar) {
      apiKeyWrap.hidden = false;
      apiKeyLabel.textContent = meta.label + ' API key';
      apiKeyInput.placeholder = meta.apiKeyPlaceholder || '';
      apiKeyInput.required = !meta.envSet;

      if (meta.envSet) {
        useExistingWrap.hidden = false;
        envVarName.textContent = '$' + meta.envVar;
        useExistingChk.checked = true;
        apiKeyInput.disabled   = true;
        apiKeyInput.required   = false;
      } else {
        useExistingWrap.hidden = true;
        useExistingChk.checked = false;
        apiKeyInput.disabled   = false;
        apiKeyInput.required   = true;
      }
    } else {
      // Ollama or any provider without an API key
      apiKeyWrap.hidden       = true;
      useExistingWrap.hidden  = true;
      apiKeyInput.disabled    = true;
      apiKeyInput.required    = false;
      useExistingChk.checked  = false;
    }

    if (meta.defaultBaseURL) {
      aiBaseURLWrap.hidden = false;
      aiBaseURLInput.placeholder = meta.defaultBaseURL;
      if (!aiBaseURLInput.dataset.touched) {
        aiBaseURLInput.value = meta.defaultBaseURL;
      }
    } else {
      aiBaseURLWrap.hidden = true;
      aiBaseURLInput.value = '';
    }
  }

  providerSel.addEventListener('change', () => applyProvider(providerSel.value));

  useExistingChk.addEventListener('change', () => {
    apiKeyInput.disabled = useExistingChk.checked;
    apiKeyInput.required = !useExistingChk.checked;
    if (useExistingChk.checked) apiKeyInput.value = '';
  });

  aiBaseURLInput.addEventListener('input', () => {
    aiBaseURLInput.dataset.touched = '1';
  });

  const providersReady = (async function loadProviders() {
    try {
      const res  = await fetch('/api/providers');
      const data = await res.json();
      providerMap = {};
      const opts = [];

      for (const p of data.providers || []) {
        providerMap[p.id] = p;
        const marker = p.envSet && p.envVar ? '  ✓' : '';
        opts.push(\`<option value="\${p.id}">\${p.label}\${marker}</option>\`);
      }
      providerSel.innerHTML = opts.join('');

      const initial = data.suggested && providerMap[data.suggested] ? data.suggested : (data.providers[0] && data.providers[0].id);
      if (initial) {
        providerSel.value = initial;
        applyProvider(initial);
      }
    } catch (err) {
      providerHint.textContent = 'Failed to load providers — check the server logs.';
    }
  })();

  // ── Session restore ─────────────────────────────────────────────────────
  (async function applySession() {
    try {
      const [, , { session, keyIsSet }] = await Promise.all([
        dirsReady,
        providersReady,
        fetch('/api/session').then(r => r.json()),
      ]);

      if (!session) return;

      // Root dir
      const availableOpts = [...rootDirSel.options].map(o => o.value);
      if (availableOpts.includes(session.rootDir)) {
        rootDirSel.value = session.rootDir;
        toggleRootDirCustom(false);
      } else {
        rootDirSel.value = '__custom__';
        rootDirCustom.value = session.rootDir;
        toggleRootDirCustom(true);
      }

      // Framework + extensions
      if (session.framework) {
        frameworkSel.value = session.framework;
        renderExtensions(session.framework);
        if (Array.isArray(session.include) && session.include.length > 0) {
          document.querySelectorAll('#extensionChecks input[type="checkbox"]').forEach(cb => {
            cb.checked = session.include.includes(cb.value);
          });
        }
      }

      // Tests
      if (session.testsDir) document.getElementById('testsDir').value = session.testsDir;
      if (session.baseURL)  document.getElementById('baseURL').value  = session.baseURL;

      // Provider + models
      if (session.ai?.provider && providerMap[session.ai.provider]) {
        providerSel.value = session.ai.provider;
        applyProvider(session.ai.provider);
        if (session.ai.generationModel) generationModel.value = session.ai.generationModel;
        if (session.ai.healingModel)    healingModel.value    = session.ai.healingModel;
        if (session.ai.baseURL) {
          aiBaseURLInput.value = session.ai.baseURL;
          aiBaseURLInput.dataset.touched = '1';
        }
      }

      // Key status from .env — override the "use existing" UI
      if (keyIsSet && !apiKeyWrap.hidden) {
        useExistingWrap.hidden = false;
        useExistingChk.checked = true;
        apiKeyInput.disabled   = true;
        apiKeyInput.required   = false;
        apiKeyInput.value      = '';
        const envVar = providerMap[session.ai?.provider]?.envVar || '';
        envVarName.textContent = '$' + envVar;
      }

      // Show the banner (tweak text when key is NOT saved yet)
      const banner = document.getElementById('sessionBanner');
      if (!keyIsSet) {
        banner.querySelector('span').textContent =
          '↩ Last session restored — enter your API key to continue.';
      }
      banner.hidden = false;
    } catch { /* session loading is non-critical */ }
  })();

  document.getElementById('clearSession').addEventListener('click', async () => {
    await fetch('/api/session', { method: 'DELETE' });
    location.reload();
  });

  // ── Submit ──────────────────────────────────────────────────────────────
  document.getElementById('initForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.hidden = true;

    const include = [...form.querySelectorAll('input[name="include"]:checked')]
      .map(el => el.value);

    const rootDirSelected = form.rootDir.value;
    const rootDir = rootDirSelected === '__custom__'
      ? rootDirCustom.value.trim()
      : rootDirSelected;

    const meta = providerMap[providerSel.value] || {};
    const wantsKey = Boolean(meta.envVar);
    const usingEnv = wantsKey && useExistingChk.checked && meta.envSet;

    const ai = {
      provider:        providerSel.value,
      generationModel: generationModel.value.trim(),
      healingModel:    healingModel.value.trim(),
      apiKey:          usingEnv ? '' : apiKeyInput.value.trim(),
      useExistingEnv:  usingEnv,
    };

    if (!aiBaseURLWrap.hidden) {
      ai.baseURL = aiBaseURLInput.value.trim();
    }

    const payload = {
      rootDir,
      framework: form.framework.value,
      include,
      testsDir:  form.testsDir.value.trim(),
      baseURL:   form.baseURL.value.trim(),
      ai,
    };

    if (!payload.rootDir) {
      errorMsg.textContent = 'Project source directory is required.';
      errorMsg.hidden = false;
      return;
    }

    if (!ai.provider) {
      errorMsg.textContent = 'Pick an AI provider.';
      errorMsg.hidden = false;
      return;
    }

    if (wantsKey && !usingEnv && !ai.apiKey) {
      errorMsg.textContent = (meta.label || 'Provider') + ' API key is required.';
      errorMsg.hidden = false;
      return;
    }

    try {
      const res = await fetch('/api/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Server error');
      }

      document.getElementById('configOutput').textContent = data.configContent;
      document.querySelector('#envNote small').textContent = data.envNote || '';

      const blob = new Blob([data.configContent], { type: 'text/javascript' });
      const url  = URL.createObjectURL(blob);
      const dl   = document.getElementById('downloadLink');
      dl.href = url;

      document.getElementById('crawlHint').textContent =
        'selfcure crawl ' + payload.rootDir;

      document.getElementById('result').hidden = false;
      form.hidden = true;
    } catch (err) {
      errorMsg.textContent = err.message;
      errorMsg.hidden = false;
    }
  });

  document.getElementById('copyBtn').addEventListener('click', () => {
    const text = document.getElementById('configOutput').textContent;
    navigator.clipboard.writeText(text).catch(() => {});
  });
</script>

</main>

</body>
</html>
`;
