# Agentic Discovery Init Plan

## Decision

Selfcure should implement repository discovery as a first-class agentic capability, with MCP as the preferred integration surface for IDE agents and a configured provider fallback for CLI and CI.

The mechanism is close to Playwright MCP: expose structured browser/repository tools, let the user's selected agent call them, and validate structured output before Selfcure uses it. The CLI must still work without an IDE agent.

## Current Model

Selfcure already has an AI provider abstraction in `packages/generator/src/ai.ts`. The generator and healing loop call the selected provider through that abstraction and use Playwright traces, errors, and generated diffs as inputs.

That means the product already owns the important pattern:

```text
Selfcure command
  -> collect deterministic evidence
  -> send structured context to selected LLM provider
  -> receive structured output
  -> validate/apply result
```

Agentic discovery should reuse this model.

## IDE Agent Versus Selfcure Agent

There are two different execution modes.

### IDE/MCP mode

```text
Copilot / Cursor / Claude Desktop / Claude Code
  -> Selfcure MCP server
  -> Playwright MCP server
  -> selfcure.discover
  -> selfcure.run
```

In this mode, the IDE-selected agent can orchestrate Selfcure. If the enterprise already approved Copilot, Claude, Azure OpenAI, or another MCP-capable assistant, Selfcure should not require a second AI setup just to perform discovery.

The agent calls Selfcure MCP tools for repository understanding and can call Playwright MCP tools for live browser interaction. Selfcure persists the artifacts and validates the output.

### CLI/CI mode

```text
npx selfcure init
npx selfcure discover
npx selfcure run
```

In this mode, Selfcure cannot assume Copilot or another IDE agent exists. It should use the provider configured in `selfcure.config.mjs`, or run deterministic discovery without LLM assistance when no provider is configured.

```js
ai: {
  provider: "openai",
  model: "gpt-4.1-mini"
}
```

This keeps Selfcure reproducible, CI-friendly, and auditable.

## Playwright MCP Alignment

Playwright MCP provides browser automation capabilities through the Model Context Protocol. It lets LLM clients interact with pages through structured accessibility snapshots rather than raw screenshots. It works with clients such as VS Code, Cursor, Windsurf, Claude Desktop, Claude Code, and Copilot-compatible MCP hosts.

Selfcure should align with that model:

```text
User-selected IDE agent
  -> Playwright MCP: navigate, click, inspect accessibility tree
  -> Selfcure MCP: discover repo, score testability, generate map, run tests
```

This gives the product a strong enterprise story: the customer can use the agent/provider already approved for the IDE, while Selfcure contributes domain-specific tools and artifacts.

The important boundary is that Playwright MCP is not the Selfcure discovery engine. It is the browser-control layer. Selfcure still owns repository discovery, testability scoring, output validation, reporting, and persistence.

## Recommended Architecture

Create an agentic discovery stage that combines deterministic crawling, runtime rendering, and LLM reasoning.

```text
init
  -> create minimal config
  -> optionally run discover

discover
  -> detect package manager/framework/scripts
  -> infer routes and entrypoints
  -> start or connect to target app
  -> render routes with Playwright
  -> capture DOM, accessibility tree, screenshots, console errors
  -> score locator quality
  -> ask LLM only for ambiguous decisions
  -> write discovery artifacts

run
  -> generate tests from discovery map
  -> execute tests
  -> heal failures
  -> report
```

In IDE mode, the LLM reasoning step may be performed by the IDE-selected agent through MCP. In CLI/CI mode, the same step is performed through Selfcure's configured provider abstraction.

## Configuration Update

The new initial configuration should be minimal:

```js
export default {
  projectRoot: ".",
  baseUrl: "http://localhost:5000",

  ai: {
    provider: "openai",
    model: "gpt-4.1-mini"
  },

  discovery: {
    mode: "agentic",
    static: true,
    runtime: true,
    maxRoutes: 50,
    maxDepth: 3,
    includeHiddenStates: true,
    routeHints: [],
    ignore: ["node_modules", "dist", "coverage", ".git"]
  },

  testability: {
    preferRoleLocators: true,
    suggestTestIds: true,
    minimumScore: 80
  }
};
```

The init wizard should ask only:

```text
Project root
Base URL
AI provider
Model
Run initial discovery now?
```

It should stop asking for source folders, template folders, file extensions, or manual component paths.

