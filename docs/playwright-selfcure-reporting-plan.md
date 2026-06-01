# Playwright + Selfcure Test Reporting Plan

## Context

The current `@selfcure/reporter` is intentionally small. It receives `TestResult[]` from `@selfcure/runner` and `HealResult[]` from `@selfcure/selfcure`, then writes:

- `index.html`
- `summary.json`
- a terminal summary

Today the report shows the test file, pass/fail/healed status, duration, error text, and applied diff. That is useful for a fallback BYOK flow, but it is not enough for a precise Playwright-integrated quality report.

The next version should become an evidence report for both:

- Playwright execution: what ran, where it failed, with which browser/project/retry/artifacts.
- Selfcure prevention: why a failure happened, whether it is locator/testability related, which component or route likely needs frontend action.

## Product Goal

Create a report that answers four questions quickly:

1. What failed?
2. Why did it fail?
3. Can Selfcure or Playwright healing fix it?
4. What should the frontend or QA team do next?

The report should not be just a prettier Playwright report. It should add Selfcure-specific diagnosis: locator stability, component testability, ambiguity, suggested `data-testid` patches, healing attempts, and unresolved risks.

## Current Gaps

### Runner gaps

`@selfcure/runner` currently exposes:

```ts
interface TestResult {
  filePath: string;
  passed: boolean;
  error?: string;
  tracePath?: string;
  durationMs: number;
}
```

This loses most of the Playwright JSON reporter structure:

- test title
- suite title
- project/browser
- retry count
- status per attempt
- expected status
- annotations
- stdout/stderr
- attachments
- screenshots
- videos
- traces
- worker/project metadata
- line/column location

The implementation also only parses stdout in the success path. On failure it pushes a synthetic `<unknown>` result, which means the report can become least accurate when accuracy matters most.

### Reporter gaps

The HTML report is currently table-only. It does not show:

- route/page context
- browser/project matrix
- retry timeline
- artifact links
- failure category
- flaky tests
- healed versus still failing state after re-run
- locator/testability score near the failure
- ownership/action guidance
- CI metadata
- historical trend

### Selfcure integration gaps

Selfcure analysis output is not yet a first-class input to the report. The report should be able to correlate a failing Playwright locator with:

- route or component discovered by crawler/analyzer
- interactive element metadata
- locator candidates
- ambiguity findings
- missing or weak `data-testid`
- suggested patch
- whether the issue is a test problem or component testability problem

## Target Architecture

```text
Playwright JSON report
  -> @selfcure/runner normalizer
  -> rich RunResult model

Selfcure analysis artifacts
  -> component/route/testability context

Heal results
  -> applied patch, attempts, final status

Reporter
  -> HTML report
  -> summary.json
  -> findings.json
  -> junit.xml optional
  -> artifact manifest
```

The report module should not parse raw Playwright output directly. The runner should normalize Playwright output into a stable Selfcure run model.

## Data Model

### `RunSummary`

```ts
interface RunSummary {
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  status: "passed" | "failed" | "flaky" | "interrupted";
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  flaky: number;
  healed: number;
  projects: ProjectSummary[];
  environment: RunEnvironment;
}
```

### `RunEnvironment`

```ts
interface RunEnvironment {
  selfcureVersion?: string;
  playwrightVersion?: string;
  nodeVersion: string;
  os: string;
  ci: boolean;
  commitSha?: string;
  branch?: string;
  baseUrl?: string;
  configPath?: string;
}
```

### `RichTestResult`

```ts
interface RichTestResult {
  id: string;
  filePath: string;
  title: string;
  fullTitle: string[];
  location?: {
    file: string;
    line: number;
    column: number;
  };
  projectName?: string;
  browserName?: string;
  status: "passed" | "failed" | "skipped" | "timedOut" | "flaky" | "healed";
  expectedStatus?: string;
  durationMs: number;
  retries: number;
  attempts: TestAttempt[];
  failure?: FailureDiagnosis;
  selfcure?: SelfcureTestContext;
}
```

### `TestAttempt`

```ts
interface TestAttempt {
  retry: number;
  status: "passed" | "failed" | "skipped" | "timedOut" | "interrupted";
  durationMs: number;
  error?: {
    message: string;
    stack?: string;
    location?: {
      file: string;
      line: number;
      column: number;
    };
  };
  stdout: string[];
  stderr: string[];
  attachments: TestArtifact[];
}
```

### `TestArtifact`

```ts
interface TestArtifact {
  name: "trace" | "screenshot" | "video" | "stdout" | "stderr" | "diff" | string;
  contentType?: string;
  path?: string;
  url?: string;
  sizeBytes?: number;
}
```

### `FailureDiagnosis`

