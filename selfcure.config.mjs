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

  /**
   * Framework hint — skips auto-detection.
   * Values: 'react' | 'vue' | 'angular' | 'auto'
   * @default 'auto'
   */
  framework: 'auto',

  // ── Authentication (omit entire block for public / unauthenticated apps) ─
  //
  // Choose ONE of the four strategies below and delete the others.
  //
  // Strategy 1 — Form-based login
  // selfcure navigates to loginURL, fills the fields, and clicks submit.
  // The resulting browser session is reused for all generated tests.
  //
  // auth: {
  //   type: 'form',
  //   loginURL: '/login',
  //   usernameSelector: '[name="username"]',
  //   passwordSelector: '[name="password"]',
  //   submitSelector: 'button[type=submit]',
  //   waitForURL: '/dashboard',   // URL (or glob) to wait for after login
  //   username: process.env.SELFCURE_USERNAME,
  //   password: process.env.SELFCURE_PASSWORD,
  // },
  //
  // Strategy 2 — Playwright storage-state (pre-authenticated)
  // Run `selfcure auth-save` once to generate the file, then commit it
  // (or add it to .gitignore and generate it in CI).
  //
  // auth: {
  //   type: 'storageState',
  //   storageState: './.selfcure-auth.json',
  // },
  //
  // Strategy 3 — HTTP Basic Auth (.htaccess / nginx auth_basic)
  //
  // auth: {
  //   type: 'httpCredentials',
  //   username: process.env.SELFCURE_USERNAME,
  //   password: process.env.SELFCURE_PASSWORD,
  // },
  //
  // Strategy 4 — Custom request headers (Bearer token, API key, etc.)
  //
  // auth: {
  //   type: 'headers',
  //   extraHTTPHeaders: {
  //     Authorization: `Bearer ${process.env.SELFCURE_TOKEN}`,
  //     'X-Api-Key': process.env.SELFCURE_API_KEY,
  //   },
  // },

  // ── Browser ──────────────────────────────────────────────────────────────
  browser: {
    /** 'chromium' | 'firefox' | 'webkit' */
    type: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 720 },
    /** Default navigation + action timeout in ms */
    timeout: 30_000,
    /** Slow-motion delay between actions in ms (0 = disabled) */
    slowMo: 0,
  },

  // ── AI provider ──────────────────────────────────────────────────────────
  // Pick ONE provider. The required API key is read from the env var named
  // below — selfcure never embeds the key in this file.
  //
  // Supported providers (id → env var):
  //   anthropic → ANTHROPIC_API_KEY
  //   openai    → OPENAI_API_KEY
  //   google    → GOOGLE_GENERATIVE_AI_API_KEY
  //   groq      → GROQ_API_KEY
  //   deepseek  → DEEPSEEK_API_KEY        (uses baseURL https://api.deepseek.com/v1)
  //   ollama    → (no key — runs locally at http://localhost:11434/v1)
  ai: {
    provider: 'anthropic',
    /** Strong model for one-shot test generation */
    generationModel: 'claude-opus-4-7',
    /** Cheap, fast model for healing diffs */
    healingModel: 'claude-haiku-4-5',
    // baseURL: 'http://localhost:11434/v1',   // override for Ollama / self-hosted
    // apiKeyEnv: 'MY_CUSTOM_VAR',             // override the default env var name
  },

  // ── Test generation ──────────────────────────────────────────────────────
  /** Output directory for generated Playwright spec files */
  testsDir: './selfcure-tests',

  /** Cap input tokens per generation request to avoid runaway costs */
  maxInputTokens: 4096,

  // ── Test execution ────────────────────────────────────────────────────────
  /** Path to your Playwright configuration file */
  playwrightConfig: './playwright.config.ts',

  /** Base URL of the running application during tests */
  baseURL: 'http://localhost:3000',

  // ── Self-healing ─────────────────────────────────────────────────────────
  /** Maximum patch attempts before a test is left as failing */
  maxHealAttempts: 3,

  // ── Reporting ────────────────────────────────────────────────────────────
  /** Directory where the HTML report and JSON summary are written */
  reportDir: './selfcure-report',

  /** Title displayed in the HTML report */
  reportTitle: 'Selfcure Report',
};
