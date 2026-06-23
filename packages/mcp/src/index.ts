// ---------------------------------------------------------------------------
// @selfcure/mcp — Model Context Protocol server
//
// Exposes selfcure's testability analysis (crawler + analyzer + lint) so any
// MCP client (Claude Desktop, Cursor, VS Code, Claude Code, Windsurf, …) can
// pull testability data straight into the agent's context.
//
// This is the "preventive" half of selfcure's value proposition: a separate
// commodity layer (Playwright Test Agents) handles plan/generate/heal; we
// answer "which components are even ready to be tested?" — and feed that
// upstream of any test-generation agent the user runs.
// ---------------------------------------------------------------------------

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { crawl, discoverProject } from '@selfcure/crawler';
import {
  analyze,
  type AnalysisResult,
  type InteractiveElement,
  enrichTmlWithInventory,
  loadInventory,
  TML_LABELS,
  type TagMaturityLevel,
} from '@selfcure/analyzer';

import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Config loader (mirrors web's loadCrawlConfig, intentionally duplicated to
// avoid pulling @selfcure/web as a dependency).
// ---------------------------------------------------------------------------

interface ResolvedConfig {
  rootDir:    string;
  include:    string[];
  exclude:    string[];
  framework?: 'react' | 'vue' | 'angular' | 'auto';
  lint?:      { prBaseBranch?: string };
}

function resolveConfigPath(cwd: string, provided?: string): string {
  if (provided) return path.resolve(cwd, provided);
  const mjs = path.resolve(cwd, 'selfcure.config.mjs');
  if (fs.existsSync(mjs)) return mjs;
  return path.resolve(cwd, 'selfcure.config.js');
}

async function loadConfig(cwd: string, configPath?: string): Promise<{ config: ResolvedConfig; absPath: string }> {
  const absPath = resolveConfigPath(cwd, configPath);
  if (!fs.existsSync(absPath)) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Config not found: ${absPath}. Run \`selfcure init\` or pass configPath explicitly.`,
    );
  }
  // Cache-bust so successive calls see edits to the config.
  const url = `${pathToFileURL(absPath).href}?t=${Date.now()}`;
  const mod = await import(url);
  return { config: mod.default as ResolvedConfig, absPath };
}

// ---------------------------------------------------------------------------
// Lint pipeline (in-process duplicate of the slim version used by the
// CLI/web — kept local so this package doesn't pull in commander/chalk/etc.)
// ---------------------------------------------------------------------------

interface LintIssueOut {
  filePath:        string;
  componentName:   string;
  type:            string;
  selector:        string;
  label?:          string;
  testabilityScore: number;
  kind:            'ambiguous' | 'low-score';
  ambiguityReason?: string;
  suggestedTestId: string;
}

