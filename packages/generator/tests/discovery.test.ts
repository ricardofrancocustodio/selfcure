import { describe, it, expect } from 'vitest';
import {
  buildDiscoveryInput,
  buildDiscoveryPrompt,
  validateDiscoveryOutput,
  shouldUseLlm,
} from '../src/discovery.js';
import type { ProjectMap } from '@selfcure/crawler';
import type { RuntimeDiscoveryResult } from '@selfcure/runner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMap(overrides: Partial<ProjectMap> = {}): ProjectMap {
  return {
    projectRoot: '/app',
    framework:       'next',
    packageManager:  'npm',
    devCommand:      'npm run dev',
    buildCommand:    'npm run build',
    testCommand:     'npm test',
    routeCandidates: [
      { path: '/',        filePath: '/app/pages/index.tsx', isDynamic: false, confidence: 0.95, source: 'pages-dir' },
      { path: '/login',   filePath: '/app/pages/login.tsx', isDynamic: false, confidence: 0.95, source: 'pages-dir' },
      { path: '/checkout',filePath: '/app/pages/checkout.tsx', isDynamic: false, confidence: 0.80, source: 'pages-dir' },
    ],
    componentCandidates: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeRtResult(overrides: Partial<RuntimeDiscoveryResult> = {}): RuntimeDiscoveryResult {
  return {
    scannedRoutes: 3,
    reachable:     3,
    errored:       0,
    routes: [
      { url: 'http://localhost:3000/', route: '/', status: 'reachable', interactiveElements: [], consoleErrors: [], loadTimeMs: 100 },
      { url: 'http://localhost:3000/login', route: '/login', status: 'reachable', interactiveElements: [], consoleErrors: [], loadTimeMs: 120 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildDiscoveryInput
// ---------------------------------------------------------------------------

describe('buildDiscoveryInput', () => {
  it('maps framework and package manager', () => {
    const input = buildDiscoveryInput(makeMap());
    expect(input.framework).toBe('next');
    expect(input.packageManager).toBe('npm');
  });

  it('includes non-empty scripts only', () => {
    const input = buildDiscoveryInput(makeMap({ devCommand: 'npm run dev', buildCommand: undefined, testCommand: 'npm test' }));
    expect(input.packageScripts).toEqual(['npm run dev', 'npm test']);
  });

  it('lists all route paths', () => {
    const input = buildDiscoveryInput(makeMap());
    expect(input.routeCandidates).toEqual(['/', '/login', '/checkout']);
  });

  it('omits runtimeFindings when no rtResult given', () => {
    const input = buildDiscoveryInput(makeMap());
    expect(input.runtimeFindings).toBeUndefined();
  });

  it('includes runtimeFindings when rtResult given', () => {
    const input = buildDiscoveryInput(makeMap(), makeRtResult());
    expect(input.runtimeFindings).toHaveLength(2);
    expect(input.runtimeFindings![0]).toMatchObject({ route: '/', status: 'reachable' });
  });

  it('counts flagged elements (score < 80) in runtimeFindings', () => {
    const rt = makeRtResult({
      routes: [{
        url: 'http://localhost:3000/', route: '/', status: 'reachable',
        interactiveElements: [
          { tag: 'button', selector: 'button', score: 100 },
          { tag: 'button', selector: 'button', score: 20 },  // flagged
          { tag: 'input',  selector: 'input',  score: 50 },  // flagged
        ],
        consoleErrors: [], loadTimeMs: 100,
      }],
      scannedRoutes: 1, reachable: 1, errored: 0,
    });
    const input = buildDiscoveryInput(makeMap(), rt);
    expect(input.runtimeFindings![0]!.flaggedCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// shouldUseLlm
// ---------------------------------------------------------------------------

describe('shouldUseLlm', () => {
  it('returns false when all routes have high confidence and no runtime failures', () => {
    const map = makeMap({
      routeCandidates: [
        { path: '/',      filePath: '', isDynamic: false, confidence: 0.95, source: 'pages-dir' },
        { path: '/about', filePath: '', isDynamic: false, confidence: 0.95, source: 'pages-dir' },
      ],
    });
    expect(shouldUseLlm(map, makeRtResult())).toBe(false);
  });

  it('returns true when average confidence < 0.85', () => {
    const map = makeMap({
      routeCandidates: [
        { path: '/',     filePath: '', isDynamic: false, confidence: 0.75, source: 'router-config' },
        { path: '/blog', filePath: '', isDynamic: false, confidence: 0.65, source: 'router-config' },
      ],
    });
    expect(shouldUseLlm(map)).toBe(true);
  });

  it('returns true when runtime shows unreachable routes', () => {
    const map = makeMap({
      routeCandidates: [
        { path: '/', filePath: '', isDynamic: false, confidence: 0.95, source: 'pages-dir' },
      ],
    });
    const rt = makeRtResult({
      routes: [{ url: 'http://localhost:3000/', route: '/', status: 'auth-required', interactiveElements: [], consoleErrors: [], loadTimeMs: 50 }],
      reachable: 0, errored: 1,
    });
    expect(shouldUseLlm(map, rt)).toBe(true);
  });

  it('returns true when no route candidates exist', () => {
    const map = makeMap({ routeCandidates: [] });
    expect(shouldUseLlm(map)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildDiscoveryPrompt
// ---------------------------------------------------------------------------

describe('buildDiscoveryPrompt', () => {
  it('contains framework name', () => {
    const prompt = buildDiscoveryPrompt({ framework: 'next', packageManager: 'npm', packageScripts: [], routeCandidates: ['/'] });
    expect(prompt).toContain('next');
  });

  it('contains routeCandidates', () => {
    const prompt = buildDiscoveryPrompt({ framework: 'react', packageManager: 'npm', packageScripts: [], routeCandidates: ['/login', '/checkout'] });
    expect(prompt).toContain('/login');
    expect(prompt).toContain('/checkout');
  });

  it('instructs model to respond with JSON only', () => {
    const prompt = buildDiscoveryPrompt({ framework: 'vue', packageManager: 'pnpm', packageScripts: [], routeCandidates: [] });
    expect(prompt).toContain('ONLY valid JSON');
  });
});

// ---------------------------------------------------------------------------
// validateDiscoveryOutput
// ---------------------------------------------------------------------------

describe('validateDiscoveryOutput', () => {
  const allowed = ['/', '/login', '/checkout'];

  it('accepts a valid output', () => {
    const raw = {
      routesToVisit: ['/', '/login'],
      hiddenStatesToExplore: [{ route: '/checkout', triggerHint: 'Click "Add to cart"' }],
      confidence: 0.82,
      notes: [],
    };
    const result = validateDiscoveryOutput(raw, allowed);
    expect(result.routesToVisit).toEqual(['/', '/login']);
    expect(result.confidence).toBe(0.82);
    expect(result.hiddenStatesToExplore).toHaveLength(1);
  });

  it('throws when output is not an object', () => {
    expect(() => validateDiscoveryOutput('bad', allowed)).toThrow();
  });

  it('throws when routesToVisit is missing', () => {
    expect(() => validateDiscoveryOutput({ confidence: 0.5, notes: [] }, allowed)).toThrow('routesToVisit');
  });

  it('throws when confidence is out of range', () => {
    expect(() => validateDiscoveryOutput({ routesToVisit: [], confidence: 1.5, notes: [] }, allowed)).toThrow('confidence');
  });

  it('filters routesToVisit to allowed candidates only', () => {
    const raw = {
      routesToVisit: ['/', '/hallucinated-route'],
      hiddenStatesToExplore: [],
      confidence: 0.9,
      notes: [],
    };
    const result = validateDiscoveryOutput(raw, allowed);
    expect(result.routesToVisit).toEqual(['/']);
    expect(result.routesToVisit).not.toContain('/hallucinated-route');
  });

  it('accepts empty hiddenStatesToExplore and notes', () => {
    const raw = { routesToVisit: ['/'], hiddenStatesToExplore: [], confidence: 0.5, notes: [] };
    const result = validateDiscoveryOutput(raw, allowed);
    expect(result.hiddenStatesToExplore).toEqual([]);
    expect(result.notes).toEqual([]);
  });

  it('filters out malformed hiddenStatesToExplore entries', () => {
    const raw = {
      routesToVisit: ['/'],
      hiddenStatesToExplore: [
        { route: '/checkout', triggerHint: 'ok' },   // valid
        { route: '/bad' },                            // missing triggerHint
        'not-an-object',                              // wrong type
      ],
      confidence: 0.7,
      notes: [],
    };
    const result = validateDiscoveryOutput(raw, allowed);
    expect(result.hiddenStatesToExplore).toHaveLength(1);
  });

  it('defaults hiddenStatesToExplore to [] when absent', () => {
    const raw = { routesToVisit: ['/'], confidence: 0.8, notes: [] };
    const result = validateDiscoveryOutput(raw, allowed);
    expect(result.hiddenStatesToExplore).toEqual([]);
  });
});
