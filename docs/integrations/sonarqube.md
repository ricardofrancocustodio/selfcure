# SonarQube integration

selfcure exports its testability and accessibility findings in SonarQube's
**Generic Issue Import Format**, so they appear in the SonarQube dashboard next
to technical debt, coverage, and code smells — the panel that architects and
tech leads already use to make quality decisions.

No native Java plugin is involved. selfcure writes a JSON file; SonarQube reads
it during a normal scan.

---

## Quick start

```bash
# 1. Generate the issues file
npx selfcure export --format sonarqube --out .selfcure/sonar-issues.json

# 2. Point your SonarQube scan at it
sonar-scanner \
  -Dsonar.externalIssuesReportPaths=.selfcure/sonar-issues.json
```

Or add the path to `sonar-project.properties`:

```properties
sonar.externalIssuesReportPaths=.selfcure/sonar-issues.json
```

After the scan, selfcure findings show up under **Issues**, each linked back to
the exact file and line.

---

## Command

```bash
selfcure export --format sonarqube [options]
```

| Option | Default | Description |
|--------|---------|-------------|
| `--format <name>` | — (required) | Output format. Currently only `sonarqube`. |
| `-c, --config <path>` | `./selfcure.config.mjs` | selfcure config to load. |
| `--out <path>` | `.selfcure/sonar-issues.json` | Output file. Parent dirs are created. |
| `--threshold <n>` | `65` | Testability score below which an element is flagged. |
| `--a11y` | off | Also include WCAG accessibility findings. |
| `--wcag <level>` | `AA` | WCAG target level when `--a11y` is used (`A` / `AA` / `AAA`). |
| `--base-dir <dir>` | `process.cwd()` | `sonar.projectBaseDir` — file paths in the report are made relative to it. |
| `--inventory <path>` | off | A `testid-inventory.json` contract — adds `missing-testid` issues for entries with no source usage. |

> **`--base-dir` matters.** SonarQube resolves `filePath` relative to
> `sonar.projectBaseDir`. Run `selfcure export` from the same directory the
> scanner runs from, or pass `--base-dir` to match it. Otherwise issues won't
> attach to the right files.

---

## Issue mapping

selfcure issue kinds map onto SonarQube `type` + `severity` as follows. This
table is the source of truth — it mirrors `KIND_MAP` / `WCAG_SEVERITY` in
`packages/reporter/src/sonarqube.ts`.

| selfcure kind | SonarQube `type` | `severity` | `ruleId` |
|---------------|------------------|------------|----------|
| `ambiguous` (selector matches multiple siblings) | `BUG` | `MAJOR` | `ambiguous-selector` |
| `low-score` (no stable selector, below threshold) | `CODE_SMELL` | `MAJOR` | `low-testability` |
| `missing-testid` (governed contract entry, no source usage) | `CODE_SMELL` | `MINOR` | `missing-testid` |
| `a11y-violation` — WCAG **A** | `BUG` | `CRITICAL` | _WCAG rule key_ |
| `a11y-violation` — WCAG **AA** | `BUG` | `MAJOR` | _WCAG rule key_ |
| `a11y-violation` — WCAG **AAA** | `BUG` | `MINOR` | _WCAG rule key_ |

Every issue carries `engineId: "selfcure"`.

WCAG severity follows conformance level: level **A** failures are the most
fundamental compliance gaps, so they map to the highest severity.

---

## Output shape

```json
{
  "issues": [
    {
      "engineId": "selfcure",
      "ruleId": "ambiguous-selector",
      "severity": "MAJOR",
      "type": "BUG",
      "primaryLocation": {
        "message": "Ambiguous selector \"button\" in LoginForm — matches 3 elements. Add a unique data-testid=\"submit\".",
        "filePath": "src/LoginForm.tsx",
        "textRange": { "startLine": 12, "endLine": 12 }
      }
    }
  ]
}
```

> Testability issues (`ambiguous` / `low-score`) currently report at line 1 of
> the file — the static analyzer tracks the component, not yet a per-element
> source line. Accessibility findings carry their real line.

---

## Programmatic API

The exporter is a pure function in `@selfcure/reporter`:

```ts
import { toSonarQubeReport, exportSonarQube } from '@selfcure/reporter';
import type { SelfcureSonarIssue } from '@selfcure/reporter';

const issues: SelfcureSonarIssue[] = [
  { kind: 'ambiguous', filePath: 'src/Foo.tsx', line: 12, message: '…' },
  { kind: 'a11y-violation', filePath: 'src/Bar.tsx', line: 8, message: '…', wcagLevel: 'AA', ruleId: 'img-alt' },
];

// In-memory:
const report = toSonarQubeReport(issues, { projectBaseDir: process.cwd() });

// Or write straight to disk:
await exportSonarQube(issues, '.selfcure/sonar-issues.json', { projectBaseDir: process.cwd() });
```

---

## CI recipe (GitHub Actions)

```yaml
- name: selfcure → SonarQube issues
  run: npx selfcure export --format sonarqube --a11y --out .selfcure/sonar-issues.json

- name: SonarQube scan
  uses: SonarSource/sonarqube-scan-action@v4
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
  with:
    args: -Dsonar.externalIssuesReportPaths=.selfcure/sonar-issues.json
```

Tested against SonarQube Server 10+ and SonarQube Cloud.

## Source

- Exporter: `packages/reporter/src/sonarqube.ts`
- CLI command: `packages/cli/src/export.ts`
