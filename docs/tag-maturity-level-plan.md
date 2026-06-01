# Tag Maturity Level Implementation Plan

## Purpose

Tag Maturity Level, or TML, is a Selfcure feature that explains the maturity of each interactive tag/element identified during analysis.

The goal is to turn raw selector and testability signals into an actionable maturity label:

```text
This tag is test-ready.
This tag is usable but weak.
This tag is ambiguous and needs a stronger contract.
This tag is not testable enough for reliable Playwright automation.
```

TML should help the user understand:

- the current maturity of the tag;
- why Selfcure assigned that maturity;
- what needs to change;
- how testable the tag is today;
- whether the issue belongs to frontend, QA, or environment/configuration.

## Product Definition

TML is a per-tag maturity model. A "tag" means the frontend element or component instance Selfcure identified as relevant for testing.

Examples:

- `<button>`
- `<input>`
- `<a>`
- custom React/Vue/Angular components that behave like controls
- elements with ARIA roles such as `button`, `dialog`, `combobox`, `tab`, `menuitem`
- runtime DOM elements discovered through Playwright

TML should be shown anywhere Selfcure presents element-level findings:

- CLI lint output
- JSON analysis output
- HTML reports
- web UI
- MCP tools
- suggested PR patches

## Relationship To Existing Concepts

TML builds on existing Selfcure concepts instead of replacing them.

| Existing concept | Role in TML |
|------------------|-------------|
| `testabilityScore` | Numeric base signal, 0-100 |
| selector ranking | Explains available locator quality |
| ambiguity detection | Penalizes maturity when selector matches multiple elements |
| Test ID Inventory | Governs whether `data-testid` is valid, duplicated, deprecated, or orphaned |
| accessibility findings | Penalizes controls without accessible name or semantic role |
| runtime discovery | Confirms whether the tag actually appears in rendered DOM |

The numeric `testabilityScore` remains useful for sorting and thresholds. TML adds an opinionated maturity label and recommended changes.

## TML Levels

### TML 0: Unusable

The tag is not reliably testable.

Typical conditions:

- no stable selector;
- no accessible name;
- only bare tag, index, CSS hash, or XPath is available;
- tag is detected statically but not found in rendered DOM;
- element is hidden behind unknown state with no known trigger.

Recommended action:

- add semantic role/label where appropriate;
- add governed `data-testid` for non-semantic or complex controls;
- expose the state through a stable interaction path.

### TML 1: Fragile

The tag can be targeted, but tests are likely to break.

Typical conditions:

- selector uses class name, CSS path, XPath, or generated ID;
- accessible name exists but is generic;
- selector is not unique enough;
- tag is conditional without known runtime coverage;
- no inventory metadata exists.

Recommended action:

- prefer role/name locator when semantic;
- add or rename `data-testid`;
- register the tag in `.selfcure/testid-inventory.json`;
- improve label specificity.

### TML 2: Usable

The tag is testable, but not yet governed or fully mature.

Typical conditions:

- usable role/name, `id`, `name`, or `aria-label`;
- locator is unique within the component;
- no intra-component ambiguity;
- may be missing owner, intent, inventory entry, or route context.

Recommended action:

- add inventory metadata;
- add owner/intent/route;
- prefer domain-scoped `data-testid` for critical flows if semantic locator is not enough.

### TML 3: Stable

The tag has a stable testing contract.

Typical conditions:

- unique `data-testid` or strong role/name locator;
- no ambiguity in the component;
- observed in source and/or runtime;
- follows naming convention;
- not deprecated;
- has clear route/component context.

Recommended action:

- keep selector stable;
- monitor for drift;
- use in generated tests.

### TML 4: Governed

The tag is enterprise-grade and safe for long-lived automation.

Typical conditions:

- stable locator;
- inventory entry exists;
- owner exists;
- intent exists;
- route/screen context exists;
- not duplicated;
- not deprecated;
- observed in source and runtime;
- no accessibility blocker;
- used by tests or marked as test-ready.

Recommended action:

