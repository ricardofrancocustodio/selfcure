import fs from 'fs-extra';
import crypto from 'node:crypto';
import path from 'node:path';

export type ScmProviderId = 'github' | 'gitlab' | 'bitbucket';

interface ScmProviderMeta {
  id: ScmProviderId;
  label: string;
  authUrl: string;
  tokenUrl: string;
  userUrl: string;
  scope: string;
  clientIdEnv: string;
  clientSecretEnv: string;
}

interface ConnectionToken {
  accessToken: string;
  tokenType?: string;
  scope?: string;
  refreshToken?: string;
  expiresAt?: string;
}

interface ConnectionAccount {
  id: string;
  username: string;
  displayName: string;
  url?: string;
}

interface SavedConnection {
  provider: ScmProviderId;
  connectedAt: string;
  account: ConnectionAccount;
  token: ConnectionToken;
  managed?: boolean;
}

interface IntegrationsFile {
  connections: Partial<Record<ScmProviderId, SavedConnection>>;
}

interface PendingOAuth {
  provider: ScmProviderId;
  createdAtMs: number;
}

export interface ProviderStatus {
  id: ScmProviderId;
  label: string;
  configured: boolean;
  connected: boolean;
  missingEnv: string[];
  account?: ConnectionAccount;
  connectedAt?: string;
  connectUrl: string;
}

export interface ProviderStatusResponse {
  managed: boolean;
  connectorUrl: string | null;
  providers: ProviderStatus[];
}

const PROVIDERS: Record<ScmProviderId, ScmProviderMeta> = {
  github: {
    id: 'github',
    label: 'GitHub',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userUrl: 'https://api.github.com/user',
    scope: 'repo read:user user:email',
    clientIdEnv: 'SELFCURE_GITHUB_CLIENT_ID',
    clientSecretEnv: 'SELFCURE_GITHUB_CLIENT_SECRET',
  },
  gitlab: {
    id: 'gitlab',
    label: 'GitLab',
    authUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    userUrl: 'https://gitlab.com/api/v4/user',
    scope: 'api read_user',
    clientIdEnv: 'SELFCURE_GITLAB_CLIENT_ID',
    clientSecretEnv: 'SELFCURE_GITLAB_CLIENT_SECRET',
  },
  bitbucket: {
    id: 'bitbucket',
    label: 'Bitbucket',
    authUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    userUrl: 'https://api.bitbucket.org/2.0/user',
    scope: 'account repository',
    clientIdEnv: 'SELFCURE_BITBUCKET_CLIENT_ID',
    clientSecretEnv: 'SELFCURE_BITBUCKET_CLIENT_SECRET',
  },
};

const STATE_TTL_MS = 10 * 60 * 1000;
const pendingByState = new Map<string, PendingOAuth>();

