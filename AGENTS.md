# AGENTS.md — selfcure

## Project overview
`selfcure` is a CLI + library that uses an **LLM provider of your choice**
(Anthropic, OpenAI, Google Gemini, Groq, DeepSeek, or local Ollama) to generate
and self-heal **Playwright** test suites for React / Vue / Angular projects.
The provider abstraction lives in `packages/generator/src/ai.ts` and uses the
Vercel AI SDK under the hood.

## Repository layout (npm workspaces monorepo)
```
packages/
  cli/            — @selfcure/cli     — Commander entry-point (selfcure init | crawl | run | heal | report)
  crawler/        — @selfcure/crawler — Static + dynamic source crawl via glob + @typescript-eslint/parser
  analyzer/       — @selfcure/analyzer— Classifies interactive elements, computes testability score
  generator/      — @selfcure/generator— Sends AST + analysis → Claude → Playwright test code
  runner/         — @selfcure/runner  — Executes tests via @playwright/test, captures traces on failure
  selfcure/       — @selfcure/selfcure— Self-healing loop: trace + error → Claude diff → patch + re-run
  reporter/       — @selfcure/reporter— HTML report + JSON summary + evidence (screenshots, diffs)
  web/            — @selfcure/web     — Local HTTP server + browser init wizard (selfcure web)
  mcp/            — @selfcure/mcp     — Model Context Protocol stdio server (Claude Desktop, Cursor, VS Code, …)
selfcure.config.mjs — Config template for the TARGET project under test
package.json      — Workspace root (private, no runtime deps)
tsconfig.json     — Shared base TypeScript config (extended by each package)
```

Each package follows:
```
packages/<name>/
  src/index.ts   — public API
  package.json   — scoped deps (@selfcure/*)
  tsconfig.json  — extends ../../tsconfig.json
  dist/          — tsup output (gitignored)
```

## Commands the agent may run
| Command | Purpose |
|---------|---------|
| `npm install` | Install + link all workspace packages |
| `npm run build` | Build all packages with tsup (runs `--workspaces`) |
| `npm test` | Run vitest suite from the root |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
| `npm run build -w packages/cli` | Build a single workspace package |
| `npx selfcure run` | Execute the full crawl → generate → run → heal → report pipeline |
| `npx selfcure lint` | Lint source files for unstable selectors and suggest data-testid patches |
| `npx selfcure lint --fix` | [Pro] Auto-apply data-testid patches to source files |
| `npx selfcure lint --fix --pr` | [Pro] Auto-patch + open a GitHub PR with the changes |
| `npx selfcure web` | Open the browser init wizard at http://localhost:3333 |
| `npx selfcure mcp` | Start the MCP stdio server (equivalent to `npx @selfcure/mcp`) — consumable by Claude Desktop, Cursor, VS Code, Windsurf, Claude Code |

## Documentation maintenance
Before creating, updating, or deleting any doc or related file, read **`SKILLHUB.md`**.
It contains the full document map, change → file matrix, and checklists for common scenarios.

## Conventions
- All source in `src/`, TypeScript strict mode.
- ESM-first (`"type": "module"` in package.json).
- Every new module must have a corresponding `tests/*.test.ts`.
- Never commit `.env` or any file containing API keys.
- LLM API keys are read from env vars resolved by the provider — see
  `PROVIDERS` in `packages/generator/src/ai.ts` (e.g. `ANTHROPIC_API_KEY`,
  `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GROQ_API_KEY`,
  `DEEPSEEK_API_KEY`). Ollama is keyless.

## Self-healing loop
1. `selfcure run` executes tests → captures Playwright trace on failure.
2. Trace + assertion error are serialised and sent to the configured LLM via
   `generateText` from the Vercel AI SDK (`ai` package).
3. The LLM returns a unified diff; `healer.ts` applies it with `fs-extra`.
4. Test is re-run once; if still failing, the diff is rejected and the error is logged.
