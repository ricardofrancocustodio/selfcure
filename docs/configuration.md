# Configuration reference

All options live in **`selfcure.config.mjs`** at the root of your target project.  
The file must use ES module syntax (`export default { … }`).

The full TypeScript type is `SelfcureConfig` exported from `@selfcure/cli`.

---

## Option quick-reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rootDir` | `string` | `'./src'` | Source root to crawl |
| `include` | `string[]` | `['**/*.tsx', …]` | Glob patterns to include |
| `exclude` | `string[]` | `['**/*.spec.*', …]` | Glob patterns to exclude |
| `framework` | `string` | `'auto'` | Framework hint — skips auto-detection |
| `auth` | `AuthConfig` | `undefined` | Authentication strategy (see §2) |
| `browser.type` | `string` | `'chromium'` | Browser engine |
| `browser.headless` | `boolean` | `true` | Headless mode |
| `browser.viewport` | `object` | `{w:1280,h:720}` | Viewport size |
| `browser.timeout` | `number` | `30000` | Nav + action timeout (ms) |
| `browser.slowMo` | `number` | `0` | Delay between actions (ms) |
| `ai.provider` | `string` | — | `'anthropic' \| 'openai' \| 'google' \| 'groq' \| 'deepseek' \| 'ollama'` |
| `ai.generationModel` | `string` | per-provider | LLM model used for test generation |
| `ai.healingModel` | `string` | per-provider | LLM model used for self-healing diffs |
| `ai.apiKeyEnv` | `string` | per-provider | Env var holding the API key (override) |
| `ai.baseURL` | `string` | per-provider | Endpoint override (Ollama / self-hosted) |
| `testsDir` | `string` | `'./selfcure-tests'` | Generated spec output directory |
| `maxInputTokens` | `number` | `4096` | Token cap per generation request |
| `playwrightConfig` | `string` | `'./playwright.config.ts'` | Playwright config path |
| `baseURL` | `string` | `'http://localhost:3000'` | App base URL for tests |
| `maxHealAttempts` | `number` | `3` | Max patch attempts per test |
| `reportDir` | `string` | `'./selfcure-report'` | Report output directory |
| `reportTitle` | `string` | `'Selfcure Report'` | HTML report title |

---

## §1 Source crawl

```js
rootDir: './src',

include: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.component.ts'],

exclude: [
  '**/*.spec.*',
  '**/*.test.*',
  '**/node_modules/**',
  '**/dist/**',
],

/**
 * Optional framework hint.
 * Values: 'react' | 'vue' | 'angular' | 'auto'
 * When set to 'auto' (default) selfcure inspects file extensions and imports.
 */
framework: 'auto',
```

`rootDir` is the single root that all `include`/`exclude` globs are applied against.  
If your components span multiple directories, point `rootDir` at the common ancestor
and widen the `include` patterns.

---

## §2 Authentication

Omit the `auth` block entirely for public (unauthenticated) applications.

selfcure supports four strategies. Choose one and delete the others.

### Strategy 1 — Form-based login

selfcure opens `loginURL`, fills the username and password fields, clicks submit,
and waits for `waitForURL`. The resulting browser session is shared across all
generated tests via Playwright's storage-state mechanism.

```js
auth: {
  type: 'form',

  /** Path relative to baseURL — e.g. '/login' */
  loginURL: '/login',

  /** CSS / ARIA selector for the username input */
  usernameSelector: '[name="username"]',

  /** CSS / ARIA selector for the password input */
  passwordSelector: '[name="password"]',

  /** Selector of the submit button — default: 'button[type=submit]' */
  submitSelector: 'button[type=submit]',

  /** URL or glob to wait for after a successful login — e.g. '/dashboard' */
  waitForURL: '/dashboard',

  /** Read credentials from environment variables — never hardcode */
  username: process.env.SELFCURE_USERNAME,
  password: process.env.SELFCURE_PASSWORD,
},
```

Required environment variables:

```
SELFCURE_USERNAME=myuser
SELFCURE_PASSWORD=mypassword
```

### Strategy 2 — Playwright storage-state (pre-authenticated)

Use this when your login flow is complex (MFA, OAuth, CAPTCHA) or when you want
the fastest possible test startup. Run `selfcure auth-save` once to generate the
storage-state file, then reference it here.

```js
auth: {
  type: 'storageState',

  /** Path to the JSON file produced by `selfcure auth-save` */
  storageState: './.selfcure-auth.json',
},
```

> Add `.selfcure-auth.json` to `.gitignore` if it contains session cookies.  
> In CI, generate it in a setup step before running selfcure.

### Strategy 3 — HTTP Basic Auth

For staging environments protected by `.htaccess` / `nginx auth_basic`.

```js
auth: {
  type: 'httpCredentials',
  username: process.env.SELFCURE_USERNAME,
  password: process.env.SELFCURE_PASSWORD,
},
```

### Strategy 4 — Custom request headers

For SPAs that authenticate via a Bearer token or a proprietary API key header.

