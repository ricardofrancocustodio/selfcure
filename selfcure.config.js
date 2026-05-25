// selfcure.config.js — configuration for the TARGET project under test
// Copy this file to the root of the project you want to test, then run:
//   npx selfcure init   (auto-scaffolds this file)
//   npx selfcure run

/** @type {import('@selfcure/cli').SelfcureConfig} */
export default {
  // ── Source crawl ────────────────────────────────────────────────────────
  /** Root directory of the frontend codebase to crawl */
  rootDir: './src',

  /** Glob patterns (relative to rootDir) to include */
  include: ['**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.component.ts'],

  /** Patterns to exclude from crawling */
  exclude: [
    '**/*.spec.*',
    '**/*.test.*',
    '**/node_modules/**',
    '**/dist/**',
  ],

  // ── Test generation ──────────────────────────────────────────────────────
  /** Output directory for generated Playwright spec files */
  testsDir: './selfcure-tests',

  /** Claude model used for test generation (high quality, higher cost) */
  generationModel: 'claude-opus-4-5',

  /** Cap input tokens per generation request to avoid runaway costs */
  maxInputTokens: 4096,

  // ── Test execution ────────────────────────────────────────────────────────
  /** Path to your Playwright configuration file */
  playwrightConfig: './playwright.config.ts',

  /** Base URL of the running application during tests */
  baseURL: 'http://localhost:3000',

  // ── Self-healing ─────────────────────────────────────────────────────────
  /** Claude model used for healing fixes (fast, lower cost) */
  healingModel: 'claude-haiku-3-5',

  /** Maximum patch attempts before a test is left as failing */
  maxHealAttempts: 3,

  // ── Reporting ────────────────────────────────────────────────────────────
  /** Directory where the HTML report and JSON summary are written */
  reportDir: './selfcure-report',

  /** Title displayed in the HTML report */
  reportTitle: 'Selfcure Report',
};
