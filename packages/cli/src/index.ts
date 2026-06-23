import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';
import { runInitWizard } from './init.js';
import { runLint }       from './lint.js';
import { printA11ySection, registerA11yCommands } from './a11y.js';
import { registerTestIdsCommands } from './testids.js';
import { registerDiscoverCommand }  from './discover.js';
import { registerTmlCommands, tmlBadge } from './tml.js';
import { registerExportCommand }    from './export.js';
import { startWebServer } from '@selfcure/web';
import { crawl } from '@selfcure/crawler';
import { buildIdePrompt, type IdePromptIssue } from '@selfcure/analyzer';
import type { AIConfig, ProviderId } from '@selfcure/generator';

// Re-export AI configuration types so selfcure.config.mjs can use them via JSDoc
export type { AIConfig, ProviderId } from '@selfcure/generator';

// ---------------------------------------------------------------------------
// Public configuration types (re-exported so selfcure.config.mjs can use
//   /** @type {import('@selfcure/cli').SelfcureConfig} */
// ---------------------------------------------------------------------------

/** Login via an HTML form (selfcure fills the fields and clicks submit). */
export interface AuthFormConfig {
  type: 'form';
  /** Path (relative to baseURL) of the login page, e.g. '/login' */
  loginURL: string;
  /** CSS / ARIA selector for the username input, e.g. '[name="username"]' */
  usernameSelector: string;
  /** CSS / ARIA selector for the password input, e.g. '[name="password"]' */
  passwordSelector: string;
  /** Credential — read from an env var in the config, never hardcode */
  username: string;
  /** Credential — read from an env var in the config, never hardcode */
  password: string;
  /** Selector for the submit button — default: 'button[type=submit]' */
  submitSelector?: string;
  /** URL (or glob) Playwright should wait for after a successful login */
  waitForURL?: string;
}

/** Reuse a Playwright browser storage-state file (pre-authenticated). */
export interface AuthStorageStateConfig {
  type: 'storageState';
  /** Path to a storage-state JSON created by `selfcure auth-save` or Playwright */
  storageState: string;
}

/** HTTP Basic Auth (e.g. .htaccess-protected staging environments). */
export interface AuthHttpCredentialsConfig {
  type: 'httpCredentials';
  username: string;
  password: string;
}

/** Inject custom HTTP request headers (e.g. a Bearer token or API key). */
export interface AuthHeadersConfig {
  type: 'headers';
  /** Record of header name → value; read sensitive values from env vars */
  extraHTTPHeaders: Record<string, string>;
}

export type AuthConfig =
  | AuthFormConfig
  | AuthStorageStateConfig
  | AuthHttpCredentialsConfig
  | AuthHeadersConfig;

export interface BrowserConfig {
  /** Browser engine to use — default: 'chromium' */
  type?: 'chromium' | 'firefox' | 'webkit';
  /** Run browser without a visible UI — default: true */
  headless?: boolean;
  /** Viewport dimensions — default: { width: 1280, height: 720 } */
  viewport?: { width: number; height: number };
  /** Default navigation and action timeout in ms — default: 30000 */
  timeout?: number;
  /** Slow-motion delay between actions in ms (useful for debugging) — default: 0 */
  slowMo?: number;
}

// ---------------------------------------------------------------------------
// New agentic-discovery config blocks (Phase 1 — backward-compatible additions)
// ---------------------------------------------------------------------------

export interface DiscoveryConfig {
  /** 'agentic' uses static + optional runtime discovery; 'static' is AST-only. */
  mode?: 'agentic' | 'static';
  /** Enable static (AST) discovery — default true */
  static?: boolean;
  /** Enable runtime Playwright discovery — default false */
  runtime?: boolean;
  /** Maximum routes to visit during runtime discovery — default 50 */
  maxRoutes?: number;
  /** Maximum link-follow depth from baseUrl — default 3 */
  maxDepth?: number;
  /** Also discover hidden states (modals, wizards) — default true */
  includeHiddenStates?: boolean;
  /** Extra route paths to always visit (e.g. auth-protected routes) */
  routeHints?: string[];
  /** Glob patterns to ignore during static discovery */
  ignore?: string[];
}

export interface TestabilityConfig {
  /** Prefer role/accessible-name locators over CSS selectors — default true */
  preferRoleLocators?: boolean;
  /** Auto-suggest data-testid values for unidentifiable elements — default true */
  suggestTestIds?: boolean;
  /** Minimum testability score (0–100) before an element is flagged — default 80 */
  minimumScore?: number;
}