function readEnvVarFromDotEnv(cwd: string, key: string): string {
  try {
    const content = fs.readFileSync(path.join(cwd, '.env'), 'utf-8');
    const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
    if (!match) return '';
    return match[1].trim().replace(/^['"]|['"]$/g, '');
  } catch {
    return '';
  }
}

function resolveEnvValue(cwd: string, key: string): string {
  return process.env[key] ?? readEnvVarFromDotEnv(cwd, key);
}

function connectorBaseUrl(cwd: string): string {
  return resolveEnvValue(cwd, 'SELFCURE_CONNECTOR_BASE_URL').replace(/\/$/, '');
}

function hasManagedConnector(cwd: string): boolean {
  return Boolean(connectorBaseUrl(cwd));
}

function cleanupPending(): void {
  const now = Date.now();
  for (const [state, pending] of pendingByState) {
    if (now - pending.createdAtMs > STATE_TTL_MS) pendingByState.delete(state);
  }
}

function getConfig(cwd: string, meta: ScmProviderMeta): {
  clientId: string;
  clientSecret: string;
  missingEnv: string[];
} {
  const clientId = resolveEnvValue(cwd, meta.clientIdEnv);
  const clientSecret = resolveEnvValue(cwd, meta.clientSecretEnv);
  const missingEnv: string[] = [];
  if (!clientId) missingEnv.push(meta.clientIdEnv);
  if (!clientSecret) missingEnv.push(meta.clientSecretEnv);
  return { clientId, clientSecret, missingEnv };
}

function integrationsPath(cwd: string): string {
  return path.join(cwd, '.selfcure', 'integrations.json');
}

async function readIntegrations(cwd: string): Promise<IntegrationsFile> {
  try {
    return (await fs.readJson(integrationsPath(cwd))) as IntegrationsFile;
  } catch {
    return { connections: {} };
  }
}

async function ensureGitignore(cwd: string, entries: string[]): Promise<void> {
  const gitignorePath = path.join(cwd, '.gitignore');
  let content = '';
  try {
    content = await fs.readFile(gitignorePath, 'utf-8');
  } catch { }

  const lines = content.split('\n').map((line) => line.trim());
  const toAdd = entries.filter((entry) => {
    const bare = entry.replace(/\/$/, '');
    return !lines.includes(entry) && !lines.includes(bare) && !lines.includes(bare + '/');
  });

  if (toAdd.length === 0) return;
  const sep = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  await fs.outputFile(gitignorePath, content + sep + '\n# selfcure\n' + toAdd.join('\n') + '\n', 'utf-8');
}

async function writeIntegrations(cwd: string, data: IntegrationsFile): Promise<void> {
  await fs.outputJson(integrationsPath(cwd), data, { spaces: 2 });
  await ensureGitignore(cwd, ['.selfcure/']);
}

function callbackUrl(port: number, provider: ScmProviderId): string {
  return `http://localhost:${port}/oauth/callback/${provider}`;
}

function isRevocableToken(value: string | undefined): boolean {
  if (!value) return false;
  return value !== 'managed-by-connector';
}

async function revokeProviderToken(
  cwd: string,
  provider: ScmProviderId,
  accessToken: string,
): Promise<void> {
  const meta = PROVIDERS[provider];
  const cfg = getConfig(cwd, meta);
  if (cfg.missingEnv.length > 0) {
    throw new Error(`Missing OAuth env vars for ${meta.label}: ${cfg.missingEnv.join(', ')}`);
  }

  if (provider === 'github') {
    const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
    const resp = await fetch(
      `https://api.github.com/applications/${cfg.clientId}/grant`,
      {
        method: 'DELETE',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/json',
          'User-Agent': 'selfcure-web',
        },
        body: JSON.stringify({ access_token: accessToken }),
      },
    );

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`GitHub token revoke failed (${resp.status}): ${body || resp.statusText}`);
    }
    return;
  }

  if (provider === 'gitlab') {
    const body = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      token: accessToken,
    }).toString();

    const resp = await fetch('https://gitlab.com/oauth/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`GitLab token revoke failed (${resp.status}): ${text || resp.statusText}`);
    }
    return;
  }

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const body = new URLSearchParams({ token: accessToken }).toString();
  const resp = await fetch('https://bitbucket.org/site/oauth2/revoke', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Bitbucket token revoke failed (${resp.status}): ${text || resp.statusText}`);
  }
}

export function isScmProviderId(value: string): value is ScmProviderId {
  return value === 'github' || value === 'gitlab' || value === 'bitbucket';
}

export async function getProviderStatus(cwd: string): Promise<ProviderStatusResponse> {
  const file = await readIntegrations(cwd);
  const managed = hasManagedConnector(cwd);
  const base = connectorBaseUrl(cwd);
  const providers: ProviderStatus[] = (Object.values(PROVIDERS) as ScmProviderMeta[])
    .map((meta) => {
      const cfg = managed
        ? { clientId: 'managed', clientSecret: 'managed', missingEnv: [] }
        : getConfig(cwd, meta);
      const conn = file.connections[meta.id];
      return {
        id: meta.id,
        label: meta.label,
        configured: cfg.missingEnv.length === 0,
        connected: Boolean(conn),
        missingEnv: cfg.missingEnv,
        account: conn?.account,
        connectedAt: conn?.connectedAt,
        connectUrl: `/oauth/connect/${meta.id}`,
      };
    });

  return { managed, connectorUrl: managed ? base : null, providers };
}

export function getOAuthStartUrl(cwd: string, provider: ScmProviderId, port: number): { redirectTo?: string; error?: string } {
  cleanupPending();

  if (hasManagedConnector(cwd)) {
    const state = crypto.randomBytes(20).toString('hex');
    pendingByState.set(state, { provider, createdAtMs: Date.now() });

    const base = connectorBaseUrl(cwd);
    const returnTo = `http://localhost:${port}/oauth/managed/callback/${provider}`;
    const url = new URL(`${base}/oauth/connect/${provider}`);
    url.searchParams.set('state', state);
    url.searchParams.set('return_to', returnTo);

    return { redirectTo: url.toString() };
  }

  const meta = PROVIDERS[provider];
  const cfg = getConfig(cwd, meta);
  if (cfg.missingEnv.length > 0) {
    return {
      error: `Missing OAuth env vars for ${meta.label}: ${cfg.missingEnv.join(', ')}`,
    };
  }

  const state = crypto.randomBytes(20).toString('hex');
  pendingByState.set(state, { provider, createdAtMs: Date.now() });

  const url = new URL(meta.authUrl);
  url.searchParams.set('client_id', cfg.clientId);
  url.searchParams.set('redirect_uri', callbackUrl(port, provider));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', meta.scope);
  url.searchParams.set('state', state);

  return { redirectTo: url.toString() };
}

