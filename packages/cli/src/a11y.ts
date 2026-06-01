import type { Command } from 'commander';
import chalk from 'chalk';
import ora   from 'ora';
import path  from 'node:path';
import fs    from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { crawl, extractA11yEvidenceFromAll } from '@selfcure/crawler';
import {
  runStaticAnalysis,
  loadFindings, saveFindings, mergeFindings, emptyInventory,
  runAudit,
} from '@selfcure/analyzer';
import type { AccessibilityFinding, A11ySeverity, WcagLevel } from '@selfcure/analyzer';
import { runDynamicScan } from '@selfcure/runner';

// ---------------------------------------------------------------------------
// Output helpers shared across `selfcure lint --a11y` and future `selfcure a11y` commands
// ---------------------------------------------------------------------------

const SEVERITY_COLOR: Record<A11ySeverity, (s: string) => string> = {
  critical: chalk.red,
  major:    chalk.yellow,
  minor:    chalk.cyan,
  info:     chalk.dim,
};

function severityCounts(findings: AccessibilityFinding[]): Record<A11ySeverity, number> {
  return {
    critical: findings.filter((f) => f.severity === 'critical').length,
    major:    findings.filter((f) => f.severity === 'major').length,
    minor:    findings.filter((f) => f.severity === 'minor').length,
    info:     findings.filter((f) => f.severity === 'info').length,
  };
}

/**
 * Print the Accessibility section that appears below Testability in `selfcure lint --a11y`.
 * Shows a summary line always; full details only for Pro users.
 */
export function printA11ySection(
  findings: AccessibilityFinding[],
  opts: { isPro: boolean; wcagLevel: WcagLevel; cwd: string },
): void {
  const { isPro, wcagLevel, cwd } = opts;
  const counts = severityCounts(findings);

  console.log(chalk.bold(`Accessibility  WCAG ${wcagLevel}`));

  if (findings.length === 0) {
    console.log(chalk.dim('  0 issues'));
    console.log('');
    return;
  }

  // Summary line
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(chalk.red.bold(`critical  ${counts.critical}`));
  if (counts.major    > 0) parts.push(chalk.yellow.bold(`major  ${counts.major}`));
  if (counts.minor    > 0) parts.push(chalk.cyan(`minor  ${counts.minor}`));
  if (counts.info     > 0) parts.push(chalk.dim(`info  ${counts.info}`));
  console.log('  ' + parts.join('  ·  '));
  console.log('');

  if (!isPro) {
    console.log(chalk.bold.yellow('  ✦ Full accessibility report available on the Pro plan'));
    console.log(chalk.dim('    Enable with SELFCURE_PRO=1 or pro: true in your config.'));
    console.log('');
    return;
  }

  // Group findings by file
  const byFile = new Map<string, AccessibilityFinding[]>();
  for (const f of findings) {
    const list = byFile.get(f.sourceFile) ?? [];
    list.push(f);
    byFile.set(f.sourceFile, list);
  }

  for (const [filePath, filefindings] of byFile) {
    const rel = path.relative(cwd, filePath);
    console.log(chalk.underline(rel));
    for (const f of filefindings) {
      const col  = SEVERITY_COLOR[f.severity];
      const rule = chalk.bold(f.ruleId.replace('a11y.', ''));
      const loc  = chalk.dim(`:${f.line}${f.column ? `:${f.column}` : ''}`);
      console.log(`  ${col(f.severity.padEnd(8))}  ${rule}`);
      console.log(chalk.dim(`    ${rel}${loc}  —  ${f.message}`));
    }
    console.log('');
  }
}

/**
 * Compact single-line summary for the header bar (used when both sections are printed together).
 */
