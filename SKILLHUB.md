# SKILLHUB.md — selfcure Documentation Maintenance Guide

This file is the authoritative reference for any AI agent (Claude, GitHub Copilot, etc.)
on **where** every document lives, **what** each one covers, and **when** to
create / update / delete each one.

---

## 1. Document map

### Root-level AI instruction files

| File | Audience | Covers |
|------|----------|--------|
| `AGENTS.md` | All agents (Codex, Copilot, etc.) | Repo layout, runnable commands, conventions |
| `CLAUDE.md` | Claude specifically | Build/test, environment, design decisions, what not to touch |
| `SKILLHUB.md` | All agents | **This file** — documentation maintenance map |

### Root config

| File | Covers |
|------|--------|
| `selfcure.config.mjs` | Config schema template for the target project under test |
| `package.json` | Workspace root — workspaces list, scripts, devDependencies |
| `tsconfig.json` | Shared TypeScript base config extended by every package |

### `docs/` — human-facing documentation

| File | Covers |
|------|--------|
| `docs/getting-started.md` | Prerequisites, install, API key, `selfcure run` walkthrough, CI recipe |
| `docs/configuration.md` | Every `selfcure.config.mjs` option — types, defaults, examples |
| `docs/architecture.md` | Full pipeline diagram, per-stage descriptions, package dependency graph, design decisions |
| `docs/self-healing.md` | Heal loop design, prompt structure, diff algorithm, sanity check, rollback, limitations |
| `docs/packages/cli.md` | `@selfcure/cli` — commands, flags, pipeline orchestration |
| `docs/packages/crawler.md` | `@selfcure/crawler` — `crawl()` API, types, framework detection |
| `docs/packages/analyzer.md` | `@selfcure/analyzer` — `analyze()` API, scoring formula, complexity thresholds |
| `docs/packages/generator.md` | `@selfcure/generator` — `generate()` API, prompt template, output naming |
| `docs/packages/runner.md` | `@selfcure/runner` — `run()` API, Playwright flags, error handling |
| `docs/packages/selfcure.md` | `@selfcure/selfcure` — `heal()` API, heal prompt, sanity check |
| `docs/packages/reporter.md` | `@selfcure/reporter` — `report()` API, output files, HTML columns |
| `docs/packages/web.md` | `@selfcure/web` — `startWebServer()` API, HTTP routes, init page, generator |

### `docs/implementations/` — incremental implementation notes

| File | Covers |
|------|--------|
| `docs/implementations/2026-05-25-web-crawl-page.md` | Web crawler/analyzer page, `/crawl`, `/api/crawl`, filters, and validation notes |
| `docs/implementations/2026-05-27-no-port-3000-defaults.md` | Replaced 3000 defaults/examples with 5000 and removed test session artifact that restored 3000 |
| `docs/implementations/2026-05-27-scm-oauth-integrations.md` | Added one-click OAuth connections for GitHub, GitLab, and Bitbucket in `/integrations` |
| `docs/implementations/2026-05-27-scm-oauth-dotenv-fallback.md` | Enabled OAuth credential detection from target `.env` so Connect buttons are not wrongly disabled |

### `site/` — public landing page (GitHub Pages)

| File | Covers |
|------|--------|
| `site/index.html` | Marketing landing page hero, mantra, pipeline, providers table, quick-start, status — served via GitHub Pages from `/site` |
| `site/.nojekyll` | Prevents Jekyll preprocessing — `site/` is plain HTML |

---

## 2. Change → document matrix

Use this table to determine which files to update for any given code change.

### Code changes

| What changed | Files to update |
|--------------|-----------------|
| New CLI command added | `AGENTS.md` (commands table) · `docs/packages/cli.md` |
| CLI flag renamed or removed | `docs/packages/cli.md` · `docs/getting-started.md` (if referenced) |
| `selfcure.config.mjs` option added / changed / removed | `selfcure.config.mjs` (JSDoc) · `docs/configuration.md` |
| New npm workspace package added | `AGENTS.md` (repo layout) · `CLAUDE.md` (if design-relevant) · `docs/architecture.md` · new `docs/packages/<name>.md` · `README.md` (architecture section) |
| Existing package deleted | `AGENTS.md` · `docs/architecture.md` · delete `docs/packages/<name>.md` · `README.md` |
| Public API signature changed (`crawl`, `analyze`, etc.) | Corresponding `docs/packages/<name>.md` |
| New exported type added to any package | Corresponding `docs/packages/<name>.md` (Types section) |
| Claude model changed | `CLAUDE.md` (Claude usage guidelines) · corresponding `docs/packages/<name>.md` |
| Heal prompt template changed | `docs/self-healing.md` (Healing prompt section) · `docs/packages/selfcure.md` |
| Generator prompt template changed | `docs/packages/generator.md` (Prompt structure section) |
| Playwright version bumped | `docs/packages/runner.md` · `README.md` badge |
| `@anthropic-ai/sdk` version bumped | `docs/packages/generator.md` · `docs/packages/selfcure.md` |
| Build tooling changed (tsup, vitest, tsc) | `CLAUDE.md` · `AGENTS.md` |
| New devDependency at root | `AGENTS.md` (if it affects runnable commands) |
| `playwright.config.ts` changed | `CLAUDE.md` ("What NOT to touch" note) · `docs/packages/runner.md` |
| `tsconfig.json` base changed | `AGENTS.md` (conventions) |
| New `src/prompts/` file | `CLAUDE.md` (prompt templates note) |

