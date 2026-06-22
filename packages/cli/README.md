# @selfcure/cli

> Command-line entry point for **selfcure** — the preventive testability layer for frontend codebases.

selfcure scores every interactive element in your React / Vue / Angular / HTML source, flags ambiguous locators and missing stable identifiers, and opens a Pull Request with `data-testid` fixes — **before** Cypress, Playwright, Selenium, TestCafe, or WebdriverIO ever run.

## Install

```bash
npm install -g @selfcure/cli
```

## Usage

```bash
selfcure init       # scaffold selfcure.config.mjs in your project
selfcure crawl      # crawl source files and print component metadata
selfcure lint       # score testability + flag ambiguous locators + suggest data-testid
selfcure web        # browser UI with checkbox-driven PR flow (http://localhost:3333/lint)
selfcure mcp        # start the MCP stdio server for any AI client
```

Pro flags:

```bash
selfcure lint --fix          # apply patches to source
selfcure lint --fix --pr     # apply + branch + push + open a Pull Request
```

Legacy BYOK pipeline (fallback when not using Playwright Test Agents):

```bash
selfcure run        # crawl → generate → run → heal → report
selfcure heal       # re-attempt healing on the last failures
selfcure report     # re-generate the HTML report
```

All commands accept `-c <path>` to point at a custom config file.

## Docs

Full documentation: https://github.com/ricardofrancocustodio/selfcure#readme