function toKebab(s: string): string {
  return s.trim()
    .replace(/([A-Z])/g, '-$1')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function suggestTestId(el: InteractiveElement, index: number): string {
  if (el.label) return toKebab(el.label);
  if (el.selectors?.id) return toKebab(el.selectors.id.replace(/^#/, ''));
  if (el.selectors?.name) {
    const m = el.selectors.name.match(/\[name=["']?([^"'\]]+)["']?\]/);
    if (m) return toKebab(m[1]);
  }
  if (el.selectors?.ariaLabel) {
    const m = el.selectors.ariaLabel.match(/\[aria-label=["']?([^"'\]]+)["']?\]/);
    if (m) return toKebab(m[1]);
  }
  return `${el.type}-${index + 1}`;
}

async function runFullAnalysis(cwd: string, configPath?: string): Promise<{
  config:  ResolvedConfig;
  results: AnalysisResult[];
}> {
  const { config } = await loadConfig(cwd, configPath);
  const rootDir = path.resolve(cwd, config.rootDir);
  const components = await crawl({
    rootDir,
    include:   config.include,
    exclude:   config.exclude,
    framework: config.framework,
  });
  const results = await analyze(components);
  return { config, results };
}

async function runTmlAnalysis(cwd: string, configPath?: string, inventoryPath?: string): Promise<AnalysisResult[]> {
  const { results } = await runFullAnalysis(cwd, configPath);
  const invFile = inventoryPath
    ? path.resolve(cwd, inventoryPath)
    : path.join(cwd, '.selfcure', 'testid-inventory.json');
  const invResult = await loadInventory(invFile).catch(() => null);
  if (invResult?.ok) enrichTmlWithInventory(results, invResult.inventory!);
  return results;
}

function collectIssues(results: AnalysisResult[], threshold: number): LintIssueOut[] {
  // First pass: gather raw issues with their per-component index.
  const raw: Array<LintIssueOut & { _filePath: string }> = [];
  for (const r of results) {
    r.interactiveElements.forEach((el, i) => {
      const isAmbiguous = el.ambiguous;
      const isLowScore  = el.testabilityScore < threshold;
      if (!isAmbiguous && !isLowScore) return;
      raw.push({
        filePath:        r.component.filePath,
        componentName:   r.component.componentName,
        type:            el.type,
        selector:        el.selector,
        label:           el.label,
        testabilityScore: el.testabilityScore,
        kind:            isAmbiguous ? 'ambiguous' : 'low-score',
        ambiguityReason: el.ambiguityReason,
        suggestedTestId: suggestTestId(el, i),
        _filePath:       r.component.filePath,
      });
    });
  }
  // Second pass: dedupe suggestedTestId per file so siblings don't collide.
  const used = new Map<string, Map<string, number>>();
  for (const issue of raw) {
    if (!used.has(issue._filePath)) used.set(issue._filePath, new Map());
    const m = used.get(issue._filePath)!;
    const n = (m.get(issue.suggestedTestId) ?? 0) + 1;
    m.set(issue.suggestedTestId, n);
    if (n > 1) issue.suggestedTestId = `${issue.suggestedTestId}-${n}`;
  }
  return raw.map(({ _filePath, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const TOOLS = [
  // ── Discovery tools (Phase 6) ─────────────────────────────────────────────
  {
    name: 'selfcure_discover_project',
    description:
      'Run static project discovery: detect framework, package manager, dev scripts, and route ' +
      'candidates from source files — no running app required. Returns a compact ProjectMap. ' +
      'Call this first when a user asks "what routes does this app have?" or "what framework is ' +
      'this project using?". Larger artifacts (DOM snapshots, screenshots) are written to ' +
      '.selfcure/ and referenced by path.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string', description: 'Root directory to analyse. Defaults to cwd.' },
        outDir:      { type: 'string', description: 'Where to write project-map.json. Defaults to .selfcure.' },
      },
    },
  },
  {
    name: 'selfcure_get_project_map',
    description:
      'Read the project-map.json artifact produced by a previous `selfcure discover` run. ' +
      'Cheaper than re-running discovery when the map is already fresh. ' +
      'Returns framework, package manager, scripts, route candidates, and component count.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactDir: { type: 'string', description: 'Path to the .selfcure artifact directory. Defaults to .selfcure.' },
      },
    },
  },
  {
    name: 'selfcure_get_testability_report',
    description:
      'Read the testability-report.json produced by `selfcure discover --runtime`. ' +
      'Returns per-route testability scores, flagged interactive elements, and an overall score. ' +
      'Use this to answer "which routes are hard to test?" or to feed into a test-generation plan.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactDir: { type: 'string', description: 'Path to the .selfcure artifact directory. Defaults to .selfcure.' },
      },
    },
  },
  {
    name: 'selfcure_get_discovery_artifacts',
    description:
      'List all discovery artifacts in the .selfcure/ directory with their sizes and modification ' +
      'times. Use this to check which discovery phases have run and whether the data is fresh.',
    inputSchema: {
      type: 'object',
      properties: {
        artifactDir: { type: 'string', description: 'Path to the artifact directory. Defaults to .selfcure.' },
      },
    },
  },
  // ── TML tools (Phase 6) ───────────────────────────────────────────────────
  {
    name: 'selfcure_get_tml_summary',
    description:
      'Return a TML distribution summary for the project: how many elements are at each maturity ' +
      'level (0–4), total element count, violations below the minimum level, and overall pass rate. ' +
      'Use this for a quick governance snapshot before drilling into specifics.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath:    { type: 'string', description: 'Path to selfcure.config.mjs.' },
        minimumLevel:  { type: 'number', description: 'Minimum acceptable TML level (default: 2).' },
        inventoryPath: { type: 'string', description: 'Path to testid-inventory.json for governance signals.' },
      },
    },
  },
  {
    name: 'selfcure_list_low_maturity_tags',
    description:
      'List interactive elements that fall below a specified TML level. Each entry includes the ' +
      'file, element type, selector, testability score, current TML level, and the top required ' +
      'change. Use this to feed a PR-generation or patch-suggestion workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath:    { type: 'string' },
        belowLevel:    { type: 'number', description: 'Return elements with TML < this value (default: 2).' },
        inventoryPath: { type: 'string' },
        limit:         { type: 'number', description: 'Max results to return (default: 50).' },
      },
    },
  },
  {
    name: 'selfcure_explain_tag_maturity',
    description:
      'Explain why a specific element received its TML level: list all reasons (with severity) ' +
      'and all required changes (with priority and patch availability). Use this when an agent ' +
      'needs to explain a TML finding to the user or plan a targeted fix.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath:    { type: 'string' },
        filePath:      { type: 'string', description: 'Source file containing the element.' },
        elementIndex:  { type: 'number', description: 'Zero-based index of the element in the component.' },
        inventoryPath: { type: 'string' },
      },
      required: ['filePath', 'elementIndex'],
    },
  },
  {
    name: 'selfcure_suggest_tml_fixes',
    description:
      'Return actionable patch suggestions for elements below a minimum TML level. Only includes ' +
      'patchable changes (add-testid, rename-testid, dedupe-testid). Non-patchable items (DOM ' +
      'restructuring, business logic) are excluded. Output is ready to feed a PR-generation agent.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath:    { type: 'string' },
        minimumLevel:  { type: 'number', description: 'Target minimum TML (default: 3).' },
        inventoryPath: { type: 'string' },
      },
    },
  },
  // ── Testability tools (existing) ──────────────────────────────────────────
  {
    name: 'selfcure_lint',
    description:
      "Run selfcure's testability linter on the target project. Returns interactive elements " +
      'flagged as `low-score` (no stable selector) or `ambiguous` (best selector matches multiple ' +
      'siblings). Each issue carries a suggested `data-testid`. Use this before delegating to a ' +
      'test-generation agent so the agent skips or prioritises components that are not yet testable.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath: { type: 'string', description: 'Relative path to selfcure.config.mjs (defaults to ./selfcure.config.mjs).' },
        threshold:  { type: 'number', description: 'Score below which elements are flagged. Default: 65.' },
      },
    },
  },
  {
    name: 'selfcure_list_components',
    description:
      'List every component the crawler discovered with aggregate scores. Use this for a quick ' +
      'overview before drilling into specific files. Cheap — does not return AST or per-element ' +
      'detail.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath: { type: 'string' },
      },
    },
  },
  {
    name: 'selfcure_analyze_component',
    description:
      'Return the full analysis for a single component file: every interactive element with its ' +
      'selectorRanking, ambiguity flag, label, actions, and testability score. Use this when an ' +
      'agent needs precise per-element data before generating tests or proposing FE changes.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath: { type: 'string' },
        filePath:   { type: 'string', description: 'Absolute or workspace-relative path to the component source file.' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'selfcure_suggest_testid',
    description:
      'Suggest a kebab-cased `data-testid` value for a single element. Uses the same heuristic as ' +
      '`selfcure lint --fix`: label → id → name → aria-label → `<type>-<index>` fallback. The ' +
      'suggestion is dedup-aware across all elements in the same file.',
    inputSchema: {
      type: 'object',
      properties: {
        configPath:     { type: 'string' },
        filePath:       { type: 'string', description: 'Component file to inspect.' },
        elementIndex:   { type: 'number', description: 'Zero-based index of the interactive element within the component.' },
      },
      required: ['filePath', 'elementIndex'],
    },
  },
];

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