## New Artifacts

Persist discovery output under `.selfcure/`:

```text
.selfcure/
  project-map.json
  route-map.json
  dom-snapshots/
  accessibility-trees/
  screenshots/
  testability-report.json
  discovery-log.json
```

These artifacts make the agent auditable and prevent the product from becoming a black box.

## Package Changes

### `packages/crawler`

Add project discovery APIs:

```ts
export interface DiscoverProjectOptions {
  projectRoot: string;
  baseUrl?: string;
  config?: SelfcureConfig;
}

export interface ProjectMap {
  framework: "react" | "vue" | "angular" | "next" | "nuxt" | "unknown";
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  devCommand?: string;
  buildCommand?: string;
  routeCandidates: RouteCandidate[];
  componentCandidates: ComponentCandidate[];
}
```

Static discovery should read `package.json`, framework config files, route files, imports, and common conventions.

### `packages/runner`

Add runtime discovery support with Playwright:

```ts
export interface RuntimeDiscoveryResult {
  url: string;
  title?: string;
  domSnapshotPath: string;
  accessibilityTreePath: string;
  screenshotPath?: string;
  interactiveElements: InteractiveElement[];
  consoleErrors: string[];
}
```

The runner should render route candidates and capture real browser evidence.

### `packages/analyzer`

Move testability scoring toward rendered DOM and accessibility trees:

```text
role/name locator available -> high score
stable data-testid available -> high score
text-only locator -> medium score
CSS/XPath/index locator only -> low score
interactive element without accessible name -> finding
```

The old static lint path can remain as a fast pre-check, but the main score should come from runtime evidence.

### `packages/generator`

Add discovery prompts that are separate from test generation and healing prompts.

The LLM should receive compact structured input:

```json
{
  "framework": "next",
  "packageScripts": ["dev", "build", "test"],
  "routeCandidates": ["/", "/login", "/checkout"],
  "runtimeFindings": []
}
```

The LLM should return structured output:

```json
{
  "routesToVisit": ["/", "/login"],
  "hiddenStatesToExplore": [
    {
      "route": "/checkout",
      "triggerHint": "button with accessible name Add payment method"
    }
  ],
  "confidence": 0.82,
  "notes": []
}
```

Avoid free-form prose as the primary protocol.

### `packages/cli`

Update `selfcure init`:

```text
selfcure init
  -> ask minimal questions
  -> write new config shape
  -> optionally run selfcure discover
```

Add or formalize:

```text
selfcure discover
```

This command should write `.selfcure/project-map.json` and `.selfcure/testability-report.json`.

### `packages/mcp`

Expose discovery as MCP tools:

```text
selfcure_discover_project
selfcure_get_project_map
selfcure_get_testability_report
selfcure_run_route_discovery
```

This is how Copilot or another IDE agent can use the same Selfcure capability without Selfcure depending on the IDE agent.

Selfcure MCP should expose high-level tools instead of forcing the agent to infer everything from generic file and browser primitives.

Example tools:

```text
selfcure_detect_project
selfcure_discover_routes
selfcure_render_route
selfcure_score_testability
selfcure_get_discovery_artifacts
selfcure_generate_tests_from_map
selfcure_run_and_heal
```

The tool outputs should be compact JSON. Large DOM snapshots, screenshots, and logs should be stored as artifacts and referenced by path or ID.

## Hidden State Strategy

Hidden states should be discovered in layers:

1. Static hints: modal components, drawer components, wizard steps, route guards.
2. Runtime hints: buttons, menus, tabs, links, forms, dialogs.
3. Low-risk exploration: click visible buttons with safe labels and observe DOM changes.
4. LLM-assisted planning: ask the model which interactions are likely to reveal relevant states.
5. Optional Playwright codegen/manual recording only when discovery cannot safely infer the trigger.

Codegen remains useful, but it becomes a fallback for ambiguous hidden states rather than a required setup step.

## Why Not Depend Only On Copilot

Selfcure should integrate well with Copilot and other IDE agents, but should not depend only on them for core behavior because:

- CI has no IDE agent.
- Enterprise users need repeatable provider selection.
- Audit logs need to show which model made which decision.
- Some users will run Selfcure from terminal, pipelines, or web UI.
- MCP hosts vary in capability and permissions.

The right model is:

