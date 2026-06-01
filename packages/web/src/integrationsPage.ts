export const integrationsPageHtml = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>selfcure - integrations</title>
  <style>
    :root {
      --bg: #ffffff;
      --surface: #f8fafc;
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --accent: #0f766e;
      --accent-hover: #0d9488;
      --danger: #b91c1c;
      --danger-hover: #dc2626;
      --ok: #15803d;
      --warn-bg: #fff7ed;
      --warn: #9a3412;
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      --sans: "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #0b1220;
        --surface: #111827;
        --text: #e5e7eb;
        --muted: #9ca3af;
        --border: #253047;
        --accent: #14b8a6;
        --accent-hover: #2dd4bf;
        --danger: #f87171;
        --danger-hover: #ef4444;
        --ok: #4ade80;
        --warn-bg: #1f2937;
        --warn: #fdba74;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: radial-gradient(1000px 600px at 100% -100px, rgba(20,184,166,0.12), transparent), var(--bg);
      color: var(--text);
    }
    nav {
      position: sticky; top: 0; z-index: 100;
      display: flex; align-items: center; gap: 4px;
      height: 44px; padding: 0 16px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .nav-brand { color: var(--accent); text-decoration: none; font-family: var(--mono); font-size: 13px; font-weight: 700; margin-right: 8px; }
    .nav-sep { color: var(--muted); margin: 0 2px; }
    .nav-link {
      text-decoration: none; color: var(--muted); font-size: 13px;
      padding: 4px 10px; border-radius: 6px; transition: background 100ms, color 100ms;
    }
    .nav-link:hover { background: var(--border); color: var(--text); }
    .nav-link.active { color: var(--text); background: var(--border); font-weight: 600; }

    main { max-width: 900px; margin: 0 auto; padding: 28px 20px 70px; }
    h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.02em; }
    p.lede { margin: 0 0 22px; color: var(--muted); }

    .flash {
      display: none;
      margin: 0 0 14px;
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 13px;
      background: var(--warn-bg);
      color: var(--warn);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 12px;
    }

    .card {
      border: 1px solid var(--border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--surface) 94%, transparent);
      padding: 14px;
    }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .head h2 { margin: 0; font-size: 18px; }
    .badge {
      font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
      border-radius: 999px; padding: 3px 8px;
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .badge.ok { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 35%, var(--border)); }

    .meta {
      margin-top: 10px;
      font-size: 12px;
      color: var(--muted);
      min-height: 50px;
    }
    .meta code { font-family: var(--mono); font-size: 11px; }

    .actions { margin-top: 12px; display: flex; gap: 8px; }
    button {
      border: 1px solid var(--border);
      border-radius: 8px;
      background: transparent;
      color: var(--text);
      font-size: 13px;
      padding: 7px 11px;
      cursor: pointer;
    }
    button.primary {
      background: var(--accent);
      border-color: var(--accent);
      color: #ffffff;
      font-weight: 600;
    }
    button.primary:hover { background: var(--accent-hover); border-color: var(--accent-hover); }
    button.danger { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 45%, var(--border)); }
    button.danger:hover { color: #ffffff; background: var(--danger-hover); border-color: var(--danger-hover); }
    button:disabled { opacity: 0.6; cursor: not-allowed; }

    .setup-banner {
      margin: 0 0 20px;
      padding: 14px 16px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: color-mix(in srgb, var(--surface) 94%, transparent);
      font-size: 13px;
    }
    .setup-banner h3 { margin: 0 0 8px; font-size: 14px; }
    .setup-banner ol { margin: 8px 0 0; padding-left: 20px; line-height: 1.9; }
    .setup-banner code {
      font-family: var(--mono); font-size: 11.5px;
      background: color-mix(in srgb, var(--border) 60%, transparent);
      padding: 1px 5px; border-radius: 4px;
    }
    .managed-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 999px;
      font-size: 12px; font-weight: 600;
      background: color-mix(in srgb, var(--ok) 12%, transparent);
      color: var(--ok);
      border: 1px solid color-mix(in srgb, var(--ok) 30%, var(--border));
      margin-bottom: 16px;
    }
    .foot {
      margin-top: 22px;
      color: var(--muted);
      font-size: 12px;
      border-top: 1px dashed var(--border);
      padding-top: 12px;
    }
    .foot code { font-family: var(--mono); }
  </style>
</head>
<body>
<nav>
  <a class="nav-brand" href="/">selfcure</a>
  <span class="nav-sep">/</span>
  <a class="nav-link" href="/">init</a>
  <a class="nav-link" href="/crawl">crawl</a>
  <a class="nav-link" href="/lint">lint</a>
  <a class="nav-link" href="/a11y">a11y</a>
  <a class="nav-link" href="/discovery">discovery</a>
  <a class="nav-link" href="/tml">TML</a>
  <a class="nav-link active" href="/integrations">integrations</a>
</nav>

<main>
  <h1>SCM integrations</h1>
  <p class="lede">Connect once and keep your Git provider linked for PR-based workflows.</p>

  <div id="flash" class="flash" role="status" aria-live="polite"></div>
  <div id="connector-banner"></div>

  <section id="cards" class="grid"></section>

  <p class="foot" id="foot-note"></p>
