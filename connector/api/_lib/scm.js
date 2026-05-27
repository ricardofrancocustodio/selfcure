const PROVIDERS = {
  github: {
    label: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    scope: 'repo read:user user:email',
    clientIdEnv: 'SELFCURE_GITHUB_CLIENT_ID',
    clientSecretEnv: 'SELFCURE_GITHUB_CLIENT_SECRET',
  },
  gitlab: {
    label: 'GitLab',
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    userUrl: 'https://gitlab.com/api/v4/user',
    scope: 'api read_user',
    clientIdEnv: 'SELFCURE_GITLAB_CLIENT_ID',
    clientSecretEnv: 'SELFCURE_GITLAB_CLIENT_SECRET',
  },
  bitbucket: {
    label: 'Bitbucket',
    authUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    userUrl: 'https://api.bitbucket.org/2.0/user',
    scope: 'account repository',
    clientIdEnv: 'SELFCURE_BITBUCKET_CLIENT_ID',
    clientSecretEnv: 'SELFCURE_BITBUCKET_CLIENT_SECRET',
  },
};

function getProvider(provider) {
  return PROVIDERS[provider] ?? null;
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf-8').toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf-8');
}

function signPayload(encodedPayload, secret) {
  const crypto = require('node:crypto');
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

function encodeState(payloadObj, secret) {
  const payload = toBase64Url(JSON.stringify(payloadObj));
  const sig = signPayload(payload, secret);
  return `${payload}.${sig}`;
}

function decodeState(state, secret) {
  const [payload, sig] = String(state || '').split('.');
  if (!payload || !sig) throw new Error('Invalid state format');
  const expected = signPayload(payload, secret);
  if (sig !== expected) throw new Error('Invalid state signature');
  return JSON.parse(fromBase64Url(payload));
}

function publicBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function safeReturnTo(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function jsonError(res, status, error) {
  res.status(status).json({ error });
}

module.exports = {
  getProvider,
  encodeState,
  decodeState,
  publicBaseUrl,
  safeReturnTo,
  jsonError,
};
