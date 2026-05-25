# @selfcure/cli

Entry-point package. Provides the `selfcure` binary and orchestrates all other packages.

## Commands

```
selfcure [options] <command>

Commands:
  init    Interactive wizard — scaffold selfcure.config.js and .env
  crawl [file]  Crawl source files; if [file] is given, crawl only that file
  run     Full pipeline: crawl → analyze → generate → run → heal → report
  heal    Re-attempt healing on the last set of failures
  report  Re-generate HTML report from persisted run data
  web     Start the browser init wizard (default port 3333)

Options:
  -c, --config <path>  Path to selfcure.config.js  [default: ./selfcure.config.js]
  -p, --port <number>  Port for `selfcure web`       [default: 3333]
  -V, --version        Print version
  -h, --help           Show help
```

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
