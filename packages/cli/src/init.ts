import { input, select, password, confirm } from '@inquirer/prompts';
import { writeFile, stat }  from 'node:fs/promises';
import path                 from 'node:path';
import { PROVIDERS, type ProviderId } from '@selfcure/generator';
import { discoverProject } from '@selfcure/crawler';

// ---------------------------------------------------------------------------
// selfcure init — simplified wizard (Phase 1 of agentic discovery)
// ---------------------------------------------------------------------------
//
// Asks only 5 questions:
//   1. Project root
//   2. Base URL
//   3. AI provider
//   4. Model (single — used for both generation and healing)
//   5. Run discovery now?
//
// Writes selfcure.config.mjs in the new agentic-discovery format.
// Existing configs (old format with rootDir/include/etc.) remain valid.
// ---------------------------------------------------------------------------

const PROVIDER_CHOICES = (Object.values(PROVIDERS) as Array<typeof PROVIDERS[ProviderId]>)
  .map((p) => ({
    name: p.envVar && process.env[p.envVar]
      ? `${p.label}  ✓ (${p.envVar} detected)`
      : `${p.label}  — ${p.hint}`,
    value: p.id,
  }));

/** Detect the most likely source directory (for rootDir / crawl). */
async function detectSourceDir(cwd: string, projectRoot: string): Promise<string> {
  const abs = path.resolve(cwd, projectRoot);
  for (const candidate of ['src', 'app', 'pages', 'components']) {
    try {
      const s = await stat(path.join(abs, candidate));
      if (s.isDirectory()) return `./${candidate}`;
    } catch { /* not found */ }
  }
  return projectRoot === '.' ? './src' : projectRoot;
}

/** Detect file extensions used in the project. */
async function detectExtensions(cwd: string, sourceDir: string): Promise<string[]> {
  const abs = path.resolve(cwd, sourceDir);
  const found: string[] = [];
  for (const [ext, check] of [
    ['**/*.tsx', 'tsconfig.json'],
    ['**/*.jsx', 'vite.config.js'],
    ['**/*.vue', 'vue.config.js'],
  ] as Array<[string, string]>) {
    try { await stat(path.join(path.resolve(cwd, '.'), check)); found.push(ext); } catch { /* skip */ }
  }
  // Default: always include tsx and jsx
  if (found.length === 0) found.push('**/*.tsx', '**/*.jsx');
  return found;
}

function buildConfigContent(
  projectRoot: string,
  sourceDir:   string,
  extensions:  string[],
  baseUrl:     string,
  provider:    ProviderId,
  model:       string,
): string {
  const pr  = JSON.stringify(projectRoot);
  const sd  = JSON.stringify(sourceDir);
  const bu  = JSON.stringify(baseUrl);
  const pv  = JSON.stringify(provider);
  const mo  = JSON.stringify(model);
  const inc = JSON.stringify(extensions);

  return [
    '// selfcure.config.mjs',
    '// See: https://github.com/ricardofrancocustodio/selfcure',
    'export default {',
    `  projectRoot: ${pr},`,
    `  baseUrl: ${bu},`,
    '',
    '  // Required by selfcure lint, selfcure web, selfcure crawl',
    `  rootDir: ${sd},`,
    `  include: ${inc},`,
    `  exclude: ["**/*.test.*", "**/*.spec.*", "**/*.stories.*"],`,
    `  baseURL: ${bu},`,
    '',
    '  ai: {',
    `    provider: ${pv},`,
    `    model: ${mo},`,
    '  },',
    '',
    '  discovery: {',
    '    mode: "agentic",',
    '    static: true,',
    '    runtime: false,',
    '    maxRoutes: 50,',
    '    maxDepth: 3,',
    '    includeHiddenStates: true,',
    '    routeHints: [],',
    '    ignore: ["node_modules", "dist", "coverage", ".git"],',
    '  },',
    '',
    '  testability: {',
    '    preferRoleLocators: true,',
    '    suggestTestIds: true,',
    '    minimumScore: 80,',
    '  },',
    '};',
    '',
  ].join('\n');
}

