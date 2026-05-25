import type { ComponentMeta, HtmlElementMeta } from '@selfcure/crawler';

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

/** Derive a human-readable label from attributes. */
function buildLabel(attrs: Record<string, string | undefined>): string | undefined {
  return attrs['aria-label'] ?? attrs['placeholder'] ?? attrs['name'] ?? attrs['id'];
}

function extractInteractiveElements(ast: unknown): InteractiveElement[] {
  const elements: InteractiveElement[] = [];
  const seen = new Set<string>();

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
    if (seen.has(selector)) return;
    seen.add(selector);

    const type = TAG_TYPE[tag]!;
    elements.push({
      type,
      selector,
      label: buildLabel(attrs),
      actions: ACTIONS[type],
    });
  });

  return elements;
}

// ---------------------------------------------------------------------------
// HTML interactive element extraction (for framework: 'html')
// ---------------------------------------------------------------------------

function extractInteractiveElementsFromHtml(htmlElements: HtmlElementMeta[]): InteractiveElement[] {
  const elements: InteractiveElement[] = [];
  const seen = new Set<string>();

  for (const { tag, attrs } of htmlElements) {
    if (!TAG_TYPE[tag]) continue;
    const selector = buildSelector(tag, attrs);
    if (seen.has(selector)) continue;
    seen.add(selector);
    const type = TAG_TYPE[tag]!;
    elements.push({
      type,
      selector,
      label: buildLabel(attrs),
      actions: ACTIONS[type],
    });
  }

  return elements;
}

// ---------------------------------------------------------------------------
// Scoring + complexity
// ---------------------------------------------------------------------------

function computeScore(elements: InteractiveElement[]): number {
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
    const interactiveElements = component.htmlElements
      ? extractInteractiveElementsFromHtml(component.htmlElements)
      : extractInteractiveElements(component.ast);

    return {
      component,
      score: computeScore(interactiveElements),
      interactiveElements,
      complexity: classifyComplexity(interactiveElements),
    };
  });
}

export default analyze;