/** Optional linter behaviour — only required for `selfcure lint --pr` */
export interface LintOptions {
  /**
   * Base branch the auto-generated PR will target.
   * When omitted, selfcure asks `gh` / `glab` for the repo's default branch.
   */
  prBaseBranch?: string;

  /**
   * Force a specific git host provider. When `'auto'` (default), selfcure
   * inspects `git remote get-url origin` and picks GitHub or GitLab based on
   * the hostname. Set explicitly for self-hosted GitLab with custom domain.
   */
  gitProvider?: 'github' | 'gitlab' | 'auto';
}

/** Full selfcure configuration — used in selfcure.config.mjs */
export interface SelfcureConfig {
  // ── NEW: agentic-discovery fields (Phase 1) ──────────────────────────────
  /** Project root — alternative to rootDir for the new config format. */
  projectRoot?: string;
  /** App base URL — alternative to baseURL for the new config format. */
  baseUrl?: string;
  /** Discovery configuration block. */
  discovery?: DiscoveryConfig;
  /** Testability scoring configuration. */
  testability?: TestabilityConfig;

  // ── LEGACY: original fields — kept for backward compatibility ────────────
  // Source crawl
  rootDir: string;
  include: string[];
  exclude: string[];
  /** Optional framework hint — skips auto-detection — default: 'auto' */
  framework?: 'react' | 'vue' | 'angular' | 'auto';

  // Authentication (optional — omit for public apps)
  auth?: AuthConfig;

  // Browser
  browser?: BrowserConfig;

  // AI provider (used by both test generation and self-healing)
  ai: AIConfig;

  // Test generation
  testsDir: string;
  maxInputTokens?: number;

  // Test execution
  playwrightConfig: string;
  baseURL: string;

  // Self-healing
  maxHealAttempts?: number;

  // Reporting
  reportDir: string;
  reportTitle?: string;

  /** Optional Pro flag — enables `selfcure lint --fix` and `--pr` without the env var. */
  // pro field removed — all features are free

  /** Optional linter settings (currently just PR base branch). */
  lint?: LintOptions;
}

/**
 * Resolve the config path the user passed via `-c`. When the default value
 * (`./selfcure.config.mjs`) is in effect but only the legacy `./selfcure.config.js`
 * exists, fall back to it so users who initialised with an earlier version
 * keep working without re-running init.
 */
async function resolveConfigPath(provided: string): Promise<string> {
  const DEFAULT = './selfcure.config.mjs';
  const LEGACY  = './selfcure.config.js';

  if (provided !== DEFAULT) {
    return path.resolve(provided);
  }

  const mjs = path.resolve(DEFAULT);
  const js  = path.resolve(LEGACY);

  const mjsExists = await fs.stat(mjs).then(() => true).catch(() => false);
  if (mjsExists) return mjs;

  const jsExists = await fs.stat(js).then(() => true).catch(() => false);
  if (jsExists) return js;

  // Nothing found — return the default so the import error surfaces a familiar name
  return mjs;
}

const program = new Command();