const RESOURCES = [
  {
    uri: 'selfcure://config',
    name: 'selfcure config',
    description: 'The resolved selfcure.config.mjs from the current working directory.',
    mimeType: 'application/json',
  },
  {
    uri: 'selfcure://lint-summary',
    name: 'lint summary',
    description: 'Aggregate testability snapshot: total components, average score, issue breakdown (ambiguous vs low-score).',
    mimeType: 'application/json',
  },
  {
    uri: 'selfcure://reports/latest',
    name: 'latest report',
    description: 'Placeholder for the last @selfcure/reporter run summary. Not implemented yet — returns {status:"not-implemented"}.',
    mimeType: 'application/json',
  },
];

// ---------------------------------------------------------------------------
// Prompts (1-click templates surfaced to the end user by the MCP client)
// ---------------------------------------------------------------------------

const PROMPTS = [
  {
    name: 'selfcure_prepare_for_testing',
    description: 'Survey the repo with selfcure and propose the first 3-5 frontend fixes that would unblock test generation.',
  },
  {
    name: 'selfcure_handoff_to_playwright_agents',
    description: 'Use selfcure to filter testable components, then hand off to Playwright Test Agents (Planner → Generator → Healer) on that subset.',
  },
  {
    name: 'selfcure_discover_and_test',
    description: 'Full agentic workflow: discover the project structure, understand routes and hidden states, then generate a testability improvement plan.',
  },
];

