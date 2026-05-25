# CLAUDE.md — selfcure

## What this project is
A **self-healing Playwright test CLI** powered by Claude.
Given a frontend codebase, `selfcure` crawls source files, generates tests, runs them,
and automatically patches failures using Claude's code-generation capabilities.

## Build & test
```bash
npm install
npm run build   # tsup → dist/
npm test        # vitest
npm run lint    # tsc --noEmit
```

## Environment
Create a `.env` file (never committed) with:
```
ANTHROPIC_API_KEY=sk-ant-...
```

## Key design decisions
- **ESM-only** output; tsup configured for dual CJS+ESM when needed by consumers.
- **No runtime framework** — pure Node.js + official Anthropic SDK.
- `@typescript-eslint/parser` is used only as an AST library, not as a linter.
- Playwright is used both as a test runner and for trace capture.

## Claude usage guidelines
- Model: `claude-opus-4-5` for generation; `claude-haiku-3-5` for quick lint fixes.
- Prompt templates live in `src/prompts/`; keep them version-controlled.
- Always include component source + existing test (if any) in context.
- Cap input tokens per request; chunk large files if needed.

## What NOT to touch
- Never modify `dist/` directly — it is generated.
- Never hardcode API keys; always use `process.env.ANTHROPIC_API_KEY`.
- Do not alter `playwright.config.ts` without also updating `runner.ts`.
