# CLAUDE.md — selfcure

## Strategic positioning (read first)

selfcure is the **preventive testability layer** for frontend codebases. It is not a competitor to Playwright Test Agents (Planner / Generator / Healer) — it is the step that runs *before* them.

Mental model:

```
selfcure (preventive)                       Playwright Test Agents (reactive)
─────────────────────                       ────────────────────────────────
crawl FE source (AST)                       run app, observe DOM
score testability per component       →     Planner: explore + Markdown plan
flag ambiguous / weak selectors             Generator: plan → .spec.ts
suggest data-testid patches                 Healer: re-run + repair failures
ship the fix as a PR (FE responsibility)
```

We **don't** reinvent runtime healing. Anyone using `npx @playwright/mcp` + an MCP-capable AI client (Claude Desktop, Cursor, VS Code, Windsurf, Claude Code) already has Planner/Generator/Healer for free. Our wedge is what those agents *can't* see: the static FE source, the testability score, the ambiguity between siblings, and the path to ship the correction back to the frontend team.

Commercial entry: `@selfcure/mcp` — an MCP server that publishes our crawler+analyzer findings to any AI client the user already runs. Free and open-source. Pro features (auto-fix, PR opening, dashboards) sit on top.

`@selfcure/generator` and `@selfcure/selfcure` (BYOK LLM generator + heal loop) remain as **fallback for users without Playwright Test Agents**. They are functional today and not slated for removal — just stop being the headline.

## What this project is
A **frontend-testability lint + PR pipeline** built on top of Playwright. Given a frontend codebase, `selfcure`:
- crawls source files (AST), classifies every interactive element, and scores testability;
- detects **ambiguous locators** (selectors that resolve to multiple sibling elements in the same component) and proposes unique `data-testid` patches;
- ships those patches as a Pull Request, so the frontend team owns the fix;
- exposes everything above via an MCP server so any AI client can read it.

Legacy capabilities — LLM-based test generation and self-healing diff loop — remain available as fallback (BYOK via Anthropic, OpenAI, Google, Groq, DeepSeek, or local Ollama through the Vercel AI SDK).

## Build & test
```bash
npm install
npm run build   # tsup → dist/
npm test        # vitest
npm run lint    # tsc --noEmit
```

## Environment
selfcure is **BYOK (Bring Your Own Key)** — it never ships with credentials. Create a `.env`
file (never committed) in the target project's root with the env var matching the configured
provider:

| Provider in `selfcure.config.js` | Env var |
|----------------------------------|---------|
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai`    | `OPENAI_API_KEY` |
| `google`    | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `groq`      | `GROQ_API_KEY` |
| `deepseek`  | `DEEPSEEK_API_KEY` |
| `ollama`    | (none — runs locally) |

```
ANTHROPIC_API_KEY=sk-ant-...
# or OPENAI_API_KEY=sk-...
# or GOOGLE_GENERATIVE_AI_API_KEY=AIza...
# ...
```

## Key design decisions
- **ESM-only** output; tsup configured for dual CJS+ESM when needed by consumers.
- **Provider-agnostic via Vercel AI SDK** — both `@selfcure/generator` and `@selfcure/selfcure`
  call `generateText` against a `LanguageModel` resolved by `getModel(config.ai, kind)` in
  `packages/generator/src/ai.ts`. Adding a provider is a single switch arm + a PROVIDERS entry.
- **No runtime framework** — pure Node.js + AI SDK adapters.
- `@typescript-eslint/parser` is used only as an AST library, not as a linter.
- Playwright is used both as a test runner and for trace capture.

## LLM usage guidelines
- Default models per provider live in `PROVIDERS` (`packages/generator/src/ai.ts`).
  Anthropic defaults to `claude-opus-4-7` (generation) and `claude-haiku-4-5` (healing).
- Prompt builders are inlined next to each call site (`buildPrompt` in generator,
  `buildHealPrompt` in selfcure). Keep them in source — they are version-controlled.
- Always include component source + existing test (if any) in context.
- Cap input tokens per request (`maxInputTokens` in config); chunk large files if needed.
- Provider-specific features (Anthropic prompt caching, OpenAI tools, etc.) are NOT used —
  the integration is intentionally minimal so any provider works.

## Documentation maintenance
Before creating, updating, or deleting any doc or related file, read **`SKILLHUB.md`**.
It maps every document to the code it covers and provides checklists for structural changes
(new package, deleted package, new config option, etc.).

## What NOT to touch
- Never modify `dist/` directly — it is generated.
- Never hardcode API keys; always resolve them from env vars via the provider layer.
- Do not alter `playwright.config.ts` without also updating `runner.ts`.
- Do not reposition selfcure as a competitor to Playwright Test Agents in any doc, README, or marketing copy. We are the **preventive** layer; we feed *into* the Playwright agents. See "Strategic positioning" above.
- Do not delete `@selfcure/generator` or `@selfcure/selfcure` — they are the BYOK fallback. They may be moved or rewired, but they ship working value today.
