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
      position: sticky; top: 0; z-index: 20;
      display: flex; align-items: center; gap: 6px;
      height: 46px; padding: 0 18px;
      background: color-mix(in srgb, var(--surface) 92%, transparent);
      border-bottom: 1px solid var(--border);
      backdrop-filter: blur(6px);
    }
    .nav-brand { color: var(--accent); text-decoration: none; font-family: var(--mono); font-size: 13px; font-weight: 700; }
    .nav-sep { color: var(--muted); }
    .nav-link {
      text-decoration: none; color: var(--muted); font-size: 13px;
      padding: 4px 10px; border-radius: 6px;
    }
    .nav-link:hover { background: color-mix(in srgb, var(--surface) 80%, transparent); color: var(--text); }
    .nav-link.active { color: var(--text); background: color-mix(in srgb, var(--surface) 90%, transparent); }

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
  <a class="nav-link active" href="/integrations">integrations</a>
</nav>

<main>
  <h1>SCM integrations</h1>
  <p class="lede">Connect once and keep your Git provider linked for PR-based workflows.</p>

  <div id="flash" class="flash" role="status" aria-live="polite"></div>

  <section id="cards" class="grid"></section>

  <p class="foot">
    Managed mode (recommended): <code>SELFCURE_CONNECTOR_BASE_URL</code>.<br>
    Required env vars: <code>SELFCURE_GITHUB_CLIENT_ID</code>, <code>SELFCURE_GITHUB_CLIENT_SECRET</code>,
    <code>SELFCURE_GITLAB_CLIENT_ID</code>, <code>SELFCURE_GITLAB_CLIENT_SECRET</code>,
    <code>SELFCURE_BITBUCKET_CLIENT_ID</code>, <code>SELFCURE_BITBUCKET_CLIENT_SECRET</code>.
  </p>
</main>

<script>
  const cards = document.getElementById('cards');
  const flash = document.getElementById('flash');

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
