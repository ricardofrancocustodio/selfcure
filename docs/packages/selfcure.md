# @selfcure/selfcure

Implements the self-healing loop: for each failing `TestResult`, asks the configured
LLM for a unified diff, applies it, validates the result, and rolls back on failure.
The LLM provider/model is resolved through the same layer as `@selfcure/generator`
(`getModel` from `@selfcure/generator`).

See [Self-healing loop](../self-healing.md) for the full design rationale.

## API

### `heal(failedTests, options): Promise<HealResult[]>`

```ts
import { heal } from '@selfcure/selfcure';

const healResults = await heal(failedTests, {
  playwrightConfig: './playwright.config.ts',
  ai: {
    provider: 'anthropic',
    healingModel: 'claude-haiku-4-5',
  },
  maxAttempts: 3,
});
```

### Types

```ts
interface HealOptions {
  /** Resolved `ai` block from selfcure.config.mjs */
  ai: AIConfig;
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

`AIConfig` is the same type used by `@selfcure/generator` —
see [generator.md](generator.md#types).

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

Same as `@selfcure/generator` — one env var matching `ai.provider`
(see [generator.md](generator.md#required-environment)).

## Runtime dependencies

| Package | Role |
|---------|------|
| `ai` | Vercel AI SDK core — `generateText` |
| `@selfcure/generator` | Provider resolver (`getModel`) + AIConfig type |
| `@selfcure/runner` | Typed inputs (`TestResult`) |
| `fs-extra` | File read / write / rollback |

## Source

`packages/selfcure/src/index.ts`
