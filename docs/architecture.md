# Architecture

## Overview

selfcure is a **npm workspaces monorepo** made up of seven focused packages that form a linear pipeline with an optional self-healing feedback loop.

```
  ┌──────────────────────────────────────────────────────────────────┐
  │                         selfcure run                             │
  └──────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────┐      ┌──────────────┐      ┌───────────────┐
  │  @selfcure/ │      │  @selfcure/  │      │  @selfcure/   │
  │   crawler   │─────►│   analyzer   │─────►│   generator   │──► Claude API
  └─────────────┘      └──────────────┘      └───────────────┘
                                                      │ .spec.ts files
                                                      ▼
                                             ┌───────────────┐
                                             │  @selfcure/   │
                                             │    runner     │
                                             └───────────────┘
                                                      │ TestResult[]
                                          ┌───────────┴────────────┐
                                          │ passed?                │
                                    yes ──┘                    no ──┘
                                          │                        │
                                          │              ┌─────────▼──────┐
                                          │              │  @selfcure/    │
                                          │              │   selfcure     │──► Claude API
                                          │              └─────────┬──────┘
                                          │                        │ HealResult[]
                                          └──────────┬─────────────┘
                                                     ▼
                                            ┌────────────────┐
                                            │  @selfcure/    │
                                            │   reporter     │
                                            └────────────────┘
                                                     │
                                             index.html + summary.json
```

## Package dependency graph

```
@selfcure/cli
  ├── @selfcure/crawler
  │     └── (no @selfcure deps)
  ├── @selfcure/analyzer
  │     └── @selfcure/crawler
  ├── @selfcure/generator
  │     └── @selfcure/analyzer
  ├── @selfcure/runner
  │     └── (no @selfcure deps)
  ├── @selfcure/selfcure
  │     ├── @selfcure/runner
  │     └── @selfcure/generator
  └── @selfcure/reporter
        ├── @selfcure/runner
        └── @selfcure/selfcure
```

## Stage descriptions

### 1 · Crawl (`@selfcure/crawler`)

Uses **glob** to find component files matching the patterns in `selfcure.config.js`, then parses each file's source with **`@typescript-eslint/parser`** to produce an ESTree-compatible AST. Returns a `ComponentMeta[]` array — one entry per file — containing the framework type, component name, extracted props, and the raw AST.

No network calls. Fully offline.

### 2 · Analyze (`@selfcure/analyzer`)

Walks each `ComponentMeta` AST to:

- Identify interactive nodes: `<button>`, `<input>`, `<a>`, `<form>`, custom elements.
- Determine the best Playwright selector for each element (ARIA label → `data-testid` → role → CSS).
- Compute a **testability score** (0–100) based on the number of labelled, uniquely addressable elements.
- Assign a **complexity level** (`low` / `medium` / `high`) used by the generator to decide how many test cases to write.

### 3 · Generate (`@selfcure/generator`)

Sends each `AnalysisResult` to **Claude** (`claude-opus-4-5` by default) as a structured prompt that includes the component name, framework, interactive elements, and testability score.

Claude returns raw TypeScript — no markdown fences — which is written to `<testsDir>/<ComponentName>.spec.ts`.

Prompt template: `packages/generator/src/index.ts` → `buildPrompt()`.

### 4 · Run (`@selfcure/runner`)

Invokes **`npx playwright test`** via `execFile` with `--reporter=json` and `--trace=on-first-retry`. Parses stdout as Playwright's JSON reporter format and returns a `TestResult[]` array with `passed`, `error`, `tracePath`, and `durationMs` per spec.

### 5 · Heal (`@selfcure/selfcure`)

For each failed `TestResult`:

1. Reads the current test file source.
2. Sends source + error message to **Claude** (`claude-haiku-3-5` by default, fast + cheap).
3. Claude returns a **unified diff**.
4. The healer applies the diff, runs a basic AST sanity check, and writes the patched file.
5. If the sanity check fails, the original file is restored and the next attempt begins.
6. After `maxHealAttempts` the failure is recorded and left unpatched.

### 6 · Report (`@selfcure/reporter`)

Merges `TestResult[]` + `HealResult[]` into:

- **`index.html`** — styled HTML report with per-test status, duration, error detail, and applied diffs (collapsible).
- **`summary.json`** — machine-readable totals (`total`, `passed`, `failed`, `healed`).
- Terminal table printed via **chalk**.

## Key design decisions

| Decision | Rationale |
|----------|-----------|
| ESM-only (`"type": "module"`) | Aligns with Playwright, Claude SDK, and modern Node ecosystem |
| No runtime framework | Keeps the dependency surface minimal; pure Node + official SDKs |
| `@typescript-eslint/parser` as AST library only | Gives full TypeScript+JSX AST without pulling in the full ESLint stack |
| Per-package `tsup` builds | Fast, zero-config bundling; each package is independently publishable |
| Unified diff for healing | Language-agnostic; can be inspected, version-controlled, and replayed |
| Rollback on failed sanity check | Prevents a bad patch from leaving tests in an unparseable state |
