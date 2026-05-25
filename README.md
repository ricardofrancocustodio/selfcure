# selfcure

> AI-powered self-healing Playwright test CLI — crawl, generate, run, fix.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Playwright](https://img.shields.io/badge/@playwright%2Ftest-1.60.0-45ba4b)](https://playwright.dev)
[![Claude](https://img.shields.io/badge/Claude-claude--opus--4--5-blueviolet)](https://www.anthropic.com)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

**selfcure** points at any React, Vue, or Angular codebase and does the rest:

1. **Crawls** source files, parses component ASTs, and ranks every interactive element by locator reliability (`data-testid` → ARIA role → label → CSS → XPath).
2. **Generates** complete, idiomatic Playwright spec files using Claude.
3. **Runs** the suite and captures traces on every failure.
4. **Heals** broken tests automatically — sends the trace + error to Claude, applies the unified diff, and re-validates. Rejects and rolls back patches that don't fix the failure.
5. **Reports** a rich HTML report with evidence (screenshots, traces, applied diffs) and a machine-readable `summary.json`.

---

## Quick start

```bash
# 1 — Install (requires Node 20+)
npm install -g @selfcure/cli

# 2 — Add an API key
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env

# 3 — Scaffold configuration inside your target project
selfcure init

# 4 — Run the full pipeline
selfcure run
```

## Commands

| Command | Description |
|---------|-------------|
| `selfcure init` | Scaffold `selfcure.config.mjs` in the current project |
| `selfcure crawl` | Crawl source files and print component metadata |
| `selfcure run` | Full pipeline: crawl → generate → run → heal → report |
| `selfcure heal` | Re-attempt healing on the last set of failures only |
| `selfcure report` | Re-generate the HTML report from persisted run data |

All commands accept `-c <path>` to point at a custom config file.

## Package architecture

```
packages/
├── cli           selfcure init | crawl | run | heal | report
├── crawler       glob + @typescript-eslint/parser → ComponentMeta[]
├── analyzer      classifies elements, computes 0–100 testability score
├── generator     component analysis → LLM → Playwright .spec.ts
├── runner        @playwright/test programmatic API + trace capture
├── selfcure      self-healing loop (LLM diff → patch → re-run)
└── reporter      HTML report + summary.json + terminal table
```

Dependency flow:

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
| [Self-healing loop](docs/self-healing.md) | How patch/revert/retry works |
| [Packages](docs/packages/) | Per-package API reference |

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