export function a11ySummaryLine(findings: AccessibilityFinding[]): string {
  if (findings.length === 0) return chalk.green('0 a11y issues');
  const counts = severityCounts(findings);
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(chalk.red(`${counts.critical} critical`));
  if (counts.major    > 0) parts.push(chalk.yellow(`${counts.major} major`));
  if (counts.minor    > 0) parts.push(chalk.cyan(`${counts.minor} minor`));
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Config loader (shared with testids commands)
// ---------------------------------------------------------------------------

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

const DEFAULT_SOURCE_GLOBS = ['**/*.{tsx,jsx,ts,js,vue}'];
const DEFAULT_EXCLUDE       = ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/.nuxt/**'];

// ---------------------------------------------------------------------------
// CLI commands — selfcure a11y scan / audit
// ---------------------------------------------------------------------------

export function registerA11yCommands(program: Command): void {
  const a11y = program
    .command('a11y')
    .description('Accessibility WCAG commands — scan, audit, and CI gate');

  // ── selfcure a11y scan ────────────────────────────────────────────────────
  a11y
    .command('scan')
    .description('Scan source files for WCAG accessibility issues and update the findings inventory')
    .option('-c, --config <path>',    'path to selfcure.config.mjs', './selfcure.config.mjs')
    .option('--root <dir>',           'project root (overrides config.rootDir)')
    .option('--wcag <level>',         'WCAG target level: A, AA, or AAA', 'AA')
    .option('--out <dir>',            'output directory for findings file', '.selfcure')
    .option('--app <name>',           'application name for the findings file')
    .option('--dynamic',              '[Pro] also run live Playwright + axe-core scan')
    .option('--base-url <url>',       'app base URL for dynamic scan (e.g. http://localhost:3000)')
    .option('--routes <routes>',      'comma-separated routes to scan (default: /)', '/')
    .option('--axe-source <path>',    'local path or URL to axe-core script (default: CDN)')
    .action(async (opts: {
      config: string; root?: string; wcag: string; out: string; app?: string;
      dynamic?: boolean; baseUrl?: string; routes: string; axeSource?: string;
    }) => {
      const spinner = ora('Scanning for accessibility issues…').start();
      try {
        const config  = await tryLoadConfig(opts.config);
        const rootDir = opts.root
          ? path.resolve(opts.root)
          : config?.['rootDir'] ? path.resolve(String(config['rootDir'])) : process.cwd();

        const include: string[] = (config?.['include'] as string[] | undefined) ?? DEFAULT_SOURCE_GLOBS;
        const exclude: string[] = (config?.['exclude'] as string[] | undefined) ?? DEFAULT_EXCLUDE;
        const wcagLevel = (opts.wcag ?? 'AA') as WcagLevel;

        const components = await crawl({ rootDir, include, exclude });
        const evidenceList = extractA11yEvidenceFromAll(components);
        const newFindings: AccessibilityFinding[] = runStaticAnalysis(evidenceList, { level: wcagLevel });

        // Dynamic scan (Playwright + axe-core)
        if (opts.dynamic) {
          const baseUrl = opts.baseUrl;
          if (!baseUrl) {
            spinner.warn(chalk.yellow('--dynamic requires --base-url. Skipping dynamic scan.'));
          } else {
            spinner.text = 'Running dynamic Playwright + axe-core scan…';
            try {
              const routes = opts.routes.split(',').map((r: string) => r.trim()).filter(Boolean);
              const dynResult = await runDynamicScan({
                baseURL:   baseUrl,
                routes,
                level:     wcagLevel,
                axeSource: opts.axeSource,
              });
              newFindings.push(...dynResult.findings);
              if (dynResult.errors.length > 0) {
                for (const e of dynResult.errors) {
                  console.warn(chalk.yellow(`  dynamic scan error on ${e.route}: ${e.error}`));
                }
              }
            } catch (err) {
              spinner.warn(chalk.yellow(`Dynamic scan failed: ${String(err)}`));
            }
          }
        }

        // Merge with existing inventory (creates fresh if not found)
        const outDir  = path.resolve(opts.out);
        const outFile = path.join(outDir, 'a11y-findings.json');
        const existing = await loadFindings(outFile);
        const appName  = opts.app ?? path.basename(rootDir);

        const base = existing.ok
          ? existing.inventory
          : emptyInventory({ app: appName, targetLevel: wcagLevel });

        const merged = mergeFindings(base, newFindings);
        await saveFindings(outFile, merged);

        const open = merged.findings.filter((f: AccessibilityFinding) => f.status === 'open');
        const counts = severityCounts(open);
        spinner.succeed(chalk.green(`Scan complete — ${components.length} file(s) scanned`));
        console.log('');

        if (open.length === 0) {
          console.log(chalk.green('  0 accessibility issues'));
        } else {
          const parts: string[] = [];
          if (counts.critical > 0) parts.push(chalk.red(`critical  ${counts.critical}`));
          if (counts.major    > 0) parts.push(chalk.yellow(`major  ${counts.major}`));
          if (counts.minor    > 0) parts.push(chalk.cyan(`minor  ${counts.minor}`));
          if (counts.info     > 0) parts.push(chalk.dim(`info  ${counts.info}`));
          console.log('  ' + parts.join('  ·  '));
        }

        const resolved   = merged.findings.filter((f: AccessibilityFinding) => f.status === 'resolved').length;
        const suppressed = merged.findings.filter((f: AccessibilityFinding) => f.status === 'suppressed').length;
        if (resolved > 0)   console.log(chalk.dim(`  ${resolved} resolved since last scan`));
        if (suppressed > 0) console.log(chalk.dim(`  ${suppressed} suppressed`));
        console.log(chalk.dim(`\n  findings written to  ${path.relative(process.cwd(), outFile)}`));
        console.log('');
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── selfcure a11y audit ───────────────────────────────────────────────────
  a11y
    .command('audit')
    .description('Audit the accessibility findings inventory and optionally gate CI')
    .option('--findings <path>', 'path to findings file', '.selfcure/a11y-findings.json')
    .option('--fail-on <sev>',   'minimum severity that fails CI: info, minor, major, critical', 'major')
    .option('--ci',              'exit non-zero when findings meet or exceed --fail-on severity')
    .action(async (opts: { findings: string; failOn: string; ci: boolean }) => {
      const spinner = ora('Loading accessibility findings…').start();
      try {
        const findingsPath = path.resolve(opts.findings);
        const result = await loadFindings(findingsPath);

        if (!result.ok) {
          spinner.fail(chalk.red('Failed to load findings:'));
          for (const e of result.errors) console.error(chalk.red(`  ${e}`));
          process.exit(1);
        }

        spinner.stop();

        const inventory  = result.inventory;
        const auditResult = runAudit(inventory, { failOn: opts.failOn as A11ySeverity });
        const { counts, wouldFailCI } = auditResult;

        console.log('');
        console.log(chalk.bold('selfcure a11y audit'));
        console.log(chalk.dim(`  ${path.relative(process.cwd(), findingsPath)}  ·  WCAG ${inventory.targetLevel}`));
        console.log('');
        console.log(
          chalk.dim('Open: ')       + chalk.white(counts.open) + '  ' +
          chalk.dim('Resolved: ')   + chalk.white(counts.resolved) + '  ' +
          chalk.dim('Suppressed: ') + chalk.white(counts.suppressed),
        );
        console.log('');

        if (counts.open === 0) {
          console.log(chalk.green.bold('✔ No open accessibility findings'));
          console.log('');
          return;
        }

        // Print open findings grouped by file
        const open = inventory.findings.filter((f: AccessibilityFinding) => f.status === 'open');
        printA11ySection(open, { isPro: true, wcagLevel: inventory.targetLevel, cwd: process.cwd() });

        if (opts.ci) {
          if (wouldFailCI) {
            console.log(chalk.red.bold(
              `CI mode: exiting with code 1 ` +
              `(fail-on: ${opts.failOn} — found ` +
              [
                counts.bySeverity.critical > 0 ? `${counts.bySeverity.critical} critical` : '',
                counts.bySeverity.major    > 0 ? `${counts.bySeverity.major} major`    : '',
              ].filter(Boolean).join(', ') +
              ')',
            ));
            process.exit(1);
          } else {
            console.log(chalk.green(`CI mode: passed (no findings at or above "${opts.failOn}")`));
          }
        }
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