- no immediate change;
- enforce in CI for critical flows.

## Level Calculation

Initial deterministic calculation:

```ts
type TagMaturityLevel = 0 | 1 | 2 | 3 | 4;

interface TagMaturityResult {
  level: TagMaturityLevel;
  label: "unusable" | "fragile" | "usable" | "stable" | "governed";
  score: number;
  reasons: TagMaturityReason[];
  requiredChanges: TagMaturityChange[];
  confidence: number;
}
```

Recommended mapping:

| Condition | Max level |
|-----------|-----------|
| no selector or only bare tag | TML 0 |
| selector is ambiguous in component | TML 1 |
| selector is CSS/XPath/generated class only | TML 1 |
| selector is role/name, `id`, `name`, or `aria-label` and unique | TML 2 |
| stable selector with no ambiguity | TML 3 |
| stable selector plus valid inventory metadata | TML 4 |

The max-level model prevents a high numeric score from hiding a blocking issue. For example, duplicated `data-testid` should not be TML 4 even if `data-testid` normally scores 100.

## Input Signals

### Static source signals

- tag name;
- component name;
- file path, line, column;
- JSX/Vue/Angular attributes;
- conditional rendering;
- available selector candidates;
- ambiguity within component;
- cross-component reuse;
- custom component heuristics.

### Test ID inventory signals

- inventory entry exists;
- naming convention validity;
- owner exists;
- intent exists;
- status: active, deprecated, removed;
- duplicate status;
- route/screen metadata;
- first seen / last seen.

### Accessibility signals

- accessible name exists;
- semantic role exists;
- ARIA label quality;
- disabled/hidden state;
- control has associated label;
- interactive element is keyboard reachable when runtime data exists.

### Runtime Playwright signals

- tag appears in rendered DOM;
- locator resolves to exactly one element;
- locator resolves in expected route/state;
- element is visible/enabled/editable as expected;
- screenshots/traces confirm state;
- runtime-only generated elements.

## Output Shape

Add TML to each interactive element:

```ts
interface InteractiveElement {
  type: ElementType;
  selector: string;
  label?: string;
  actions: string[];
  selectorRanking: SelectorCandidate[];
  testabilityScore: number;
  ambiguous: boolean;
  ambiguityReason?: string;
  tml?: TagMaturityResult;
}
```

Detailed output:

```ts
interface TagMaturityReason {
  code:
    | "stable-testid"
    | "missing-testid"
    | "invalid-testid-name"
    | "duplicate-testid"
    | "deprecated-testid"
    | "strong-role-name"
    | "generic-accessible-name"
    | "missing-accessible-name"
    | "ambiguous-selector"
    | "weak-css-selector"
    | "runtime-not-observed"
    | "runtime-unique"
    | "missing-owner"
    | "missing-intent";
  severity: "info" | "warning" | "error";
  message: string;
  evidence?: string[];
}

interface TagMaturityChange {
  type:
    | "add-testid"
    | "rename-testid"
    | "dedupe-testid"
    | "add-accessible-name"
    | "add-inventory-entry"
    | "add-owner"
    | "add-intent"
    | "replace-selector"
    | "confirm-runtime-state";
  priority: "low" | "medium" | "high";
  description: string;
  suggestedValue?: string;
  patchAvailable?: boolean;
}
```

## JSON Example

```json
{
  "component": "CheckoutForm",
  "sourceFile": "src/pages/Checkout.tsx",
  "tag": "button",
  "label": "Apply",
  "selector": "text=Apply",
  "testabilityScore": 58,
  "tml": {
    "level": 1,
    "label": "fragile",
    "score": 58,
    "confidence": 0.91,
    "reasons": [
      {
        "code": "generic-accessible-name",
        "severity": "warning",
        "message": "The accessible name is usable but too generic for a critical checkout action."
      },
      {
        "code": "missing-testid",
        "severity": "warning",
        "message": "No governed data-testid was found for this action."
      }
    ],
    "requiredChanges": [
      {
        "type": "add-testid",
        "priority": "high",
        "description": "Add a domain-scoped test ID for the coupon apply action.",
        "suggestedValue": "checkout.coupon.apply-button",
        "patchAvailable": true
      },
      {
        "type": "add-inventory-entry",
        "priority": "medium",
        "description": "Register the tag in .selfcure/testid-inventory.json with owner and intent."
      }
    ]
  }
}
```

