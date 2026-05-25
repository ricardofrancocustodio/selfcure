import http from 'node:http';
import { generateConfig, type InitOptions } from './generator.js';
import { initPageHtml } from './initPage.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type { InitOptions, GenerateResult } from './generator.js';
export { buildConfigContent, generateConfig, FRAMEWORK_EXTENSIONS } from './generator.js';

/**
 * Start the selfcure web UI server.
 *
 * Routes:
 *   GET  /          → init wizard HTML page
 *   POST /api/init  → generate selfcure.config.js + .env, return JSON
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

          // Minimal server-side validation
          if (!options.apiKey || !options.baseURL || !options.rootDir) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'rootDir, baseURL and apiKey are required' }));
            return;
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
