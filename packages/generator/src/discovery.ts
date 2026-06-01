import { generateText } from 'ai';
import { getModel, type AIConfig } from './ai.js';
import type { ProjectMap, RouteCandidate } from '@selfcure/crawler';
import type { RuntimeDiscoveryResult } from '@selfcure/runner';

// ---------------------------------------------------------------------------
// Structured types — the LLM speaks only JSON using these schemas
// ---------------------------------------------------------------------------

export interface DiscoveryLlmInput {
  framework:        string;
  packageManager:   string;
  packageScripts:   string[];
  routeCandidates:  string[];
  /** Present only when runtime discovery already ran */
  runtimeFindings?: {
    route:        string;
    status:       string;
    flaggedCount: number;
  }[];
}

export interface HiddenStateHint {
  route:       string;
  /** Plain-language description of the UI trigger, e.g. "button 'Add to cart'" */
  triggerHint: string;
}

export interface DiscoveryLlmOutput {
  routesToVisit:         string[];
  hiddenStatesToExplore: HiddenStateHint[];
  /** LLM's own confidence in its suggestions, 0–1 */
  confidence:            number;
  notes:                 string[];
}

// ---------------------------------------------------------------------------
// Input builder (pure — converts ProjectMap → compact LLM payload)
// ---------------------------------------------------------------------------

/** Build the compact structured input for the discovery LLM call. */
export function buildDiscoveryInput(
  map:       ProjectMap,
  rtResult?: RuntimeDiscoveryResult,
): DiscoveryLlmInput {
  const scripts: string[] = [
    map.devCommand,
    map.buildCommand,
    map.testCommand,
  ].filter((s): s is string => Boolean(s));

  const input: DiscoveryLlmInput = {
    framework:       map.framework,
    packageManager:  map.packageManager,
    packageScripts:  scripts,
    routeCandidates: map.routeCandidates.map((r: RouteCandidate) => r.path),
  };

  if (rtResult) {
    input.runtimeFindings = rtResult.routes.map((r) => ({
      route:        r.route,
      status:       r.status,
      flaggedCount: r.interactiveElements.filter((e: { score: number }) => e.score < 80).length,
    }));
  }

  return input;
}

// ---------------------------------------------------------------------------
// Threshold — when should we bother calling the LLM?
// ---------------------------------------------------------------------------

/**
 * Return true when the deterministic evidence is uncertain enough that an LLM
 * call is worthwhile.  Skip LLM when:
 * - All static route candidates have confidence >= 0.9 AND
 * - Runtime shows no unreachable routes (or runtime wasn't run)
 */
export function shouldUseLlm(
  map:       ProjectMap,
  rtResult?: RuntimeDiscoveryResult,
): boolean {
  const avgConf = map.routeCandidates.length > 0
    ? map.routeCandidates.reduce((s, r) => s + r.confidence, 0) / map.routeCandidates.length
    : 0;

  if (avgConf < 0.85) return true;

  if (rtResult) {
    const hasUnreachable = rtResult.routes.some((r: { status: string }) => r.status !== 'reachable');
    if (hasUnreachable) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Prompt builder (pure)
// ---------------------------------------------------------------------------

export function buildDiscoveryPrompt(input: DiscoveryLlmInput): string {
  return [
    `You are analyzing a ${input.framework} frontend application to improve testability coverage.`,
    '',
    'Given the project information below, identify:',
    '1. Which route candidates are the most important to test (prioritise by user-journey value)',
    '2. Any hidden states (modals, drawers, wizard steps, dialogs) likely triggered from those routes',
    '',
    'Project information:',
    JSON.stringify(input, null, 2),
    '',
    'Respond with ONLY valid JSON — no prose, no markdown fences:',
    '{',
    '  "routesToVisit": ["/", "/login"],',
    '  "hiddenStatesToExplore": [',
    '    { "route": "/checkout", "triggerHint": "button with accessible name \'Add payment method\'" }',
    '  ],',
    '  "confidence": 0.82,',
    '  "notes": []',
    '}',
    '',
    'Rules:',
    '- routesToVisit must be a subset of routeCandidates',
    '- confidence must be a number between 0 and 1',
    '- hiddenStatesToExplore may be an empty array',
    '- notes may be an empty array',
    '- Do NOT include any explanation outside the JSON object',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Output validation (pure — throws on bad LLM output)
// ---------------------------------------------------------------------------

export function validateDiscoveryOutput(raw: unknown, allowedRoutes: string[]): DiscoveryLlmOutput {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Discovery LLM output is not an object');
  }
  const r = raw as Record<string, unknown>;

  if (!Array.isArray(r['routesToVisit'])) {
    throw new Error('routesToVisit must be an array');
  }
  if (typeof r['confidence'] !== 'number' || r['confidence'] < 0 || r['confidence'] > 1) {
    throw new Error('confidence must be a number between 0 and 1');
  }

  // Filter routesToVisit to known candidates only (guard against LLM hallucination)
  const allowed = new Set(allowedRoutes);
  const routesToVisit = (r['routesToVisit'] as unknown[])
    .filter((x): x is string => typeof x === 'string' && allowed.has(x));

  const hiddenStatesToExplore = Array.isArray(r['hiddenStatesToExplore'])
    ? (r['hiddenStatesToExplore'] as unknown[]).filter(
        (x): x is HiddenStateHint =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as Record<string, unknown>)['route']       === 'string' &&
          typeof (x as Record<string, unknown>)['triggerHint'] === 'string',
      )
    : [];

  const notes = Array.isArray(r['notes'])
    ? (r['notes'] as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];

  return {
    routesToVisit,
    hiddenStatesToExplore,
    confidence: r['confidence'] as number,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Main LLM call
// ---------------------------------------------------------------------------

/**
 * Ask the configured LLM provider to suggest which routes to visit and which
 * hidden states to explore.  Only called when `shouldUseLlm()` returns true.
 *
 * Throws if the provider API key is missing or the response cannot be parsed.
 */
export async function runLlmDiscovery(
  input:    DiscoveryLlmInput,
  aiConfig: AIConfig,
): Promise<DiscoveryLlmOutput> {
  const model  = getModel(aiConfig, 'generation');
  const prompt = buildDiscoveryPrompt(input);

  const { text } = await generateText({ model, prompt, maxOutputTokens: 1000 });

  // Extract the first JSON object from the response (guards against markdown fences)
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`LLM response contained no JSON object.\n\nRaw response:\n${text}`);
  }

  const parsed = JSON.parse(match[0]) as unknown;
  return validateDiscoveryOutput(parsed, input.routeCandidates);
}