## CLI Experience

### `selfcure lint`

Show TML inline with each issue:

```text
warning TML-1 fragile src/pages/Checkout.tsx:42
  button "Apply" uses a weak text locator.
  Testability: 58/100
  Required: add data-testid="checkout.coupon.apply-button"
```

### Dedicated command

Add:

```bash
selfcure tml scan
selfcure tml report
selfcure tml audit --ci
```

Expected behavior:

- `scan`: compute TML for observed tags.
- `report`: write JSON/HTML report.
- `audit --ci`: fail when configured thresholds are not met.

## Config

Add an optional `tml` section:

```js
export default {
  tml: {
    enabled: true,
    minimumLevel: 2,
    criticalMinimumLevel: 3,
    requireInventoryForLevel4: true,
    failOnBelowMinimum: false,
    criticalRoutes: ["/checkout", "/login"],
    namingConvention: "<domain>.<screen-or-flow>.<element>.<role-or-action>"
  }
};
```

CI mode can promote thresholds:

```bash
selfcure tml audit --ci --minimum-level 3
```

## Analyzer Integration

Add a TML module under analyzer:

```text
packages/analyzer/src/tml/
  levels.ts
  score.ts
  reasons.ts
  changes.ts
  schema.ts
```

Responsibilities:

- map selector/testability signals to maturity levels;
- merge inventory findings;
- merge accessibility findings when available;
- produce required changes;
- keep output deterministic and testable.

The core API should be pure:

```ts
export function assessTagMaturity(input: TagMaturityInput): TagMaturityResult;
```

## Crawler Integration

Crawler should provide enough tag evidence:

- exact source location;
- raw tag name;
- raw attributes;
- parent component;
- conditional rendering context;
- whether the element comes from a custom component;
- resolved `data-testid` when possible.

No TML decisions should live in crawler. It only extracts facts.

## Reporter Integration

Reports should include:

```text
Tag Maturity Overview
  TML distribution: 0/1/2/3/4
  average testability score
  tags below minimum
  critical routes below minimum

Tag Findings
  component
  tag
  TML
  score
  required change
  patch availability

Frontend Action Items
  add-testid
  rename-testid
  dedupe-testid
  add accessible name
  add inventory entry
```

Machine-readable output:

```text
.selfcure/tml-report.json
.selfcure/tml-findings.json
```

## Web UI Integration

Add a TML filter to the existing lint/testability views:

```text
All tags
TML 0
TML 1
TML 2
TML 3
TML 4
Needs patch
Critical route
```

Each tag row should show:

- maturity badge;
- score;
- selector;
- component path;
- reason;
- required change;
- checkbox for patch/PR flow when patchable.

## MCP Integration

Expose TML through MCP tools:

```text
selfcure_get_tml_summary
selfcure_list_low_maturity_tags
selfcure_explain_tag_maturity
selfcure_suggest_tml_fixes
```

Example IDE agent use cases:

```text
"Show me all TML 0 and TML 1 tags in checkout."
"Explain why this button is only TML 1."
"Create a PR to raise checkout tags to TML 3."
```

## Patch Strategy

TML should connect directly to patch suggestions when safe.

Patchable changes:

- add literal `data-testid`;
- replace generic `data-testid`;
- add inventory entry;
- add owner/intent metadata;
- add `aria-label` only when there is a clear non-visual label need.

Non-patchable or review-required changes:

- changing visible text;
- changing component behavior;
- restructuring DOM;
- adding hidden states or route access;
- modifying business logic.

## CI Policy

Initial CI behavior:

```text
exit 0 when all tags meet configured minimum
exit 1 when critical tags are below configured minimum
warnings for non-critical tags below minimum
```