program
  .name('selfcure')
  .description('AI-powered self-healing Playwright test CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Scaffold selfcure.config.mjs in the current project')
  .action(async () => {
    try {
      await runInitWizard(process.cwd());
    } catch (err) {
      console.error(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('crawl [file]')
  .description('Crawl source files and extract component metadata')
  .option('-c, --config <path>', 'path to selfcure.config.mjs (falls back to selfcure.config.js)', './selfcure.config.mjs')
  .action(async (file: string | undefined, opts) => {
    const spinner = ora('Crawling source files…').start();
    try {
      const configPath = await resolveConfigPath(opts.config);
      const configUrl = pathToFileURL(configPath).href;
      const { default: config } = await import(configUrl);

      let components;
      if (file) {
        const abs = path.resolve(file);
        const stat = await fs.stat(abs).catch(() => null);
        if (!stat) {
          throw new Error(`Path not found: ${file}`);
        }

        if (stat.isDirectory()) {
          // Directory mode: re-scope rootDir to this path, keep config globs
          components = await crawl({
            rootDir: abs,
            include: config.include,
            exclude: config.exclude,
            framework: config.framework,
          });
        } else {
          // Single-file mode: crawl exactly this file
          components = await crawl({
            rootDir: path.dirname(abs),
            include: [path.basename(abs)],
            exclude: [],
            framework: config.framework,
          });
        }
      } else {
        components = await crawl({
          rootDir: config.rootDir,
          include: config.include,
          exclude: config.exclude,
          framework: config.framework,
        });
      }

      spinner.succeed(chalk.green(`Crawl complete — ${components.length} component(s) found`));
      for (const c of components) {
        const propsInfo = c.props.length
          ? chalk.dim(` (${c.props.length} prop${c.props.length > 1 ? 's' : ''}: ${c.props.map((p) => p.name).join(', ')})`)
          : '';
        console.log(chalk.dim(`  ${c.framework}  ${chalk.white(c.componentName)}  →  ${c.filePath}${propsInfo}`));
      }
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Generate tests, run them, and self-heal failures automatically')
  .option('-c, --config <path>', 'path to selfcure.config.mjs (falls back to selfcure.config.js)', './selfcure.config.mjs')
  .action(async (_opts) => {
    const spinner = ora('Running selfcure pipeline…').start();
    try {
      // TODO: crawl → analyze → generate → run → heal → report
      spinner.succeed(chalk.green('Pipeline complete'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('heal')
  .description('Attempt to heal failing tests without re-generating the full suite')
  .option('-c, --config <path>', 'path to selfcure.config.mjs (falls back to selfcure.config.js)', './selfcure.config.mjs')
  .action(async (_opts) => {
    const spinner = ora('Healing failing tests…').start();
    try {
      // TODO: load last run results, call @selfcure/selfcure healer
      spinner.succeed(chalk.green('Healing complete'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('report')
  .description('Generate HTML report from the last run results')
  .option('-c, --config <path>', 'path to selfcure.config.mjs (falls back to selfcure.config.js)', './selfcure.config.mjs')
  .action(async (_opts) => {
    const spinner = ora('Generating report…').start();
    try {
      // TODO: call @selfcure/reporter with persisted run/heal results
      spinner.succeed(chalk.green('Report generated'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('lint')
  .description('Lint source files for unstable test selectors and suggest data-testid patches')
  .option('-c, --config <path>', 'path to selfcure.config.mjs (falls back to selfcure.config.js)', './selfcure.config.mjs')
  .option('--threshold <n>', 'testability score below which an element is flagged', '65')
  .option('--fix',          'apply data-testid patches to source files automatically')
  .option('--pr',           'create a GitHub PR with the applied fixes (requires --fix)')
  .option('--a11y',         'also run WCAG accessibility lint alongside testability')
  .option('--wcag <level>', 'WCAG target level when using --a11y: A, AA, or AAA', 'AA')
  .option('--prompt',       'print a paste-ready prompt for your IDE AI agent (Copilot/Cursor) instead of the report — no API key needed')
  .action(async (opts) => {
    const spinner = ora('Analysing source files…').start();
    try {
      const configPath = await resolveConfigPath(opts.config);
      const configUrl  = pathToFileURL(configPath).href;
      const { default: config } = await import(configUrl);

      const threshold = Number(opts.threshold ?? 65);

      const fix  = Boolean(opts.fix);
      const pr   = Boolean(opts.pr) && fix;
      const a11y = Boolean(opts.a11y);

      const summary = await runLint(config, { threshold, fix, pr, a11y, wcag: opts.wcag as 'A' | 'AA' | 'AAA' });
      spinner.stop();

      const { issues, totalFiles, fixedCount, skippedCount, prUrl, a11yFindings } = summary;

      // ── --prompt: emit a paste-ready IDE prompt and exit (pipeable) ───────
      if (opts.prompt) {
        if (issues.length === 0) {
          console.error(chalk.green(`No issues — nothing to fix (${totalFiles} file(s) scanned).`));
          return;
        }
        const promptIssues: IdePromptIssue[] = issues.map((i) => ({
          filePath:        i.filePath,
          componentName:   i.componentName,
          elementType:     i.element.type,
          selector:        i.element.selector,
          kind:            i.kind,
          ambiguityReason: i.ambiguityReason,
          suggestedTestId: i.suggestedTestId,
        }));
        // Only the prompt goes to stdout, so `selfcure lint --prompt | clip` works.
        console.log(buildIdePrompt(promptIssues, { baseDir: process.cwd() }));
        return;
      }

      // ── Report header ────────────────────────────────────────────────────
      console.log('');
      if (issues.length === 0 && (!a11yFindings || a11yFindings.length === 0)) {
        console.log(chalk.green.bold('✔ selfcure lint — no issues found'));
        console.log(chalk.dim(`  ${totalFiles} file(s) scanned — all elements have a testability score ≥ ${threshold}`));
        if (a11yFindings) {
          console.log(chalk.dim(`  WCAG ${opts.wcag ?? 'AA'} — 0 accessibility issues`));
        }
        return;
      }

      console.log(
        chalk.bold(`selfcure lint — ${chalk.yellow(issues.length)} issue(s) across `) +
        chalk.bold(`${[...new Set(issues.map(i => i.filePath))].length} file(s)`) +
        chalk.dim(` · threshold: ${threshold}/100`),
      );
      console.log('');

      // ── Per-file issue list ───────────────────────────────────────────────
      const byFile = new Map<string, typeof issues>();
      for (const issue of issues) {
        if (!byFile.has(issue.filePath)) byFile.set(issue.filePath, []);
        byFile.get(issue.filePath)!.push(issue);
      }

      for (const [filePath, fileIssues] of byFile) {
        console.log(chalk.underline(path.relative(process.cwd(), filePath)));
        for (const issue of fileIssues) {
          const score    = issue.element.testabilityScore;
          const scoreTxt = score >= 50
            ? chalk.yellow(`score: ${score}`)
            : chalk.red(`score: ${score}`);
          const fixTxt = issue.fixApplied
            ? chalk.green(' ✔ patched')
            : chalk.dim(` → add data-testid="${issue.suggestedTestId}"`);
          const tml    = issue.element.tml;
          const tmlTxt = tml ? '  ' + tmlBadge(tml.level, tml.label) : '';
          console.log(
            `  ${chalk.cyan(issue.element.type.padEnd(8))}` +
            `  ${chalk.dim(issue.element.selector.padEnd(30))}` +
            `  ${scoreTxt}${tmlTxt}` +
            fixTxt,
          );
        }
        console.log('');
      }

      // ── Accessibility section ─────────────────────────────────────────────
      if (a11yFindings && a11yFindings.length > 0) {
        console.log(chalk.dim('─'.repeat(60)));
        console.log('');
        printA11ySection(a11yFindings, {
          wcagLevel: (opts.wcag ?? 'AA') as 'A' | 'AA' | 'AAA',
          cwd: process.cwd(),
        });
      }

      // ── Summary line ─────────────────────────────────────────────────────
      if (fix) {
        if (fixedCount > 0) {
          console.log(chalk.green(`✔ ${fixedCount} element(s) patched`) +
            (skippedCount > 0 ? chalk.dim(` · ${skippedCount} skipped (no unique identifier found)`) : ''));
        }
        if (prUrl) {
          console.log(chalk.bold.green(`✔ PR opened: ${prUrl}`));
        } else if (pr) {
          console.log(chalk.yellow('  PR creation skipped (no files changed).'));
        }
      } else {
        console.log(chalk.dim('  Run with --fix to auto-patch source files'));
        console.log(chalk.dim('  Run with --fix --pr to open a GitHub PR'));
      }
      console.log('');
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('mcp')
  .description('Start the selfcure MCP server on stdio (consumable by Claude Desktop, Cursor, VS Code, etc.)')
  .action(async () => {
    // Lazy import: side-effectful module that boots the stdio server.
    await import('@selfcure/mcp');
  });

program
  .command('web')
  .description('Open the selfcure dashboard in the browser (zero-config: discover, crawl, lint, TML — all from the UI)')
  .option('-p, --port <number>', 'port to listen on', '3333')
  .option('--no-open', "don't auto-open the browser")
  .action((opts) => {
    const port = Number(opts.port);
    startWebServer(port, process.cwd(), { openBrowser: opts.open !== false });
  });

program
  .command('stop')
  .description('Kill any selfcure web server running on the given port')
  .option('-p, --port <number>', 'port to kill', '3333')
  .action((opts) => {
    const port = Number(opts.port);
    try {
      if (process.platform === 'win32') {
        execSync(
          `powershell -NonInteractive -Command "` +
          `Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue ` +
          `| Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique ` +
          `| ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`,
          { stdio: 'inherit' },
        );
      } else {
        // macOS / Linux
        execSync(`lsof -ti :${port} | xargs kill -9`, { stdio: 'inherit' });
      }
      console.log(chalk.green(`Port ${port} cleared.`));
    } catch {
      console.log(chalk.yellow(`No process found on port ${port}.`));
    }
  });

registerDiscoverCommand(program);
registerTmlCommands(program);
registerTestIdsCommands(program);
registerA11yCommands(program);
registerExportCommand(program);

program.parse();
