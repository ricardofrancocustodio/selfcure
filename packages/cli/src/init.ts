import { input, select, password, checkbox } from '@inquirer/prompts';
import path from 'node:path';
import { generateConfig, FRAMEWORK_EXTENSIONS } from '@selfcure/web';

// ---------------------------------------------------------------------------
// selfcure init — interactive CLI wizard
// ---------------------------------------------------------------------------

const FRAMEWORK_CHOICES = [
  { name: 'React', value: 'react' },
  { name: 'Vue', value: 'vue' },
  { name: 'Angular', value: 'angular' },
  { name: 'HTML / Other', value: 'auto' },
] as const;

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

  const apiKey = await password({
    message: 'API key (Anthropic)?',
    mask: '*',
  });

  const result = await generateConfig(
    { rootDir, framework, include, testsDir, baseURL, apiKey },
    cwd,
  );

  const relative = path.relative(cwd, result.configPath);
  console.log(`\n✔  ${relative} created`);
  console.log(`✔  .env written (ANTHROPIC_API_KEY)`);
  console.log(`\nNext step:\n  selfcure crawl ${rootDir}\n`);
}
