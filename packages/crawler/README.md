# @selfcure/crawler

> Source crawler for **selfcure** — extracts interactive-element metadata from frontend source via AST.

Globs your `*.tsx`, `*.jsx`, `*.vue`, `*.component.ts`, and `*.html` files, parses each component with `@typescript-eslint/parser`, and returns a structured `ComponentMeta[]` describing every interactive element and its candidate selectors.

Internal library powering [`@selfcure/cli`](https://www.npmjs.com/package/@selfcure/cli) and [`@selfcure/mcp`](https://www.npmjs.com/package/@selfcure/mcp). You usually don't need to depend on it directly.

## Install

```bash
npm install @selfcure/crawler
```

## Docs

Full documentation: https://github.com/ricardofrancocustodio/selfcure#readme
