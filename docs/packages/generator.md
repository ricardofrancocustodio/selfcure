# @selfcure/generator

Sends each `AnalysisResult` to the configured LLM (Anthropic / OpenAI / Google /
Groq / DeepSeek / Ollama) and receives a complete, runnable Playwright TypeScript
spec file in return. Multi-provider support is provided by the [Vercel AI SDK](https://sdk.vercel.ai).

## API

### `generate(analyses, options): Promise<GeneratedTest[]>`

```ts
import { generate } from '@selfcure/generator';

const tests = await generate(analyses, {
  testsDir: './selfcure-tests',
  ai: {
    provider: 'anthropic',
    generationModel: 'claude-opus-4-7',
    healingModel:    'claude-haiku-4-5',
  },
  maxInputTokens: 4096,
});
```

### Types

```ts
interface GeneratorOptions {
  /** Resolved `ai` block from selfcure.config.mjs */
  ai: AIConfig;
  /** Directory where .spec.ts files will be written */
  testsDir: string;
  /** Token cap per request — default: 4096 */
  maxInputTokens?: number;
}

interface GeneratedTest {
  /** Absolute path of the generated spec file */
  filePath: string;
  sourceComponent: string;
  testCode: string;
  generatedAt: Date;
}

interface AIConfig {
  provider: ProviderId;        // 'anthropic' | 'openai' | 'google' | 'groq' | 'deepseek' | 'ollama'
  generationModel?: string;    // falls back to PROVIDERS[provider].defaultGenerationModel
  healingModel?: string;       // falls back to PROVIDERS[provider].defaultHealingModel
  apiKeyEnv?: string;          // override the default env var name
  baseURL?: string;            // override the endpoint (Ollama / self-hosted)
}
```

## Provider layer

`@selfcure/generator` also exposes the provider resolver consumed by
`@selfcure/selfcure` and `@selfcure/web`:

```ts
import { PROVIDERS, getModel } from '@selfcure/generator';

const model = getModel({ provider: 'openai' }, 'generation');
// → LanguageModel from @ai-sdk/openai
```

| Export | Description |
|--------|-------------|
| `PROVIDERS` | `Record<ProviderId, ProviderMeta>` — labels, env vars, default models, endpoints |
| `getModel(ai, kind)` | Returns a Vercel AI SDK `LanguageModel` for the given config + role |
| `AIConfig` / `ProviderId` / `ProviderMeta` / `ModelKind` | TypeScript types |

See [docs/configuration.md §4](../configuration.md#§4-ai-provider) for the full
provider table.

## Prompt structure

The prompt sent to the LLM for each component:

```
You are an expert Playwright test engineer.

Generate a complete, runnable Playwright TypeScript test file for the component described below.

## Component
- Name: <componentName>
- Framework: <framework>
- File: <filePath>
- Testability score: <score>/100

## Interactive elements
- button [role=button, aria-label="Submit"] — actions: click
- input  [placeholder="Email"]             — actions: fill, clear

## Rules
- Use @playwright/test imports only.
- Each test must be independent (no shared state).
- Use accessible-name selectors (getByRole, getByLabel) over CSS selectors.
- Include at least one positive and one negative test case per element.
- Output ONLY the TypeScript code, no markdown fences.
```

The prompt is plain text — provider-agnostic — and works the same against every
supported model.

## Output file naming

```
<testsDir>/<ComponentName>.spec.ts
```

## Required environment

One env var, matching `ai.provider`:

| Provider | Env var |
|----------|---------|
| `anthropic` | `ANTHROPIC_API_KEY` |
| `openai` | `OPENAI_API_KEY` |
| `google` | `GOOGLE_GENERATIVE_AI_API_KEY` |
| `groq` | `GROQ_API_KEY` |
| `deepseek` | `DEEPSEEK_API_KEY` |
| `ollama` | *(none — local)* |

## Runtime dependencies

| Package | Role |
|---------|------|
| `ai` | Vercel AI SDK core — `generateText` |
| `@ai-sdk/anthropic` | Anthropic provider adapter |
| `@ai-sdk/openai` | OpenAI provider adapter |
| `@ai-sdk/google` | Gemini provider adapter |
| `@ai-sdk/groq` | Groq provider adapter |
| `@ai-sdk/openai-compatible` | DeepSeek + Ollama (both speak OpenAI dialect) |
| `@selfcure/analyzer` | Typed inputs |

## Source

`packages/generator/src/index.ts` (public API) · `packages/generator/src/ai.ts` (provider layer)
