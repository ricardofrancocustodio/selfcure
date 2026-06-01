import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RunOptions {
  /** Absolute path to playwright.config.ts */
  playwrightConfig: string;
  /** Subset of test files to run; omit to run all */
  testFiles?: string[];
  /** Base URL forwarded to Playwright via env */
  baseURL?: string;
}

export interface TestResult {
  filePath: string;
  passed: boolean;
  error?: string;
  /** Absolute path to the .zip trace if Playwright captured one */
  tracePath?: string;
  durationMs: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute Playwright tests via the CLI and parse the JSON reporter output.
 * Always enables `--trace on-first-retry` so healer has trace data on failure.
 */
export async function run(options: RunOptions): Promise<TestResult[]> {
  const args = [
    'playwright',
    'test',
    '--reporter=json',
    '--trace=on-first-retry',
    `--config=${options.playwrightConfig}`,
    ...(options.testFiles ?? []),
  ];

  const env = {
    ...process.env,
    ...(options.baseURL ? { PLAYWRIGHT_BASE_URL: options.baseURL } : {}),
  };

  const results: TestResult[] = [];

  try {
    const { stdout } = await execFileAsync('npx', args, {
      env,
      cwd: path.dirname(options.playwrightConfig),
    });

    // Parse Playwright JSON reporter output
    const report = JSON.parse(stdout) as {
      suites: Array<{
        specs: Array<{
          file: string;
          ok: boolean;
          tests: Array<{ results: Array<{ error?: { message: string }; duration: number }> }>;
        }>;
      }>;
    };

    for (const suite of report.suites) {
      for (const spec of suite.specs) {
        const lastResult = spec.tests[0]?.results.at(-1);
        results.push({
          filePath: spec.file,
          passed: spec.ok,
          error: lastResult?.error?.message,
          durationMs: lastResult?.duration ?? 0,
        });
      }
    }
  } catch (err) {
    // Playwright exits with non-zero on test failure — parse stderr for context
    results.push({
      filePath: '<unknown>',
      passed: false,
      error: String(err),
      durationMs: 0,
    });
  }

  return results;
}

export default run;

export type { DynamicScanOptions, DynamicScanRoute, DynamicScanResult } from './a11y/dynamic.js';
export { runDynamicScan, wcagRefsFromTags, impactToSeverity, levelFromTags } from './a11y/dynamic.js';

export type { RuntimeElement, RuntimeRouteEvidence, RuntimeDiscoveryOptions, RuntimeDiscoveryResult } from './discovery/runtime.js';
export { runRuntimeDiscovery, scoreElement, buildRuntimeSelector } from './discovery/runtime.js';
