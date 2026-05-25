import type { ComponentMeta } from '@selfcure/crawler';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ElementType = 'button' | 'input' | 'link' | 'form' | 'custom';
export type Complexity = 'low' | 'medium' | 'high';

export interface InteractiveElement {
  type: ElementType;
  /** Best CSS / ARIA selector for Playwright */
  selector: string;
  label?: string;
  /** e.g. ['click', 'fill', 'check'] */
  actions: string[];
}

export interface AnalysisResult {
  component: ComponentMeta;
  /** Testability score 0–100 (higher = easier to test reliably) */
  score: number;
  interactiveElements: InteractiveElement[];
  complexity: Complexity;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function computeScore(elements: InteractiveElement[]): number {
  // Simple heuristic: more labelled interactive elements → higher score
  const labelled = elements.filter((e) => e.label).length;
  return Math.min(100, 40 + labelled * 15);
}

function classifyComplexity(elements: InteractiveElement[]): Complexity {
  if (elements.length <= 2) return 'low';
  if (elements.length <= 6) return 'medium';
  return 'high';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyse crawled components: classify their interactive elements, compute a
 * testability score, and flag overall complexity.
 */
export async function analyze(components: ComponentMeta[]): Promise<AnalysisResult[]> {
  return components.map((component) => {
    // TODO: walk component.ast, extract JSX elements / Vue template nodes
    const interactiveElements: InteractiveElement[] = [];

    return {
      component,
      score: computeScore(interactiveElements),
      interactiveElements,
      complexity: classifyComplexity(interactiveElements),
    };
  });
}

export default analyze;
