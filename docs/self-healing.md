# Self-healing loop

selfcure's self-healing loop is what differentiates it from a plain test generator. When a generated test fails, selfcure does not just report the error — it tries to fix the test automatically using Claude.

---

## High-level flow

```
TestResult (passed=false)
       │
       ▼
  Read test file source
       │
       ▼
  Build heal prompt ──► Claude (claude-haiku-3-5)
       │
       ▼
  Receive unified diff
       │
       ▼
  Apply diff (in memory)
       │
       ├── Sanity check PASS ──► write patched file ──► record HealResult(healed=true)
       │
       └── Sanity check FAIL ──► restore original ──► retry (up to maxHealAttempts)
                                                              │
                                                     maxAttempts reached
                                                              │
                                                   record HealResult(healed=false)
```

---

## The healing prompt

The prompt sent to Claude includes:

1. **Full test file source** — the current state of the failing `.spec.ts` file.
2. **Error message** — the raw assertion or timeout error from Playwright.
3. **Constraints** — Claude must return only a unified diff (`--- a/test  +++ b/test`), no prose.

```
You are an expert Playwright test engineer fixing a failing test.

## Failing test file
```typescript
<source>
```

## Error
```
<error>
```

Produce a unified diff (--- a/test  +++ b/test) that fixes the failure.
Output ONLY the diff, no explanation.
```

Keeping the prompt tightly scoped ensures low latency and minimal token usage.

---

## Diff application

selfcure uses a **line-level patch algorithm** (`applyUnifiedDiff` in `packages/selfcure/src/index.ts`):

- Lines prefixed with `-` are removed (first match wins).
- Lines prefixed with `+` are appended.
- Context lines (no prefix) are ignored.

This is intentionally simple. Claude is instructed to produce minimal diffs targeting exactly the failing assertion or locator, so the algorithm handles realistic output well. A full diff engine (e.g. `diff`, `patch`) can replace this as the project matures.

---

## Sanity check

After applying the diff selfcure runs a **basic parse check** before writing the file:

```ts
new Function(patched.replace(/^import .+$/gm, ''));
```

This strips ES import statements (which `Function()` cannot evaluate) and attempts to parse the remainder as a function body. If the JavaScript engine throws a `SyntaxError`, the patch is rejected.

> This check catches malformed output from Claude (e.g. incomplete diffs) but does **not** guarantee the test will pass — that is determined by re-running Playwright.

---

## Rollback

If the sanity check fails, selfcure writes the **original source** back to disk before the next attempt:

```ts
await fs.writeFile(failed.filePath, original, 'utf-8');
```

The `original` variable is captured once at the start of the healing loop and is never mutated. This guarantees that multiple failed attempts cannot compound into a progressively worse file.

---

## Configuring the loop

```js
// selfcure.config.js
export default {
  healingModel:    'claude-haiku-3-5',  // fast, cheap — ideal for iterations
  maxHealAttempts: 3,                   // give up after 3 failed patches
};
```

Increase `maxHealAttempts` for complex components where the first diff might partially fix the issue. Decrease it to limit API costs in large suites.

---

## HealResult

Each healing attempt produces a `HealResult` record consumed by `@selfcure/reporter`:

```ts
interface HealResult {
  filePath:      string;           // absolute path to the test file
  healed:        boolean;          // true if a patch was accepted
  attempts:      number;           // total attempts made
  patchApplied?: string;           // the unified diff that was accepted
  finalError?:   string;           // last sanity-check error if all attempts failed
}
```

The `patchApplied` diff is rendered verbatim in the HTML report inside a collapsible `<details>` block so developers can review every automated change.

---

## What selfcure cannot heal

The healing loop is designed for **locator drift** — the most common cause of flaky Playwright tests after a UI refactor. It will not reliably fix:

- Tests that require **new environment setup** (missing test data, changed API contracts).
- **Timing issues** that require `waitFor` strategies.
- Tests that assert **wrong expected values** (business-logic bugs in the test itself).
- Failures caused by **missing Playwright capabilities** (browser-specific bugs).

For these cases the unhealed failure is logged with the full error, and the developer is expected to intervene.
