import type { Command } from 'commander';
import chalk from 'chalk';
import ora   from 'ora';
import path  from 'node:path';
import fs    from 'node:fs/promises';
import { discoverProject } from '@selfcure/crawler';
import type { ProjectMap } from '@selfcure/crawler';
import { runRuntimeDiscovery } from '@selfcure/runner';
import { buildTestabilityReport, summarizeReport } from '@selfcure/analyzer';
import { buildDiscoveryInput, shouldUseLlm, runLlmDiscovery, type DiscoveryLlmOutput } from '@selfcure/generator';
import type { AIConfig } from '@selfcure/generator';

// ---------------------------------------------------------------------------
// Output formatting
// ---------------------------------------------------------------------------

function frameworkLabel(f: ProjectMap['framework']): string {
  const map: Record<string, string> = {
    next:    'Next.js',
    nuxt:    'Nuxt',
    vue:     'Vue',
    angular: 'Angular',
    svelte:  'Svelte',
    react:   'React (SPA)',
    unknown: 'Unknown',
  };
  return map[f] ?? f;
}

function scoreColor(score: number): string {
  if (score >= 80) return chalk.green(String(score));
  if (score >= 60) return chalk.yellow(String(score));
  return chalk.red(String(score));
}

function confidenceBar(c: number): string {
  const pct = Math.round(c * 100);
  const col = pct >= 90 ? chalk.green : pct >= 70 ? chalk.yellow : chalk.dim;
  return col(`${pct}%`);
}

function printSummary(map: ProjectMap, cwd: string): void {
  console.log('');
  console.log(chalk.bold('selfcure discover'));
  console.log('');

  console.log(chalk.dim('  Framework:       ') + chalk.white(frameworkLabel(map.framework)));
  console.log(chalk.dim('  Package manager: ') + chalk.white(map.packageManager));
  if (map.devCommand)   console.log(chalk.dim('  Dev command:     ') + chalk.white(map.devCommand));
  if (map.buildCommand) console.log(chalk.dim('  Build command:   ') + chalk.white(map.buildCommand));
  if (map.testCommand)  console.log(chalk.dim('  Test command:    ') + chalk.white(map.testCommand));

  console.log('');
  const routes = map.routeCandidates;
  if (routes.length === 0) {
    console.log(chalk.dim('  No route candidates found.'));
  } else {
    console.log(chalk.bold(`  Routes (${routes.length}):`));
    for (const r of routes) {
      const rel  = path.relative(cwd, r.filePath);
      const dyn  = r.isDynamic ? chalk.dim(' [dynamic]') : '';
      const conf = confidenceBar(r.confidence);
      console.log(`    ${chalk.cyan(r.path.padEnd(35))} ${conf.padEnd(8)}  ${chalk.dim(rel)}${dyn}`);
    }
  }

  if (map.componentCandidates.length > 0) {
    console.log('');
    console.log(chalk.dim(`  ${map.componentCandidates.length} component candidate(s) found.`));
  }
}

// ---------------------------------------------------------------------------
// CLI command registration
// ---------------------------------------------------------------------------

