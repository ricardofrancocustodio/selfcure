const {
  getProvider,
  decodeState,
  publicBaseUrl,
  jsonError,
} = require('../../_lib/scm');

function buildReturnUrl(returnTo, params) {
  const target = new URL(returnTo);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v) !== '') {
      target.searchParams.set(k, String(v));
    }
  }
  return target.toString();
}

async function exchangeCode(providerId, provider, code, callbackUrl) {
  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv];

  if (providerId === 'github') {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }).toString();

    const resp = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    const json = await resp.json();
    if (!resp.ok || !json.access_token) {
      throw new Error(json.error_description || json.error || 'GitHub token exchange failed');
    }
    return json.access_token;
  }

  if (providerId === 'gitlab') {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: callbackUrl,
    }).toString();

    const resp = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const json = await resp.json();
    if (!resp.ok || !json.access_token) {
      throw new Error(json.error_description || json.error || 'GitLab token exchange failed');
    }
    return json.access_token;
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl,
  }).toString();

  const resp = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body,
  });

  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'Bitbucket token exchange failed');
  }
  return json.access_token;
}

async function fetchAccount(providerId, provider, accessToken) {
  const resp = await fetch(provider.userUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'selfcure-connector',
    },
  });

  if (!resp.ok) throw new Error(`Failed to fetch ${provider.label} user profile`);

  if (providerId === 'github') {
    const json = await resp.json();
    return {
      accountId: String(json.id || ''),
      username: json.login || '',
      displayName: json.name || json.login || '',
      url: json.html_url || '',
    };
  }

  if (providerId === 'gitlab') {
    const json = await resp.json();
    return {
      accountId: String(json.id || ''),
      username: json.username || '',
      displayName: json.name || json.username || '',
      url: json.web_url || '',
    };
  }

  const json = await resp.json();
  return {
    accountId: json.uuid || '',
    username: json.username || json.display_name || '',
    displayName: json.display_name || json.username || '',
    url: json.links?.html?.href || '',
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return jsonError(res, 405, 'Method not allowed');
  }

  const providerId = req.query.provider;
  const provider = getProvider(providerId);
  if (!provider) return jsonError(res, 404, 'Unknown provider');

  const stateSecret = process.env.SELFCURE_CONNECTOR_STATE_SECRET;
  if (!stateSecret) {
    return jsonError(res, 500, 'Connector missing env var: SELFCURE_CONNECTOR_STATE_SECRET');
  }

  const oauthError = req.query.error;
  const oauthErrorDescription = req.query.error_description;

  let decoded;
  try {
    decoded = decodeState(req.query.state, stateSecret);
  } catch (err) {
    return jsonError(res, 400, err instanceof Error ? err.message : String(err));
  }

  if (decoded.p !== providerId) {
    return jsonError(res, 400, 'Provider mismatch in state payload');
  }

  const returnTo = decoded.rt;
  const localState = decoded.ls;

  if (oauthError) {
    return res.redirect(
      302,
      buildReturnUrl(returnTo, {
        state: localState,
        status: 'error',
        error: oauthErrorDescription || oauthError,
      }),
    );
  }

  const code = String(req.query.code || '').trim();
  if (!code) {
    return res.redirect(
      302,
      buildReturnUrl(returnTo, {
        state: localState,
        status: 'error',
        error: 'Missing authorization code',
      }),
    );
  }

  try {
    const callbackUrl = `${publicBaseUrl(req)}/oauth/callback/${providerId}`;
    const accessToken = await exchangeCode(providerId, provider, code, callbackUrl);
    const account = await fetchAccount(providerId, provider, accessToken);

    return res.redirect(
      302,
      buildReturnUrl(returnTo, {
        state: localState,
        status: 'ok',
        accountId: account.accountId,
        username: account.username,
        displayName: account.displayName,
        url: account.url,
      }),
    );
  } catch (err) {
    return res.redirect(
      302,
      buildReturnUrl(returnTo, {
        state: localState,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
};
