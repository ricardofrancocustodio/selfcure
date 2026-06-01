import { generateText } from 'ai';
import type { AnalysisResult } from '@selfcure/analyzer';
import { getModel, type AIConfig } from './ai.js';

// Re-export the provider layer so consumers can import everything from
// @selfcure/generator without juggling subpaths.
export {
  PROVIDERS,
  getModel,
  type AIConfig,
  type ProviderId,
  type ProviderMeta,
  type ModelKind,
} from './ai.js';

export type { DiscoveryLlmInput, DiscoveryLlmOutput, HiddenStateHint } from './discovery.js';
export { buildDiscoveryInput, buildDiscoveryPrompt, validateDiscoveryOutput, shouldUseLlm, runLlmDiscovery } from './discovery.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GeneratorOptions {
  /** Resolved `ai` block from selfcure.config.mjs — provider + model overrides */
  ai: AIConfig;
  /** Output directory where generated test files will be written */
  testsDir: string;
  /** Cap per LLM request to avoid runaway costs */
  maxInputTokens?: number;
}

export interface GeneratedTest {
  /** Absolute path of the generated .spec.ts file */
  filePath: string;
  sourceComponent: string;
  testCode: string;
  generatedAt: Date;
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(analysis: AnalysisResult): string {
  const { component, interactiveElements, score } = analysis;

  const ambiguous = interactiveElements.filter((e) => e.ambiguous);
  const ambiguitySection = ambiguous.length
    ? `\n\n## Ambiguous locators\nThe following elements have no unique locator in this component — multiple nodes share the best available selector. For each, narrow the locator (e.g. \`page.getByRole('button', { name: ... })\`, \`.filter({ hasText })\`, \`.nth(i)\`, or scope under a parent) so each test targets exactly one node:\n${ambiguous.map((e) => `- ${e.type} [${e.selector}]${e.label ? ` — label: "${e.label}"` : ''} (${e.ambiguityReason ?? 'matches multiple elements'})`).join('\n')}`
    : '';

  return `You are an expert Playwright test engineer.

Generate a complete, runnable Playwright TypeScript test file for the component described below.

## Component
- Name: ${component.componentName}
- Framework: ${component.framework}
- File: ${component.filePath}
- Testability score: ${score}/100

## Interactive elements
${interactiveElements.map((e) => `- ${e.type} [${e.selector}]${e.ambiguous ? ' ⚠ ambiguous' : ''} — actions: ${e.actions.join(', ')}`).join('\n')}${ambiguitySection}

## Rules
- Use \`@playwright/test\` imports only.
- Each test must be independent (no shared state).
- Use accessible-name selectors (getByRole, getByLabel) over CSS selectors where possible.
- For elements flagged as ambiguous, never use the bare selector — always combine with a name, text, or scoping locator so the query resolves to exactly one node.
- Include at least one positive and one negative test case per interactive element.
- Output ONLY the TypeScript code, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * For each analysed component, call the configured LLM and receive a
 * Playwright test file. The provider (Anthropic/OpenAI/Google/Groq/DeepSeek/
 * Ollama) and model are resolved from `options.ai`.
 *
 * The required API key is read from the env var declared by the provider
 * (e.g. ANTHROPIC_API_KEY, OPENAI_API_KEY, …).
 */
export async function generate(
  analyses: AnalysisResult[],
  options: GeneratorOptions,
): Promise<GeneratedTest[]> {
  const model = getModel(options.ai, 'generation');
  const results: GeneratedTest[] = [];

  for (const analysis of analyses) {
    const { text } = await generateText({
      model,
      prompt: buildPrompt(analysis),
      maxOutputTokens: options.maxInputTokens ?? 4096,
    });

    results.push({
      filePath: `${options.testsDir}/${analysis.component.componentName}.spec.ts`,
      sourceComponent: analysis.component.filePath,
      testCode: text,
      generatedAt: new Date(),
    });
  }

  return results;
}

export default generate;
