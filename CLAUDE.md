# CLAUDE.md — selfcure

## What this project is
A **self-healing Playwright test CLI** powered by an LLM (BYOK).
Given a frontend codebase, `selfcure` crawls source files, generates tests, runs them,
and automatically patches failures by sending the failing source + error to the configured
provider (Anthropic, OpenAI, Google, Groq, DeepSeek, or local Ollama) via the Vercel AI SDK.

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
