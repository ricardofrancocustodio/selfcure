# Test ID Inventory Implementation Plan

## Purpose

The Test ID Inventory turns `data-testid` values into a versioned contract between frontend code, generated tests, CI, reporting, and future design inputs such as Figma.

The goal is not to maintain a manual spreadsheet of selectors. The goal is to let selfcure continuously compare:

```txt
Expected testability contract  <->  Observed frontend and test code
```

That comparison lets selfcure detect ambiguity, missing identifiers, duplicated selectors, stale selectors, unstable naming, and ownership gaps before Playwright tests become fragile.

## Recommended Approach

Use an inventory-style mapping as the canonical governance layer, backed by automatic scanning.

```txt
Inventory = governed contract
Scanner = observed reality
Audit = diff between contract and reality
```

This keeps the inventory useful without making it fully manual.

## Canonical Inventory File

The recommended target-project file is:

```txt
.selfcure/testid-inventory.json
```

Initial schema:

```json
{
  "version": "1.0",
  "app": "checkout-web",
  "generatedAt": "2026-05-29T00:00:00.000Z",
  "routes": [
    {
      "path": "/checkout",
      "screen": "CheckoutPage",
      "owner": "payments-frontend",
      "elements": [
        {
          "testId": "checkout.payment-method.select",
          "component": "PaymentMethodSelect",
          "elementType": "select",
          "intent": "choose_payment_method",
          "label": "Payment method",
          "sourceFile": "src/pages/CheckoutPage.tsx",
          "status": "active",
          "stability": "stable",
          "firstSeenAt": "2026-05-29T00:00:00.000Z",
          "lastSeenAt": "2026-05-29T00:00:00.000Z"
        }
      ]
    }
  ]
}
```

## Naming Convention

Prefer readable, domain-scoped identifiers:

```txt
<domain>.<screen-or-flow>.<element>.<role-or-action>
```

Examples:

```txt
checkout.payment-method.select
checkout.coupon.input
checkout.coupon.apply-button
checkout.summary.total-value
auth.login.email-input
auth.login.submit-button
dashboard.filters.date-range-trigger
```

Avoid generic names:

```txt
button-submit
modal-close
input-email
submit
close
```

## Frontend Implementation Shape

Projects may use literal `data-testid` attributes, but the preferred implementation is a typed test ID registry.

Example:

```ts
export const testIds = {
  checkout: {
    coupon: {
      input: "checkout.coupon.input",
      applyButton: "checkout.coupon.apply-button"
    },
    paymentMethod: {
      select: "checkout.payment-method.select"
    }
  }
} as const;
```

Usage:

```tsx
import { testIds } from "../testids";

export function CouponForm() {
  return (
    <form>
      <input data-testid={testIds.checkout.coupon.input} />
      <button data-testid={testIds.checkout.coupon.applyButton}>
        Apply
      </button>
    </form>
  );
}
```

For large projects, split the registry by domain:

```txt
src/testids/
  auth.ts
  checkout.ts
  dashboard.ts
  index.ts
```

Dynamic IDs are allowed only when the pattern is explicit and auditable:

```ts
export function userRowActionTestId(userId: string, action: "edit" | "delete") {
  return `users.table.row.${userId}.${action}-button`;
}
```

Dynamic patterns should be represented in the inventory with a pattern field rather than a single concrete ID.

## Backend Implementation Shape

The backend work should be split across the existing pipeline packages:

```txt
packages/crawler/src/testids/extract.ts
packages/analyzer/src/testids/schema.ts
packages/analyzer/src/testids/inventory.ts
packages/analyzer/src/testids/audit.ts
packages/analyzer/src/testids/naming.ts
packages/reporter/src/testids/report.ts
packages/cli/src/testids.ts
```

Responsibilities:

| Area | Responsibility |
|------|----------------|
| crawler | Extract observed `data-testid` values and `getByTestId()` usage from source and test files |
| analyzer | Normalize inventory entries, validate naming, detect ambiguity, compute status |
| cli | Expose scan, audit, sync, and report commands |
| reporter | Produce JSON and HTML views for humans and CI |
| web | Later surface the same inventory and audit results in the local dashboard |

## CLI Commands

MVP commands:

```bash
selfcure testids scan
selfcure testids audit
selfcure testids audit --ci
```

Later commands:

```bash
selfcure testids sync
selfcure testids report
selfcure testids owners
selfcure testids export --format csv
selfcure testids suggest
```

Expected `scan` behavior:

```txt
1. Crawl configured source and test globs.
2. Extract literal `data-testid` attributes.
3. Extract registry-backed `data-testid={testIds...}` usage when statically resolvable.
4. Extract Playwright `getByTestId(...)` usage.
5. Write observed results to selfcure output JSON.
```

Expected `audit` behavior:

```txt
1. Load `.selfcure/testid-inventory.json`.
2. Load observed scanner output.
3. Compare expected vs observed IDs.
4. Report duplicates, missing inventory entries, orphaned inventory entries, naming violations, and test-only selectors.
5. Exit non-zero in `--ci` mode when critical issues exist.
```

## Audit Rules

Initial rules:

| Rule | Severity | Description |
|------|----------|-------------|
| duplicate-testid | error | Same concrete `data-testid` appears in conflicting contexts |
| missing-inventory | warning | Observed frontend ID is not registered in the inventory |
| orphaned-inventory | warning | Inventory ID was not observed in source code |
| test-only-selector | error | Test uses `getByTestId()` for an ID not found in frontend code |
| invalid-name | warning | ID does not match naming convention |
| generic-name | warning | ID is too broad to be stable |
| missing-owner | warning | Route or element has no owning team |
| deprecated-used | error | Code or tests still use a deprecated ID |