async function exchangeCode(
  cwd: string,
  provider: ScmProviderId,
  code: string,
  port: number,
): Promise<ConnectionToken> {
  const meta = PROVIDERS[provider];
  const cfg = getConfig(cwd, meta);
  if (cfg.missingEnv.length > 0) {
    throw new Error(`Missing OAuth env vars for ${meta.label}: ${cfg.missingEnv.join(', ')}`);
  }

  const redirectUri = callbackUrl(port, provider);

  if (provider === 'github') {
    const form = new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(meta.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: form.toString(),
    });

    const json = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !json.access_token) {
      throw new Error(json.error_description || json.error || 'GitHub token exchange failed');
    }

    return {
      accessToken: json.access_token,
      tokenType: json.token_type,
      scope: json.scope,
    };
  }

  if (provider === 'gitlab') {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(meta.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const json = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (!response.ok || !json.access_token) {
      throw new Error(json.error_description || json.error || 'GitLab token exchange failed');
    }

    return {
      accessToken: json.access_token,
      tokenType: json.token_type,
      scope: json.scope,
      refreshToken: json.refresh_token,
      expiresAt: typeof json.expires_in === 'number'
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : undefined,
    };
  }

  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  const form = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });

  const response = await fetch(meta.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: form.toString(),
  });

  const json = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || 'Bitbucket token exchange failed');
  }

  return {
    accessToken: json.access_token,
    tokenType: json.token_type,
    scope: json.scope,
    refreshToken: json.refresh_token,
    expiresAt: typeof json.expires_in === 'number'
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : undefined,
  };
}

