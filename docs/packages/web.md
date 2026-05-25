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
| `cwd` | `string` | `process.cwd()` | Directory where `selfcure.config.mjs` + `.env` are written |

Returns a `http.Server` instance.

## HTTP routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serves the init wizard HTML page |
| `GET` | `/api/dirs` | Returns the wizard `cwd` and its immediate subdirectories (used to populate the source-folder picker) |
| `GET` | `/api/providers` | Returns the supported LLM providers + which env vars are already set in the server's environment |
| `POST` | `/api/init` | Writes `selfcure.config.mjs` + `.env`, returns `GenerateResult` JSON |

### GET `/api/dirs` response

```typescript
interface DirsResponse {
  cwd:  string;     // absolute path of the working directory
  dirs: string[];   // immediate subdirs as relative paths (e.g. "./src")
                    // node_modules, dist, build, coverage, hidden dirs etc. are excluded
}
```

### GET `/api/providers` response

```typescript
interface ProvidersResponse {
  providers: ProviderListEntry[];
  /** id of the first provider whose env var is already set — fallback default */
  suggested: ProviderId;
}

interface ProviderListEntry {
  id: ProviderId;                  // 'anthropic' | 'openai' | 'google' | 'groq' | 'deepseek' | 'ollama'
  label: string;                   // human-readable label, e.g. "Anthropic"
  envVar: string | null;           // null for keyless providers (Ollama)
  envSet: boolean;                 // whether process.env[envVar] is currently set
  defaultGenerationModel: string;
  defaultHealingModel:    string;
  defaultBaseURL?: string;         // present for Ollama / DeepSeek
  hint: string;                    // short marketing line ("Free tier", etc.)
  apiKeyPlaceholder: string;       // e.g. "sk-ant-…"
}
```

The wizard pre-selects `suggested` and pre-checks "Use existing $VAR" when
`envSet` is true. The env var **value** is never sent in the response.

### POST `/api/init` request body (`InitOptions`)

```typescript
interface InitOptions {
  rootDir:   string;   // e.g. "./src"
  framework: string;   // "react" | "vue" | "angular" | "auto"
  include:   string[]; // glob patterns, e.g. ["**/*.tsx", "**/*.jsx"]
  testsDir:  string;   // e.g. "./selfcure-tests"
  baseURL:   string;   // e.g. "http://localhost:5000"
  ai:        InitAIOptions;
}

interface InitAIOptions {
  provider:         ProviderId;
  generationModel:  string;
  healingModel:     string;
  /**
   * API key value entered by the user. Empty when `useExistingEnv` is true
   * — in that case the server reads the value from its own `process.env`
   * so the key never crosses the wire from the browser.
   */
  apiKey:           string;
  useExistingEnv:   boolean;
  /** Endpoint override — used for Ollama / DeepSeek / self-hosted */
  baseURL?:         string;
}
```

### POST `/api/init` response body (`GenerateResult`)

```typescript
interface GenerateResult {
  configContent: string;  // full text of selfcure.config.mjs
  configPath:    string;  // absolute path where the file was written
  envNote:       string;  // human-readable note; apiKey is NOT returned
}
```

## Init page

Single self-contained HTML document with an inline `<style>` block —
dev-tool minimalist aesthetic, single-column layout, light theme with
automatic dark mode via `prefers-color-scheme`. No external CSS framework,
no per-element inline styles. Fields mirror the CLI wizard exactly:

- Project source directory (`rootDir`) — `<select>` populated from `GET /api/dirs`, with an "Other…" option that reveals a text input for custom paths
- Framework (`select`: React / Vue / Angular / HTML)
- Component extensions (`checkbox` — pre-checked per framework, user-editable)
- Generated tests directory (`testsDir`)
- Test environment URL (`baseURL`)
- AI provider (`select` populated from `GET /api/providers`, with ✓ next to providers whose env var is already set)
- Generation model + Healing model (`text` inputs, pre-filled from provider defaults)
- API key (`password` input — hidden for Ollama, optional + disabled when "Use existing $VAR" is checked)
- Endpoint URL (`url` input — shown only for Ollama / DeepSeek)

On submit the page POSTs to `/api/init`, then shows the generated config
with **Copy to clipboard** and **Download** buttons.

## Config generator

```typescript
import { buildConfigContent, generateConfig, FRAMEWORK_EXTENSIONS } from '@selfcure/web';
```

| Export | Description |
|--------|-------------|
| `FRAMEWORK_EXTENSIONS` | Maps `"react" \| "vue" \| "angular" \| "auto"` → default glob patterns |
| `buildConfigContent(options)` | Returns `selfcure.config.mjs` as a string (no I/O) |
| `generateConfig(options, cwd)` | Writes `selfcure.config.mjs` + `.env`, returns `GenerateResult` |

## Source layout

```
packages/web/
  src/
    index.ts       — startWebServer() + re-exports
    generator.ts   — InitOptions, GenerateResult, buildConfigContent, generateConfig
    initPage.ts    — initPageHtml string (the init wizard HTML)
```
