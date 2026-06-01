// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RuntimeElement {
  tag:       string;
  role?:     string;
  /** Accessible name — aria-label or visible text */
  name?:     string;
  /** Best selector available */
  selector:  string;
  testId?:   string;
  /** Testability score 0–100 */
  score:     number;
}

export interface RuntimeRouteEvidence {
  url:                    string;
  route:                  string;
  status:                 'reachable' | 'error' | 'timeout' | 'auth-required';
  title?:                 string;
  domSnapshotPath?:       string;
  accessibilityTreePath?: string;
  screenshotPath?:        string;
  interactiveElements:    RuntimeElement[];
  consoleErrors:          string[];
  loadTimeMs:             number;
}

export interface RuntimeDiscoveryResult {
  routes:        RuntimeRouteEvidence[];
  scannedRoutes: number;
  reachable:     number;
  errored:       number;
}

export interface TestabilityFinding {
  route:     string;
  url:       string;
  element:   RuntimeElement;
  score:     number;
  issues:    string[];
}

export interface RouteTestabilityResult {
  route:         string;
  url:           string;
  status:        RuntimeRouteEvidence['status'];
  score:         number;      // average of all elements (0–100)
  totalElements: number;
  flaggedCount:  number;
  findings:      TestabilityFinding[];
}

export interface TestabilityReport {
  generatedAt:   string;
  minimumScore:  number;
  routes:        RouteTestabilityResult[];
  overall: {
    score:          number;
    totalElements:  number;
    flaggedCount:   number;
  };
}

// ---------------------------------------------------------------------------
// Issue categorisation
// ---------------------------------------------------------------------------

function issuesForElement(el: RuntimeElement): string[] {
  const issues: string[] = [];
  if (!el.testId && !el.name && !el.role) {
    issues.push('No accessible name, role, or data-testid — selector is unstable');
  }
  if (!el.testId && el.score < 75) {
    issues.push('Missing data-testid — add one for a stable 100-score locator');
  }
  if (el.tag === 'div' || el.tag === 'span') {
    issues.push('Non-semantic interactive element — prefer <button> or <a>');
  }
  return issues;
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function averageScore(elements: RuntimeElement[]): number {
  if (elements.length === 0) return 100; // no interactive elements = no issues
  const sum = elements.reduce((acc, el) => acc + el.score, 0);
  return Math.round(sum / elements.length);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a testability report from Playwright runtime discovery evidence.
 * Only elements with score < minimumScore are reported as findings.
 */
export function buildTestabilityReport(
  result:       RuntimeDiscoveryResult,
  minimumScore = 80,
): TestabilityReport {
  const routeResults: RouteTestabilityResult[] = [];

  for (const evidence of result.routes) {
    const interactive = evidence.interactiveElements;
    const findings: TestabilityFinding[] = [];

    for (const el of interactive) {
      if (el.score < minimumScore) {
        findings.push({
          route:   evidence.route,
          url:     evidence.url,
          element: el,
          score:   el.score,
          issues:  issuesForElement(el),
        });
      }
    }

    routeResults.push({
      route:         evidence.route,
      url:           evidence.url,
      status:        evidence.status,
      score:         averageScore(interactive),
      totalElements: interactive.length,
      flaggedCount:  findings.length,
      findings,
    });
  }

  const totalElements = routeResults.reduce((s, r) => s + r.totalElements, 0);
  const flaggedCount  = routeResults.reduce((s, r) => s + r.flaggedCount,  0);
  const overallScore  = routeResults.length === 0
    ? 100
    : Math.round(routeResults.reduce((s, r) => s + r.score, 0) / routeResults.length);

  return {
    generatedAt:  new Date().toISOString(),
    minimumScore,
    routes:       routeResults,
    overall:      { score: overallScore, totalElements, flaggedCount },
  };
}

/**
 * Group findings by severity bucket for quick summary display.
 */
export function summarizeReport(report: TestabilityReport): {
  critical: RouteTestabilityResult[];
  warning:  RouteTestabilityResult[];
  healthy:  RouteTestabilityResult[];
} {
  const reachable = report.routes.filter((r) => r.status === 'reachable');
  return {
    critical: reachable.filter((r) => r.score < 60),
    warning:  reachable.filter((r) => r.score >= 60 && r.score < report.minimumScore),
    healthy:  reachable.filter((r) => r.score >= report.minimumScore),
  };
}
