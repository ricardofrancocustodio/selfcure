# @selfcure/cli

Entry-point package. Provides the `selfcure` binary and orchestrates all other packages.

## Commands

```
selfcure [options] <command>

Commands:
  init              Interactive wizard — scaffold selfcure.config.mjs and .env
  crawl [file]      Crawl source files; if [file] is given, crawl only that file
  run               Full pipeline: crawl → analyze → generate → run → heal → report
  heal              Re-attempt healing on the last set of failures
  report            Re-generate HTML report from persisted run data
  lint              [Pro] Lint selectors and suggest data-testid patches
  lint --fix        [Pro] Apply data-testid patches to source files
  lint --fix --pr   [Pro] Apply patches and open a GitHub PR
  web               Start the browser init wizard (default port 3333)
  stop              Kill a web server running on the given port

Options:
  -c, --config <path>   Path to selfcure.config.mjs  [default: ./selfcure.config.mjs]
  -p, --port <number>   Port for `selfcure web`/stop  [default: 3333]
      --threshold <n>   Testability score threshold for lint [default: 65]
  -V, --version         Print version
  -h, --help            Show help
```

## `selfcure lint` (Pro)

Scans source files for interactive elements (button, input, link, form) with a testability
score below `--threshold` (default 65/100) — meaning they lack a stable selector such as
`data-testid`, `id`, or `aria-label`.

```
selfcure lint [options]

  --threshold <n>   Flag elements with testability score below n  [default: 65]
  --fix             [Pro] Inject data-testid attributes into matching source files
  --pr              [Pro] Commit fixes to a new branch and open a GitHub PR
```

### Pro gate

`--fix` and `--pr` require the Pro plan. Activate it by setting:

```
# option A — environment variable
SELFCURE_PRO=1 selfcure lint --fix

# option B — selfcure.config.mjs
pro: true
```

### PR creation

`--pr` requires the [GitHub CLI (`gh`)](https://cli.github.com/) installed and authenticated
in the target project's working directory. selfcure:

1. Creates a branch `selfcure/lint-fix-<timestamp>`
2. Commits all patched files
3. Pushes the branch
4. Runs `gh pr create` with a generated description listing every changed element

### Suggested `data-testid` values

The suggestion is derived (in priority order) from:

1. The element's visible label
2. Its `id` attribute value
3. Its `name` attribute value
4. Its `aria-label` value
5. `<type>-<index>` fallback (e.g. `button-3`)

All values are kebab-cased.

## Pipeline (`selfcure run`)

```
load config
     │
     ▼
@selfcure/crawler  →  ComponentMeta[]
     │
     ▼
@selfcure/analyzer →  AnalysisResult[]
     │
     ▼
@selfcure/generator→  GeneratedTest[]   (writes .spec.ts files)
     │
     ▼
@selfcure/runner   →  TestResult[]
     │
     ▼
@selfcure/selfcure →  HealResult[]
     │
     ▼
@selfcure/reporter →  ReportSummary     (writes index.html + summary.json)
```

## Runtime dependencies

| Package | Role |
|---------|------|
| `@selfcure/crawler` | Source crawling |
| `@selfcure/analyzer` | Element classification |
| `@selfcure/generator` | Test generation |
| `@selfcure/runner` | Test execution |
| `@selfcure/selfcure` | Self-healing |
| `@selfcure/reporter` | Report generation |
| `@selfcure/web` | Browser init wizard server |
| `@inquirer/prompts` | Interactive CLI prompts for `selfcure init` |
| `commander` | CLI argument parsing |
| `chalk` | Coloured terminal output |
| `ora` | Spinner UX during long stages |

## Source

`packages/cli/src/index.ts`
