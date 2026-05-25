# AGENTS.md — selfcure

## Project overview
`selfcure` is a CLI + library that uses **Claude** (Anthropic) to generate, lint,
and self-heal **Playwright** test suites for React / Vue / Angular projects.

## Repository layout
```
src/
  cli.ts          — Commander entry-point  (selfcure crawl | run | heal)
  crawler.ts      — Scans source files with glob, extracts components via @typescript-eslint/parser
  generator.ts    — Sends component AST → Claude → returns Playwright test code
  runner.ts       — Executes tests via @playwright/test programmatic API
  healer.ts       — On failure, sends trace + error → Claude → patches test file
  utils/          — chalk/ora helpers, fs-extra wrappers
dist/             — tsup output (CommonJS + ESM)
tests/            — vitest unit tests for selfcure itself
```

## Commands the agent may run
| Command | Purpose |
|---------|---------|
| `npm run build` | Compile CLI with tsup |
| `npm test` | Run vitest suite |
| `npm run lint` | TypeScript type-check |
| `npx playwright test` | Execute generated tests |

## Conventions
- All source in `src/`, TypeScript strict mode.
- ESM-first (`"type": "module"` in package.json).
- Every new module must have a corresponding `tests/*.test.ts`.
- Never commit `.env` or any file containing API keys.
- Claude API key read from `process.env.ANTHROPIC_API_KEY` only.

## Self-healing loop
1. `selfcure run` executes tests → captures Playwright trace on failure.
2. Trace + assertion error are serialised and sent to Claude via `@anthropic-ai/sdk`.
3. Claude returns a unified diff; `healer.ts` applies it with `fs-extra`.
4. Test is re-run once; if still failing, the diff is rejected and the error is logged.
