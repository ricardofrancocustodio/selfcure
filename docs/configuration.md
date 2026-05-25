# Configuration reference

All options live in **`selfcure.config.js`** at the root of your target project.  
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
| `testsDir` | `string` | `'./selfcure-tests'` | Generated spec output directory |
| `generationModel` | `string` | `'claude-opus-4-5'` | Claude model for generation |
| `maxInputTokens` | `number` | `4096` | Token cap per generation request |
| `playwrightConfig` | `string` | `'./playwright.config.ts'` | Playwright config path |
| `baseURL` | `string` | `'http://localhost:3000'` | App base URL for tests |
| `healingModel` | `string` | `'claude-haiku-3-5'` | Claude model for healing diffs |
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

## §4 Test generation

```js
testsDir: './selfcure-tests',
generationModel: 'claude-opus-4-5',
maxInputTokens: 4096,
```

`maxInputTokens` caps the component source sent to Claude per request.

---

## §5 Test execution

```js
playwrightConfig: './playwright.config.ts',
baseURL: 'http://localhost:3000',
```

selfcure always appends `--trace=on-first-retry` so traces are available for healing.

---

## §6 Self-healing

```js
healingModel: 'claude-haiku-3-5',
maxHealAttempts: 3,
```

After `maxHealAttempts` the test is left failing and flagged in the report.

---

## §7 Reporting

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

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | **Yes** | Anthropic API key — never hardcode |
| `PLAYWRIGHT_BASE_URL` | No | Overrides `baseURL` at runtime |
| `SELFCURE_USERNAME` | Auth | Username for `form` / `httpCredentials` strategies |
| `SELFCURE_PASSWORD` | Auth | Password for `form` / `httpCredentials` strategies |
| `SELFCURE_TOKEN` | Auth | Bearer token for the `headers` strategy |
| `SELFCURE_API_KEY` | Auth | Optional API key for the `headers` strategy |

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
} from '@selfcure/cli';
```
