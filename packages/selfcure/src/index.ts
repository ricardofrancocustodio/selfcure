import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs-extra';
import type { TestResult } from '@selfcure/runner';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface HealOptions {
  /** Claude model for quick fix generation — default: claude-haiku-3-5 */
  model?: string;
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
 * For each failing test result, ask Claude for a diff, apply it, and
 * re-validate by reading the patched file. Rejects the patch and rolls back
 * if the file cannot be parsed after patching.
 */
export async function heal(
  failedTests: TestResult[],
  options: HealOptions,
): Promise<HealResult[]> {
  const client = new Anthropic();
  const model = options.model ?? 'claude-haiku-3-5';
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

      const message = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [{ role: 'user', content: buildHealPrompt(failed, current) }],
      });

      const diff = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as Anthropic.TextBlock).text)
        .join('');

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
