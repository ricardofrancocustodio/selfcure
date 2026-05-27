const {
  getProvider,
  encodeState,
  publicBaseUrl,
  safeReturnTo,
  jsonError,
} = require('../../_lib/scm');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return jsonError(res, 405, 'Method not allowed');
  }

  const providerId = req.query.provider;
  const provider = getProvider(providerId);
  if (!provider) return jsonError(res, 404, 'Unknown provider');

  const localState = String(req.query.state || '').trim();
  const returnTo = safeReturnTo(req.query.return_to);
  if (!localState) return jsonError(res, 400, 'Missing local state');
  if (!returnTo) return jsonError(res, 400, 'Missing or invalid return_to');

  const clientId = process.env[provider.clientIdEnv];
  const clientSecret = process.env[provider.clientSecretEnv];
  const stateSecret = process.env.SELFCURE_CONNECTOR_STATE_SECRET;

  if (!clientId || !clientSecret) {
    return jsonError(
      res,
      500,
      `Connector missing env vars: ${provider.clientIdEnv} / ${provider.clientSecretEnv}`,
    );
  }
  if (!stateSecret) {
    return jsonError(res, 500, 'Connector missing env var: SELFCURE_CONNECTOR_STATE_SECRET');
  }

  const callbackUrl = `${publicBaseUrl(req)}/oauth/callback/${providerId}`;
  const connectorState = encodeState(
    {
      p: providerId,
      ls: localState,
      rt: returnTo,
      t: Date.now(),
    },
    stateSecret,
  );

  const authUrl = new URL(provider.authUrl);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', callbackUrl);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', provider.scope);
  authUrl.searchParams.set('state', connectorState);

  res.redirect(302, authUrl.toString());
};