</main>

<script>
  const CANONICAL_CONNECTOR = 'https://selfcure.vercel.app';

  const cards = document.getElementById('cards');
  const flash = document.getElementById('flash');
  const banner = document.getElementById('connector-banner');
  const footNote = document.getElementById('foot-note');

  function escapeHtml(s) {
    return (s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function showFlash(text) {
    if (!text) return;
    flash.textContent = text;
    flash.style.display = 'block';
  }

  function renderBanner(managed, connectorUrl) {
    if (managed) {
      const url = escapeHtml(connectorUrl || CANONICAL_CONNECTOR);
      banner.innerHTML =
        '<div class="managed-pill">' +
          '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">' +
            '<circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.5"/>' +
            '<path d="M3.5 6l1.8 1.8 3.2-3.6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
          'Managed connector: <code style="font-family:var(--mono);font-size:11px">' + url + '</code>' +
        '</div>';
      footNote.innerHTML =
        'OAuth is routed through the selfcure connector at <code>' + url + '</code>. ' +
        'Make sure the GitHub OAuth App callback URL includes <code>' + url + '/oauth/callback/github</code>.';
    } else {
      banner.innerHTML =
        '<div class="setup-banner">' +
          '<h3>Recommended: use the selfcure managed connector</h3>' +
          '<p style="margin:0;color:var(--muted)">Zero-config OAuth — no need to create your own GitHub/GitLab/Bitbucket OAuth App.</p>' +
          '<ol>' +
            '<li>Add to your project <code>.env</code>:<br>' +
              '<code>SELFCURE_CONNECTOR_BASE_URL=' + CANONICAL_CONNECTOR + '</code></li>' +
            '<li>In your GitHub OAuth App settings, set the callback URL to:<br>' +
              '<code>' + CANONICAL_CONNECTOR + '/oauth/callback/github</code></li>' +
            '<li>Restart selfcure and return to this page.</li>' +
          '</ol>' +
          '<p style="margin:8px 0 0;color:var(--muted)">Or bring your own OAuth App by setting ' +
            '<code>SELFCURE_GITHUB_CLIENT_ID</code> and <code>SELFCURE_GITHUB_CLIENT_SECRET</code> ' +
            '(plus equivalents for GitLab/Bitbucket).</p>' +
        '</div>';
      footNote.innerHTML =
        'Env vars for self-managed mode: <code>SELFCURE_GITHUB_CLIENT_ID</code>, <code>SELFCURE_GITHUB_CLIENT_SECRET</code>, ' +
        '<code>SELFCURE_GITLAB_CLIENT_ID</code>, <code>SELFCURE_GITLAB_CLIENT_SECRET</code>, ' +
        '<code>SELFCURE_BITBUCKET_CLIENT_ID</code>, <code>SELFCURE_BITBUCKET_CLIENT_SECRET</code>.';
    }
  }

  function cardHtml(p) {
    const statusCls = p.connected ? 'badge ok' : 'badge';
    const statusTxt = p.connected ? 'connected' : 'disconnected';
    const who = p.account
      ? '<div>Connected as <strong>' + escapeHtml(p.account.displayName || p.account.username) + '</strong></div>'
      : '<div>Not connected yet.</div>';

    const missing = (!p.configured && Array.isArray(p.missingEnv) && p.missingEnv.length)
      ? '<div style="margin-top:6px">Missing: ' + p.missingEnv.map(v => '<code>' + escapeHtml(v) + '</code>').join(', ') + '</div>'
      : '';

    return '' +
      '<article class="card" data-provider="' + escapeHtml(p.id) + '">' +
        '<div class="head">' +
          '<h2>' + escapeHtml(p.label) + '</h2>' +
          '<span class="' + statusCls + '">' + statusTxt + '</span>' +
        '</div>' +
        '<div class="meta">' +
          who +
          missing +
        '</div>' +
        '<div class="actions">' +
          '<button class="primary connect" ' + (p.configured ? '' : 'disabled') + '>Connect</button>' +
          '<button class="danger disconnect" ' + (p.connected ? '' : 'disabled') + '>Disconnect</button>' +
        '</div>' +
      '</article>';
  }

  async function load() {
    const res = await fetch('/api/integrations');
    const data = await res.json();
    renderBanner(data.managed, data.connectorUrl);
    cards.innerHTML = (data.providers || []).map(cardHtml).join('');

    cards.querySelectorAll('.connect').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        const id = ev.currentTarget.closest('.card').dataset.provider;
        window.location.href = '/oauth/connect/' + encodeURIComponent(id);
      });
    });

    cards.querySelectorAll('.disconnect').forEach((btn) => {
      btn.addEventListener('click', async (ev) => {
        const id = ev.currentTarget.closest('.card').dataset.provider;
        await fetch('/api/integrations/' + encodeURIComponent(id), { method: 'DELETE' });
        await load();
      });
    });
  }

  (function init() {
    const qs = new URLSearchParams(location.search);
    const connected = qs.get('connected');
    const error = qs.get('error');
    if (connected) showFlash('Connected to ' + connected + ' successfully.');
    if (error) showFlash(error);
    load().catch((err) => showFlash(err.message || String(err)));
  })();
</script>
</body>
</html>
`;
