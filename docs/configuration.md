# Configuration reference

All options live in **`selfcure.config.js`** at the root of your target project.  
The file must use ES module syntax (`export default { … }`).

---

## Full reference

```js
/** @type {import('@selfcure/cli').SelfcureConfig} */
export default {

  // ── Source crawl ─────────────────────────────────────────────────────────

  /**
   * Root directory of the frontend codebase to crawl.
   * All glob patterns in `include` / `exclude` are relative to this path.
   * @default './src'
   */
  rootDir: './src',

  /**
   * Glob patterns of files to include in the crawl.
   * @default ['**\/*.tsx', '**\/*.jsx', '**\/*.vue', '**\/*.component.ts']
   */
  include: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.component.ts'],

  /**
   * Glob patterns to exclude.
   * @default ['**\/*.spec.*', '**\/*.test.*', '**/node_modules/**', '**/dist/**']
   */
  exclude: [
    '**/*.spec.*',
    '**/*.test.*',
    '**/node_modules/**',
    '**/dist/**',
  ],

  // ── Test generation ───────────────────────────────────────────────────────

  /**
   * Directory where selfcure writes generated .spec.ts files.
   * Created automatically if it does not exist.
   * @default './selfcure-tests'
   */
  testsDir: './selfcure-tests',

  /**
   * Claude model used for test generation.
   * Higher-quality models produce better tests but cost more tokens.
   * @default 'claude-opus-4-5'
   */
  generationModel: 'claude-opus-4-5',

  /**
   * Maximum input tokens sent to Claude per generation request.
   * Increase for very large components; decrease to reduce cost.
   * @default 4096
   */
  maxInputTokens: 4096,

  // ── Test execution ────────────────────────────────────────────────────────

  /**
   * Absolute or relative path to your Playwright configuration file.
   * selfcure adds --trace=on-first-retry automatically.
   * @default './playwright.config.ts'
   */
  playwrightConfig: './playwright.config.ts',

  /**
   * Base URL of the running application.
   * Forwarded to Playwright via PLAYWRIGHT_BASE_URL env var.
   * @default 'http://localhost:3000'
   */
  baseURL: 'http://localhost:3000',

  // ── Self-healing ──────────────────────────────────────────────────────────

  /**
   * Claude model used to generate healing diffs.
   * Haiku is fast and inexpensive — ideal for iterative patching.
   * @default 'claude-haiku-3-5'
   */
  healingModel: 'claude-haiku-3-5',

  /**
   * Maximum number of patch attempts per failing test.
   * After this limit the test is left unpatched and marked as failed.
   * @default 3
   */
  maxHealAttempts: 3,

  // ── Reporting ─────────────────────────────────────────────────────────────

  /**
   * Directory where the HTML report and summary.json are written.
   * Created automatically if it does not exist.
   * @default './selfcure-report'
   */
  reportDir: './selfcure-report',

  /**
   * Title shown in the generated HTML report.
   * @default 'Selfcure Report'
   */
  reportTitle: 'Selfcure Report',
};
```

---

## Option quick-reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `rootDir` | `string` | `'./src'` | Source root to crawl |
| `include` | `string[]` | `['**/*.tsx', …]` | Glob patterns to include |
| `exclude` | `string[]` | `['**/*.spec.*', …]` | Glob patterns to exclude |
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

## Using a custom config path

Every command accepts a `-c` / `--config` flag:

```bash
selfcure run --config ./config/selfcure.staging.js
```

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key — never hardcode |
| `PLAYWRIGHT_BASE_URL` | No | Overrides `baseURL` at runtime |