Later rules:

| Rule | Severity | Description |
|------|----------|-------------|
| interactive-without-testid | warning | Interactive element lacks a stable ID and has no stronger semantic selector |
| figma-drift | warning | Figma-suggested ID differs from implemented ID |
| removed-without-replacement | error | Active ID was removed without deprecation metadata |
| high-risk-change | error | Critical route lost one or more stable selectors |

## Output Shape

Initial JSON output:

```json
{
  "summary": {
    "totalObserved": 42,
    "duplicates": 1,
    "missingInventory": 6,
    "orphaned": 2,
    "testOnlySelectors": 1,
    "invalidNames": 3
  },
  "issues": [
    {
      "rule": "duplicate-testid",
      "severity": "error",
      "testId": "checkout.submit-button",
      "locations": [
        "src/pages/CheckoutPage.tsx:88",
        "src/components/CheckoutFooter.tsx:34"
      ]
    }
  ]
}
```

CLI output should be compact:

```txt
selfcure testids audit

Found 42 observed test IDs.
Errors: 2
Warnings: 11

error duplicate-testid checkout.submit-button
  src/pages/CheckoutPage.tsx:88
  src/components/CheckoutFooter.tsx:34

error test-only-selector checkout.legacy-confirm-button
  tests/checkout.spec.ts:42
```

## CI Behavior

`selfcure testids audit --ci` should exit with:

```txt
0 when no error-level issues exist
1 when error-level issues exist
```

Warnings should not fail CI in the first implementation. A future config option can promote selected warnings to errors.

## Figma Integration Direction

The future Figma plugin can generate suggested inventory metadata:

```json
{
  "figmaNodeId": "123:456",
  "component": "PaymentMethodSelect",
  "suggestedTestId": "checkout.payment-method.select",
  "intent": "choose_payment_method"
}
```

The inventory then becomes the bridge:

```txt
Figma suggestion -> frontend implementation -> Playwright selector -> CI audit -> report
```

## Incremental Implementation Plan

### Part 1: Schema and Types — DONE

> Implemented 2026-05-29. 26 tests passing.

Create typed inventory structures and tests.

Target files:

```txt
packages/analyzer/src/testids/schema.ts        ✅
packages/analyzer/src/testids/inventory.ts     ✅
packages/analyzer/tests/testid-inventory.test.ts ✅
```

Deliverables:

- [x] Inventory TypeScript interfaces.
- [x] JSON parse and validation helpers.
- [x] Normalization for route and element entries.
- [x] Unit tests for valid, invalid, and empty inventory files.

### Part 2: Basic Scanner — DONE

> Implemented 2026-05-29. 18 tests passing.

Extract literal frontend and test usage.

Target files:

```txt
packages/crawler/src/testids/extract.ts        ✅
packages/crawler/tests/testid-extract.test.ts  ✅
```

Deliverables:

- [x] Detect `data-testid="..."`.
- [x] Detect `getByTestId("...")`.
- [x] Return file path, line, column, usage kind, and raw value.

### Part 3: CLI Scan Command — DONE

> Implemented 2026-05-29. Wired into `packages/cli/src/index.ts`.

Expose scanner through the CLI.

Target files:

```txt
packages/cli/src/testids.ts   ✅
packages/cli/src/index.ts     ✅ (registerTestIdsCommands wired)
docs/packages/cli.md          ⏳ (doc update pending)
```

Deliverables:

- [x] `selfcure testids scan`.
- [x] JSON output written under the configured selfcure output directory.
- [x] Human-readable summary in stdout.

### Part 4: Audit Engine — DONE

> Implemented 2026-05-29. 30 tests passing.

Compare inventory vs observed scanner output.

Target files:

```txt
packages/analyzer/src/testids/audit.ts         ✅
packages/analyzer/src/testids/naming.ts        ✅
packages/analyzer/tests/testid-audit.test.ts   ✅
```

Deliverables:

- [x] Duplicate detection.
- [x] Missing inventory detection.
- [x] Orphaned inventory detection.
- [x] Test-only selector detection.
- [x] Naming convention validation.

### Part 5: CI Mode — DONE

> Implemented 2026-05-29. Included in `packages/cli/src/testids.ts`.

Make audit usable in pipelines.

Target files:

```txt
packages/cli/src/testids.ts   ✅ (--ci flag, exit code 1 on errors)
docs/getting-started.md       ⏳ (CI example pending)
docs/packages/cli.md          ⏳ (doc update pending)
```

Deliverables:

- [x] `selfcure testids audit --ci`.
- [x] Stable exit codes (0 = clean, 1 = errors).
- [ ] CI example for GitHub Actions.

### Part 6: Report and Web UI — PENDING

Create human-facing inventory visibility.

Target files:

```txt
packages/reporter/src/testids/report.ts   ⏳
packages/web/src/testidsPage.ts           ⏳
docs/packages/reporter.md                 ⏳
docs/packages/web.md                      ⏳
```

Deliverables:

- [ ] JSON and HTML report.
- [ ] Local web dashboard page.
- [ ] Route-level and owner-level summaries.
- [ ] Enterprise-friendly metrics.

## First Implementation Slice

Start with Part 1 only:

```txt
packages/analyzer/src/testids/schema.ts
packages/analyzer/src/testids/inventory.ts
packages/analyzer/tests/testid-inventory.test.ts
```

This creates the stable contract before scanner and CLI work begin.