```ts
interface FailureDiagnosis {
  category:
    | "locator"
    | "assertion"
    | "timeout"
    | "navigation"
    | "network"
    | "auth"
    | "environment"
    | "app-error"
    | "unknown";
  confidence: number;
  summary: string;
  evidence: string[];
  suggestedOwner: "frontend" | "qa" | "platform" | "unknown";
  suggestedAction: string;
}
```

### `SelfcureTestContext`

```ts
interface SelfcureTestContext {
  route?: string;
  componentName?: string;
  componentPath?: string;
  testabilityScore?: number;
  locatorQuality?: "stable" | "acceptable" | "weak" | "ambiguous" | "missing";
  relatedIssues: SelfcureFindingRef[];
  suggestedPatchIds: string[];
  healing?: {
    attempted: boolean;
    healed: boolean;
    attempts: number;
    patchPath?: string;
    finalError?: string;
  };
}
```

## Runner Plan

### 1. Parse Playwright JSON on pass and fail

Use `execFile` but preserve stdout even when Playwright exits non-zero. The failure path should parse `err.stdout` before falling back to a synthetic runner failure.

Acceptance criteria:

- Failed tests still produce one `RichTestResult` per spec/test.
- Global Playwright startup failures produce a single infrastructure failure.
- JSON parse errors are reported as `environment` failures with raw output attached.

### 2. Preserve Playwright hierarchy

Capture:

- suite titles
- spec title
- test title
- file/line/column
- project name
- retry attempts
- annotations
- expected status

This lets the report show a real test name, not only a filename.

### 3. Capture artifacts

Configure Playwright to produce artifacts in a Selfcure-managed directory:

```text
.selfcure/runs/<runId>/artifacts/
  traces/
  screenshots/
  videos/
  stdout/
  stderr/
```

The runner should copy or reference Playwright attachments and emit an artifact manifest.

### 4. Classify failure type

Implement deterministic classification first:

| Pattern | Category |
|---------|----------|
| `locator` strict mode violation | `locator` |
| `Timeout ... waiting for` | `timeout` |
| `expect(received)` / assertion matcher | `assertion` |
| `net::ERR` / failed request | `network` |
| login/session redirect patterns | `auth` |
| browser launch/config error | `environment` |
| page console uncaught exception | `app-error` |

LLM-assisted diagnosis can be added later, but the first version should be deterministic and cheap.

## Reporter Plan

### 1. Report sections

The HTML report should contain:

```text
Overview
  pass/fail/flaky/healed totals
  duration
  browser/project matrix
  CI/build metadata

Failure Triage
  grouped by category and suggested owner
  top actionable failures
  "frontend action needed" section

Test Results
  searchable/filterable table
  file, test title, project, status, duration, retries, category

Evidence
  screenshots
  trace links
  video links
  stdout/stderr
  error stack

Selfcure Analysis
  route/component context
  testability score
  locator quality
  related ambiguity/missing-testid findings
  suggested patches

Healing
  attempted fixes
  applied diffs
  final state
  rejected/unhealed failures

Trends
  optional comparison with previous run
  newly failing
  newly healed
  persistent failures
```

### 2. Precision-first UI

The report should prioritize scanning and triage:

- status cards for totals
- grouped failure categories
- dense table with filters
- expandable evidence per test
- direct links to Playwright trace files
- direct links to source/test files where possible
- clear owner/action labels

Avoid turning the report into a marketing page. It is an engineering artifact.

### 3. Machine-readable outputs

Write:

```text
.selfcure/report/
  index.html
  summary.json
  results.json
  findings.json
  artifacts.json
  junit.xml
```

`summary.json` remains small and stable for CI. `results.json` contains full test details. `findings.json` contains Selfcure action items.

### 4. CI behavior

Add options:

```ts
interface ReportOptions {
  outputDir: string;
  title?: string;
  includeArtifacts?: boolean;
  includeTrends?: boolean;
  previousRunPath?: string;
  failOn?: {
    failedTests?: boolean;
    unhealedLocatorFailures?: boolean;
    minimumTestabilityScore?: number;
  };
}
```

The CLI can expose:

```bash
selfcure report
selfcure report --serve
selfcure report --json
selfcure report --previous .selfcure/runs/latest/results.json
selfcure report --fail-on unhealed-locators
```

## Selfcure Correlation Plan

### 1. Correlate by file and route

Use these signals:

- test file name
- generated test metadata comments
- route visited in test
- Playwright trace action URLs
- component paths from static analysis
- locator text/testid/role from failure message

Generated tests should include metadata comments:

```ts
// @selfcure component=CheckoutForm path=src/pages/Checkout.tsx route=/checkout
```

This makes correlation cheap and reliable.

### 2. Correlate locator failures

When a Playwright failure says a locator failed, the report should show:

- failing locator
- nearest component or route
- known locator candidates
- whether the locator is ambiguous in source
- whether the element lacks `data-testid`
- suggested stable locator
- suggested frontend patch if available