Recommended defaults:

| Scope | Minimum |
|-------|---------|
| all tags | TML 2 |
| critical routes | TML 3 |
| release gates | TML 3 |
| enterprise governed flows | TML 4 |

## Implementation Phases

### Phase 1: Taxonomy and pure scoring — DONE

> Implemented 2026-06-01. 307 tests passing.

Files:

```text
packages/analyzer/src/tml/schema.ts       ✅ all types
packages/analyzer/src/tml/score.ts        ✅ assessTagMaturity() + deriveTestIdSuggestion()
packages/analyzer/tests/tml-score.test.ts ✅ 33 tests covering TML 0–4, confidence, suggestions
```

Deliverables:

- [x] `TagMaturityLevel` (0–4), `TagMaturityLabel`, `TagMaturityResult` types.
- [x] `TagMaturityReason` with 14 reason codes.
- [x] `TagMaturityChange` with 9 change types, priority, suggestedValue, patchAvailable.
- [x] `assessTagMaturity(input)` — pure deterministic function, ceiling-model logic.
- [x] Inventory and runtime fields on `TagMaturityInput` (optional — phases 3 and 7).
- [x] `deriveTestIdSuggestion(label, elementType)` — kebab-case heuristic.
- [x] 33 unit tests covering all level transitions and edge cases.

### Phase 2: Analyzer output integration — DONE

> Implemented 2026-06-01. 307 tests passing. Existing testabilityScore preserved.

Files:

```text
packages/analyzer/src/index.ts  ✅ (InteractiveElement.tml added, analyze() wires TML)
```

Deliverables:

- [x] `InteractiveElement.tml?: TagMaturityResult` — optional field, populated after ambiguity pass.
- [x] `analyze()` calls `assessTagMaturity()` in a third pass, after ambiguity penalties are applied.
- [x] All TML types exported from `@selfcure/analyzer`.
- [x] Backward compatible — `testabilityScore` unchanged; `tml` is additive.

### Phase 3: Inventory and ambiguity integration — DONE

> Implemented 2026-06-01. 307 tests passing.

Files:

```text
packages/analyzer/src/tml/inventory.ts  ✅
packages/analyzer/src/index.ts          ✅ (new exports)
```

Deliverables:

- [x] `buildDuplicateSet(inventory)` — returns testIds that appear >1 time across routes.
- [x] `isValidTmlNaming(testId)` — validates `domain.screen.element` naming convention.
- [x] `buildTmlInventoryEntry(testId, inventory, duplicates)` — maps `InventoryElement` → `TmlInventoryEntry`.
- [x] `enrichTmlWithInventory(results, inventory)` — re-runs TML in place with inventory metadata; call after `analyze()`.
- [x] Duplicate/deprecated/naming-invalid testIds correctly cap at TML 2.
- [x] Missing owner or intent caps at TML 3 (not 4).

### Phase 4: CLI output — DONE

> Implemented 2026-06-01. 307 tests passing. Type-check clean.

Files:

```text
packages/cli/src/tml.ts      ✅
packages/cli/src/index.ts    ✅ (TML badge added to lint output + tml commands wired)
```

Deliverables:

- [x] `selfcure lint` now shows `[TML-1:fragile]` badge inline for each flagged element.
- [x] `selfcure tml scan` — prints TML distribution (0–4) + elements below minimum.
- [x] `selfcure tml audit --ci` — exits 1 when violations exist; `--ci` flag outputs JSON for pipelines.
- [x] `--minimum <level>` configures threshold (default: 2); `--minimum-level` on audit.
- [x] Inventory enrichment applied automatically when `.selfcure/testid-inventory.json` exists.

### Phase 5: Report and web UI — DONE

> Implemented 2026-06-01. 307 tests passing. Type-check clean on all packages.

Files:

```text
packages/reporter/src/tml/report.ts  ✅
packages/reporter/src/index.ts       ✅ (new exports)
packages/web/src/tmlPage.ts          ✅
packages/web/src/index.ts            ✅ (GET /tml + GET /api/tml-analysis)
packages/cli/src/tml.ts              ✅ (selfcure tml report added)
```