```text
Selfcure owns the workflow and artifacts.
IDE agents can drive Selfcure through MCP.
Configured providers power standalone CLI and CI automation.
```

## Implementation Phases

### Phase 1: Config And Init — DONE

> Implemented 2026-05-29. Type-check clean, 229 tests passing.

Files:

```txt
packages/cli/src/init.ts             ✅ (simplified to 5 questions)
packages/cli/src/index.ts            ✅ (DiscoveryConfig, TestabilityConfig added to SelfcureConfig)
packages/cli/src/discover.ts         ✅ (registerDiscoverCommand)
```

Deliverables:

- [x] `DiscoveryConfig` and `TestabilityConfig` added to `SelfcureConfig` (backward-compatible, both `projectRoot`/`baseUrl` and legacy `rootDir`/`baseURL` accepted).
- [x] `selfcure init` simplified to 5 questions: project root, base URL, provider, model, run discovery now?
- [x] New `selfcure.config.mjs` format with `discovery` and `testability` blocks.
- [x] Existing configs with old fields remain fully supported.

### Phase 2: Static Project Discovery — DONE

> Implemented 2026-05-29. 23 tests covering all supported frameworks.

Files:

```txt
packages/crawler/src/discover.ts        ✅
packages/crawler/tests/discover.test.ts ✅
packages/crawler/src/index.ts           ✅ (new exports)
```

Deliverables:

- [x] `discoverProject(options)` → `ProjectMap` — framework, package manager, scripts, routes, components.
- [x] `detectFramework` — detects Next.js, Nuxt, Vue, React, Angular, Svelte from package.json deps.
- [x] `detectPackageManager` — bun / pnpm / yarn / npm via lockfile detection (priority order).
- [x] Route discovery: Next.js pages router, Next.js app router, Nuxt pages/, Vue views/, React pages/ and React Router config scan, Angular routing modules.
- [x] Component candidate listing from src/.
- [x] Route deduplication (highest confidence wins per path).
- [x] `selfcure discover [--root] [--out]` CLI command writes `.selfcure/project-map.json`.
- [x] Human-readable terminal summary with confidence indicators.

### Phase 3: Runtime Route Discovery — DONE

> Implemented 2026-05-29. 253 total tests passing.

Files:

```txt
packages/runner/src/discovery/runtime.ts         ✅
packages/runner/tests/discovery-runtime.test.ts  ✅
packages/runner/src/index.ts                     ✅ (new exports)
```

Deliverables:

- [x] `runRuntimeDiscovery(opts)` → `RuntimeDiscoveryResult` — launches Playwright, visits each route, captures DOM + ARIA snapshot + screenshots (optional).
- [x] Per-route evidence: `RuntimeRouteEvidence` with status ('reachable' | 'error' | 'timeout' | 'auth-required'), title, paths to artifacts.
- [x] Interactive element extraction via `page.evaluate()` with score calculation (`scoreElement()`).
- [x] Selector builder (`buildRuntimeSelector()`) — uses data-testid > id > aria-label > tag.
- [x] Console error capture per route.
- [x] 8 pure-function tests (scoreElement, buildRuntimeSelector).

### Phase 4: Runtime Testability Scoring — DONE

> Implemented 2026-05-29. 253 total tests passing.

Files:

```txt
packages/analyzer/src/discovery/testability.ts         ✅
packages/analyzer/tests/discovery-testability.test.ts  ✅
packages/analyzer/src/index.ts                         ✅ (new exports)
```

Deliverables:

- [x] `buildTestabilityReport(RuntimeDiscoveryResult, minimumScore)` → `TestabilityReport` — scores each route and element.
- [x] Per-route result: `RouteTestabilityResult` with score (0–100), element count, flagged count, findings.
- [x] Per-element finding: `TestabilityFinding` with issues (no accessible name, missing data-testid, non-semantic tag).
- [x] `summarizeReport()` — bucketing routes into critical (< 60) / warning (60–79) / healthy (≥ 80).
- [x] Integration with CLI `selfcure discover --runtime --base-url <url>` — persists `route-map.json` and `testability-report.json`.
- [x] Human-readable terminal output with severity badges and score coloring.
- [x] 11 integration tests covering scoring, bucketing, error handling.

### Phase 5: LLM-Assisted Discovery — DONE

> Implemented 2026-05-29. 274 total tests passing.

Files:

