# @selfcure/runner

Executes Playwright tests programmatically via `npx playwright test` and returns structured `TestResult[]` objects for each spec.

## API

### `run(options): Promise<TestResult[]>`

```ts
import { run } from '@selfcure/runner';

const results = await run({
  playwrightConfig: './playwright.config.ts',
  testFiles: ['./selfcure-tests/Button.spec.ts'],  // optional subset
  baseURL: 'http://localhost:3000',                 // optional
});
```

### Types

```ts
interface RunOptions {
  /** Absolute path to playwright.config.ts */
  playwrightConfig: string;
  /** Subset of test files to run; omit to run all */
  testFiles?: string[];
  /** Base URL forwarded to Playwright via PLAYWRIGHT_BASE_URL */
  baseURL?: string;
}

interface TestResult {
  filePath: string;
  passed: boolean;
  error?: string;
  /** Absolute path to the .zip trace, if Playwright captured one */
  tracePath?: string;
  durationMs: number;
}
```

## Playwright flags applied automatically

| Flag | Value | Reason |
|------|-------|--------|
| `--reporter` | `json` | Machine-readable output for `TestResult` parsing |
| `--trace` | `on-first-retry` | Captures traces for the healer on first retry |

## Error handling

Playwright exits with a non-zero code when tests fail. The runner catches this and parses `stdout` regardless, so partial results are always returned. A global catch produces a single `TestResult` with `passed: false` when Playwright itself cannot start (e.g. missing `playwright.config.ts`).

## Runtime dependencies

| Package | Role |
|---------|------|
| `@playwright/test` | Test execution engine |

## Source

`packages/runner/src/index.ts`
