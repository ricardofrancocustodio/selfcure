import { input, select, password, checkbox, confirm } from '@inquirer/prompts';
import path from 'node:path';
import { generateConfig, FRAMEWORK_EXTENSIONS, type InitOptions } from '@selfcure/web';
import { PROVIDERS, type ProviderId } from '@selfcure/generator';

// ---------------------------------------------------------------------------
// selfcure init — interactive CLI wizard
// ---------------------------------------------------------------------------

const FRAMEWORK_CHOICES = [
  { name: 'React', value: 'react' },
  { name: 'Vue', value: 'vue' },
  { name: 'Angular', value: 'angular' },
  { name: 'HTML / Other', value: 'auto' },
] as const;

const PROVIDER_CHOICES = (Object.values(PROVIDERS) as Array<typeof PROVIDERS[ProviderId]>)
  .map((p) => ({
    name: p.envVar && process.env[p.envVar]
      ? `${p.label}  ✓ (${p.envVar} detected)`
      : `${p.label}  — ${p.hint}`,
    value: p.id,
  }));

export async function runInitWizard(cwd: string): Promise<void> {
  const rootDir = await input({
    message: 'Onde está o source do projeto?',
    default: './src',
  });

  const framework = await select({
    message: 'Qual framework?',
    choices: FRAMEWORK_CHOICES,
  });

  const defaultExtensions = FRAMEWORK_EXTENSIONS[framework] ?? ['**/*.tsx'];

  const include = await checkbox({
    message: 'Extensões dos componentes?',
    choices: defaultExtensions.map((ext) => ({ name: ext, value: ext, checked: true })),
  });

  const testsDir = await input({
    message: 'Onde salvar os testes gerados?',
    default: './selfcure-tests',
  });

  const baseURL = await input({
    message: 'URL do ambiente de testes?',
    default: 'http://localhost:5000',
  });

  // ── AI provider ─────────────────────────────────────────────────────────
  const providerSuggested =
    (Object.values(PROVIDERS) as Array<typeof PROVIDERS[ProviderId]>)
      .find((p) => p.envVar && process.env[p.envVar])?.id ?? 'anthropic';

  const provider = await select<ProviderId>({
    message: 'Qual provedor de LLM?',
    choices: PROVIDER_CHOICES,
    default: providerSuggested,
  });

  const meta = PROVIDERS[provider];

  const generationModel = await input({
    message: 'Modelo para geração de testes?',
    default: meta.defaultGenerationModel,
  });

  const healingModel = await input({
    message: 'Modelo para self-healing?',
    default: meta.defaultHealingModel,
  });

  let apiKey = '';
  let useExistingEnv = false;
  if (meta.envVar) {
    const envValuePresent = Boolean(process.env[meta.envVar]);
    if (envValuePresent) {
      useExistingEnv = await confirm({
        message: `Usar ${meta.envVar} já detectada no seu ambiente?`,
        default: true,
      });
    }
    if (!useExistingEnv) {
      apiKey = await password({
        message: `${meta.label} API key (${meta.envVar})?`,
        mask: '*',
      });
    }
  }

  let aiBaseURL: string | undefined;
  if (meta.defaultBaseURL) {
    aiBaseURL = await input({
      message: `Endpoint para ${meta.label}?`,
      default: meta.defaultBaseURL,
    });
  }

  const initOptions: InitOptions = {
    rootDir,
    framework,
    include,
    testsDir,
    baseURL,
    ai: {
      provider,
      generationModel,
      healingModel,
      apiKey,
      useExistingEnv,
      baseURL: aiBaseURL,
    },
  };

  const result = await generateConfig(initOptions, cwd);

  const relative = path.relative(cwd, result.configPath);
  console.log(`\n✔  ${relative} created`);
  console.log(`✔  ${result.envNote}`);
  console.log(`\nNext step:\n  selfcure crawl ${rootDir}\n`);
}
