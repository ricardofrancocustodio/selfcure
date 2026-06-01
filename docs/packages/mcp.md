# `@selfcure/mcp`

Model Context Protocol server exposing selfcure's testability analysis (crawler + analyzer + lint) to any MCP client — Claude Desktop, Cursor, VS Code, Claude Code, Windsurf, or anything else that speaks [MCP](https://modelcontextprotocol.io).

This is the **commercial entry point** for selfcure: a discoverable, free, open-source MCP server that any AI client can install in one line. Once installed, the user's existing agent gains an opinionated view of which components in their FE codebase are ready to be tested — before any test-generation agent (e.g. Playwright Test Agents) goes to work.

## API

The server speaks MCP over stdio. There is no programmatic Node.js API — consume it like any other MCP server.

```bash
# Standalone (recommended — installable into any MCP client config):
npx @selfcure/mcp@latest

# Or via the selfcure CLI (same binary):
selfcure mcp
```

### Tools

| Tool | Inputs | Returns |
|------|--------|---------|
| `selfcure_lint` | `configPath?`, `threshold?` (default 65) | `{ rootDir, threshold, totalFiles, issues[] }` with per-issue `kind` (`ambiguous` / `low-score`) and dedup-aware `suggestedTestId` |
| `selfcure_list_components` | `configPath?` | `{ count, components[] }` — file path, name, framework, score, complexity, interactive count, ambiguous count |
| `selfcure_analyze_component` | `configPath?`, `filePath` | Full `InteractiveElement[]` for one component (selectorRanking, ambiguity flag, label, actions, score). Raw AST is stripped to keep context windows small. |
| `selfcure_suggest_testid` | `configPath?`, `filePath`, `elementIndex` | `{ filePath, elementIndex, suggestedTestId }` — matches what `selfcure lint --fix` would write |

### Resources

| URI | Content |
|-----|---------|
| `selfcure://config` | The resolved `selfcure.config.mjs` from the working directory |
| `selfcure://lint-summary` | Aggregate snapshot: `totalComponents`, `averageScore`, `issuesByKind` (ambiguous / lowScore), `totalIssues` |
| `selfcure://reports/latest` | Placeholder. Returns `{ status: 'not-implemented' }`. Reserved for future `@selfcure/reporter` integration. |

### Prompts

| Name | Use |
|------|-----|
| `selfcure_prepare_for_testing` | "Survey the repo with selfcure and propose the first 3-5 frontend fixes that would unblock test generation." |
| `selfcure_handoff_to_playwright_agents` | "Use selfcure to filter testable components, then hand off to Playwright Test Agents (Planner → Generator → Healer) on that subset." |

## Configuring an MCP client

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "selfcure": {
      "command": "npx",
      "args": ["@selfcure/mcp@latest"],
      "cwd": "/absolute/path/to/your/frontend/project"
    }
  }
}
```

The `cwd` is critical — the server reads `selfcure.config.mjs` from there.

### Cursor / VS Code (with MCP support) / Windsurf

Equivalent MCP server entry under whatever JSON config the client exposes.

### Claude Code

```bash
claude mcp add selfcure -- npx @selfcure/mcp@latest
```

## Design decisions

- **Stdio transport only**, no HTTP. Stdio is the universal MCP transport and works with every known client. HTTP/SSE can be added later if a use case appears.
- **Reuses `@selfcure/crawler` and `@selfcure/analyzer` directly** — zero logic duplication, same lint heuristic as the CLI/web flow.
- **No `selfcure_open_pr` tool in v1.** Opening a PR is an irreversible side effect; we want the user to retain that decision via the `selfcure web` UI or `selfcure lint --fix --pr`. The MCP server is for *information*, not actions.
- **`selfcure://reports/latest` stubbed**. Easy to fill in when `@selfcure/reporter` produces a JSON summary worth exposing.

## Runtime dependencies

| Package | Role |
|---------|------|
| `@modelcontextprotocol/sdk` | Official MCP server SDK from Anthropic |
| `@selfcure/crawler` | Source crawling (reused) |
| `@selfcure/analyzer` | Element classification + ambiguity detection (reused) |

## Source

`packages/mcp/src/index.ts`
