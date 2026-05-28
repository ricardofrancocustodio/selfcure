# `@selfcure/web`

Local HTTP server that serves the selfcure init wizard and crawler/analyzer results in the browser.
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
| `GET` | `/crawl` | Serves the crawler/analyzer results page with client-side filters |
| `GET` | `/lint` | Serves the testability linter page (PR-focused, see below) |
| `GET` | `/integrations` | Serves the SCM integrations page (GitHub/GitLab/Bitbucket) |
| `GET` | `/oauth/connect/:provider` | Starts OAuth login and redirects to the selected provider |
| `GET` | `/oauth/managed/callback/:provider` | Handles callback when using a managed cloud connector |
| `GET` | `/oauth/callback/:provider` | Handles OAuth callback and persists the connection |
| `GET` | `/api/dirs` | Returns the wizard `cwd` and its immediate subdirectories (used to populate the source-folder picker) |
| `GET` | `/api/providers` | Returns the supported LLM providers + which env vars are already set in the server's environment |
| `GET` | `/api/integrations` | Returns `{ providers }` with configured/connected status for each SCM provider |
| `DELETE` | `/api/integrations/:provider` | Disconnects a provider, attempts remote token revocation, then removes saved token from `.selfcure/integrations.json` |
| `POST` | `/api/init` | Writes `selfcure.config.mjs` + `.env`, returns `GenerateResult` JSON |
| `POST` | `/api/crawl` | Loads `selfcure.config.mjs`, runs `crawl()` + `analyze()`, and returns serializable component metadata |
| `POST` | `/api/lint` | Scans the source, returns `{ issues, totalFiles, fixedCount, skippedCount, pro }` (no file mutations) |
| `POST` | `/api/pr`  | **One-shot PR flow** — applies the user-selected patches, opens a PR with auto-generated title/body, redirects to GitHub. Pro-gated. |

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

### GET `/api/integrations` response

```typescript
interface IntegrationsResponse {
  providers: Array<{
    id: 'github' | 'gitlab' | 'bitbucket';
    label: string;
    configured: boolean;
    connected: boolean;
    missingEnv: string[];
    account?: {
      id: string;
      username: string;
      displayName: string;
      url?: string;
    };
    connectedAt?: string;
    connectUrl: string; // e.g. /oauth/connect/github
  }>;
}
```

OAuth app credentials are read from environment variables (`process.env`) and
fallback to the target project's `.env` file when not present in the shell:

- `SELFCURE_GITHUB_CLIENT_ID`
- `SELFCURE_GITHUB_CLIENT_SECRET`
- `SELFCURE_GITLAB_CLIENT_ID`
- `SELFCURE_GITLAB_CLIENT_SECRET`
- `SELFCURE_BITBUCKET_CLIENT_ID`
- `SELFCURE_BITBUCKET_CLIENT_SECRET`

Managed connector mode (commercial-friendly, no per-provider client secrets on customer machines):

- `SELFCURE_CONNECTOR_BASE_URL` — when set, `/oauth/connect/:provider` redirects to your cloud connector,
  and the local callback route `/oauth/managed/callback/:provider` persists the connected account.

Tokens are stored locally in `.selfcure/integrations.json` and `.selfcure/`
is auto-added to `.gitignore` when the first provider is connected.

Disconnect behavior:

- `DELETE /api/integrations/:provider` performs best-effort remote revoke first (GitHub/GitLab/Bitbucket), then clears local connection data.
- Remote revoke failures do not block local disconnect (the API still removes local state).

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

### POST `/api/crawl` request body

```typescript
interface CrawlWebRequest {
  /** Optional path relative to the web server cwd; default: selfcure.config.mjs, fallback: selfcure.config.js */
  configPath?: string;
}
```

### POST `/api/crawl` response body

