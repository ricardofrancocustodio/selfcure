// ---------------------------------------------------------------------------
// selfcure export — emit findings in an external tool's format.
//
// Currently supports SonarQube's Generic Issue Import Format, so selfcure's
// testability + accessibility findings show up in the SonarQube dashboard
// next to technical debt and coverage — the panel architects and tech leads
// already live in. No native Java plugin to maintain.
//
//   selfcure export --format sonarqube --out .selfcure/sonar-issues.json
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import chalk from 'chalk';
import ora   from 'ora';
import path  from 'node:path';
import fs    from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { runLint } from './lint.js';
import type { LintConfig } from './lint.js';
import { exportSonarQube } from '@selfcure/reporter';
import type { SelfcureSonarIssue, WcagLevel } from '@selfcure/reporter';
import { extractTestIds } from '@selfcure/crawler';
import { loadInventory, audit } from '@selfcure/analyzer';

const DEFAULT_OUT      = '.selfcure/sonar-issues.json';
const DEFAULT_TEST_GLOBS = ['**/*.{spec,test}.{ts,js,tsx,jsx}', '**/*.e2e.{ts,js}'];
const DEFAULT_EXCLUDE    = ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.nuxt/**'];

interface ExportOpts {
  format:    string;
  config:    string;
  out:       string;
  threshold: string;
  a11y:      boolean;
  wcag:      string;
  baseDir:   string;
  inventory?: string;
}

/** Parse a "file:line" location string (testids audit format) into parts. */
function parseLocation(loc: string | undefined): { filePath?: string; line?: number } {
  if (!loc) return {};
  const m = loc.match(/^(.*):(\d+)$/);
  if (m) return { filePath: m[1], line: Number(m[2]) };
  return { filePath: loc };
}

export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export findings in an external tool format (SonarQube Generic Issue Import Format)')
    .requiredOption('--format <name>', 'output format — currently only "sonarqube"')
    .option('-c, --config <path>', 'path to selfcure.config.mjs', './selfcure.config.mjs')
    .option('--out <path>',        'output file', DEFAULT_OUT)
    .option('--threshold <n>',     'testability score below which an element is flagged', '65')
    .option('--a11y',              'include WCAG accessibility findings', false)
    .option('--wcag <level>',      'WCAG target level when using --a11y: A, AA, or AAA', 'AA')
    .option('--base-dir <dir>',    'sonar.projectBaseDir — filePaths are made relative to it', '')
    .option('--inventory <path>',  'testid-inventory.json — include missing-testid (orphaned contract) issues')
    .action(async (opts: ExportOpts) => {
      if (opts.format !== 'sonarqube') {
        console.error(chalk.red(`Unsupported format "${opts.format}". Currently only "sonarqube" is supported.`));
        process.exit(1);
      }

      const spinner = ora('Analysing source files…').start();
      try {
        // ── Load config ──────────────────────────────────────────────────────
        const configPath = path.resolve(opts.config);
        const exists = await fs.stat(configPath).then(() => true).catch(() => false);
        if (!exists) {
          spinner.fail(chalk.red(`Config not found: ${opts.config}`));
          process.exit(1);
        }
        const { default: config } = await import(pathToFileURL(configPath).href) as { default: LintConfig };

        const threshold = Number(opts.threshold ?? 65);
        const wcag      = (opts.wcag ?? 'AA') as WcagLevel;
        const baseDir   = opts.baseDir ? path.resolve(opts.baseDir) : process.cwd();

        const issues: SelfcureSonarIssue[] = [];

        // ── 1. Testability + accessibility (single crawl via runLint) ────────
        const summary = await runLint(config, {
          threshold,
          fix:  false,
          pr:   false,
          a11y: opts.a11y,
          wcag,
        });

        for (const issue of summary.issues) {
          issues.push({
            kind:     issue.kind, // 'ambiguous' | 'low-score'
            filePath: issue.filePath,
            message:  issue.kind === 'ambiguous'
              ? `Ambiguous selector "${issue.element.selector}" in ${issue.componentName} — `
                + `${(issue.ambiguityReason ?? 'matches multiple elements').replace(/\.\s*$/, '')}. `
                + `Add a unique data-testid="${issue.suggestedTestId}".`
              : `Low testability (score ${issue.element.testabilityScore}/100) for `
                + `${issue.element.type} in ${issue.componentName}. `
                + `Add data-testid="${issue.suggestedTestId}".`,
          });
        }

        for (const f of summary.a11yFindings ?? []) {
          issues.push({
            kind:      'a11y-violation',
            filePath:  f.sourceFile,
            line:      f.line,
            wcagLevel: f.level,
            ruleId:    f.ruleId,
            message:   `${f.message} (WCAG ${f.level}: ${f.wcag.join(', ')}). ${f.remediation}`,
          });
        }

        // ── 2. Missing-testid (governed contract) — opt-in via --inventory ───
        if (opts.inventory) {
          const inv = await loadInventory(path.resolve(opts.inventory));
          if (!inv.ok) {
            spinner.warn(chalk.yellow(`Skipping --inventory: failed to load ${opts.inventory}`));
          } else {
            const rootDir = config.rootDir ? path.resolve(config.rootDir) : process.cwd();
            const { usages } = await extractTestIds({
              rootDir,
              sourceGlobs: config.include ?? ['**/*.{tsx,jsx,ts,js,vue,html}'],
              testGlobs:   DEFAULT_TEST_GLOBS,
              exclude:     config.exclude ?? DEFAULT_EXCLUDE,
            });
            const { issues: auditIssues } = audit(inv.inventory, usages);
            // orphaned-inventory = contract entry the frontend never added.
            for (const ai of auditIssues.filter((i) => i.rule === 'orphaned-inventory')) {
              const loc = parseLocation(ai.locations?.[0]);
              issues.push({
                kind:     'missing-testid',
                filePath: loc.filePath ?? path.resolve(opts.inventory),
                line:     loc.line,
                message:  ai.message ?? `data-testid="${ai.testId}" is in the inventory but missing from source.`,
              });
            }
          }
        }

        // ── 3. Write the SonarQube report ────────────────────────────────────
        const report = await exportSonarQube(issues, opts.out, { projectBaseDir: baseDir });
        spinner.stop();

        console.log('');
        console.log(chalk.green.bold(`✔ SonarQube report written — ${report.issues.length} issue(s)`));
        console.log(chalk.dim(`  ${path.relative(process.cwd(), path.resolve(opts.out))}`));
        console.log('');
        console.log(chalk.dim('  Point SonarQube at it with:'));
        console.log(chalk.dim(`    sonar.externalIssuesReportPaths=${opts.out}`));
        console.log('');
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
