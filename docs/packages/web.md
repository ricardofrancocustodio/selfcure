# `@selfcure/web`

Local HTTP server that serves the selfcure init wizard in the browser.
Invoked via `selfcure web` from the CLI.

## Exported API

```typescript
import { startWebServer } from '@selfcure/web';

const server = startWebServer(port?, cwd?);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `port` | `number` | `3333` | Port to listen on (localhost only) |
| `cwd` | `string` | `process.cwd()` | Directory where `selfcure.config.js` + `.env` are written |

Returns a `http.Server` instance.

## HTTP routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serves the init wizard HTML page |
| `POST` | `/api/init` | Writes `selfcure.config.js` + `.env`, returns `GenerateResult` JSON |

### POST `/api/init` request body (`InitOptions`)

```typescript
interface InitOptions {
  rootDir:   string;   // e.g. "./src"
  framework: string;   // "react" | "vue" | "angular" | "auto"
  include:   string[]; // glob patterns, e.g. ["**/*.tsx", "**/*.jsx"]
  testsDir:  string;   // e.g. "./selfcure-tests"
  baseURL:   string;   // e.g. "http://localhost:5000"
  apiKey:    string;   // Anthropic API key — written only to .env on disk
}
```

### POST `/api/init` response body (`GenerateResult`)

```typescript
interface GenerateResult {
  configContent: string;  // full text of selfcure.config.js
  configPath:    string;  // absolute path where the file was written
  envNote:       string;  // human-readable note; apiKey is NOT returned
}
```

## Init page

Plain semantic HTML — **no CSS framework or inline styles** (layout TBD).
Fields mirror the CLI wizard exactly:

- Project source directory (`rootDir`)
- Framework (`select`: React / Vue / Angular / HTML)
- Component extensions (`checkbox` — pre-checked per framework, user-editable)
- Generated tests directory (`testsDir`)
- Test environment URL (`baseURL`)
- Anthropic API key (`password` input)

On submit the page POSTs to `/api/init`, then shows the generated config
with **Copy to clipboard** and **Download** buttons.

## Config generator

```typescript
import { buildConfigContent, generateConfig, FRAMEWORK_EXTENSIONS } from '@selfcure/web';
```

| Export | Description |
|--------|-------------|
| `FRAMEWORK_EXTENSIONS` | Maps `"react" \| "vue" \| "angular" \| "auto"` → default glob patterns |
| `buildConfigContent(options)` | Returns `selfcure.config.js` as a string (no I/O) |
| `generateConfig(options, cwd)` | Writes `selfcure.config.js` + `.env`, returns `GenerateResult` |

## Source layout

```
packages/web/
  src/
    index.ts       — startWebServer() + re-exports
    generator.ts   — InitOptions, GenerateResult, buildConfigContent, generateConfig
    initPage.ts    — initPageHtml string (the init wizard HTML)
```
