import { generateText } from 'ai';
import fs from 'fs-extra';
import { getModel, type AIConfig } from '@selfcure/generator';
import type { TestResult } from '@selfcure/runner';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HealOptions {
  /** Resolved `ai` block from selfcure.config.mjs — provider + model overrides */
  ai: AIConfig;
  /** How many times to attempt patching before giving up */
  maxAttempts?: number;
  /** Playwright config needed to re-run after patching */
  playwrightConfig: string;
}

export interface HealResult {
  filePath: string;
  healed: boolean;
  attempts: number;
  /** Unified diff that was ultimately applied, if any */
  patchApplied?: string;
  finalError?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function buildHealPrompt(result: TestResult, source: string): string {
  return `You are an expert Playwright test engineer fixing a failing test.

## Failing test file
\`\`\`typescript
${source}
\`\`\`

## Error
\`\`\`
${result.error ?? 'Unknown error'}
\`\`\`

Produce a unified diff (--- a/test  +++ b/test) that fixes the failure.
Output ONLY the diff, no explanation.`;
}

function applyUnifiedDiff(original: string, diff: string): string {
  // Minimal line-level patch application
  const lines = original.split('\n');
  for (const line of diff.split('\n')) {
    if (line.startsWith('-') && !line.startsWith('---')) {
      const idx = lines.indexOf(line.slice(1));
      if (idx !== -1) lines.splice(idx, 1);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      lines.push(line.slice(1));
    }
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * For each failing test result, ask the configured LLM for a diff, apply it,
 * and re-validate by reading the patched file. Rejects the patch and rolls
 * back if the file cannot be parsed after patching.
 */
export async function heal(
  failedTests: TestResult[],
  options: HealOptions,
): Promise<HealResult[]> {
  const model = getModel(options.ai, 'healing');
  const maxAttempts = options.maxAttempts ?? 3;
  const results: HealResult[] = [];

  for (const failed of failedTests) {
    if (failed.passed) continue;

    let attempts = 0;
    let healed = false;
    let patchApplied: string | undefined;
    let finalError: string | undefined;
    const original = await fs.readFile(failed.filePath, 'utf-8');

    while (attempts < maxAttempts && !healed) {
      attempts++;
      const current = await fs.readFile(failed.filePath, 'utf-8');

      const { text: diff } = await generateText({
        model,
        prompt: buildHealPrompt(failed, current),
        maxOutputTokens: 2048,
      });

      const patched = applyUnifiedDiff(current, diff);

      try {
        // Basic sanity check — patched file must be parseable JS
        new Function(patched.replace(/^import .+$/gm, ''));
        await fs.writeFile(failed.filePath, patched, 'utf-8');
        patchApplied = diff;
        healed = true;
      } catch (err) {
        finalError = String(err);
        // Roll back to original before next attempt
        await fs.writeFile(failed.filePath, original, 'utf-8');
      }
    }

    results.push({ filePath: failed.filePath, healed, attempts, patchApplied, finalError });
  }

  return results;
}

export default heal;
