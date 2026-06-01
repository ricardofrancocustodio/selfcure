import { describe, it, expect } from 'vitest';
import { enrichTmlWithRuntime } from '../src/tml/runtime.js';
import { assessTagMaturity } from '../src/tml/score.js';
import type { RuntimeMap } from '../src/tml/runtime.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEl(overrides: {
  testId?: string; ariaLabel?: string; id?: string;
  score?: number; ambiguous?: boolean;
}) {
  const { testId, ariaLabel, id, score = 100, ambiguous = false } = overrides;
  const strategy = testId ? 'data-testid' : ariaLabel ? 'aria-label' : id ? 'id' : 'css';
  return {
    testabilityScore: score,
    ambiguous,
    label:            ariaLabel,
    type:             'button',
    selectors: {
      dataTestId: testId ? `[data-testid="${testId}"]` : undefined,
      ariaLabel:  ariaLabel ? `button[aria-label="${ariaLabel}"]` : undefined,
      id:         id ? `#${id}` : undefined,
    },
    selectorRanking: [{ strategy }],
    tml: undefined as unknown,
  };
}

function makeRtMap(routes: RuntimeMap['routes']): RuntimeMap {
  return { routes };
}

function makeRtEl(opts: { testId?: string; name?: string; selector?: string }) {
  return {
    tag: 'button',
    testId:   opts.testId,
    name:     opts.name,
    selector: opts.selector ?? opts.testId ? `[data-testid="${opts.testId}"]` : 'button',
  };
}

// ---------------------------------------------------------------------------
// Runtime caps in computeCeilingLevel (via assessTagMaturity)
// ---------------------------------------------------------------------------

describe('runtime caps — assessTagMaturity direct', () => {
  it('caps at TML 2 when not observed (would be TML 3 without runtime)', () => {
    const r = assessTagMaturity({
      testabilityScore: 100, ambiguous: false,
      bestStrategy: 'data-testid', elementType: 'button',
      runtime: { observed: false, unique: false },
    });
    expect(r.level).toBe(2);
    expect(r.reasons.some((x) => x.code === 'runtime-not-observed')).toBe(true);
  });

  it('caps at TML 1 when observed but not unique (would be TML 3)', () => {
    const r = assessTagMaturity({
      testabilityScore: 100, ambiguous: false,
      bestStrategy: 'data-testid', elementType: 'button',
      runtime: { observed: true, unique: false },
    });
    expect(r.level).toBe(1);
  });

  it('does NOT lower level when observed and unique', () => {
    const r = assessTagMaturity({
      testabilityScore: 100, ambiguous: false,
      bestStrategy: 'data-testid', elementType: 'button',
      runtime: { observed: true, unique: true },
    });
    expect(r.level).toBe(3);
    expect(r.reasons.some((x) => x.code === 'runtime-unique')).toBe(true);
  });

  it('runtime cap does not raise level above static ceiling', () => {
    // Static ceiling = TML 2 (aria-label), runtime observed+unique → stays 2
    const r = assessTagMaturity({
      testabilityScore: 75, ambiguous: false,
      bestStrategy: 'aria-label', elementType: 'button',
      runtime: { observed: true, unique: true },
    });
    expect(r.level).toBe(2);
  });

  it('not-observed cap stops at TML 2 (already below 2 → no change)', () => {
    // Static ceiling = TML 1 (CSS), runtime not observed → stays 1
    const r = assessTagMaturity({
      testabilityScore: 35, ambiguous: false,
      bestStrategy: 'css', elementType: 'button',
      runtime: { observed: false, unique: false },
    });
    expect(r.level).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// enrichTmlWithRuntime — matching and mutation
// ---------------------------------------------------------------------------

describe('enrichTmlWithRuntime — matching by testId', () => {
  it('marks element as observed when testId found in runtime', () => {
    const el = makeEl({ testId: 'checkout.submit' });
    const rt = makeRtMap([{
      route: '/', status: 'reachable',
      interactiveElements: [makeRtEl({ testId: 'checkout.submit', selector: '[data-testid="checkout.submit"]' })],
    }]);
    enrichTmlWithRuntime([{ interactiveElements: [el] }], rt);
    const tml = el.tml as any;
    expect(tml.reasons.some((r: any) => r.code === 'runtime-unique')).toBe(true);
  });

  it('caps at TML 2 when testId not found in any route', () => {
    const el = makeEl({ testId: 'checkout.submit' });
    const rt = makeRtMap([{
      route: '/', status: 'reachable',
      interactiveElements: [makeRtEl({ testId: 'other.button', selector: '[data-testid="other.button"]' })],
    }]);
    enrichTmlWithRuntime([{ interactiveElements: [el] }], rt);
    const tml = el.tml as any;
    expect(tml.level).toBe(2);
    expect(tml.reasons.some((r: any) => r.code === 'runtime-not-observed')).toBe(true);
  });

  it('caps at TML 1 when testId appears in multiple elements', () => {
    const el = makeEl({ testId: 'btn' });
    const rt = makeRtMap([{
      route: '/', status: 'reachable',
      interactiveElements: [
        makeRtEl({ testId: 'btn', selector: '[data-testid="btn"]' }),
        makeRtEl({ testId: 'btn', selector: '[data-testid="btn"]' }),  // duplicate!
      ],
    }]);
    enrichTmlWithRuntime([{ interactiveElements: [el] }], rt);
    const tml = el.tml as any;
    expect(tml.level).toBe(1);
  });
});

describe('enrichTmlWithRuntime — matching by aria-label', () => {
  it('matches by accessible name when no testId', () => {
    const el = makeEl({ ariaLabel: 'Submit order' });
    const rt = makeRtMap([{
      route: '/', status: 'reachable',
      interactiveElements: [{ tag: 'button', selector: '[aria-label="Submit order"]', name: 'Submit order' }],
    }]);
    enrichTmlWithRuntime([{ interactiveElements: [el] }], rt);
    const tml = el.tml as any;
    expect(tml.reasons.some((r: any) => r.code === 'runtime-unique')).toBe(true);
  });
});

describe('enrichTmlWithRuntime — error routes excluded', () => {
  it('ignores elements in errored routes', () => {
    const el = makeEl({ testId: 'checkout.submit' });
    const rt = makeRtMap([{
      route: '/', status: 'error',   // errored — should be ignored
      interactiveElements: [makeRtEl({ testId: 'checkout.submit', selector: '[data-testid="checkout.submit"]' })],
    }]);
    enrichTmlWithRuntime([{ interactiveElements: [el] }], rt);
    const tml = el.tml as any;
    // Not observed (because only errored route was skipped)
    expect(tml.reasons.some((r: any) => r.code === 'runtime-not-observed')).toBe(true);
  });
});

describe('enrichTmlWithRuntime — empty runtime map', () => {
  it('marks all elements as not-observed when no routes', () => {
    const el = makeEl({ testId: 'foo.bar' });
    enrichTmlWithRuntime([{ interactiveElements: [el] }], makeRtMap([]));
    const tml = el.tml as any;
    expect(tml.level).toBe(2); // capped from 3
    expect(tml.reasons.some((r: any) => r.code === 'runtime-not-observed')).toBe(true);
  });
});
