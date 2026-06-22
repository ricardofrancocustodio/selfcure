# @selfcure/mcp

> Model Context Protocol server that publishes **selfcure**'s testability analysis to any MCP client.

Exposes selfcure's crawler + analyzer findings (component scores, ambiguous locators, suggested `data-testid` patches) over MCP, so an AI agent in Claude Desktop, Cursor, VS Code + GitHub Copilot, Claude Code, or Windsurf can read what the static frontend source makes — or doesn't make — testable.

This is the **preventive** companion to the Playwright Test Agents (Planner / Generator / Healer): it surfaces what those runtime agents can't see — the static source, the testability score, and the ambiguity between sibling elements.

## Install

```bash
npm install -g @selfcure/mcp
# or run on demand:
npx @selfcure/mcp
```

## Use as an MCP server

Add to your MCP client config (example for a generic `mcp.json`):

```json
{
  "servers": {
    "selfcure": { "command": "npx", "args": ["-y", "@selfcure/mcp"] }
  }
}
```

Then ask your agent which components are blocking test generation, where selectors are ambiguous, and which `data-testid`s to add.

## Docs

Full documentation: https://github.com/ricardofrancocustodio/selfcure#readme
