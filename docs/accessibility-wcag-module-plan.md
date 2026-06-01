# Accessibility WCAG Module Implementation Plan

## Purpose

The Accessibility WCAG module adds a paid, optional governance layer for teams that need accessibility compliance, auditability, and frontend remediation guidance.

This module is separate from the Test ID Inventory because accessibility has a different shape:

```txt
Test IDs answer: "Can this element be selected reliably?"
Accessibility answers: "Can this experience be used reliably by people and assistive technologies?"
```

The module should integrate with `selfcure lint`, reports, CI, and later the web dashboard.

## Recommended Data Model

Use a hybrid model:

```txt
WCAG Rule Catalog + Accessibility Finding Inventory
```

Do not model accessibility only as a flat inventory of elements. A pure inventory works well for `data-testid` because the primary asset is the selector contract. For WCAG, the primary asset is the compliance state of a page, component, or flow against a rule set.

The better model is:

| Layer | Role |
|------|------|
| Rule catalog | Stable list of WCAG rules, severity, tags, paid/free availability, and remediation text |
| Finding inventory | Observed violations, warnings, affected source locations, route, component, evidence, and lifecycle status |
| Optional element map | Stable mapping from DOM/source element to findings, useful for tracking recurring problems |

This gives enterprise teams traceability without forcing accessibility into the wrong abstraction.

## Module Boundary

The Accessibility module should be a separate paid module:

```txt
selfcure lint              -> base testability lint
selfcure lint --a11y       -> paid accessibility lint
selfcure a11y scan         -> paid accessibility scan
selfcure a11y audit --ci   -> paid CI gate
selfcure a11y report       -> paid report
```

The module can share crawler, analyzer, reporter, and web infrastructure, but it should have separate schemas, output files, rule definitions, and licensing gates.

## Scope

Initial scope:

- WCAG-oriented static analysis for JSX/TSX, Vue, and Angular templates.
- Optional dynamic scan using Playwright plus an accessibility engine.
- Integration with `selfcure lint`.
- JSON and HTML reports.
- CI mode with configurable severity thresholds.
- Separate mapping and lifecycle tracking for findings.

Out of scope for the first implementation:

- Full legal compliance certification.
- Manual screen reader validation.
- Complete WCAG coverage through static analysis only.
- Automatic remediation for every violation.

## Rule Catalog

Recommended file inside selfcure:

```txt
packages/analyzer/src/a11y/rules.ts
```

Rule shape:

```ts
export interface AccessibilityRule {
  id: string;
  wcag: string[];
  level: "A" | "AA" | "AAA";
  category:
    | "perceivable"
    | "operable"
    | "understandable"
    | "robust";
  severity: "info" | "minor" | "major" | "critical";
  source: "static" | "dynamic" | "hybrid";
  paid: boolean;
  title: string;
  description: string;
  remediation: string;
}
```

Example rules:

```ts
export const accessibilityRules: AccessibilityRule[] = [
  {
    id: "a11y.button-accessible-name",
    wcag: ["4.1.2", "2.5.3"],
    level: "A",
    category: "robust",
    severity: "critical",
    source: "static",
    paid: true,
    title: "Button must have an accessible name",
    description: "Interactive buttons need visible text, aria-label, aria-labelledby, or equivalent accessible naming.",
    remediation: "Add visible text or an explicit accessible name that matches the user-facing intent."
  }
];
```

## Finding Inventory

Recommended target-project file:

```txt
.selfcure/a11y-findings.json
```

This file tracks observed accessibility findings across scans.

Initial shape:

```json
{
  "version": "1.0",
  "app": "checkout-web",
  "standard": "WCAG",
  "targetLevel": "AA",
  "generatedAt": "2026-05-29T00:00:00.000Z",
  "findings": [
    {
      "id": "a11y_01JXAMPLE0001",
      "ruleId": "a11y.button-accessible-name",
      "wcag": ["4.1.2", "2.5.3"],
      "level": "A",
      "severity": "critical",
      "status": "open",
      "route": "/checkout",
      "component": "CouponForm",
      "sourceFile": "src/pages/CheckoutPage.tsx",
      "line": 42,
      "column": 7,
      "selector": "button.applyCoupon",
      "testId": "checkout.coupon.apply-button",
      "accessibleName": "",
      "message": "Button has no accessible name.",
      "remediation": "Add visible text, aria-label, or aria-labelledby.",
      "firstSeenAt": "2026-05-29T00:00:00.000Z",
      "lastSeenAt": "2026-05-29T00:00:00.000Z",
      "owner": "payments-frontend"
    }
  ]
}
```