Deliverables:

- [x] `reportTml(results, options)` — generates `.selfcure/tml-report.html` + `.selfcure/tml-report.json`.
- [x] HTML report: dark-mode, stat cards (total/pass-rate/violations), CSS bar chart per level, per-file findings table.
- [x] `selfcure tml report` — runs analysis, writes report, prints artifact paths.
- [x] `GET /tml` — interactive dashboard with distribution bars, filter buttons (TML-0…4), per-element table.
- [x] `GET /api/tml-analysis` — runs analysis in-process, enriches with inventory if available, returns JSON.
- [x] Navigation link `/tml` added to header (matches other pages).

### Phase 6: MCP tools — DONE

> Implemented 2026-06-01. 307 tests passing. Type-check clean on MCP package.

Files:

```text
packages/mcp/src/index.ts  ✅ (4 new tools added)
```

| Tool | Description |
|---|---|
| `selfcure_get_tml_summary` | Distribution + pass rate + violations. Quick governance snapshot. |
| `selfcure_list_low_maturity_tags` | Elements below a level — ready for patch workflow. |
| `selfcure_explain_tag_maturity` | Full reasons + required changes for a specific element. |
| `selfcure_suggest_tml_fixes` | Patchable changes only (add-testid, rename, dedupe) — feeds PR agent. |

All tools accept optional `inventoryPath` to enrich TML with governance metadata.

### Phase 7: Runtime confirmation — DONE

> Implemented 2026-06-01. 318 tests passing. Type-check clean.

Files:

```text
packages/analyzer/src/tml/runtime.ts          ✅
packages/analyzer/src/tml/score.ts            ✅ (runtime caps added to computeCeilingLevel)
packages/analyzer/tests/tml-runtime.test.ts   ✅
packages/analyzer/src/index.ts                ✅ (RuntimeMap, enrichTmlWithRuntime, loadRuntimeMap exported)
packages/cli/src/tml.ts                       ✅ (--runtime-map flag on all tml subcommands)
```

Deliverables:

- [x] `enrichTmlWithRuntime(results, routeMap, inventory?)` — re-computes TML with Playwright evidence; call after `enrichTmlWithInventory()`.
- [x] Matching by data-testid → id → aria-label/name (in priority order); ignores errored routes.
- [x] Exclusive runtime caps in `computeCeilingLevel`:
  - Not observed in DOM → cap at TML 2 (conditionally rendered / removed from page)
  - Observed but locator not unique → cap at TML 1 (ambiguous at runtime)
  - Observed and unique → confidence boost, static/inventory level preserved
- [x] `loadRuntimeMap(filePath)` — reads `.selfcure/route-map.json` from `selfcure discover --runtime`.
- [x] `--runtime-map <path>` flag on `selfcure tml scan`, `tml audit`, and `tml report`.
- [x] Auto-loads `.selfcure/route-map.json` when flag is omitted (zero-config for users of `selfcure discover --runtime`).
- [x] 11 tests covering all level transitions, matching strategies, error route exclusion, and empty map.

## Acceptance Criteria

- Every interactive element can receive a TML result.
- TML does not remove or redefine existing `testabilityScore`.
- Ambiguous selectors cannot receive TML 3 or TML 4.
- Duplicate/deprecated inventory IDs cannot receive TML 4.
- TML output includes reasons and required changes.
- CLI shows TML for lint findings.
- JSON output is stable enough for CI and MCP.
- Patch suggestions are generated only for safe, local changes.

## First Implementation Slice

Start with deterministic analyzer-only TML:

1. Implement `TagMaturityResult` types.
2. Implement `assessTagMaturity()`.
3. Use selector ranking, ambiguity, and `testabilityScore`.
4. Attach TML to `InteractiveElement`.
5. Add tests for TML 0 through TML 4.

Inventory, runtime, web, and MCP integration should come after the basic model is stable.