function discoverAndTestPrompt(): string {
  return [
    'You are an AI agent with access to the selfcure MCP tools. Perform the full agentic discovery workflow:',
    '',
    '1. **Discover the project** — call `selfcure_discover_project` to detect framework, package manager, and route candidates.',
    '2. **Check for existing artifacts** — call `selfcure_get_discovery_artifacts` to see what data is already available.',
    '3. **Understand the routes** — call `selfcure_get_project_map` and summarise the discovered routes for the user.',
    '4. **Check testability** — if testability-report.json exists, call `selfcure_get_testability_report` and identify the routes with score < 60.',
    '5. **Lint static components** — call `selfcure_lint` to find low-score or ambiguous selectors that would break tests.',
    '6. **Produce a plan** — generate a prioritised list:',
    '   a. Routes ready for testing (high score, reachable).',
    '   b. Routes needing FE fixes first (low score — suggest data-testid patches).',
    '   c. Routes needing authentication hints (auth-required status).',
    '',
    'Self-cure owns the preventive layer. Playwright Test Agents run after these fixes are applied.',
    'If the user has Playwright MCP available, hand off the ready routes using `selfcure_handoff_to_playwright_agents`.',
  ].join('\n');
}

function prepareForTestingPrompt(): string {
  return [
    'You have access to the `selfcure_*` MCP tools. Perform the following steps:',
    '',
    '1. Call `selfcure_lint` with the default threshold to enumerate every component flagged as low-score or ambiguous.',
    '2. Group the issues by file and pick the 3-5 files that are blocking the most test surface area (most interactive elements flagged, or the most-ambiguous ones).',
    '3. For each chosen file, propose a *minimal* frontend change (typically: add the suggested `data-testid` produced by selfcure). Format each suggestion as a unified diff snippet so the user can apply it directly.',
    '4. End with a one-line recommendation: "After applying these patches, the project is ready for Playwright Test Agents (`npx playwright init-agents`)."',
  ].join('\n');
}

