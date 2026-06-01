# selfcure

> **The preventive testability layer for frontend codebases.** Playwright Healer cures tests that break. selfcure *evites* that they break — by analyzing the component before it becomes a test, and handing the fix back to the frontend team.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Playwright](https://img.shields.io/badge/@playwright%2Ftest-1.60.0-45ba4b)](https://playwright.dev)
[![MCP](https://img.shields.io/badge/MCP-Anthropic-blueviolet)](https://modelcontextprotocol.io)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

## Why selfcure exists

The market is saturated with **reactive** test healing tools (Playwright Test Agents, Shiplight, BrowserStack Self-Heal, …). They all wait for a test to fail, then patch.

selfcure does the opposite: it reads your React/Vue/Angular/HTML source **before any test exists**, scores every interactive element on a 0–100 testability scale, and flags two things nobody else catches at source level:

- **Low-score elements** — buttons / inputs / links with no `data-testid`, `id`, `aria-label`, or `name`. The fix belongs to the frontend, not the QA pipeline.
- **Ambiguous locators** — the best selector for an element also matches one of its siblings. Playwright would resolve to multiple nodes; the test would silently bind to the wrong one.

Then it opens a Pull Request with the suggested patches. The frontend team owns the fix.

Dogfooded on a real legacy HTML app (qnexytest): **500 issues across 27 files — 477 of them ambiguous**, the exact failure mode runtime healers can't prevent.

## What it does, end-to-end

1. **Crawls** source files (`*.tsx`, `*.jsx`, `*.vue`, `*.component.ts`, `*.html`), parses component ASTs, builds a `selectorRanking` per interactive element (`data-testid` → `id` → `aria-label` → `name` → CSS → XPath).
2. **Detects ambiguity** — when two or more elements in the same component share the best selector, the score is penalised and the element is flagged.
3. **Lints with score + ambiguity** — `selfcure lint` or `POST /api/lint` returns one `LintIssue` per flagged element with a dedup-aware `suggestedTestId`.
4. **Opens a Pull Request** — the `/lint` web page lets you pick which fixes to include with checkboxes. One click → branch + commit + push + PR against the base branch you configured (or the repo's default branch, auto-detected via `gh`). Redirects to GitHub.
5. **Exposes everything via MCP** — `@selfcure/mcp` lets any MCP client (Claude Desktop, Cursor, VS Code, Claude Code, Windsurf) ask selfcure which components are blocking test generation.

## Where Playwright Test Agents fit in

selfcure does NOT generate or heal tests. That's the job of:

- **`@playwright/mcp`** + Playwright Test Agents — Planner, Generator, Healer. The official Microsoft pipeline, free, open-source.
- An MCP client of your choice (Claude Desktop, Cursor, VS Code Copilot, etc.) brings the LLM.

The intended workflow:

```
selfcure lint  →  apply patches via PR  →  npx playwright init-agents  →  generate + run + heal
   (prevention)        (frontend owns)         (Microsoft Test Agents take over)
```

Selfcure also ships a **legacy BYOK pipeline** (`@selfcure/generator` + `@selfcure/selfcure`) for teams that haven't moved to Playwright Test Agents yet. Same provider matrix: Anthropic, OpenAI, Google, Groq, DeepSeek, Ollama.

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
| `selfcure mcp` | Start the MCP stdio server (Claude Desktop / Cursor / VS Code / Windsurf) |
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

Dependency flow — preventive path (the headline):

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

LLM provider is configurable: Anthropic, OpenAI, Google Gemini, Groq,
DeepSeek, or local Ollama. See [`docs/configuration.md`](docs/configuration.md#§4-ai-provider).

## Documentation

| Doc | Description |
|-----|-------------|
| [Getting started](docs/getting-started.md) | Install, configure, first run |
| [Configuration reference](docs/configuration.md) | All `selfcure.config.mjs` options |
| [Architecture](docs/architecture.md) | Package graph, data flow, design decisions |
| [Build roadmap](docs/SELFCURE_BUILD.md) | Module-by-module build order + strategic positioning |
| [Self-healing loop](docs/self-healing.md) | How patch/revert/retry works (legacy fallback path) |
| [Packages](docs/packages/) | Per-package API reference (incl. [`@selfcure/mcp`](docs/packages/mcp.md)) |

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

See [docs/configuration.md §9](docs/configuration.md#§9-linter-pro) for the full reference and CI setup.

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

