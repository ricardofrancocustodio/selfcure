import http from 'node:http';
import fs from 'node:fs';
import { PROVIDERS, type ProviderId } from '@selfcure/generator';
import { generateConfig, type InitOptions } from './generator.js';
import { initPageHtml } from './initPage.js';

// Directories that should never appear in the source-folder picker
const IGNORED_DIRS = new Set([
  'node_modules', 'dist', 'build', 'out', 'coverage',
  '.git', '.cache', '.next', '.nuxt', '.svelte-kit',
  'selfcure-tests', 'selfcure-report', '.selfcure',
]);

function listSourceDirs(cwd: string): string[] {
  try {
    return fs.readdirSync(cwd, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.') && !IGNORED_DIRS.has(e.name))
      .map((e) => './' + e.name)
      .sort();
  } catch {
    return [];
  }
}

interface ProviderListEntry {
  id: ProviderId;
  label: string;
  envVar: string | null;
  envSet: boolean;
  defaultGenerationModel: string;
  defaultHealingModel: string;
  defaultBaseURL?: string;
  hint: string;
  apiKeyPlaceholder: string;
}

function listProviders(): {
  providers: ProviderListEntry[];
  suggested: ProviderId;
} {
  const providers: ProviderListEntry[] = (Object.values(PROVIDERS) as Array<typeof PROVIDERS[ProviderId]>)
    .map((p) => ({
      id: p.id,
      label: p.label,
      envVar: p.envVar,
      envSet: p.envVar ? Boolean(process.env[p.envVar]) : true,
      defaultGenerationModel: p.defaultGenerationModel,
      defaultHealingModel: p.defaultHealingModel,
      defaultBaseURL: p.defaultBaseURL,
      hint: p.hint,
      apiKeyPlaceholder: p.apiKeyPlaceholder,
    }));

  // Suggest the first provider whose env var is already set; fall back to anthropic
  const suggested =
    providers.find((p) => p.envVar && p.envSet)?.id
    ?? providers[0]?.id
    ?? 'anthropic';

  return { providers, suggested };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type { InitOptions, InitAIOptions, GenerateResult } from './generator.js';
export { buildConfigContent, generateConfig, FRAMEWORK_EXTENSIONS } from './generator.js';

/**
 * Start the selfcure web UI server.
 *
 * Routes:
 *   GET  /              → init wizard HTML page
 *   GET  /api/dirs      → cwd + immediate subdirs (for the source-folder picker)
 *   GET  /api/providers → supported LLM providers + which env vars are already set
 *   POST /api/init      → generate selfcure.config.mjs + .env, return JSON
 *
 * @param port - Port to listen on (default: 3333)
 * @param cwd  - Working directory where config + .env are written (default: process.cwd())
 */
export function startWebServer(
  port = 3333,
  cwd = process.cwd(),
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(initPageHtml);
      return;
    }

    if (req.method === 'GET' && req.url === '/api/dirs') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ cwd, dirs: listSourceDirs(cwd) }));
      return;
    }

    if (req.method === 'GET' && req.url === '/api/providers') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(listProviders()));
      return;
    }

    if (req.method === 'POST' && req.url === '/api/init') {
      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
        // Guard against unexpectedly large payloads
        if (body.length > 64_000) {
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });
      req.on('end', async () => {
        try {
          const options: InitOptions = JSON.parse(body);

          if (!options.rootDir || !options.baseURL) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'rootDir and baseURL are required' }));
            return;
          }

          if (!options.ai || !options.ai.provider) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'ai.provider is required' }));
            return;
          }

          const meta = PROVIDERS[options.ai.provider];
          if (!meta) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unknown provider: ${options.ai.provider}` }));
            return;
          }

          // Providers that need a key must have one — either typed by the user
          // or available in the server's env when useExistingEnv was checked.
          if (meta.envVar) {
            const hasTyped = Boolean(options.ai.apiKey);
            const hasEnv = options.ai.useExistingEnv && Boolean(process.env[meta.envVar]);
            if (!hasTyped && !hasEnv) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: `Provider "${options.ai.provider}" needs ${meta.envVar} — enter it or set the env var.`,
              }));
              return;
            }
          }

          const result = await generateConfig(options, cwd);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`selfcure web  →  http://localhost:${port}`);
  });

  return server;
}