```js
auth: {
  type: 'headers',
  extraHTTPHeaders: {
    Authorization: `Bearer ${process.env.SELFCURE_TOKEN}`,
    // 'X-Api-Key': process.env.SELFCURE_API_KEY,
  },
},
```

Required environment variable:

```
SELFCURE_TOKEN=eyJhbGciOiJ...
```

---

## §3 Browser

```js
browser: {
  /** 'chromium' (default) | 'firefox' | 'webkit' */
  type: 'chromium',
  headless: true,
  viewport: { width: 1280, height: 720 },
  /** Navigation and action timeout in ms — default: 30000 */
  timeout: 30_000,
  /** Slow-motion delay between actions in ms (0 = disabled) */
  slowMo: 0,
},
```

---

## §4 AI provider

selfcure is **BYOK (Bring Your Own Key)** — pick one provider and supply the matching
API key via the environment. The provider layer ([packages/generator/src/ai.ts](../packages/generator/src/ai.ts))
uses the [Vercel AI SDK](https://sdk.vercel.ai) under the hood.

```js
ai: {
  provider: 'anthropic',
  generationModel: 'claude-opus-4-7',
  healingModel:    'claude-haiku-4-5',
  // baseURL:   'http://localhost:11434/v1',   // override (Ollama / self-hosted)
  // apiKeyEnv: 'MY_CUSTOM_VAR',               // override env var name
},
```

### Supported providers

| `provider` | Env var | Generation default | Healing default | Endpoint |
|------------|---------|--------------------|-----------------|----------|
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-opus-4-7` | `claude-haiku-4-5` | api.anthropic.com |
| `openai` | `OPENAI_API_KEY` | `gpt-4.1` | `gpt-4o-mini` | api.openai.com |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` | `gemini-2.0-flash-exp` | `gemini-2.0-flash-exp` | generativelanguage.googleapis.com |
| `groq` | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | `llama-3.1-8b-instant` | api.groq.com |
| `deepseek` | `DEEPSEEK_API_KEY` | `deepseek-chat` | `deepseek-chat` | api.deepseek.com/v1 |
| `ollama` | *(none)* | `qwen2.5-coder:14b` | `qwen2.5-coder:7b` | localhost:11434/v1 |

`ollama` requires no key — install [Ollama](https://ollama.com), pull a coder model
(`ollama pull qwen2.5-coder:14b`), and point `ai.baseURL` if it runs elsewhere.

`ai.apiKeyEnv` lets you redirect any provider to a non-default env var name
(useful when you already have a corporate-named secret like `MYCO_LLM_KEY`).

### Switching providers

There are three ways to change providers:

1. **Edit `selfcure.config.mjs`** — change `ai.provider` and the matching env var.
2. **Re-run `selfcure init`** — overwrites the file with the new picks.
3. **Re-run `selfcure web`** — same wizard in the browser.

---

## §5 Test generation

```js
testsDir: './selfcure-tests',
maxInputTokens: 4096,
```

`maxInputTokens` caps the component source sent to the LLM per request.

---

## §6 Test execution

```js
playwrightConfig: './playwright.config.ts',
baseURL: 'http://localhost:3000',
```

selfcure always appends `--trace=on-first-retry` so traces are available for healing.

---

## §7 Self-healing

```js
maxHealAttempts: 3,
```

The healing model is whatever `ai.healingModel` resolves to (see §4).
After `maxHealAttempts` the test is left failing and flagged in the report.

---

## §8 Reporting

```js
reportDir: './selfcure-report',
reportTitle: 'Selfcure Report',
```

Both `index.html` and `summary.json` are written to `reportDir`.

---

## Using a custom config path

Every command accepts a `-c` / `--config` flag:

```bash
selfcure run --config ./config/selfcure.staging.js
```

---

## Environment variables

Exactly one LLM env var is required, matching `ai.provider`:

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | When `ai.provider = 'anthropic'` | Anthropic API key |
| `OPENAI_API_KEY` | When `ai.provider = 'openai'` | OpenAI API key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | When `ai.provider = 'google'` | Gemini API key |
| `GROQ_API_KEY` | When `ai.provider = 'groq'` | Groq API key |
| `DEEPSEEK_API_KEY` | When `ai.provider = 'deepseek'` | DeepSeek API key |
| `PLAYWRIGHT_BASE_URL` | No | Overrides `baseURL` at runtime |
| `SELFCURE_USERNAME` | Auth | Username for `form` / `httpCredentials` strategies |
| `SELFCURE_PASSWORD` | Auth | Password for `form` / `httpCredentials` strategies |
| `SELFCURE_TOKEN` | Auth | Bearer token for the `headers` strategy |
| `SELFCURE_API_KEY` | Auth | Optional API key for the `headers` strategy |

Ollama needs no key — it talks to a local daemon.

---

## TypeScript types

```ts
import type {
  SelfcureConfig,
  AuthFormConfig,
  AuthStorageStateConfig,
  AuthHttpCredentialsConfig,
  AuthHeadersConfig,
  AuthConfig,
  BrowserConfig,
  AIConfig,
  ProviderId,
} from '@selfcure/cli';
```
