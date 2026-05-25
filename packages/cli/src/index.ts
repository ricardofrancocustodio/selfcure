#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

// ---------------------------------------------------------------------------
// Public configuration types (re-exported so selfcure.config.js can use
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

/** Full selfcure configuration — used in selfcure.config.js */
export interface SelfcureConfig {
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

  // Test generation
  testsDir: string;
  generationModel?: string;
  maxInputTokens?: number;

  // Test execution
  playwrightConfig: string;
  baseURL: string;

  // Self-healing
  healingModel?: string;
  maxHealAttempts?: number;

  // Reporting
  reportDir: string;
  reportTitle?: string;
}

const program = new Command();

program
  .name('selfcure')
  .description('AI-powered self-healing Playwright test CLI')
  .version('0.1.0');

program
  .command('init')
  .description('Scaffold selfcure.config.js in the current project')
  .action(async () => {
    const spinner = ora('Initialising selfcure…').start();
    try {
      // TODO: copy selfcure.config.js template into cwd
      spinner.succeed(chalk.green('selfcure.config.js created'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('crawl')
  .description('Crawl source files and extract component metadata')
  .option('-c, --config <path>', 'path to selfcure.config.js', './selfcure.config.js')
  .action(async (_opts) => {
    const spinner = ora('Crawling source files…').start();
    try {
      // TODO: load config, call @selfcure/crawler, print summary
      spinner.succeed(chalk.green('Crawl complete'));
    } catch (err) {
      spinner.fail(chalk.red(String(err)));
      process.exit(1);
    }
  });

program
  .command('run')
  .description('Generate tests, run them, and self-heal failures automatically')
  .option('-c, --config <path>', 'path to selfcure.config.js', './selfcure.config.js')
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
  .option('-c, --config <path>', 'path to selfcure.config.js', './selfcure.config.js')
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
  .option('-c, --config <path>', 'path to selfcure.config.js', './selfcure.config.js')
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

program.parse();
