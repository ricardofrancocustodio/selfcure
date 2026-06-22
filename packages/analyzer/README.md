# @selfcure/analyzer

> Testability scorer for **selfcure** — classifies interactive elements and computes a 0–100 score per component.

Takes `ComponentMeta[]` from [`@selfcure/crawler`](https://www.npmjs.com/package/@selfcure/crawler), builds a `selectorRanking` per element (`data-testid` → `id` → `aria-label` → `name` → CSS → XPath), detects **ambiguous locators** (when the best selector for an element also matches a sibling), and emits a testability score plus a dedup-aware suggested `data-testid`.

Internal library powering [`@selfcure/cli`](https://www.npmjs.com/package/@selfcure/cli) and [`@selfcure/mcp`](https://www.npmjs.com/package/@selfcure/mcp).

## Install

```bash
npm install @selfcure/analyzer
```

## Docs

Full documentation: https://github.com/ricardofrancocustodio/selfcure#readme
