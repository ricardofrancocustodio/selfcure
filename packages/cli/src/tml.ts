// ---------------------------------------------------------------------------
// selfcure tml — Tag Maturity Level commands
//   selfcure tml scan          — print per-element TML across the project
//   selfcure tml audit --ci    — exit 1 when elements fall below minimum level
// ---------------------------------------------------------------------------

import type { Command } from 'commander';
import chalk from 'chalk';
import ora   from 'ora';
import path  from 'node:path';
import fs    from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { crawl } from '@selfcure/crawler';
import { analyze, enrichTmlWithInventory, loadInventory, enrichTmlWithRuntime, loadRuntimeMap } from '@selfcure/analyzer';
import type { AnalysisResult, TagMaturityLevel } from '@selfcure/analyzer';
import { reportTml } from '@selfcure/reporter';

async function resolveConfig(cwd: string, provided?: string): Promise<{ config: Record<string, unknown>; resolved: string }> {
  const names = provided
    ? [path.resolve(cwd, provided)]
    : [path.resolve(cwd, 'selfcure.config.mjs'), path.resolve(cwd, 'selfcure.config.js')];
  for (const p of names) {
    const exists = await fs.stat(p).then(() => true).catch(() => false);
    if (exists) {
      const mod = await import(`${pathToFileURL(p).href}?t=${Date.now()}`);
      return { config: mod.default as Record<string, unknown>, resolved: p };
    }
  }
  throw new Error(`selfcure.config.mjs not found in ${cwd}. Run selfcure init first.`);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const TML_COLORS: Record<TagMaturityLevel, (s: string) => string> = {
  0: chalk.red,
  1: chalk.yellow,
  2: chalk.blue,
  3: chalk.cyan,
  4: chalk.green,
};

export function tmlBadge(level: TagMaturityLevel, label: string): string {
  const color = TML_COLORS[level];
  return color(`[TML-${level}:${label}]`);
}

export function tmlBadgeShort(level: TagMaturityLevel): string {
  return TML_COLORS[level](`TML-${level}`);
}

// ---------------------------------------------------------------------------
// Scan engine (shared between scan and audit commands)
// ---------------------------------------------------------------------------

async function runTmlAnalysis(cwd: string, configPath?: string, inventoryPath?: string, runtimeMapPath?: string): Promise<{
  results:  AnalysisResult[];
  rootDir:  string;
}> {
  const { config } = await resolveConfig(cwd, configPath);
  const rootDir  = path.resolve(cwd, String(config['rootDir'] ?? config['projectRoot'] ?? '.'));

  const include   = (config['include']   as string[] | undefined) ?? ['**/*.tsx', '**/*.jsx'];
  const exclude   = (config['exclude']   as string[] | undefined) ?? [];
  const framework = (config['framework'] as 'react' | 'vue' | 'angular' | 'auto' | undefined);

  const components = await crawl({ rootDir, include, exclude, framework });
  const results    = await analyze(components);

  // 1. Inventory enrichment
  const invFile   = inventoryPath
    ? path.resolve(cwd, inventoryPath)
    : path.join(cwd, '.selfcure', 'testid-inventory.json');
  const invResult = await loadInventory(invFile).catch(() => null);
  if (invResult?.ok) enrichTmlWithInventory(results, invResult.inventory!);

  // 2. Runtime enrichment (Phase 7)
  const rtFile = runtimeMapPath
    ? path.resolve(cwd, runtimeMapPath)
    : path.join(cwd, '.selfcure', 'route-map.json');
  const rtMap = await loadRuntimeMap(rtFile).catch(() => null);
  if (rtMap) enrichTmlWithRuntime(results, rtMap, invResult?.ok ? invResult.inventory : undefined);

  return { results, rootDir };
}

// ---------------------------------------------------------------------------
// TML distribution summary
// ---------------------------------------------------------------------------

function printDistribution(results: AnalysisResult[], cwd: string, minimumLevel: TagMaturityLevel): void {
  const dist: Record<TagMaturityLevel, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  let total = 0;

  for (const r of results) {
    for (const el of r.interactiveElements) {
      if (!el.tml) continue;
      dist[el.tml.level]++;
      total++;
    }
  }

  if (total === 0) {
    console.log(chalk.dim('  No interactive elements found.'));
    return;
  }

  console.log('');
  console.log(chalk.bold('Tag Maturity Distribution'));
  console.log('');

  const LABELS: Record<TagMaturityLevel, string> = {
    0: 'unusable', 1: 'fragile', 2: 'usable', 3: 'stable', 4: 'governed',
  };

  for (const lvl of [4, 3, 2, 1, 0] as TagMaturityLevel[]) {
    const cnt = dist[lvl];
    if (cnt === 0 && lvl > 1) continue;
    const bar    = '█'.repeat(Math.round((cnt / total) * 20));
    const pct    = Math.round((cnt / total) * 100);
    const color  = TML_COLORS[lvl];
    const flag   = lvl < minimumLevel && cnt > 0 ? chalk.red(' ← below minimum') : '';
    console.log(
      `  ${color(`TML-${lvl}`)} ${LABELS[lvl].padEnd(9)} ${color(bar.padEnd(20))} ` +
      `${String(cnt).padStart(4)} (${String(pct).padStart(3)}%)${flag}`,
    );
  }

  console.log('');
  console.log(chalk.dim(`  Total interactive elements: ${total}`));
}

// ---------------------------------------------------------------------------
// Per-element listing (scan)
// ---------------------------------------------------------------------------

function printElementList(results: AnalysisResult[], cwd: string, minimumLevel: TagMaturityLevel): void {
  const flagged: Array<{ filePath: string; rel: string; elType: string; selector: string; level: TagMaturityLevel; label: string; changes: string[] }> = [];

  for (const r of results) {
    const rel = path.relative(cwd, r.component.filePath);
    for (const el of r.interactiveElements) {
      if (!el.tml || el.tml.level >= minimumLevel) continue;
      flagged.push({
        filePath: r.component.filePath,
        rel,
        elType:   el.type,
        selector: el.selector,
        level:    el.tml.level,
        label:    el.tml.label,
        changes:  el.tml.requiredChanges.slice(0, 2).map((c: { description: string }) => c.description),
      });
    }
  }

  if (flagged.length === 0) {
    console.log(chalk.green(`  ✓ All elements meet TML-${minimumLevel} or above.`));
    return;
  }

  console.log(chalk.bold(`Elements below TML-${minimumLevel} (${flagged.length}):`));
  console.log('');

  const byFile = new Map<string, typeof flagged>();
  for (const f of flagged) {
    if (!byFile.has(f.filePath)) byFile.set(f.filePath, []);
    byFile.get(f.filePath)!.push(f);
  }

  for (const [, items] of byFile) {
    console.log(chalk.underline(items[0]!.rel));
    for (const item of items) {
      console.log(
        `  ${tmlBadgeShort(item.level).padEnd(16)}` +
        `  ${chalk.cyan(item.elType.padEnd(8))}` +
        `  ${chalk.dim(item.selector.slice(0, 32).padEnd(32))}`,
      );
      for (const change of item.changes) {
        console.log(`    ${chalk.dim('→')} ${chalk.dim(change)}`);
      }
    }
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

export function registerTmlCommands(program: Command): void {
  const tml = program.command('tml').description('Tag Maturity Level — testability governance');

  // ── selfcure tml report ───────────────────────────────────────────────────
  tml
    .command('report')
    .description('Generate HTML + JSON TML report at .selfcure/tml-report.html')
    .option('--config <path>',    'Path to selfcure.config.mjs')
    .option('--inventory <path>', 'Path to testid-inventory.json')
    .option('--out <dir>',        'Output directory', '.selfcure')
    .option('--minimum <level>',  'Minimum TML level for findings (0–4)', '2')
    .action(async (opts: { config?: string; inventory?: string; runtimeMap?: string; out: string; minimum: string }) => {
      const cwd     = process.cwd();
      const minLvl  = Math.max(0, Math.min(4, parseInt(opts.minimum, 10) || 2)) as TagMaturityLevel;
      const outDir  = path.resolve(cwd, opts.out);
      const spinner = ora('Generating TML report…').start();

      try {
        const { results } = await runTmlAnalysis(cwd, opts.config, opts.inventory, opts.runtimeMap ?? undefined);
        const summary = await reportTml(results, { outputDir: outDir, minimumLevel: minLvl });
        spinner.stop();
        console.log('');
        console.log(chalk.green(`  ✓ Report written`));
        console.log(chalk.dim(`    ${path.relative(cwd, path.join(outDir, 'tml-report.html'))}`));
        console.log(chalk.dim(`    ${path.relative(cwd, path.join(outDir, 'tml-report.json'))}`));
        console.log('');
        console.log(chalk.dim(`  Total: ${summary.totalElements}  Violations: ${summary.violations}  TML ≥ ${minLvl}`));
        console.log('');
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── selfcure tml scan ────────────────────────────────────────────────────
  tml
    .command('scan')
    .description('Compute TML for all interactive elements and print a distribution summary')
    .option('--config <path>',      'Path to selfcure.config.mjs')
    .option('--inventory <path>',   'Path to testid-inventory.json (default: .selfcure/testid-inventory.json)')
    .option('--runtime-map <path>', 'Path to route-map.json from selfcure discover --runtime (default: .selfcure/route-map.json)')
    .option('--minimum <level>',    'Minimum acceptable TML level for display (0–4)', '2')
    .action(async (opts: { config?: string; inventory?: string; runtimeMap?: string; minimum: string }) => {
      const cwd     = process.cwd();
      const minLvl  = Math.max(0, Math.min(4, parseInt(opts.minimum, 10) || 2)) as TagMaturityLevel;
      const spinner = ora('Computing Tag Maturity Levels…').start();

      try {
        const { results } = await runTmlAnalysis(cwd, opts.config, opts.inventory, opts.runtimeMap);
        spinner.stop();

        console.log('');
        printDistribution(results, cwd, minLvl);
        printElementList(results, cwd, minLvl);
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });

  // ── selfcure tml audit --ci ───────────────────────────────────────────────
  tml
    .command('audit')
    .description('Fail (exit 1) when elements fall below the configured minimum TML level')
    .option('--config <path>',          'Path to selfcure.config.mjs')
    .option('--inventory <path>',       'Path to testid-inventory.json')
    .option('--minimum-level <level>',  'Minimum acceptable TML (default: 2)', '2')
    .option('--critical-minimum <lvl>', 'Stricter minimum for critical routes (default: same as --minimum-level)')
    .option('--ci',                     'Machine-readable output; exit 1 on failures')
    .action(async (opts: { config?: string; inventory?: string; runtimeMap?: string; minimumLevel: string; criticalMinimum?: string; ci?: boolean }) => {
      const cwd    = process.cwd();
      const minLvl = Math.max(0, Math.min(4, parseInt(opts.minimumLevel, 10) || 2)) as TagMaturityLevel;
      const spinner = opts.ci ? null : ora('Running TML audit…').start();

      try {
        const { results } = await runTmlAnalysis(cwd, opts.config, opts.inventory, opts.runtimeMap ?? undefined);
        spinner?.stop();

        let violations = 0;
        let total      = 0;

        for (const r of results) {
          for (const el of r.interactiveElements) {
            if (!el.tml) continue;
            total++;
            if (el.tml.level < minLvl) violations++;
          }
        }

        if (opts.ci) {
          console.log(JSON.stringify({ total, violations, minimumLevel: minLvl, passed: violations === 0 }));
        } else {
          printDistribution(results, cwd, minLvl);
          if (violations === 0) {
            console.log(chalk.green(`  ✓ TML audit passed — all ${total} element(s) meet TML-${minLvl} or above.`));
          } else {
            printElementList(results, cwd, minLvl);
            console.log(chalk.red(`  ✗ TML audit failed — ${violations}/${total} element(s) below TML-${minLvl}.`));
          }
        }

        if (violations > 0) process.exit(1);
      } catch (err) {
        spinner?.fail(chalk.red(String(err)));
        process.exit(1);
      }
    });
}