```txt
packages/generator/src/discovery.ts        ✅
packages/generator/tests/discovery.test.ts ✅
packages/generator/src/index.ts            ✅ (new exports)
```

Deliverables:

- [x] `buildDiscoveryInput(ProjectMap, RuntimeDiscoveryResult?)` → `DiscoveryLlmInput` — compact structured payload, no prose.
- [x] `shouldUseLlm(map, rtResult?)` — skip LLM when avg confidence ≥ 0.85 and all routes reachable; call otherwise.
- [x] `buildDiscoveryPrompt(DiscoveryLlmInput)` → prompt string — JSON-only instruction, no free-form output.
- [x] `validateDiscoveryOutput(raw, allowedRoutes)` — strict validation + hallucination filter (strips routes not in the original candidates list).
- [x] `runLlmDiscovery(input, AIConfig)` — calls configured provider via Vercel AI SDK, extracts JSON from response.
- [x] CLI `selfcure discover --llm --provider anthropic --model claude-opus-4-7` — skips LLM when not needed, writes `.selfcure/llm-hints.json`.
- [x] 21 pure-function tests covering input building, threshold logic, prompt content, and all validation edge cases (null, wrong types, hallucinated routes, missing fields).

### Phase 6: MCP Integration — DONE

> Implemented 2026-06-01. 274 tests passing. Type-check clean on MCP + web packages.

Files:

```txt
packages/mcp/src/index.ts   ✅ (4 new tools + 1 new prompt added)
```

New MCP tools:

| Tool | Description |
|------|-------------|
| `selfcure_discover_project` | Run static discovery from the project root; writes `project-map.json`. |
| `selfcure_get_project_map` | Read existing `project-map.json` artifact (no re-scan). |
| `selfcure_get_testability_report` | Read existing `testability-report.json` from runtime scan. |
| `selfcure_get_discovery_artifacts` | List all files in `.selfcure/` with sizes and timestamps. |

New MCP prompt:

- `selfcure_discover_and_test` — 6-step agentic workflow: discover → check artifacts → understand routes → check testability → lint → produce prioritised plan.

Works with Copilot, Cursor, Claude Desktop, Claude Code, VS Code, Windsurf. CLI/CI behaviour is completely independent — no IDE agent required.

### Phase 7: Report And UX — DONE

> Implemented 2026-06-01. 274 tests passing.

Files:

```txt
packages/web/src/discoveryPage.ts  ✅ (new dashboard page)
packages/web/src/index.ts          ✅ (GET /discovery + GET /api/discovery-artifact)
```

Deliverables:

- [x] `GET /discovery` — dark-mode dashboard served by the web server.
- [x] `GET /api/discovery-artifact?dir=.selfcure&file=project-map.json` — JSON artifact reader (path-traversal protected).
- [x] Dashboard loads all 4 artifacts in parallel (project-map, route-map, testability-report, llm-hints).
- [x] Meta row: framework, package manager, dev/build commands.
- [x] Route table: path, source, confidence bar, runtime status badge, testability score bar, flagged element count.
- [x] "Needs hint" panel (yellow border): lists auth-required and errored routes with actionable instructions.
- [x] LLM hints panel (purple border): prioritised routes + hidden state triggers + notes.
- [x] Navigation link to /discovery added to header of the new page (matches existing pages).

## Acceptance Criteria

- A user can run `selfcure init` without specifying source folders.
- A user can run `selfcure discover` and get a project map.
- Runtime discovery renders at least the reachable route candidates through Playwright.
- Testability scoring uses rendered DOM evidence.
- `selfcure run` can consume the discovery map.
- Existing config files remain supported.
- Copilot can call discovery through MCP, but the CLI does not require Copilot.

## Summary

The implementation should reuse the current healing architecture pattern: gather evidence, ask an agent or provider for reasoning when needed, validate the result, and persist artifacts. The difference is that discovery happens before test generation and healing.

The mechanics are similar to Playwright MCP in IDE mode: the user's selected agent can drive structured tools. The ownership remains different:

```text
Healing fixes failed tests.
Discovery understands the app before tests exist.
MCP lets IDE agents trigger the workflow.
Selfcure remains the source of truth.
```

## References

- Playwright MCP documentation: https://playwright.dev/docs/getting-started-mcp
- Playwright MCP repository: https://github.com/microsoft/playwright-mcp