### 3. Distinguish test bug from component testability problem

The report should label failures as:

```text
Test issue
  the assertion or test flow is wrong

Component testability issue
  UI element is real but unstable/ambiguous/unaddressable

Environment issue
  app, browser, auth, network, or CI setup failed

Application issue
  tested behavior appears broken
```

This is the Selfcure-specific value. Playwright can show that a locator failed; Selfcure should explain whether the frontend needs a better contract.

## Integration With Playwright Reporters

The first implementation should keep using Playwright's JSON reporter as the ingestion source:

```bash
npx playwright test --reporter=json
```

Later, add a custom Playwright reporter package or mode:

```ts
export default defineConfig({
  reporter: [
    ["json", { outputFile: ".selfcure/runs/<runId>/playwright-report.json" }],
    ["@selfcure/reporter/playwright", { outputDir: ".selfcure/report" }]
  ]
});
```

Do not start with a custom reporter unless JSON ingestion blocks required data. JSON ingestion is simpler and keeps the first version compatible with existing projects.

## MCP And IDE Agent Integration

Expose report tools through `@selfcure/mcp`:

```text
selfcure_get_latest_report_summary
selfcure_get_failed_tests
selfcure_get_failure_evidence
selfcure_get_frontend_action_items
selfcure_explain_failure
```

The IDE agent should be able to ask:

```text
"Show me failures that need frontend changes."
"Open the trace for the checkout failure."
"Create a PR with only the missing-testid fixes."
```

MCP should return compact JSON and artifact references, not full HTML or giant traces.

## Web UI Integration

Add a report view to `@selfcure/web`:

```text
/report
/report/:runId
/api/reports
/api/reports/:runId
/api/reports/:runId/artifacts/:artifactId
```

The UI should reuse the same `results.json`, `findings.json`, and `artifacts.json` generated by the CLI reporter.

## Implementation Phases

### Phase 1: Rich Playwright normalization

- Replace `TestResult` or add `RichTestResult`.
- Parse Playwright JSON in both success and failure paths.
- Preserve test title, project, retries, status, location, errors, stdout/stderr.
- Add tests with fixture Playwright JSON for pass, fail, retry, skipped, and startup failure.

### Phase 2: Artifact manifest

- Create `.selfcure/runs/<runId>/`.
- Store normalized `playwright-report.json`.
- Collect trace, screenshot, video, stdout, stderr references.
- Write `artifacts.json`.

### Phase 3: Failure diagnosis

- Add deterministic failure classifier.
- Add `FailureDiagnosis`.
- Group failures by category and owner.
- Add tests for locator, timeout, assertion, auth, network, app-error, and environment patterns.

### Phase 4: Selfcure correlation

- Add generated test metadata comments.
- Correlate failures with analyzer findings.
- Include component path, route, testability score, locator quality, and suggested patches.
- Emit `findings.json`.

### Phase 5: HTML report v2

- Replace table-only report with overview, triage, results, evidence, Selfcure analysis, and healing sections.
- Keep static HTML with inline CSS/JS, no external network dependencies.
- Add filters for status, category, project, owner, healed/unhealed.

### Phase 6: CI and trend outputs

- Keep stable `summary.json`.
- Add `results.json`, `findings.json`, `junit.xml`.
- Add previous-run comparison.
- Add CLI flags for fail-on policies.

### Phase 7: MCP and web consumption

- Expose report summary/evidence/action items through MCP.
- Add `/report` to `@selfcure/web`.
- Ensure report artifacts can be opened locally without a running server.

## Acceptance Criteria

- Failed Playwright runs produce accurate per-test results instead of `<unknown>` when JSON output exists.
- Report shows real test titles, projects, retries, errors, and durations.
- Trace, screenshot, and video artifacts are linked when available.
- Locator failures are classified separately from assertion, timeout, environment, auth, network, and app errors.
- Report identifies which failures likely require frontend action.
- Healing attempts and applied diffs are visible per test.
- `summary.json` remains backwards-compatible or has a documented migration path.
- CI can consume machine-readable outputs without parsing HTML.
- MCP clients can query latest failures and action items.

## Risks And Guardrails

- Do not duplicate Playwright's full trace viewer. Link to trace artifacts instead.
- Do not require LLM diagnosis for the first version. Deterministic classification should be the default.
- Do not load huge traces into the HTML. Store references and metadata.
- Do not make reporting depend on the web server.
- Do not hide raw Playwright evidence behind Selfcure summaries.

## Recommended First PR

Start with the runner because report precision depends on input precision:

1. Add fixture tests for Playwright JSON parsing.
2. Parse stdout from failed Playwright executions.
3. Introduce `RichTestResult` while keeping the old `TestResult` adapter.
4. Update reporter to show test title, project, retry count, and failure category.

This creates immediate value without requiring the full UI/report redesign.
