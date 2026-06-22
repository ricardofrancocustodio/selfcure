# @selfcure/selfcure

> Self-healing loop for **selfcure** — feeds trace + error to the configured LLM, applies a diff, and re-validates.

Part of selfcure's **legacy BYOK pipeline** (fallback for teams not using the Playwright Test Agents' Healer). On a failing test, it sends the trace and error to the configured provider, applies the proposed diff, and re-runs to confirm the fix. **BYOK** — bring your own key.

Internal library powering `selfcure heal`. The headline, preventive flow is `selfcure lint` — see [`@selfcure/cli`](https://www.npmjs.com/package/@selfcure/cli).

## Install

```bash
npm install @selfcure/selfcure
```

## Docs

Full documentation: https://github.com/ricardofrancocustodio/selfcure#readme
