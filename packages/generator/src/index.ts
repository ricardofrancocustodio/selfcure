import Anthropic from '@anthropic-ai/sdk';
import type { AnalysisResult } from '@selfcure/analyzer';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GeneratorOptions {
  /** Claude model for test generation — default: claude-opus-4-5 */
  model?: string;
  /** Output directory where generated test files will be written */
  testsDir: string;
  /** Cap per API request to avoid runaway costs */
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
  return `You are an expert Playwright test engineer.

Generate a complete, runnable Playwright TypeScript test file for the component described below.

## Component
- Name: ${component.componentName}
- Framework: ${component.framework}
- File: ${component.filePath}
- Testability score: ${score}/100

## Interactive elements
${interactiveElements.map((e) => `- ${e.type} [${e.selector}] — actions: ${e.actions.join(', ')}`).join('\n')}

## Rules
- Use \`@playwright/test\` imports only.
- Each test must be independent (no shared state).
- Use accessible-name selectors (getByRole, getByLabel) over CSS selectors where possible.
- Include at least one positive and one negative test case per interactive element.
- Output ONLY the TypeScript code, no markdown fences.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * For each analysed component, call Claude and receive a Playwright test file.
 * Requires ANTHROPIC_API_KEY in the environment.
 */
export async function generate(
  analyses: AnalysisResult[],
  options: GeneratorOptions,
): Promise<GeneratedTest[]> {
  const client = new Anthropic();
  const model = options.model ?? 'claude-opus-4-5';
  const results: GeneratedTest[] = [];

  for (const analysis of analyses) {
    const message = await client.messages.create({
      model,
      max_tokens: options.maxInputTokens ?? 4096,
      messages: [{ role: 'user', content: buildPrompt(analysis) }],
    });

    const testCode = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as Anthropic.TextBlock).text)
      .join('');

    results.push({
      filePath: `${options.testsDir}/${analysis.component.componentName}.spec.ts`,
      sourceComponent: analysis.component.filePath,
      testCode,
      generatedAt: new Date(),
    });
  }

  return results;
}

export default generate;