export async function runInitWizard(cwd: string): Promise<void> {
  console.log('');
  console.log('selfcure init — agentic discovery setup');
  console.log('');

  // ── 1. Project root ──────────────────────────────────────────────────────
  const projectRoot = await input({
    message: 'Project root (relative to cwd)?',
    default: '.',
  });

  // ── 2. Base URL ───────────────────────────────────────────────────────────
  const baseUrl = await input({
    message: 'App base URL (dev server)?',
    default: 'http://localhost:3000',
  });

  // ── 3. AI provider ────────────────────────────────────────────────────────
  const suggestedProvider =
    (Object.values(PROVIDERS) as Array<typeof PROVIDERS[ProviderId]>)
      .find((p) => p.envVar && process.env[p.envVar])?.id ?? 'anthropic';

  const provider = await select<ProviderId>({
    message: 'AI provider?',
    choices: PROVIDER_CHOICES,
    default: suggestedProvider,
  });

  const meta = PROVIDERS[provider];

  // ── 4. Model ──────────────────────────────────────────────────────────────
  const model = await input({
    message: 'Model?',
    default: meta.defaultGenerationModel,
  });

  // API key (when needed)
  if (meta.envVar && !process.env[meta.envVar]) {
    const apiKey = await password({
      message: `${meta.label} API key (${meta.envVar})?`,
      mask: '*',
    });
    if (apiKey) {
      const envPath = path.join(cwd, '.env');
      const line    = `\n${meta.envVar}=${apiKey}\n`;
      const { appendFile } = await import('node:fs/promises');
      await appendFile(envPath, line, 'utf-8');
      console.log(`  ✔ appended to ${path.relative(cwd, envPath)}`);
    }
  }

  // ── 5. Run discovery now? ─────────────────────────────────────────────────
  const runNow = await confirm({
    message: 'Run static project discovery now?',
    default: true,
  });

  // Auto-detect source dir and extensions
  const sourceDir  = await detectSourceDir(cwd, projectRoot);
  const extensions = await detectExtensions(cwd, sourceDir);

  // Write config
  const configPath    = path.join(cwd, 'selfcure.config.mjs');
  const configContent = buildConfigContent(projectRoot, sourceDir, extensions, baseUrl, provider, model);
  await writeFile(configPath, configContent, 'utf-8');
  console.log(`\n✔  selfcure.config.mjs created`);
  console.log(`   rootDir: ${sourceDir}   include: ${extensions.join(', ')}`);

  // Optional discovery run
  if (runNow) {
    console.log('');
    const { default: ora } = await import('ora');
    const spinner = ora('Discovering project structure…').start();
    try {
      const root   = path.resolve(cwd, projectRoot);
      const map    = await discoverProject({ projectRoot: root });
      const outDir = path.join(cwd, '.selfcure');
      const { mkdir, writeFile: wf } = await import('node:fs/promises');
      await mkdir(outDir, { recursive: true });
      await wf(path.join(outDir, 'project-map.json'), JSON.stringify(map, null, 2), 'utf-8');

      spinner.succeed(`Discovered ${map.routeCandidates.length} route candidate(s) · ${map.componentCandidates.length} component(s)`);
      console.log(`  Framework: ${map.framework}   Package manager: ${map.packageManager}`);
      if (map.devCommand) console.log(`  Dev:       ${map.devCommand}`);
      console.log(`  Artifacts: .selfcure/project-map.json`);
    } catch (err) {
      spinner.warn(`Discovery skipped: ${String(err)}`);
    }
  }

  console.log('\nNext steps:');
  console.log('  selfcure discover          — (re)run static discovery');
  console.log('  selfcure lint              — testability lint');
  console.log('  selfcure a11y scan         — WCAG accessibility scan');
  console.log('');
}
