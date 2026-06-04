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
  export            Export findings to an external tool format (SonarQube)
  web               Start the browser init wizard (default port 3333)
  stop              Kill a web server running on the given port

Options:
  -c, --config <path>   Path to selfcure.config.mjs  [default: ./selfcure.config.mjs]
  -p, --port <number>   Port for `selfcure web`/stop  [default: 3333]
      --threshold <n>   Testability score threshold for lint [default: 65]
  -V, --version         Print version
  -h, --help            Show help
```

## `selfcure export`

Exports testability + accessibility findings in an external tool's format.
Currently supports **SonarQube** (Generic Issue Import Format):

```
selfcure export --format sonarqube [--out .selfcure/sonar-issues.json] [--a11y] [--inventory <path>]
```

Full reference — flags, issue→severity mapping, and CI recipe — in
[docs/integrations/sonarqube.md](../integrations/sonarqube.md).

## `selfcure lint` (Pro)

Scans source files for interactive elements (button, input, link, form) and flags two kinds of issues:

- **`low-score`** — testability score below `--threshold` (default 65/100): the element lacks a stable selector such as `data-testid`, `id`, or `aria-label`.
- **`ambiguous`** — the element's best selector matches more than one element in the same component, so Playwright would resolve to multiple nodes. The analyzer detects this during scoring (see [analyzer.md → Ambiguity detection](analyzer.md#ambiguity-detection)). Each flagged `LintIssue` carries a `kind` field and, when ambiguous, an `ambiguityReason` string.

```
selfcure lint [options]

  --threshold <n>   Flag elements with testability score below n  [default: 65]
  --fix             [Pro] Inject or rewrite data-testid attributes in source files
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

1. Resolves the **base branch** (`lint.prBaseBranch` in your config, or — when omitted — the repo's default branch via `gh repo view`).
2. Remembers the current branch so it can return you there once the PR is open.
3. Creates a branch `selfcure/lint-fix-<YYYY-MM-DD>-<short>` (date + short collision-avoidance suffix).
4. Stages **only** the files selfcure patched — never unrelated dirty changes.
5. Commits, pushes, and runs `gh pr create --base <baseBranch>` with an auto-generated title and Markdown body that separates `low-score` fixes from `ambiguous` fixes.
6. Checks out the original branch again (best-effort) so you're not stranded on the lint branch.

Configure the target with `lint.prBaseBranch` in `selfcure.config.mjs`:

```js
export default {
  // …
  pro: true,
  lint: {
    prBaseBranch: 'main',   // or 'develop', 'release/v2', etc.
  },
};
```

### Suggested `data-testid` values

The suggestion is derived (in priority order) from:

1. The element's visible label
2. Its `id` attribute value
3. Its `name` attribute value
4. Its `aria-label` value
5. `<type>-<index>` fallback (e.g. `button-3`)

All values are kebab-cased.

**Per-file uniqueness.** After suggestions are generated, lint deduplicates them within each file by appending a numeric suffix (`-2`, `-3`, …) when two issues would otherwise produce the same `data-testid`. This guarantees that fixing ambiguous siblings produces *distinct* locators — otherwise two `<button aria-label="Submit">` siblings would both be patched to `data-testid="submit"` and remain ambiguous.

### `--fix` modes

For each flagged element, `--fix` chooses one of two patch modes:

- **ADD** (default) — locate the element via its `id` / `name` / `aria-label` attribute and inject a new `data-testid="<suggested>"`.
- **REPLACE** — used when an element flagged as `ambiguous` already has a `data-testid` (i.e. the testid itself is shared with a sibling). Lint rewrites the existing `data-testid` value to the new unique one instead of adding a duplicate attribute.

When the same identifying attribute (e.g. `aria-label="Submit"`) repeats in the source, each iteration of the patcher targets the next unpatched occurrence — so a file with N ambiguous siblings is patched N times, each with the corresponding unique test-id.

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
