# @selfcure/cli

Entry-point package. Provides the `selfcure` binary and orchestrates all other packages.

## Commands

```
selfcure [options] <command>

Commands:
  init    Scaffold selfcure.config.js in the current project
  crawl   Crawl source files and extract component metadata
  run     Full pipeline: crawl → analyze → generate → run → heal → report
  heal    Re-attempt healing on the last set of failures
  report  Re-generate HTML report from persisted run data

Options:
  -c, --config <path>  Path to selfcure.config.js  [default: ./selfcure.config.js]
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
| `commander` | CLI argument parsing |
| `chalk` | Coloured terminal output |
| `ora` | Spinner UX during long stages |

## Source

`packages/cli/src/index.ts`
