# @selfcure/selfcure

Implements the self-healing loop: for each failing `TestResult`, asks Claude for a unified diff, applies it, validates the result, and rolls back on failure.

See [Self-healing loop](../self-healing.md) for the full design rationale.

## API

### `heal(failedTests, options): Promise<HealResult[]>`

```ts
import { heal } from '@selfcure/selfcure';

const healResults = await heal(failedTests, {
  playwrightConfig: './playwright.config.ts',
  model: 'claude-haiku-3-5',   // optional
  maxAttempts: 3,               // optional
});
```

### Types

```ts
interface HealOptions {
  /** Claude model — default: 'claude-haiku-3-5' */
  model?: string;
  /** Max patch attempts per test — default: 3 */
  maxAttempts?: number;
  /** Playwright config path (needed for re-run after patch) */
  playwrightConfig: string;
}

interface HealResult {
  filePath: string;
  healed: boolean;
  attempts: number;
  /** Unified diff that was accepted, if any */
  patchApplied?: string;
  /** Last sanity-check error if all attempts failed */
  finalError?: string;
}
```

## Healing prompt

```
You are an expert Playwright test engineer fixing a failing test.

## Failing test file
```typescript
<current source>
```

## Error
```
<error message>
```

Produce a unified diff (--- a/test  +++ b/test) that fixes the failure.
Output ONLY the diff, no explanation.
```

## Sanity check

Before committing a patch to disk, selfcure validates the patched source:

```ts
new Function(patched.replace(/^import .+$/gm, ''));
```

A `SyntaxError` triggers a rollback to the original source and starts the next attempt.

## Required environment

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Runtime dependencies

| Package | Role |
|---------|------|
| `@anthropic-ai/sdk` | Claude API client |
| `@selfcure/runner` | Typed inputs (`TestResult`) |
| `@selfcure/generator` | Typed inputs (`GeneratorOptions`) |
| `fs-extra` | File read / write / rollback |

## Source

`packages/selfcure/src/index.ts`