export function registerDiscoverCommand(program: Command): void {
  program
    .command('discover')
    .description('Discover project structure, framework, and route candidates (static analysis)')
    .option('--root <dir>',      'project root to analyse (default: cwd)')
    .option('--out <dir>',       'output directory for discovery artifacts', '.selfcure')
    .option('--runtime',         'also render routes with Playwright (requires a running app)')
    .option('--base-url <url>',  'app base URL for runtime discovery (e.g. http://localhost:3000)')
    .option('--screenshots',     'capture screenshots during runtime discovery')
    .option('--llm',             'use LLM to suggest routes and hidden states when confidence is low')
    .option('--provider <id>',   'AI provider for --llm (anthropic|openai|google|groq|deepseek|ollama)')
    .option('--model <name>',    'model name for --llm')
    .action(async (opts: {
      root?: string; out: string;
      runtime?: boolean; baseUrl?: string; screenshots?: boolean;
      llm?: boolean; provider?: string; model?: string;
    }) => {
      const cwd      = process.cwd();
      const root     = opts.root ? path.resolve(opts.root) : cwd;
      const outDir   = path.resolve(opts.out);

      // ── Phase 2: Static discovery ─────────────────────────────────────────
      const spinner  = ora('Discovering project structure…').start();
      let map: ProjectMap;
      try {
        map = await discoverProject({ projectRoot: root });
      } catch (err) {
        spinner.fail(chalk.red(String(err)));
        process.exit(1);
        return;
      }

      await fs.mkdir(outDir, { recursive: true });
      const mapFile = path.join(outDir, 'project-map.json');
      await fs.writeFile(mapFile, JSON.stringify(map, null, 2), 'utf-8');
      spinner.stop();

      printSummary(map, cwd);
      console.log(chalk.dim(`  Artifacts: ${path.relative(cwd, mapFile)}`));

      // ── Phase 3+4: Runtime discovery + testability scoring ────────────────
      if (opts.runtime) {
        const baseURL = opts.baseUrl;
        if (!baseURL) {
          console.log('');
          console.log(chalk.yellow('  --runtime requires --base-url <url> (e.g. http://localhost:3000)'));
          console.log('');
        } else {
          const routes   = map.routeCandidates.map((r) => r.path);
          const rtSpinner = ora(`Runtime discovery — ${routes.length} route(s) via Playwright…`).start();
          try {
            const rtResult = await runRuntimeDiscovery({
              baseURL,
              routes,
              outDir,
              screenshots: opts.screenshots ?? false,
            });

            // Write route-map.json
            const routeMapFile = path.join(outDir, 'route-map.json');
            await fs.writeFile(routeMapFile, JSON.stringify(rtResult, null, 2), 'utf-8');

            // Phase 4: testability report
            const trReport  = buildTestabilityReport(rtResult);
            const trFile    = path.join(outDir, 'testability-report.json');
            await fs.writeFile(trFile, JSON.stringify(trReport, null, 2), 'utf-8');
            const summary = summarizeReport(trReport);

            rtSpinner.stop();
            console.log('');
            console.log(chalk.bold(`  Runtime results (${rtResult.reachable}/${routes.length} reachable):`));

            for (const r of rtResult.routes) {
              const icon  = r.status === 'reachable' ? chalk.green('✓') : chalk.red('✗');
              const title = r.title ? chalk.dim(` "${r.title.slice(0, 40)}"`) : '';
              const els   = r.status === 'reachable' ? chalk.dim(` · ${r.interactiveElements.length} elements`) : '';
              const routeResult = trReport.routes.find((x: typeof trReport.routes[number]) => x.route === r.route);
              const score = routeResult && r.status === 'reachable'
                ? '  score: ' + scoreColor(routeResult.score)
                : '';
              console.log(`    ${icon}  ${chalk.cyan(r.route.padEnd(30))}${title}${els}${score}`);
            }

            console.log('');
            console.log(chalk.bold('  Testability:'));
            if (summary.critical.length > 0) {
              console.log(chalk.red(`    Critical (< 60):  ${summary.critical.map((r: typeof summary.critical[number]) => r.route).join(', ')}`));
            }
            if (summary.warning.length > 0) {
              console.log(chalk.yellow(`    Warning  (< 80):  ${summary.warning.map((r: typeof summary.warning[number]) => r.route).join(', ')}`));
            }
            if (summary.healthy.length > 0) {
              console.log(chalk.green(`    Healthy  (≥ 80):  ${summary.healthy.map((r: typeof summary.healthy[number]) => r.route).join(', ')}`));
            }
            console.log(chalk.dim(`    Overall score:    ${trReport.overall.score}/100`));
            console.log('');
            console.log(chalk.dim(`  Artifacts: ${path.relative(cwd, routeMapFile)}`));
            console.log(chalk.dim(`             ${path.relative(cwd, trFile)}`));
          } catch (err) {
            rtSpinner.fail(chalk.red(`Runtime discovery failed: ${String(err)}`));
          }
        }
      } else if (map.routeCandidates.length > 0) {
        console.log('');
        console.log(chalk.dim('  Tip: run with --runtime --base-url <url> to render routes live'));
      }

      // ── Phase 5: LLM-Assisted Discovery ──────────────────────────────────
      const rtResult = undefined; // only populated after --runtime (captured above)
      if (opts.llm) {
        const needsLlm = shouldUseLlm(map, rtResult);
        if (!needsLlm) {
          console.log(chalk.dim('  LLM skipped — deterministic confidence is high enough.'));
        } else {
          const aiConfig: AIConfig = {
            provider: (opts.provider as AIConfig['provider']) ?? 'anthropic',
            generationModel: opts.model,
          };
          const llmSpinner = ora('LLM discovery — asking model for route + hidden-state hints…').start();
          try {
            const llmInput  = buildDiscoveryInput(map, rtResult);
            const llmOutput: DiscoveryLlmOutput = await runLlmDiscovery(llmInput, aiConfig);
            llmSpinner.stop();

            console.log('');
            console.log(chalk.bold(`  LLM suggestions (confidence: ${Math.round(llmOutput.confidence * 100)}%):`));
            if (llmOutput.routesToVisit.length > 0) {
              console.log(chalk.dim('    Routes to prioritise:'));
              for (const r of llmOutput.routesToVisit) {
                console.log(`      ${chalk.cyan(r)}`);
              }
            }
            if (llmOutput.hiddenStatesToExplore.length > 0) {
              console.log(chalk.dim('    Hidden states to explore:'));
              for (const h of llmOutput.hiddenStatesToExplore) {
                console.log(`      ${chalk.cyan(h.route)}  →  ${chalk.dim(h.triggerHint)}`);
              }
            }
            if (llmOutput.notes.length > 0) {
              console.log(chalk.dim('    Notes:'));
              for (const n of llmOutput.notes) console.log(`      ${chalk.dim(n)}`);
            }

            // Write llm-hints.json
            const hintsFile = path.join(outDir, 'llm-hints.json');
            await fs.writeFile(hintsFile, JSON.stringify(llmOutput, null, 2), 'utf-8');
            console.log(chalk.dim(`  Artifacts: ${path.relative(cwd, hintsFile)}`));
          } catch (err) {
            llmSpinner.fail(chalk.red(`LLM discovery failed: ${String(err)}`));
          }
        }
      } else if (!opts.runtime) {
        console.log(chalk.dim('  Tip: add --llm --provider anthropic to get AI route hints'));
      }

      console.log('');
    });
}
