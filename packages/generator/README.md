# @selfcure/generator

> Legacy BYOK test generator for **selfcure** — turns component analysis into Playwright test code via an LLM.

Part of selfcure's **fallback pipeline** for teams not using the Playwright Test Agents. Sends component analysis to a provider-agnostic `LanguageModel` (via the Vercel AI SDK) and receives a Playwright `.spec.ts`. **BYOK** — bring your own key; no credentials ship with the package.

Supported providers: Anthropic, OpenAI, Google Gemini, Groq, DeepSeek, and local Ollama.

Internal library powering `selfcure run`. Most teams don't need it: the headline, preventive flow is `selfcure lint` surfaced to your AI client through [`@selfcure/mcp`](https://www.npmjs.com/package/@selfcure/mcp) — see [`@selfcure/cli`](https://www.npmjs.com/package/@selfcure/cli).

## Install

```bash
npm install @selfcure/generator
```

## Docs

Full documentation: https://github.com/ricardofrancocustodio/selfcure#readme
