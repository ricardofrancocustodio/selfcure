# @selfcure/generator

Sends each `AnalysisResult` to **Claude** and receives a complete, runnable Playwright TypeScript spec file in return.

## API

### `generate(analyses, options): Promise<GeneratedTest[]>`

```ts
import { generate } from '@selfcure/generator';

const tests = await generate(analyses, {
  testsDir: './selfcure-tests',
  model: 'claude-opus-4-5',   // optional, defaults to claude-opus-4-5
  maxInputTokens: 4096,       // optional
});
```

### Types

```ts
interface GeneratorOptions {
  /** Claude model — default: 'claude-opus-4-5' */
  model?: string;
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
```

## Prompt structure

The prompt sent to Claude for each component:

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

## Output file naming

```
<testsDir>/<ComponentName>.spec.ts
```

## Required environment

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Runtime dependencies

| Package | Role |
|---------|------|
| `@anthropic-ai/sdk` | Claude API client |
| `@selfcure/analyzer` | Typed inputs |

## Source

`packages/generator/src/index.ts`