function handoffToPlaywrightPrompt(): string {
  return [
    'Selfcure handles testability *prevention*, Playwright Test Agents handle test *generation* and *healing*. Use them in sequence:',
    '',
    '1. Call `selfcure_lint` and identify the components with `testabilityScore >= 65` and no `ambiguous` flag — these are ready for test generation.',
    '2. Pass that filtered file list to the Playwright Planner agent (`npx playwright init-agents` if not yet installed, then invoke the Planner) so it focuses only on the testable surface.',
    '3. After the Planner produces a Markdown plan, run the Generator agent to produce `.spec.ts` files.',
    '4. Run the test suite; the Healer agent will repair any locator drift.',
    '5. Re-run `selfcure_lint` afterwards to confirm no new ambiguities were introduced by the generated tests.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Server wiring
// ---------------------------------------------------------------------------

const server = new Server(
  { name: 'selfcure-mcp', version: '0.1.0' },
  {
    capabilities: {
      tools:     {},
      resources: {},
      prompts:   {},
    },
  },
);

const CWD = process.cwd();

// ── Tools ──────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: rawArgs } = req.params;
  const args = (rawArgs ?? {}) as Record<string, unknown>;

  try {
    switch (name) {
      // ── Discovery handlers ────────────────────────────────────────────────

      case 'selfcure_discover_project': {
        const root    = typeof args['projectRoot'] === 'string' ? path.resolve(CWD, args['projectRoot']) : CWD;
        const outDir  = typeof args['outDir']      === 'string' ? path.resolve(CWD, args['outDir'])      : path.join(CWD, '.selfcure');
        const { promises: fsp } = await import('node:fs');
        const map = await discoverProject({ projectRoot: root });
        await fsp.mkdir(outDir, { recursive: true });
        await fsp.writeFile(path.join(outDir, 'project-map.json'), JSON.stringify(map, null, 2), 'utf-8');
        // Return compact summary (omit full componentCandidates list to save tokens)
        const compact = {
          framework:       map.framework,
          packageManager:  map.packageManager,
          devCommand:      map.devCommand,
          buildCommand:    map.buildCommand,
          routeCount:      map.routeCandidates.length,
          componentCount:  map.componentCandidates.length,
          routeCandidates: map.routeCandidates,
          artifactPath:    path.join(outDir, 'project-map.json'),
          generatedAt:     map.generatedAt,
        };
        return { content: [{ type: 'text', text: JSON.stringify(compact, null, 2) }] };
      }

      case 'selfcure_get_project_map': {
        const dir  = typeof args['artifactDir'] === 'string' ? path.resolve(CWD, args['artifactDir']) : path.join(CWD, '.selfcure');
        const file = path.join(dir, 'project-map.json');
        if (!fs.existsSync(file)) {
          throw new McpError(ErrorCode.InvalidRequest, `project-map.json not found at ${file}. Run selfcure_discover_project first.`);
        }
        const map = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        return { content: [{ type: 'text', text: JSON.stringify(map, null, 2) }] };
      }

      case 'selfcure_get_testability_report': {
        const dir  = typeof args['artifactDir'] === 'string' ? path.resolve(CWD, args['artifactDir']) : path.join(CWD, '.selfcure');
        const file = path.join(dir, 'testability-report.json');
        if (!fs.existsSync(file)) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `testability-report.json not found at ${file}. Run: selfcure discover --runtime --base-url <url>`,
          );
        }
        const report = JSON.parse(fs.readFileSync(file, 'utf-8')) as Record<string, unknown>;
        return { content: [{ type: 'text', text: JSON.stringify(report, null, 2) }] };
      }

      case 'selfcure_get_discovery_artifacts': {
        const dir = typeof args['artifactDir'] === 'string' ? path.resolve(CWD, args['artifactDir']) : path.join(CWD, '.selfcure');
        if (!fs.existsSync(dir)) {
          return { content: [{ type: 'text', text: JSON.stringify({ dir, exists: false, files: [] }, null, 2) }] };
        }
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files = entries
          .filter((e) => e.isFile())
          .map((e) => {
            const fp   = path.join(dir, e.name);
            const stat = fs.statSync(fp);
            return { name: e.name, sizeBytes: stat.size, modifiedAt: stat.mtime.toISOString() };
          })
          .sort((a, b) => a.name.localeCompare(b.name));
        const subdirs = entries
          .filter((e) => e.isDirectory())
          .map((e) => {
            const dp   = path.join(dir, e.name);
            const cnt  = fs.readdirSync(dp).length;
            return { name: e.name + '/', fileCount: cnt };
          });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ dir, files, subdirectories: subdirs }, null, 2),
          }],
        };
      }

      // ── TML handlers ─────────────────────────────────────────────────────

      case 'selfcure_get_tml_summary': {
        const minLvl   = typeof args['minimumLevel']  === 'number' ? args['minimumLevel']  : 2;
        const cfgPath  = typeof args['configPath']    === 'string' ? args['configPath']    : undefined;
        const invPath  = typeof args['inventoryPath'] === 'string' ? args['inventoryPath'] : undefined;
        const results  = await runTmlAnalysis(CWD, cfgPath, invPath);
        const dist: Record<string, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
        let total = 0;
        for (const r of results) {
          for (const el of r.interactiveElements) {
            if (!el.tml) continue;
            dist[el.tml.level]++;
            total++;
          }
        }
        const violations = Object.entries(dist)
          .filter(([lvl]) => Number(lvl) < minLvl)
          .reduce((s, [, n]) => s + n, 0);
        const passRate = total > 0 ? Math.round(((total - violations) / total) * 100) : 100;
        const distWithLabels = Object.fromEntries(
          (Object.entries(dist) as Array<[string, number]>).map(([lvl, cnt]) => [
            `TML-${lvl} (${TML_LABELS[Number(lvl) as TagMaturityLevel]})`, cnt,
          ])
        );
        return { content: [{ type: 'text', text: JSON.stringify({ totalElements: total, violations, passRate, minimumLevel: minLvl, distribution: distWithLabels }, null, 2) }] };
      }

      case 'selfcure_list_low_maturity_tags': {
        const belowLvl = typeof args['belowLevel']    === 'number' ? args['belowLevel']    : 2;
        const limit    = typeof args['limit']         === 'number' ? args['limit']         : 50;
        const cfgPath  = typeof args['configPath']    === 'string' ? args['configPath']    : undefined;
        const invPath  = typeof args['inventoryPath'] === 'string' ? args['inventoryPath'] : undefined;
        const results  = await runTmlAnalysis(CWD, cfgPath, invPath);
        const items: unknown[] = [];
        for (const r of results) {
          for (const el of r.interactiveElements) {
            if (!el.tml || el.tml.level >= belowLvl || items.length >= limit) continue;
            items.push({
              filePath:      r.component.filePath,
              componentName: r.component.componentName,
              elementType:   el.type,
              selector:      el.selector,
              score:         el.testabilityScore,
              tmlLevel:      el.tml.level,
              tmlLabel:      el.tml.label,
              topChange:     el.tml.requiredChanges[0] ?? null,
            });
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: items.length, belowLevel: belowLvl, items }, null, 2) }] };
      }

      case 'selfcure_explain_tag_maturity': {
        const filePath     = String(args['filePath'] ?? '');
        const elementIndex = Number(args['elementIndex'] ?? -1);
        if (!filePath) throw new McpError(ErrorCode.InvalidParams, 'filePath is required');
        if (!Number.isInteger(elementIndex) || elementIndex < 0)
          throw new McpError(ErrorCode.InvalidParams, 'elementIndex must be a non-negative integer');
        const cfgPath  = typeof args['configPath']    === 'string' ? args['configPath']    : undefined;
        const invPath  = typeof args['inventoryPath'] === 'string' ? args['inventoryPath'] : undefined;
        const results  = await runTmlAnalysis(CWD, cfgPath, invPath);
        const target   = path.resolve(CWD, filePath);
        const found    = results.find((r) => path.resolve(r.component.filePath) === target);
        if (!found) throw new McpError(ErrorCode.InvalidRequest, `Component not found: ${filePath}`);
        const el = found.interactiveElements[elementIndex];
        if (!el) throw new McpError(ErrorCode.InvalidRequest, `elementIndex ${elementIndex} out of range`);
        if (!el.tml) throw new McpError(ErrorCode.InternalError, 'TML not computed for this element');
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              filePath, elementIndex,
              elementType:   el.type,
              selector:      el.selector,
              score:         el.testabilityScore,
              tml: {
                level:           el.tml.level,
                label:           el.tml.label,
                confidence:      el.tml.confidence,
                reasons:         el.tml.reasons,
                requiredChanges: el.tml.requiredChanges,
              },
            }, null, 2),
          }],
        };
      }

      case 'selfcure_suggest_tml_fixes': {
        const minLvl  = typeof args['minimumLevel']  === 'number' ? args['minimumLevel']  : 3;
        const cfgPath = typeof args['configPath']    === 'string' ? args['configPath']    : undefined;
        const invPath = typeof args['inventoryPath'] === 'string' ? args['inventoryPath'] : undefined;
        const results = await runTmlAnalysis(CWD, cfgPath, invPath);
        const PATCHABLE = new Set(['add-testid', 'rename-testid', 'dedupe-testid']);
        const patches: unknown[] = [];
        for (const r of results) {
          r.interactiveElements.forEach((el, idx) => {
            if (!el.tml || el.tml.level >= minLvl) return;
            const patchableChanges = el.tml.requiredChanges.filter((c) => PATCHABLE.has(c.type) && c.patchAvailable);
            if (patchableChanges.length === 0) return;
            patches.push({
              filePath:        r.component.filePath,
              componentName:   r.component.componentName,
              elementIndex:    idx,
              elementType:     el.type,
              selector:        el.selector,
              currentTml:      el.tml.level,
              targetTml:       Math.min(minLvl, 3),
              patchableChanges,
            });
          });
        }
        return { content: [{ type: 'text', text: JSON.stringify({ count: patches.length, minimumLevel: minLvl, patches }, null, 2) }] };
      }

      // ── Testability handlers (existing) ───────────────────────────────────

      case 'selfcure_lint': {
        const threshold  = typeof args['threshold']  === 'number' ? args['threshold']  : 65;
        const configPath = typeof args['configPath'] === 'string' ? args['configPath'] : undefined;
        const { config, results } = await runFullAnalysis(CWD, configPath);
        const issues = collectIssues(results, threshold);
        const payload = {
          rootDir:    config.rootDir,
          threshold,
          totalFiles: results.length,
          issues,
        };
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
      }

      case 'selfcure_list_components': {
        const configPath = typeof args['configPath'] === 'string' ? args['configPath'] : undefined;
        const { results } = await runFullAnalysis(CWD, configPath);
        const components = results.map((r) => ({
          filePath:           r.component.filePath,
          componentName:      r.component.componentName,
          framework:          r.component.framework,
          score:              r.score,
          complexity:         r.complexity,
          interactiveCount:   r.interactiveElements.length,
          ambiguousCount:     r.interactiveElements.filter((e) => e.ambiguous).length,
        }));
        return { content: [{ type: 'text', text: JSON.stringify({ count: components.length, components }, null, 2) }] };
      }

      case 'selfcure_analyze_component': {
        const filePath = String(args['filePath'] ?? '');
        if (!filePath) throw new McpError(ErrorCode.InvalidParams, 'filePath is required');
        const configPath = typeof args['configPath'] === 'string' ? args['configPath'] : undefined;
        const { results } = await runFullAnalysis(CWD, configPath);
        const target = path.resolve(CWD, filePath);
        const found  = results.find((r) => path.resolve(r.component.filePath) === target);
        if (!found) {
          throw new McpError(ErrorCode.InvalidRequest, `Component not found in crawl results: ${filePath}`);
        }
        // Strip the raw AST — too noisy for an agent context window.
        const payload = {
          filePath:            found.component.filePath,
          componentName:       found.component.componentName,
          framework:           found.component.framework,
          props:               found.component.props,
          score:               found.score,
          complexity:          found.complexity,
          interactiveElements: found.interactiveElements,
        };
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
      }

      case 'selfcure_suggest_testid': {
        const filePath = String(args['filePath'] ?? '');
        const elementIndex = Number(args['elementIndex'] ?? -1);
        if (!filePath) throw new McpError(ErrorCode.InvalidParams, 'filePath is required');
        if (!Number.isInteger(elementIndex) || elementIndex < 0) {
          throw new McpError(ErrorCode.InvalidParams, 'elementIndex must be a non-negative integer');
        }
        const configPath = typeof args['configPath'] === 'string' ? args['configPath'] : undefined;
        const { results } = await runFullAnalysis(CWD, configPath);
        const target = path.resolve(CWD, filePath);
        const found  = results.find((r) => path.resolve(r.component.filePath) === target);
        if (!found) throw new McpError(ErrorCode.InvalidRequest, `Component not found: ${filePath}`);
        const el = found.interactiveElements[elementIndex];
        if (!el) throw new McpError(ErrorCode.InvalidRequest, `elementIndex ${elementIndex} out of range`);

        // Dedup-aware: replay the same dedup logic across the whole file so the
        // returned suggestion matches what `selfcure lint --fix` would write.
        const file = results.find((r) => path.resolve(r.component.filePath) === target)!;
        const used = new Map<string, number>();
        let answer = '';
        file.interactiveElements.forEach((cur, i) => {
          const base = suggestTestId(cur, i);
          const n = (used.get(base) ?? 0) + 1;
          used.set(base, n);
          const final = n > 1 ? `${base}-${n}` : base;
          if (i === elementIndex) answer = final;
        });
        return { content: [{ type: 'text', text: JSON.stringify({ filePath, elementIndex, suggestedTestId: answer }, null, 2) }] };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof McpError) throw err;
    throw new McpError(ErrorCode.InternalError, err instanceof Error ? err.message : String(err));
  }
});

