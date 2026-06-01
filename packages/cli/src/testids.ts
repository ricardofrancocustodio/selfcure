import type { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'node:path';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { extractTestIds } from '@selfcure/crawler';
import { loadInventory, audit } from '@selfcure/analyzer';
import type { AuditIssue } from '@selfcure/analyzer';

// Default globs used when the config does not specify a dedicated test directory.
const DEFAULT_SOURCE_GLOBS = ['**/*.{tsx,jsx,ts,js,vue,html}'];
const DEFAULT_TEST_GLOBS   = ['**/*.{spec,test}.{ts,js,tsx,jsx}', '**/*.e2e.{ts,js}'];
const DEFAULT_EXCLUDE       = ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.nuxt/**'];

interface ScanOpts {
  config: string;
  root: string;
  out: string;
}

interface AuditOpts {
  config: string;
  root: string;
  inventory: string;
  ci: boolean;
}

async function tryLoadConfig(configPath: string): Promise<Record<string, unknown> | null> {
  const resolved = path.resolve(configPath);
  const exists = await fs.stat(resolved).then(() => true).catch(() => false);
  if (!exists) return null;
  try {
    const { default: cfg } = await import(pathToFileURL(resolved).href);
    return cfg as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function registerTestIdsCommands(program: Command): void {
  const testids = program
    .command('testids')
    .description('Test ID inventory — scan source for data-testid usage and audit against a governed contract');

  // ── selfcure testids scan ─────────────────────────────────────────────────
  testids
    .command('scan')
    .description('Scan source and test files for data-testid usage and write observed results')
    .option('-c, --config <path>', 'path to selfcure.config.mjs', './selfcure.config.mjs')
    .option('--root <dir>',        'project root (overrides config.rootDir)', '')
    .option('--out <dir>',         'output directory for scan results', '.selfcure')
    .action(async (opts: ScanOpts) => {
      const spinner = ora('Scanning for data-testid usage…').start();
      try {
        const config = await tryLoadConfig(opts.config);
        const rootDir = opts.root
          ? path.resolve(opts.root)
          : config?.['rootDir']
            ? path.resolve(String(config['rootDir']))
            : process.cwd();

        const sourceGlobs: string[] = (config?.['include'] as string[] | undefined) ?? DEFAULT_SOURCE_GLOBS;
        const exclude: string[]     = (config?.['exclude'] as string[] | undefined) ?? DEFAULT_EXCLUDE;

        const result = await extractTestIds({
          rootDir,
          sourceGlobs,
          testGlobs: DEFAULT_TEST_GLOBS,
          exclude,
        });

        // Write JSON output
        const outDir  = path.resolve(opts.out);
        await fs.mkdir(outDir, { recursive: true });
        const outFile = path.join(outDir, 'testids-scan.json');
        await fs.writeFile(outFile, JSON.stringify({ rootDir, ...result, generatedAt: new Date().toISOString() }, null, 2), 'utf-8');

        spinner.succeed(chalk.green(`Scan complete — ${result.scannedFiles} file(s) scanned`));
        console.log('');

        const frontendCount = result.usages.filter((u) => u.kind === 'frontend').length;
        const testCount     = result.usages.filter((u) => u.kind === 'test').length;
        const uniqueFe      = new Set(result.usages.filter((u) => u.kind === 'frontend').map((u) => u.value)).size;

        console.log(chalk.dim(`  frontend data-testid: `) + chalk.white(`${uniqueFe} unique (${frontendCount} occurrences)`));
        console.log(chalk.dim(`  test getByTestId:     `) + chalk.white(`${testCount} calls`));
        console.log(chalk.dim(`  results written to:   `) + chalk.white(path.relative(process.cwd(), outFile)));
        console.log('');
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── selfcure testids audit ────────────────────────────────────────────────
  testids
    .command('audit')
    .description('Audit the testid-inventory.json contract against observed source usage')
    .option('-c, --config <path>',    'path to selfcure.config.mjs', './selfcure.config.mjs')
    .option('--root <dir>',           'project root (overrides config.rootDir)', '')
    .option('--inventory <path>',     'path to inventory file', '.selfcure/testid-inventory.json')
    .option('--ci',                   'exit non-zero when error-level issues exist')
    .action(async (opts: AuditOpts) => {
      const spinner = ora('Loading inventory and scanning source…').start();
      try {
        // Load inventory
        const inventoryPath = path.resolve(opts.inventory);
        const inventoryResult = await loadInventory(inventoryPath);
        if (!inventoryResult.ok) {
          spinner.fail(chalk.red('Failed to load inventory:'));
          for (const e of inventoryResult.errors) console.error(chalk.red(`  ${e}`));
          process.exit(1);
        }
        const inventory = inventoryResult.inventory;

        // Load config (optional)
        const config = await tryLoadConfig(opts.config);
        const rootDir = opts.root
          ? path.resolve(opts.root)
          : config?.['rootDir']
            ? path.resolve(String(config['rootDir']))
            : process.cwd();

        const sourceGlobs: string[] = (config?.['include'] as string[] | undefined) ?? DEFAULT_SOURCE_GLOBS;
        const exclude: string[]     = (config?.['exclude'] as string[] | undefined) ?? DEFAULT_EXCLUDE;

        // Scan source
        const { usages, scannedFiles } = await extractTestIds({
          rootDir,
          sourceGlobs,
          testGlobs: DEFAULT_TEST_GLOBS,
          exclude,
        });

        spinner.stop();

        // Run audit engine
        const result = audit(inventory, usages);
        const { summary, issues } = result;

        const errors   = issues.filter((i) => i.severity === 'error');
        const warnings = issues.filter((i) => i.severity === 'warning');

        // ── Header ───────────────────────────────────────────────────────────
        console.log('');
        console.log(chalk.bold('selfcure testids audit'));
        console.log(chalk.dim(`  ${scannedFiles} file(s) scanned · ${summary.totalObserved} unique frontend test IDs observed`));
        console.log('');

        if (issues.length === 0) {
          console.log(chalk.green.bold('✔ No issues found'));
          console.log('');
          return;
        }

        console.log(
          (errors.length > 0 ? chalk.red(`Errors: ${errors.length}`) : chalk.dim('Errors: 0')) +
          '  ' +
          (warnings.length > 0 ? chalk.yellow(`Warnings: ${warnings.length}`) : chalk.dim('Warnings: 0')),
        );
        console.log('');

        // ── Issue list ────────────────────────────────────────────────────────
        for (const issue of issues) {
          printIssue(issue);
        }

        // ── CI exit ───────────────────────────────────────────────────────────
        if (opts.ci && errors.length > 0) {
          console.log(chalk.red.bold(`\nCI mode: exiting with code 1 (${errors.length} error(s) found)`));
          process.exit(1);
        }
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}

function printIssue(issue: AuditIssue): void {
  const severity = issue.severity === 'error'
    ? chalk.red('error')
    : chalk.yellow('warn ');

  const extra = issue.message ? chalk.dim(` — ${issue.message}`) : '';
  console.log(`${severity}  ${chalk.bold(issue.rule)}  ${chalk.white(issue.testId)}${extra}`);

  if (issue.locations) {
    for (const loc of issue.locations) {
      console.log(chalk.dim(`    ${loc}`));
    }
  }
}
