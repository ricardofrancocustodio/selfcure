# @selfcure/reporter

Merges `TestResult[]` and `HealResult[]` into a styled **HTML report**, a machine-readable **`summary.json`**, and a **terminal table**.

## API

### `report(results, healResults, options): Promise<ReportSummary>`

```ts
import { report } from '@selfcure/reporter';

const summary = await report(testResults, healResults, {
  outputDir: './selfcure-report',
  title: 'My App — Selfcure Report',
});

console.log(summary.reportPath); // ./selfcure-report/index.html
```

### Types

```ts
interface ReportOptions {
  /** Directory where report files are written (created if absent) */
  outputDir: string;
  /** Title displayed in the HTML report — default: 'Selfcure Report' */
  title?: string;
}

interface ReportSummary {
  total: number;
  passed: number;
  failed: number;
  /** Tests that were failing but successfully healed */
  healed: number;
  /** Absolute path to the generated index.html */
  reportPath: string;
}
```

## Output files

| File | Description |
|------|-------------|
| `<outputDir>/index.html` | Styled HTML report |
| `<outputDir>/summary.json` | Machine-readable totals |

## HTML report contents

Each row in the report table shows:

| Column | Description |
|--------|-------------|
| Test file | Basename of the `.spec.ts` file |
| Status | `PASS` / `FAIL` / `HEALED (N attempts)` |
| Duration | `durationMs` from Playwright |
| Details | Error message (if failed) + applied diff in a `<details>` block (if healed) |

## Terminal output

```
── Selfcure Report ──────────────────────
  Passed : 8
  Failed : 1
  Healed : 2
  Report : ./selfcure-report/index.html
```

## Runtime dependencies

| Package | Role |
|---------|------|
| `@selfcure/runner` | Typed inputs (`TestResult`) |
| `@selfcure/selfcure` | Typed inputs (`HealResult`) |
| `fs-extra` | Directory creation, file writing |
| `chalk` | Coloured terminal output |

## Source

`packages/reporter/src/index.ts`