## Optional Accessibility Element Map

For companies that need stricter traceability, add an optional element map:

```txt
.selfcure/a11y-elements.json
```

This maps important elements to accessibility metadata:

```json
{
  "version": "1.0",
  "elements": [
    {
      "elementId": "checkout.coupon.apply-button",
      "route": "/checkout",
      "component": "CouponForm",
      "sourceFile": "src/pages/CheckoutPage.tsx",
      "role": "button",
      "expectedAccessibleName": "Apply coupon",
      "expectedKeyboardSupport": ["Enter", "Space"],
      "requiredWcag": ["2.1.1", "2.5.3", "4.1.2"],
      "owner": "payments-frontend",
      "criticality": "high"
    }
  ]
}
```

This should be optional. Most teams should start with the finding inventory. Regulated teams can opt into the element map.

## Lint Integration

`selfcure lint` should remain the base testability lint. Accessibility should be opt-in and paid:

```bash
selfcure lint --a11y
selfcure lint --a11y --wcag AA
selfcure lint --a11y --ci
```

Behavior:

```txt
1. Run base testability lint.
2. If `--a11y` is enabled, run accessibility rules.
3. Merge findings into one CLI summary.
4. Keep output sections separate: Testability and Accessibility.
5. Apply paid-plan gate before running paid rules.
```

Example output:

```txt
selfcure lint --a11y

Testability
  warnings  8
  errors    1

Accessibility WCAG AA
  critical  2
  major     5
  minor     7

critical a11y.button-accessible-name
  src/pages/CheckoutPage.tsx:42
  Button has no accessible name.
```

## Static Rules for MVP

Initial static checks:

| Rule | WCAG | Severity |
|------|------|----------|
| button-accessible-name | 4.1.2, 2.5.3 | critical |
| link-accessible-name | 4.1.2, 2.4.4 | critical |
| input-associated-label | 1.3.1, 3.3.2, 4.1.2 | critical |
| img-alt-text | 1.1.1 | major |
| aria-invalid-reference | 4.1.2 | critical |
| positive-tabindex | 2.4.3 | major |
| noninteractive-click-handler | 2.1.1, 4.1.2 | major |
| missing-dialog-name | 4.1.2 | critical |
| heading-order | 1.3.1, 2.4.6 | minor |
| duplicate-id | 4.1.1 | critical |

## Dynamic Rules for Later

Dynamic scanning should use Playwright to render pages and collect runtime accessibility evidence.

Candidate implementation:

```txt
@playwright/test + axe-core or @axe-core/playwright
```

Dynamic checks:

- Color contrast.
- Runtime accessible names.
- Focus order.
- Keyboard navigation traps.
- ARIA state validity after interaction.
- Modal focus management.
- Landmark structure.
- Hidden content exposed to assistive technology.

Dynamic scanning should be a second phase because it needs app startup, routing, authentication, and stable fixtures.

## Package Layout

Recommended files:

```txt
packages/analyzer/src/a11y/schema.ts
packages/analyzer/src/a11y/rules.ts
packages/analyzer/src/a11y/static.ts
packages/analyzer/src/a11y/audit.ts
packages/analyzer/src/a11y/findings.ts
packages/crawler/src/a11y/extract.ts
packages/runner/src/a11y/dynamic.ts
packages/reporter/src/a11y/report.ts
packages/cli/src/a11y.ts
```

Tests:

```txt
packages/analyzer/tests/a11y-rules.test.ts
packages/analyzer/tests/a11y-audit.test.ts
packages/crawler/tests/a11y-extract.test.ts
packages/cli/tests/a11y.test.ts
```

## CLI Commands

MVP:

```bash
selfcure lint --a11y
selfcure a11y scan
selfcure a11y audit
selfcure a11y audit --ci
```

Later:

```bash
selfcure a11y report
selfcure a11y baseline
selfcure a11y explain <finding-id>
selfcure a11y suppress <finding-id>
selfcure a11y export --format sarif
```

## Paid Plan Gate