```typescript
interface CrawlWebResponse {
  rootDir: string;
  count: number;
  components: Array<{
    filePath: string;
    componentName: string;
    framework: 'react' | 'vue' | 'angular' | 'unknown';
    props: Array<{ name: string; type: string; required: boolean }>;
    score: number;
    complexity: 'low' | 'medium' | 'high';
    interactiveElements: Array<{
      type: 'button' | 'input' | 'link' | 'form' | 'custom';
      selector: string;
      label?: string;
      actions: string[];
    }>;
  }>;
}
```

The raw AST is intentionally omitted from this response. The browser receives only the data needed to list pages/components, props, selectors, labels, actions, score, and complexity.

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

## Crawl page

`GET /crawl` serves a plain HTML page that calls `POST /api/crawl` and renders:

- pages/components discovered by the crawler
- prop names, types, and required/optional status
- interactive tags found by the analyzer (`button`, `input`, `select`, `textarea`, `a`, `form` mapped to element types)
- selector, label, available Playwright actions, score, and complexity

The page filters results locally by search text, framework, complexity, tag/element type, minimum score, and whether a component has interactive tags. Results can also be sorted by file path, component name, score, or number of tags.

## Lint page

`GET /lint` serves the testability linter page, designed around a **single-click PR flow**:

1. User clicks **Run lint** → `POST /api/lint` returns issues plus `pro: boolean` (UI hint).
2. Every issue is rendered with a checkbox (pre-checked) and a per-file "select all" master checkbox.
3. A sticky bar at the top reads `N of M issues selected` and shows a primary **Open pull request** button (disabled when `pro: false`).
4. Clicking the button:
   - Immediately opens a new browser tab (`window.open` inside the click handler avoids popup blockers).
   - POSTs `{ configPath, threshold, selectedKeys }` to `/api/pr`.
   - Server re-runs lint, patches **only** the selected issues, branches off `lint.prBaseBranch` (or the repo default via `gh repo view`), commits, pushes, runs `gh pr create --base …`, restores the original branch.
   - Redirects the pre-opened tab to the returned `prUrl` and shows an inline success banner.

The user never edits branch/title/body locally — those are auto-generated and refined on GitHub after the redirect.

### `POST /api/lint` request / response

```typescript
interface LintRequest {
  configPath?: string;
  threshold?:  number;  // default 65
}

interface LintResponse {
  issues: Array<{
    filePath:        string;
    componentName:   string;
    element:         InteractiveElement;
    suggestedTestId: string;
    kind:            'ambiguous' | 'low-score';
    ambiguityReason?: string;
  }>;
  totalFiles:   number;
  fixedCount:   number;   // always 0 (this endpoint never mutates)
  skippedCount: number;   // always 0
  pro:          boolean;  // UI hint — does NOT gate /api/pr
}
```

### `POST /api/pr` request / response

```typescript
interface OpenPrRequest {
  configPath?:   string;
  threshold?:    number;
  /** `filePath|suggestedTestId` keys the user kept checked. */
  selectedKeys:  string[];
}

interface OpenPrResponse {
  prUrl:       string;
  fixedCount:  number;
  baseBranch?: string;   // 'main' / 'develop' / etc. — undefined when gh chose default
  branch:      string;   // `selfcure/lint-fix-<date>-<short>`
}
```

The Pro gate is enforced server-side (`pro: true` in config or `SELFCURE_PRO=1`). If unauthorized, the endpoint returns HTTP 400 with `{ error: '…Pro feature…' }`.

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
    index.ts       — startWebServer() + /api/* handlers (includes runOpenPr for /api/pr)
    integrations.ts — OAuth flow + status persistence for GitHub/GitLab/Bitbucket
    integrationsPage.ts — integrations UI with one-click Connect/Disconnect buttons
    crawlPage.ts   — crawler/analyzer results page HTML
    generator.ts   — InitOptions, GenerateResult, buildConfigContent, generateConfig
    initPage.ts    — initPageHtml string (the init wizard HTML)
    lintPage.ts    — lintPageHtml string (testability linter, PR-focused UI)
```
