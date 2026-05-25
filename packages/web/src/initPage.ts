// ---------------------------------------------------------------------------
// selfcure init — web page (no layout; styling deferred to a later task)
// ---------------------------------------------------------------------------

export const initPageHtml = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>selfcure — init</title>
</head>
<body>

<h1>selfcure init</h1>
<p>Fill in the details below to generate <code>selfcure.config.js</code> and <code>.env</code> in your project root.</p>

<form id="initForm" novalidate>

  <fieldset>
    <legend>Source</legend>

    <p>
      <label for="rootDir">Project source directory</label><br>
      <input id="rootDir" name="rootDir" type="text" value="./src" required>
    </p>

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
    <legend>API</legend>

    <p>
      <label for="apiKey">Anthropic API key</label><br>
      <input id="apiKey" name="apiKey" type="password" placeholder="sk-ant-..." required autocomplete="off">
    </p>
    <p><small>The key is written only to <code>.env</code> on disk and is never logged or transmitted beyond this page.</small></p>
  </fieldset>

  <p>
    <button type="submit">Generate selfcure.config.js</button>
  </p>

  <p id="errorMsg" hidden></p>

</form>

<section id="result" hidden>
  <h2>Done</h2>
  <p><code>selfcure.config.js</code> and <code>.env</code> have been written to your project root.</p>

  <h3>selfcure.config.js</h3>
  <pre id="configOutput"></pre>

  <p>
    <button id="copyBtn" type="button">Copy to clipboard</button>
    <a id="downloadLink" download="selfcure.config.js">Download selfcure.config.js</a>
  </p>

  <h3>Next step</h3>
  <p>Run the crawler on a specific component:</p>
  <pre id="crawlHint"></pre>
</section>

<script>
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

  document.getElementById('initForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const form = e.target;
    const errorMsg = document.getElementById('errorMsg');
    errorMsg.hidden = true;

    const include = [...form.querySelectorAll('input[name="include"]:checked')]
      .map(el => el.value);

    const payload = {
      rootDir:   form.rootDir.value.trim(),
      framework: form.framework.value,
      include,
      testsDir:  form.testsDir.value.trim(),
      baseURL:   form.baseURL.value.trim(),
      apiKey:    form.apiKey.value.trim(),
    };

    if (!payload.apiKey) {
      errorMsg.textContent = 'Anthropic API key is required.';
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

</body>
</html>
`;
