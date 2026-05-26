import type { ComponentMeta, HtmlElementMeta } from '@selfcure/crawler';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ElementType = 'button' | 'input' | 'link' | 'form' | 'custom';
export type Complexity = 'low' | 'medium' | 'high';

export interface SelectorCandidate {
  strategy: 'data-testid' | 'id' | 'aria-label' | 'name' | 'css' | 'xpath';
  /** Ready-to-use selector string */
  value: string;
  /** Stability score 0–100: higher = less likely to break on UI changes */
  score: number;
  /** How many elements within the same component match this selector value */
  matchCount?: number;
  /** How many elements across all analysed components match this selector value */
  crossMatchCount?: number;
  /** True when the selector matches more than one element in the same component */
  ambiguous?: boolean;
}

export interface ElementSelectors {
  dataTestId?: string;
  id?: string;
  ariaLabel?: string;
  name?: string;
  /** Best CSS selector (may alias one of the above) */
  cssSelector: string;
  /** XPath expression */
  xpath: string;
}

export interface InteractiveElement {
  type: ElementType;
  /** Best selector — always equals selectorRanking[0].value */
  selector: string;
  label?: string;
  /** e.g. ['click', 'fill', 'check'] */
  actions: string[];
  /** All available selectors for this element */
  selectors: ElementSelectors;
  /** Candidates sorted from most stable (index 0) to least stable */
  selectorRanking: SelectorCandidate[];
  /** Testability score for this element 0–100 */
  testabilityScore: number;
  /**
   * True when the best available selector also matches another element in
   * the same component — Playwright would resolve to multiple nodes.
   */
  ambiguous: boolean;
  /** Human-readable explanation when {@link ambiguous} is true */
  ambiguityReason?: string;
}

export interface AnalysisResult {
  component: ComponentMeta;
  /** Testability score 0–100 — average of per-element testabilityScore values */
  score: number;
  interactiveElements: InteractiveElement[];
  complexity: Complexity;
}

// ---------------------------------------------------------------------------
// AST walker
// ---------------------------------------------------------------------------

type AnyNode = Record<string, unknown>;

function walkAST(node: unknown, visitor: (n: AnyNode) => void): void {
  if (!node || typeof node !== 'object') return;
  const n = node as AnyNode;
  if (typeof n['type'] === 'string') visitor(n);
  for (const key of Object.keys(n)) {
    const child = n[key];
    if (Array.isArray(child)) {
      for (const item of child) walkAST(item, visitor);
    } else if (child && typeof child === 'object') {
      walkAST(child, visitor);
    }
  }
}

// ---------------------------------------------------------------------------
// JSX interactive element extraction
// ---------------------------------------------------------------------------

const TAG_TYPE: Record<string, ElementType> = {
  button:   'button',
  input:    'input',
  select:   'input',
  textarea: 'input',
  a:        'link',
  form:     'form',
};

const ACTIONS: Record<ElementType, string[]> = {
  button: ['click'],
  input:  ['fill', 'press', 'clear'],
  link:   ['click'],
  form:   ['submit'],
  custom: ['click'],
};

/** Pull the string value out of a JSXAttribute value node. */
function attrStringValue(valueNode: unknown): string | undefined {
  if (!valueNode || typeof valueNode !== 'object') return undefined;
  const v = valueNode as AnyNode;
  // <input placeholder="foo" /> → Literal.value
  if (v['type'] === 'Literal') return String(v['value'] ?? '');
  // <input aria-label={"foo"} /> → JSXExpressionContainer with Literal inside
  if (v['type'] === 'JSXExpressionContainer') {
    const expr = v['expression'] as AnyNode | undefined;
    if (expr?.['type'] === 'Literal') return String(expr['value'] ?? '');
  }
  return undefined;
}

/** Build the most specific stable Playwright selector for a JSX element. */
function buildSelector(tag: string, attrs: Record<string, string | undefined>): string {
  if (attrs['data-testid']) return `[data-testid="${attrs['data-testid']}"]`;
  if (attrs['aria-label'])  return `${tag}[aria-label="${attrs['aria-label']}"]`;
  if (attrs['id'])          return `#${attrs['id']}`;
  if (attrs['name'])        return `${tag}[name="${attrs['name']}"]`;
  if (attrs['type'] && tag === 'input') return `input[type="${attrs['type']}"]`;
  return tag;
}

// ---------------------------------------------------------------------------
// Selector builders
// ---------------------------------------------------------------------------

