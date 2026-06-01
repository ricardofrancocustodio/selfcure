import { describe, it, expect } from 'vitest';
import { buildTestabilityReport, summarizeReport } from '../src/discovery/testability.js';
import type { RuntimeDiscoveryResult, RuntimeElement } from '../src/discovery/testability.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(routes: Array<{
  route: string;
  status?: 'reachable' | 'error' | 'timeout';
  elements?: Partial<RuntimeElement>[];
}>): RuntimeDiscoveryResult {
  return {
    scannedRoutes: routes.length,
    reachable:     routes.filter((r) => (r.status ?? 'reachable') === 'reachable').length,
    errored:       routes.filter((r) => (r.status ?? 'reachable') !== 'reachable').length,
    routes: routes.map((r) => ({
      url:                  `http://localhost:3000${r.route}`,
      route:                r.route,
      status:               r.status ?? 'reachable',
      interactiveElements:  (r.elements ?? []).map((e) => ({
        tag:      e.tag ?? 'button',
        selector: e.selector ?? e.tag ?? 'button',
        score:    e.score ?? 20,
        ...e,
      } as RuntimeElement)),
      consoleErrors:        [],
      loadTimeMs:           100,
    })),
  };
}

// ---------------------------------------------------------------------------
// buildTestabilityReport
// ---------------------------------------------------------------------------

describe('buildTestabilityReport — basic counts', () => {
  it('returns a report with generatedAt timestamp', () => {
    const result = makeResult([{ route: '/' }]);
    const report = buildTestabilityReport(result);
    expect(report.generatedAt).toBeTruthy();
    expect(() => new Date(report.generatedAt)).not.toThrow();
  });

  it('counts total and flagged elements correctly', () => {
    const result = makeResult([{
      route: '/checkout',
      elements: [
        { tag: 'button', score: 100, selector: '[data-testid="submit"]' },
        { tag: 'button', score: 20,  selector: 'button' },  // flagged (< 80)
        { tag: 'input',  score: 50,  selector: 'input' },   // flagged
      ],
    }]);
    const report = buildTestabilityReport(result, 80);
    expect(report.overall.totalElements).toBe(3);
    expect(report.overall.flaggedCount).toBe(2);
  });

  it('reports score 100 for routes with no interactive elements', () => {
    const result = makeResult([{ route: '/', elements: [] }]);
    const report = buildTestabilityReport(result);
    expect(report.routes[0]!.score).toBe(100);
  });

  it('computes average route score', () => {
    const result = makeResult([{
      route: '/',
      elements: [
        { tag: 'button', score: 100, selector: 'x' },
        { tag: 'button', score: 20,  selector: 'y' },
      ],
    }]);
    const report = buildTestabilityReport(result);
    expect(report.routes[0]!.score).toBe(60); // (100 + 20) / 2
  });

  it('computes overall score as average of route scores', () => {
    const result = makeResult([
      { route: '/a', elements: [{ tag: 'button', score: 100, selector: 'x' }] },
      { route: '/b', elements: [{ tag: 'button', score: 0,   selector: 'y' }] },
    ]);
    const report = buildTestabilityReport(result);
    expect(report.overall.score).toBe(50);
  });

  it('includes only elements below minimumScore in findings', () => {
    const result = makeResult([{
      route: '/',
      elements: [
        { tag: 'button', score: 90, selector: '[data-testid="ok"]' },
        { tag: 'button', score: 30, selector: 'button' },
      ],
    }]);
    const report = buildTestabilityReport(result, 80);
    expect(report.routes[0]!.findings).toHaveLength(1);
    expect(report.routes[0]!.findings[0]!.score).toBe(30);
  });
});

describe('buildTestabilityReport — empty input', () => {
  it('returns overall score 100 when no routes', () => {
    const result = makeResult([]);
    const report = buildTestabilityReport(result);
    expect(report.overall.score).toBe(100);
    expect(report.overall.totalElements).toBe(0);
  });
});

describe('buildTestabilityReport — errored routes', () => {
  it('includes errored routes in output but with empty elements', () => {
    const result = makeResult([
      { route: '/',        status: 'reachable', elements: [{ tag: 'button', score: 80, selector: 'x' }] },
      { route: '/login',   status: 'error',     elements: [] },
    ]);
    const report = buildTestabilityReport(result);
    expect(report.routes).toHaveLength(2);
    expect(report.routes.find((r) => r.route === '/login')?.status).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// summarizeReport
// ---------------------------------------------------------------------------

describe('summarizeReport', () => {
  it('classifies routes into critical / warning / healthy', () => {
    const result = makeResult([
      { route: '/a', elements: [{ tag: 'button', score: 40, selector: 'x' }] },   // critical < 60
      { route: '/b', elements: [{ tag: 'button', score: 70, selector: 'x' }] },   // warning 60–79
      { route: '/c', elements: [{ tag: 'button', score: 95, selector: 'x' }] },   // healthy >= 80
    ]);
    const report  = buildTestabilityReport(result, 80);
    const summary = summarizeReport(report);

    expect(summary.critical.map((r) => r.route)).toContain('/a');
    expect(summary.warning.map((r) => r.route)).toContain('/b');
    expect(summary.healthy.map((r) => r.route)).toContain('/c');
  });

  it('excludes errored routes from all buckets', () => {
    const result = makeResult([
      { route: '/error', status: 'error', elements: [] },
    ]);
    const report  = buildTestabilityReport(result);
    const summary = summarizeReport(report);
    expect(summary.critical).toHaveLength(0);
    expect(summary.warning).toHaveLength(0);
    expect(summary.healthy).toHaveLength(0);
  });
});