// ── Resources ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: RESOURCES }));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const { uri } = req.params;

  if (uri === 'selfcure://config') {
    const { config, absPath } = await loadConfig(CWD);
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ absPath, config }, null, 2),
      }],
    };
  }

  if (uri === 'selfcure://lint-summary') {
    const { results } = await runFullAnalysis(CWD);
    const issues = collectIssues(results, 65);
    const ambiguous = issues.filter((i) => i.kind === 'ambiguous').length;
    const lowScore  = issues.length - ambiguous;
    const avgScore  = results.length === 0
      ? 0
      : Math.round(results.reduce((s, r) => s + r.score, 0) / results.length);
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({
          totalComponents: results.length,
          averageScore:    avgScore,
          issuesByKind:    { ambiguous, lowScore },
          totalIssues:     issues.length,
        }, null, 2),
      }],
    };
  }

  if (uri === 'selfcure://reports/latest') {
    return {
      contents: [{
        uri,
        mimeType: 'application/json',
        text: JSON.stringify({ status: 'not-implemented', note: 'Reserved for future @selfcure/reporter integration.' }, null, 2),
      }],
    };
  }

  throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
});

// ── Prompts ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const { name } = req.params;
  switch (name) {
    case 'selfcure_prepare_for_testing':
      return {
        messages: [{ role: 'user', content: { type: 'text', text: prepareForTestingPrompt() } }],
      };
    case 'selfcure_handoff_to_playwright_agents':
      return {
        messages: [{ role: 'user', content: { type: 'text', text: handoffToPlaywrightPrompt() } }],
      };
    case 'selfcure_discover_and_test':
      return {
        messages: [{ role: 'user', content: { type: 'text', text: discoverAndTestPrompt() } }],
      };
    default:
      throw new McpError(ErrorCode.InvalidRequest, `Unknown prompt: ${name}`);
  }
});

// ---------------------------------------------------------------------------
// Boot — stdio transport (the universal MCP transport — works with every
// known MCP client). Errors during connect are non-recoverable.
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
await server.connect(transport);