function buildXPath(tag: string, attrs: Record<string, string | undefined>): string {
  if (attrs['id'])          return `//${tag}[@id='${attrs['id']}']`;
  if (attrs['data-testid']) return `//${tag}[@data-testid='${attrs['data-testid']}']`;
  if (attrs['aria-label'])  return `//${tag}[@aria-label='${attrs['aria-label']}']`;
  if (attrs['name'])        return `//${tag}[@name='${attrs['name']}']`;
  if (attrs['type'])        return `//${tag}[@type='${attrs['type']}']`;
  return `//${tag}`;
}

function buildElementSelectors(tag: string, attrs: Record<string, string | undefined>): ElementSelectors {
  return {
    dataTestId: attrs['data-testid'] ? `[data-testid="${attrs['data-testid']}"]` : undefined,
    id:         attrs['id']          ? `#${attrs['id']}`                          : undefined,
    ariaLabel:  attrs['aria-label']  ? `${tag}[aria-label="${attrs['aria-label']}"]` : undefined,
    name:       attrs['name']        ? `${tag}[name="${attrs['name']}"]`          : undefined,
    cssSelector: buildSelector(tag, attrs),
    xpath:       buildXPath(tag, attrs),
  };
}

function buildSelectorRanking(tag: string, attrs: Record<string, string | undefined>): SelectorCandidate[] {
  const candidates: SelectorCandidate[] = [];

  if (attrs['data-testid']) {
    candidates.push({ strategy: 'data-testid', value: `[data-testid="${attrs['data-testid']}"]`, score: 100 });
  }
  if (attrs['id']) {
    candidates.push({ strategy: 'id', value: `#${attrs['id']}`, score: 85 });
  }
  if (attrs['aria-label']) {
    candidates.push({ strategy: 'aria-label', value: `${tag}[aria-label="${attrs['aria-label']}"]`, score: 75 });
  }
  if (attrs['name']) {
    candidates.push({ strategy: 'name', value: `${tag}[name="${attrs['name']}"]`, score: 65 });
  }

  // Add CSS only when it isn't already represented by a named candidate above
  const cssVal = buildSelector(tag, attrs);
  if (!candidates.some((c) => c.value === cssVal)) {
    const cssScore = (attrs['type'] && tag === 'input') ? 35 : 10;
    candidates.push({ strategy: 'css', value: cssVal, score: cssScore });
  }

  // XPath — always useful as a last resort
  candidates.push({ strategy: 'xpath', value: buildXPath(tag, attrs), score: 20 });

  return candidates.sort((a, b) => b.score - a.score);
}

function elementTestabilityScore(attrs: Record<string, string | undefined>): number {
  if (attrs['data-testid']) return 100;
  if (attrs['id'])          return 85;
  if (attrs['aria-label'])  return 75;
  if (attrs['name'])        return 65;
  if (attrs['type'])        return 35;
  return 10;
}

/** Derive a human-readable label from attributes. */
function buildLabel(attrs: Record<string, string | undefined>): string | undefined {
  return attrs['aria-label'] ?? attrs['placeholder'] ?? attrs['name'] ?? attrs['id'];
}

function extractInteractiveElements(ast: unknown): InteractiveElement[] {
  const elements: InteractiveElement[] = [];

  walkAST(ast, (node) => {
    if (node['type'] !== 'JSXOpeningElement') return;

    // tag name — only handle lowercase (HTML) elements
    const nameNode = node['name'] as AnyNode | undefined;
    if (!nameNode || nameNode['type'] !== 'JSXIdentifier') return;
    const tag = String(nameNode['name'] ?? '');
    if (!TAG_TYPE[tag]) return;

    // collect attributes into a flat map
    const attrs: Record<string, string | undefined> = {};
    for (const attr of (node['attributes'] as AnyNode[] | undefined) ?? []) {
      if (attr['type'] !== 'JSXAttribute') continue;
      const attrName = ((attr['name'] as AnyNode)?.['name'] as string) ?? '';
      attrs[attrName] = attrStringValue(attr['value']);
    }

    const selector = buildSelector(tag, attrs);
    const type = TAG_TYPE[tag]!;
    const ranking = buildSelectorRanking(tag, attrs);
    elements.push({
      type,
      selector,
      label: buildLabel(attrs),
      actions: ACTIONS[type],
      selectors: buildElementSelectors(tag, attrs),
      selectorRanking: ranking,
      testabilityScore: elementTestabilityScore(attrs),
      ambiguous: false,
    });
  });

  return elements;
}

// ---------------------------------------------------------------------------
// HTML interactive element extraction (for framework: 'html')
// ---------------------------------------------------------------------------