async function fetchAccount(provider: ScmProviderId, token: ConnectionToken): Promise<ConnectionAccount> {
  const meta = PROVIDERS[provider];
  const response = await fetch(meta.userUrl, {
    headers: {
      Authorization: `Bearer ${token.accessToken}`,
      Accept: 'application/json',
      'User-Agent': 'selfcure-web',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${meta.label} user profile`);
  }

  if (provider === 'github') {
    const json = (await response.json()) as {
      id: number;
      login: string;
      name?: string;
      html_url?: string;
    };
    return {
      id: String(json.id),
      username: json.login,
      displayName: json.name || json.login,
      url: json.html_url,
    };
  }

  if (provider === 'gitlab') {
    const json = (await response.json()) as {
      id: number;
      username: string;
      name?: string;
      web_url?: string;
    };
    return {
      id: String(json.id),
      username: json.username,
      displayName: json.name || json.username,
      url: json.web_url,
    };
  }

  const json = (await response.json()) as {
    uuid?: string;
    username?: string;
    display_name?: string;
    links?: { html?: { href?: string } };
  };

  const username = json.username || json.display_name || 'bitbucket-user';
  return {
    id: json.uuid || username,
    username,
    displayName: json.display_name || username,
    url: json.links?.html?.href,
  };
}

export async function handleOAuthCallback(
  cwd: string,
  port: number,
  provider: ScmProviderId,
  query: URLSearchParams,
): Promise<{ ok: boolean; error?: string }> {
  cleanupPending();

  const code = query.get('code') ?? '';
  const state = query.get('state') ?? '';
  const oauthError = query.get('error');
  const oauthErrorDescription = query.get('error_description');

  if (oauthError) {
    return { ok: false, error: oauthErrorDescription || oauthError };
  }

  if (!code || !state) {
    return { ok: false, error: 'Missing OAuth code/state in callback' };
  }

  const pending = pendingByState.get(state);
  pendingByState.delete(state);

  if (!pending || pending.provider !== provider) {
    return { ok: false, error: 'Invalid or expired OAuth state. Retry connect.' };
  }

  try {
    const token = await exchangeCode(cwd, provider, code, port);
    const account = await fetchAccount(provider, token);

    const file = await readIntegrations(cwd);
    file.connections[provider] = {
      provider,
      connectedAt: new Date().toISOString(),
      account,
      token,
    };
    await writeIntegrations(cwd, file);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function handleManagedOAuthCallback(
  cwd: string,
  provider: ScmProviderId,
  query: URLSearchParams,
): Promise<{ ok: boolean; error?: string }> {
  cleanupPending();

  const state = query.get('state') ?? '';
  const status = query.get('status') ?? '';
  const error = query.get('error') ?? '';

  if (!state) {
    return { ok: false, error: 'Missing OAuth state in callback' };
  }

  const pending = pendingByState.get(state);
  pendingByState.delete(state);
  if (!pending || pending.provider !== provider) {
    return { ok: false, error: 'Invalid or expired OAuth state. Retry connect.' };
  }

  if (error) return { ok: false, error };
  if (status && status !== 'ok') {
    return { ok: false, error: `Connector returned status=${status}` };
  }

  const account: ConnectionAccount = {
    id: query.get('accountId') || `${provider}-managed`,
    username: query.get('username') || `${provider}-user`,
    displayName: query.get('displayName') || query.get('username') || `${provider} user`,
    ...(query.get('url') ? { url: query.get('url') ?? undefined } : {}),
  };

  const file = await readIntegrations(cwd);
  file.connections[provider] = {
    provider,
    connectedAt: new Date().toISOString(),
    account,
    token: { accessToken: 'managed-by-connector', tokenType: 'Bearer' },
    managed: true,
  };
  await writeIntegrations(cwd, file);

  return { ok: true };
}

export async function disconnectProvider(cwd: string, provider: ScmProviderId): Promise<void> {
  const file = await readIntegrations(cwd);
  const conn = file.connections[provider];
  if (!conn) return;

  if (isRevocableToken(conn.token.accessToken)) {
    try {
      await revokeProviderToken(cwd, provider, conn.token.accessToken);
    } catch {
      // Best effort: local disconnect must still work even when provider
      // revocation fails (network, already-revoked token, provider outage).
    }
  }

  delete file.connections[provider];
  await writeIntegrations(cwd, file);
}