### Documentation-only changes

| Scenario | Action |
|----------|--------|
| New conceptual topic needed | Create under `docs/` and add a row to the map in §1 of this file |
| Package doc for a new package | Create `docs/packages/<name>.md` from the template in §4 |
| Doc deleted (package removed) | Remove the file **and** its row in §1 of this file |

---

## 3. Update rules

1. **Always keep §1 of this file current.** Every new doc file needs a row; every deleted doc file loses its row.
2. **Update `README.md` only for structural changes** — new package, deleted package, new top-level command, new badge.  Do not repeat content that lives in `docs/`.
3. **Cross-reference `docs/architecture.md`** whenever the inter-package dependency graph changes or a new pipeline stage is added.
4. **Do not duplicate.** If a fact (e.g., the scoring formula) lives in one doc, link to it from others rather than copying it.
5. **Keep code snippets in docs in sync with `src/`.** Stale API signatures in docs are bugs.
6. **Commit docs in the same commit as the code change** whenever possible so history stays coherent.

---

## 4. New package doc template

When a new workspace package is added, create `docs/packages/<name>.md` using this template:

```markdown
# @selfcure/<name>

One-sentence description of what this package does.

## API

### `<mainFunction>(options): Promise<ReturnType>`

\`\`\`ts
import { <mainFunction> } from '@selfcure/<name>';

const result = await <mainFunction>({ /* options */ });
\`\`\`

### Types

\`\`\`ts
interface <Name>Options {
  // document every option
}

interface <ReturnType> {
  // document every field
}
\`\`\`

## Runtime dependencies

| Package | Role |
|---------|------|
| `<dep>` | <why> |

## Source

`packages/<name>/src/index.ts`
```

---

## 5. File creation / deletion checklist

### Adding a new package

- [ ] `packages/<name>/package.json`
- [ ] `packages/<name>/tsconfig.json`
- [ ] `packages/<name>/src/index.ts`
- [ ] `packages/<name>/tests/<name>.test.ts`
- [ ] `docs/packages/<name>.md` (use template in §4)
- [ ] Add row to §1 of `SKILLHUB.md`
- [ ] Add package to repo layout in `AGENTS.md`
- [ ] Update `docs/architecture.md` dependency graph
- [ ] Update `README.md` architecture section
- [ ] Wire as dependency in `packages/cli/package.json` if it is a pipeline stage

### Removing a package

- [ ] Delete `packages/<name>/`
- [ ] Delete `docs/packages/<name>.md`
- [ ] Remove row from §1 of `SKILLHUB.md`
- [ ] Remove package from `AGENTS.md`
- [ ] Update `docs/architecture.md`
- [ ] Update `README.md`
- [ ] Remove from `packages/cli/package.json`

### Adding a new `selfcure.config.mjs` option

- [ ] Add the option with JSDoc in `selfcure.config.mjs`
- [ ] Add a row to the quick-reference table in `docs/configuration.md`
- [ ] Add a full section in `docs/configuration.md` if the option needs detailed explanation
- [ ] Update `docs/getting-started.md` if the option is commonly used during setup

---

## 6. Quick-reference: which file owns what

| Topic | Owner file |
|-------|-----------|
| Scoring formula | `docs/packages/analyzer.md` |
| Heal prompt (verbatim) | `docs/self-healing.md` |
| Generator prompt (verbatim) | `docs/packages/generator.md` |
| Claude model selection rationale | `CLAUDE.md` |
| Complete option reference | `docs/configuration.md` |
| Pipeline stage descriptions | `docs/architecture.md` |
| Package dependency graph | `docs/architecture.md` |
| Getting-started / CI recipe | `docs/getting-started.md` |
| Per-package public API | `docs/packages/<name>.md` |
| Runnable agent commands | `AGENTS.md` |
