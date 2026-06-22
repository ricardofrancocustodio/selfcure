# selfcure

> **Testability maturity & visibility for frontend teams.** selfcure scores every interactive element in your React, Vue, Angular, or HTML source, flags ambiguous locators and missing stable identifiers, and opens a Pull Request with the fix — before Cypress, Playwright, Selenium, TestCafe, or WebdriverIO ever run.

> Correction is commodity — visibility over time is the product.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![npm @selfcure/cli](https://img.shields.io/npm/v/@selfcure/cli?label=%40selfcure%2Fcli&color=cb3837&logo=npm)](https://www.npmjs.com/package/@selfcure/cli)
[![npm @selfcure/mcp](https://img.shields.io/npm/v/@selfcure/mcp?label=%40selfcure%2Fmcp&color=cb3837&logo=npm)](https://www.npmjs.com/package/@selfcure/mcp)
[![npm @selfcure/selfcure](https://img.shields.io/npm/v/@selfcure/selfcure?label=%40selfcure%2Fselfcure&color=cb3837&logo=npm)](https://www.npmjs.com/package/@selfcure/selfcure)
[![Playwright](https://img.shields.io/badge/@playwright%2Ftest-1.60.0-45ba4b)](https://playwright.dev)
[![MCP](https://img.shields.io/badge/MCP-compatible-blueviolet)](https://modelcontextprotocol.io)
[![VS Code](https://img.shields.io/badge/VS%20Code-GitHub%20Copilot-007ACC?logo=visualstudiocode)](https://code.visualstudio.com/docs/copilot/chat/mcp-servers)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

## Why selfcure exists

Automation tools — Cypress, Playwright, Selenium, TestCafe, WebdriverIO — can only test what the source makes testable. When selectors are ambiguous or identifiers are missing, tests fail silently or bind to the wrong element. The fix belongs to the frontend team, not the QA pipeline.

selfcure reads your React / Vue / Angular / HTML source **before any test runs**, scores every interactive element on a 0–100 testability scale, and flags:

- **Low-score elements** — buttons, inputs, links with no `data-testid`, `id`, `aria-label`, or `name`.
- **Ambiguous locators** — when the best selector for an element also matches a sibling. Any automation runtime would silently bind to the wrong node.

Then it opens a Pull Request with the fix and tracks maturity over time — per component, per package, per team.

Dogfooded on a real legacy HTML app: **500 issues across 27 files — 477 of them ambiguous locators**, avg score 43/100. Exported directly to SonarQube.

## What it does, end-to-end

1. **Crawls** source files (`*.tsx`, `*.jsx`, `*.vue`, `*.component.ts`, `*.html`), parses component ASTs, builds a `selectorRanking` per interactive element (`data-testid` → `id` → `aria-label` → `name` → CSS → XPath).
2. **Detects ambiguity** — when two or more elements in the same component share the best selector, the score is penalised and the element is flagged.
3. **Lints with score + ambiguity** — `selfcure lint` or `POST /api/lint` returns one `LintIssue` per flagged element with a dedup-aware `suggestedTestId`.
4. **Opens a Pull Request** — the `/lint` web page lets you pick which fixes to include with checkboxes. One click → branch + commit + push + PR against the base branch you configured (or the repo's default branch, auto-detected via `gh`). Redirects to GitHub.
5. **Exposes everything via MCP** — `@selfcure/mcp` lets any MCP client (VS Code + GitHub Copilot, Claude Desktop, Cursor, Claude Code, Windsurf) ask selfcure which components are blocking test generation.

## What selfcure is not

selfcure does **not** generate or heal tests at runtime — that's the job of your test framework (Cypress, Playwright, Selenium, TestCafe, WebdriverIO) and any AI agent you pair with it.

selfcure is the **source-level maturity layer** that runs before those tools:

```
selfcure lint  →  apply patches via PR  →  run Cypress / Playwright / Selenium / …
  (maturity score)     (frontend owns)          (stable, unambiguous selectors)
```

For teams using MCP-capable AI clients (VS Code + GitHub Copilot agent mode, Claude Desktop, Cursor, Windsurf), `@selfcure/mcp` publishes crawler + analyzer findings directly to the agent — no extra tooling needed.

selfcure also ships a **legacy BYOK pipeline** (`@selfcure/generator` + `@selfcure/selfcure`) for LLM-powered test generation and healing. Provider matrix: Anthropic, OpenAI, Google Gemini, Groq, DeepSeek, Ollama.

---

## Quick start

```bash
# 1 — Install (requires Node 20+)
npm install -g @selfcure/cli

# 2 — Scaffold configuration inside your target project
selfcure init

# 3 — Lint your frontend for testability issues
selfcure lint

# 4 — (Pro) Open the web UI, pick which fixes go into a PR
selfcure web                # opens http://localhost:3333/lint
```

For LLM-powered legacy generation/healing (fallback when not using Playwright Test Agents):

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env       # or any other provider
selfcure run                                       # full pipeline
```

## Commands

| Command | Description |
|---------|-------------|
| `selfcure init` | Scaffold `selfcure.config.mjs` in the current project |
| `selfcure crawl` | Crawl source files and print component metadata |
| `selfcure lint` | Score testability + flag ambiguous locators + suggest data-testid patches |
| `selfcure lint --fix` | [Pro] Apply patches to source files |
| `selfcure lint --fix --pr` | [Pro] Apply + branch + push + open a Pull Request |
| `selfcure web` | Browser UI with checkbox-driven PR flow |
| `selfcure mcp` | Start the MCP stdio server (VS Code Copilot / Claude Desktop / Cursor / Windsurf) |
| `selfcure run` | (Legacy) Full BYOK pipeline: crawl → generate → run → heal → report |
| `selfcure heal` | (Legacy) Re-attempt healing on the last set of failures |
| `selfcure report` | (Legacy) Re-generate the HTML report from persisted data |

All commands accept `-c <path>` to point at a custom config file.

## Package architecture

```
packages/
├── cli           selfcure init | crawl | lint | mcp | web | (legacy: run/heal/report)
├── crawler       glob + @typescript-eslint/parser → ComponentMeta[]
├── analyzer      score + ambiguity detection → InteractiveElement[]
├── web           /lint page + PR opening flow (one-click → GitHub)
├── mcp           MCP stdio server — entry point for any AI client
│
├── generator     (legacy fallback) component analysis → LLM → Playwright .spec.ts
├── runner        (legacy fallback) @playwright/test programmatic API
├── selfcure      (legacy fallback) self-healing loop
└── reporter      (legacy fallback) HTML report + summary.json
```

Dependency flow — maturity path (the headline):

```
                    crawler ──► analyzer ──► lint pipeline ──► PR
                                    │              │
                                    ▼              │
                                   mcp ◄───────────┘
                                    │
                       (Claude Desktop / Cursor / VS Code / …)
```

Dependency flow — legacy BYOK path (still works):

```
cli ──► crawler ──► analyzer ──► generator ──► [LLM provider]
                                      │
         runner ◄────────────────────┘
           │
         selfcure ──► [LLM provider]
           │
         reporter
```

LLM provider is configurable: Anthropic, OpenAI, Google Gemini, Groq, DeepSeek, or local Ollama.

## Opening pull requests (Pro)

The `selfcure lint --pr` command and the **Open pull request** button on the web `/lint` page delegate to the GitHub CLI — selfcure never stores tokens or repo URLs. Each user sets this up once:

```bash
# 1 — Install GitHub CLI (https://cli.github.com)
winget install GitHub.cli      # Windows
# brew install gh              # macOS
# sudo apt install gh          # Debian/Ubuntu

# 2 — Authenticate (browser OAuth)
gh auth login

# 3 — Ensure the project has an origin remote
git remote -v
# if missing: git remote add origin https://github.com/<org>/<repo>.git
```

Then enable the feature in `selfcure.config.mjs`:

```js
pro: true,
lint: { prBaseBranch: 'main' },   // optional — defaults to repo's default branch
```

See `selfcure.config.mjs` for the full reference and CI setup.

## Environment

One env var, matching `ai.provider` in your config — never commit:

```
ANTHROPIC_API_KEY=sk-ant-...                 # anthropic
# OPENAI_API_KEY=sk-...                       # openai
# GOOGLE_GENERATIVE_AI_API_KEY=AIza...        # google
# GROQ_API_KEY=gsk_...                        # groq
# DEEPSEEK_API_KEY=sk-...                     # deepseek
# (none)                                      # ollama (local)
```

## License

[MIT](LICENSE) © ricardofrancocustodio