Accessibility should be treated as a paid module:

```txt
Free
  - base testability lint
  - limited accessibility preview count

Pro
  - static WCAG scan
  - lint integration
  - JSON report

Enterprise
  - CI enforcement
  - dynamic Playwright scan
  - audit history
  - owner mapping
  - SARIF export
  - SLA/compliance reporting
```

The implementation should keep licensing checks outside the analyzer rules. Rules should be pure. The CLI or orchestration layer should decide whether a rule set can run.

## CI Behavior

Example:

```bash
selfcure a11y audit --ci --wcag AA --fail-on major
```

Exit behavior:

```txt
0 when no finding meets or exceeds fail threshold
1 when at least one finding meets or exceeds fail threshold
```

Recommended severity order:

```txt
info < minor < major < critical
```

## Reports

JSON report:

```txt
selfcure-report/a11y-summary.json
```

HTML report:

```txt
selfcure-report/a11y.html
```

Report sections:

- WCAG level summary.
- Severity summary.
- Open vs resolved findings.
- Findings by route.
- Findings by owner.
- Findings by component.
- Critical regressions since last baseline.
- Remediation guidance.
- Evidence and source locations.

## Suppressions

Suppression support should exist, but should require a reason, owner, and expiration date.

Example:

```json
{
  "findingId": "a11y_01JXAMPLE0001",
  "reason": "Third-party embedded payment iframe. Vendor remediation scheduled.",
  "owner": "payments-frontend",
  "expiresAt": "2026-07-01T00:00:00.000Z"
}
```

Suppressions without expiration should not be allowed in CI mode.

## Integration with Test ID Inventory

The modules should remain separate, but they can cross-reference each other.

Useful links:

```txt
a11y finding -> data-testid
data-testid inventory entry -> related a11y findings
component score -> testability + accessibility health
```

Example:

```json
{
  "testId": "checkout.coupon.apply-button",
  "relatedAccessibilityFindings": [
    "a11y_01JXAMPLE0001"
  ]
}
```

This gives teams one component-level view while preserving separate governance models.

## Figma Direction

The Figma plugin can eventually validate design-time accessibility intent:

- Button accessible name.
- Form label.
- Input helper/error text.
- Color contrast token.
- Heading hierarchy.
- Modal title.
- Focus order hints.

Design-time output should feed the optional element map, not the runtime finding inventory.

## Incremental Implementation Plan

### Part 1: Accessibility Schema and Rule Catalog — DONE

> Implemented 2026-05-29. 33 tests passing.

Target files:

```txt
packages/analyzer/src/a11y/schema.ts          ✅
packages/analyzer/src/a11y/rules.ts           ✅
packages/analyzer/tests/a11y-rules.test.ts    ✅
```

Deliverables:

- [x] TypeScript types (`AccessibilityRule`, `AccessibilityFinding`, `FindingInventory`, `FindingSuppression`).
- [x] Initial WCAG rule catalog (10 static rules: 9 Level A + 1 Level AA).
- [x] Severity model (`info < minor < major < critical`).
- [x] Rule filtering by WCAG level (`getRulesByLevel` — AA includes A).
- [x] `getRuleById`, `getRulesBySeverity`, `filterRules` helpers.
- [x] Exported from `@selfcure/analyzer`.

### Part 2: Static JSX/TSX Analysis — DONE

> Implemented 2026-05-29. 56 tests passing. All 10 rules operational.

Target files:

```txt
packages/crawler/src/a11y/extract.ts          ✅
packages/analyzer/src/a11y/static.ts          ✅
packages/analyzer/tests/a11y-static.test.ts   ✅
```

Deliverables:

- [x] Detect missing accessible names for buttons and links.
- [x] Detect inputs without labels (supports htmlFor association + aria-label/labelledby).
- [x] Detect images without alt text (alt="" decorative is valid).
- [x] Detect invalid ARIA references (aria-labelledby, aria-describedby, aria-controls).
- [x] Bonus: positive-tabindex, noninteractive-click-handler, missing-dialog-name, heading-order, duplicate-id.

### Part 3: Lint Integration — DONE

> Implemented 2026-05-29. Type-check clean, all 163 tests passing.

Target files:

```txt
packages/cli/src/lint.ts   ✅ (a11y analysis wired into runLint)
packages/cli/src/a11y.ts   ✅ (printA11ySection, a11ySummaryLine)
packages/cli/src/index.ts  ✅ (--a11y, --wcag flags added)
docs/packages/cli.md       ⏳ (doc update pending)
```

Deliverables:

- [x] `selfcure lint --a11y` — runs WCAG analysis on the same crawl result.
- [x] `selfcure lint --a11y --wcag AA` — configurable WCAG level (A / AA / AAA).
- [x] Separate output sections: Testability issues first, then Accessibility.
- [x] Paid-plan gate: full details require Pro; free shows count + upgrade prompt.
- [ ] JSON output for accessibility findings (→ Part 4, with findings file).

### Part 4: Audit and CI Gate — DONE

> Implemented 2026-05-29. 190 tests passing.

Target files:

```txt
packages/analyzer/src/a11y/audit.ts     ✅
packages/analyzer/src/a11y/findings.ts  ✅
packages/analyzer/tests/a11y-audit.test.ts ✅
packages/cli/src/a11y.ts                ✅ (registerA11yCommands added)
packages/cli/src/index.ts               ✅ (a11y commands wired)
```

Deliverables:

- [x] `.selfcure/a11y-findings.json` — findings file written by `selfcure a11y scan`.
- [x] Finding lifecycle: open, resolved, suppressed (merge logic with key = ruleId+file+line+col).
- [x] `selfcure a11y scan` — crawl + static analysis + merge + save findings file.
- [x] `selfcure a11y audit --ci` — exit code 1 when findings meet or exceed threshold.
- [x] `--fail-on minor|major|critical` — configurable CI severity threshold (default: major).
- [x] Suppressed findings are never touched during merge.

### Part 5: Reporting — DONE

> Implemented 2026-05-29. Type-check clean, 190 tests passing.

Target files:

```txt
packages/reporter/src/a11y/report.ts   ✅
packages/web/src/a11yPage.ts           ✅ (route GET /a11y + API GET /api/a11y-findings)
packages/web/src/index.ts              ✅ (routes wired)
docs/packages/reporter.md              ⏳ (doc update pending)
docs/packages/web.md                   ⏳ (doc update pending)
```

Deliverables:

- [x] HTML report (`reportA11y` → `selfcure-report/a11y.html`) with severity cards, findings by file, WCAG links, remediation.
- [x] JSON summary (`selfcure-report/a11y-summary.json`) — open/resolved/suppressed/bySeverity.
- [x] Web dashboard page at `/a11y` — dark-mode, filter by severity and status, grouped by file.
- [x] API endpoint `GET /api/a11y-findings?path=...` — serves `.selfcure/a11y-findings.json`.
- [ ] Owner/route/component grouping views (planned for future iteration).

### Part 6: Dynamic Playwright Scan — DONE

> Implemented 2026-05-29. 16 pure-function tests passing. 206 total.

Target files:

```txt
packages/runner/src/a11y/dynamic.ts      ✅
packages/runner/tests/a11y-dynamic.test.ts ✅
packages/runner/src/index.ts             ✅ (new exports)
packages/cli/src/a11y.ts                 ✅ (--dynamic, --base-url, --routes, --axe-source)
docs/packages/runner.md                  ⏳ (doc update pending)
```

Deliverables:

- [x] `runDynamicScan(opts)` — launches Playwright Chromium, injects axe-core, runs WCAG checks.
- [x] axe-core injected via CDN by default; `--axe-source` flag for offline/local use.
- [x] Findings mapped: axe impact → A11ySeverity, axe tags → WcagLevel + WCAG refs.
- [x] `selfcure a11y scan --dynamic --base-url http://localhost:3000 --routes /,/checkout`
- [x] Dynamic findings merged into `.selfcure/a11y-findings.json` alongside static findings.
- [x] Per-route errors captured (non-fatal — remaining routes continue).
- [x] Storage-state auth support (`DynamicScanRoute.storageState`).
- [ ] Authenticated route support via CLI flag (planned — use storageState API directly for now).

## First Implementation Slice

Start with Part 1:

```txt
packages/analyzer/src/a11y/schema.ts
packages/analyzer/src/a11y/rules.ts
packages/analyzer/tests/a11y-rules.test.ts
```

This creates the paid module boundary and WCAG catalog before adding lint behavior.