function extractInteractiveElementsFromHtml(htmlElements: HtmlElementMeta[]): InteractiveElement[] {
  const elements: InteractiveElement[] = [];

  for (const { tag, attrs } of htmlElements) {
    if (!TAG_TYPE[tag]) continue;
    const selector = buildSelector(tag, attrs);
    const type = TAG_TYPE[tag]!;
    const ranking = buildSelectorRanking(tag, attrs);
    elements.push({
      type,
      selector,
      label: buildLabel(attrs),
      actions: ACTIONS[type],
      selectors: buildElementSelectors(tag, attrs),
      selectorRanking: ranking,
      testabilityScore: elementTestabilityScore(attrs),
      ambiguous: false,
    });
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Ambiguity detection
// ---------------------------------------------------------------------------

/**
 * Penalty applied to a candidate's score when it matches more than one element
 * in the same component. 0.4 means an ambiguous `data-testid` drops 100 → 40,
 * which is below the default lint threshold and naturally surfaces it.
 */
const INTRA_AMBIGUITY_PENALTY = 0.4;

/** Strategies that are inherently shared by tag/type (e.g. `button`, `input[type="text"]`).
 *  These are weak by definition, so we do not call them out as "ambiguous" — they
 *  are already scored low. Only the *strong* strategies surprise the user when shared. */
const STRONG_STRATEGIES: ReadonlySet<SelectorCandidate['strategy']> = new Set([
  'data-testid',
  'id',
  'aria-label',
  'name',
]);

function countSelectorValues(elements: InteractiveElement[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const el of elements) {
    for (const cand of el.selectorRanking) {
      counts.set(cand.value, (counts.get(cand.value) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * Annotate each candidate with how many elements share its selector value
 * (within the component and across all analysed components), penalise the
 * score when more than one element matches inside the same component, and
 * re-derive each element's best selector + testability score.
 */
function applyAmbiguity(
  elements: InteractiveElement[],
  intraCounts: Map<string, number>,
  crossCounts: Map<string, number>,
): void {
  for (const el of elements) {
    for (const cand of el.selectorRanking) {
      const intra = intraCounts.get(cand.value) ?? 1;
      const cross = crossCounts.get(cand.value) ?? intra;
      cand.matchCount      = intra;
      cand.crossMatchCount = cross;
      if (intra > 1) {
        cand.ambiguous = true;
        cand.score     = Math.round(cand.score * INTRA_AMBIGUITY_PENALTY);
      }
    }

    el.selectorRanking.sort((a, b) => b.score - a.score);

    const best = el.selectorRanking[0];
    if (best) {
      el.selector         = best.value;
      el.testabilityScore = best.score;
      el.ambiguous        = best.ambiguous === true;
      if (el.ambiguous && STRONG_STRATEGIES.has(best.strategy)) {
        el.ambiguityReason =
          `Selector \`${best.value}\` (${best.strategy}) matches ${best.matchCount} elements ` +
          `in this component — Playwright will resolve to multiple nodes.`;
      } else if (el.ambiguous) {
        el.ambiguityReason =
          `No unique selector available — best candidate \`${best.value}\` matches ` +
          `${best.matchCount} elements in this component.`;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Scoring + complexity
// ---------------------------------------------------------------------------

function computeScore(elements: InteractiveElement[]): number {
  if (elements.length === 0) return 40;
  const avg = elements.reduce((s, e) => s + e.testabilityScore, 0) / elements.length;
  return Math.round(avg);
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
  // First pass: extract interactive elements per component.
  const perComponent = components.map((component) => ({
    component,
    interactiveElements: component.htmlElements
      ? extractInteractiveElementsFromHtml(component.htmlElements)
      : extractInteractiveElements(component.ast),
  }));

  // Second pass: detect ambiguous locators.
  //   • Intra-component counts decide whether a selector is *ambiguous now*
  //     (Playwright would match multiple nodes on the same rendered page).
  //   • Cross-component counts are informational only — independent tests on
  //     different pages can legitimately reuse a `data-testid`.
  const crossCounts = countSelectorValues(perComponent.flatMap((p) => p.interactiveElements));

  for (const { interactiveElements } of perComponent) {
    const intraCounts = countSelectorValues(interactiveElements);
    applyAmbiguity(interactiveElements, intraCounts, crossCounts);
  }

  return perComponent.map(({ component, interactiveElements }) => ({
    component,
    score: computeScore(interactiveElements),
    interactiveElements,
    complexity: classifyComplexity(interactiveElements),
  }));
}

export default analyze;
