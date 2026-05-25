# Getting started

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 (workspace support) |
| Anthropic API key | [console.anthropic.com](https://console.anthropic.com) |
| A frontend project | React / Vue / Angular with TypeScript source |

---

## 1 · Installation

### Global (recommended for CLI use)

```bash
npm install -g @selfcure/cli
```

### Local (per-project)

```bash
npm install --save-dev @selfcure/cli
```

---

## 2 · API key

selfcure never hardcodes credentials. Create a `.env` file in the **root of your target project** (not the selfcure repo):

```bash
# .env  — never commit this file
ANTHROPIC_API_KEY=sk-ant-...
```

Load it automatically by adding `dotenv` to your project, or export it in your shell:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## 3 · Scaffold configuration

Inside your target project (e.g. `my-app/`):

```bash
selfcure init
```

This creates a commented `selfcure.config.js` with sensible defaults:

```js
// selfcure.config.js
export default {
  rootDir: './src',
  include: ['**/*.tsx', '**/*.vue', '**/*.component.ts'],
  exclude: ['**/*.spec.*', '**/node_modules/**'],
  testsDir: './selfcure-tests',
  playwrightConfig: './playwright.config.ts',
  baseURL: 'http://localhost:3000',
  generationModel: 'claude-opus-4-5',
  healingModel: 'claude-haiku-3-5',
  maxHealAttempts: 3,
  reportDir: './selfcure-report',
};
```

Edit the values to match your project structure. See the full [configuration reference](configuration.md).

---

## 4 · Start your dev server

selfcure runs tests against a **live app**, so your dev server must be running before `selfcure run`:

```bash
# example — Next.js
npm run dev

# example — Vite
npm run dev

# example — Angular
ng serve
```

---

## 5 · Run the full pipeline

```bash
selfcure run
```

This executes all five stages in sequence:

```
crawl → analyze → generate → run → heal → report
```

On completion you'll see a terminal summary and a link to the HTML report:

```
── Selfcure Report ──────────────────────
  Passed : 8
  Failed : 0
  Healed : 2
  Report : ./selfcure-report/index.html
```

---

## Individual commands

Run a single stage when you don't need the full pipeline:

```bash
# Crawl only — useful for verifying glob patterns
selfcure crawl

# Re-attempt healing on the last set of failures
selfcure heal

# Re-generate the HTML report from persisted data
selfcure report
```

---

## Continuous integration

Add selfcure to your CI workflow after your test suite:

```yaml
# .github/workflows/selfcure.yml
- name: Start dev server
  run: npm run dev &

- name: Wait for server
  run: npx wait-on http://localhost:3000

- name: Run selfcure
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx selfcure run
```

---

## Monorepo / local development

If you are working on selfcure itself:

```bash
git clone https://github.com/ricardofrancocustodio/selfcure.git
cd selfcure
npm install          # links all workspace packages
npm run build        # tsup → dist/ in every package
npm test             # vitest
npm run lint         # tsc --noEmit
```
