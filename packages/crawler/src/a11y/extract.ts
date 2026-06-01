import type { ComponentMeta } from '../index.js';

type AnyNode = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface A11yElementInfo {
  filePath: string;
  line: number;
  column: number;
  tag: string;
  /** Flat map of attribute name → string value (or '__dynamic__' for non-literal expressions). */
  attrs: Record<string, string | undefined>;
  /** True when the element has at least one non-whitespace text or expression child. */
  hasTextChildren: boolean;
  selfClosing: boolean;
}

export interface A11yFileEvidence {
  filePath: string;
  elements: A11yElementInfo[];
  /** All literal id attribute values in the file — used for ARIA reference validation. */
  allIds: string[];
}

// ---------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------

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

function attrValue(valueNode: unknown): string | undefined {
  if (valueNode == null) return '';   // bare boolean attr e.g. <button disabled>
  if (typeof valueNode !== 'object') return undefined;
  const v = valueNode as AnyNode;
  if (v['type'] === 'Literal') return v['value'] != null ? String(v['value']) : '';
  if (v['type'] === 'JSXExpressionContainer') {
    const expr = v['expression'] as AnyNode | undefined;
    if (!expr || expr['type'] === 'JSXEmptyExpression') return '';
    if (expr['type'] === 'Literal') return expr['value'] != null ? String(expr['value']) : '';
    return '__dynamic__';
  }
  return '__dynamic__';
}

function collectAttrs(attributes: AnyNode[]): Record<string, string | undefined> {
  const attrs: Record<string, string | undefined> = {};
  for (const attr of attributes) {
    if ((attr as AnyNode)['type'] !== 'JSXAttribute') continue;
    const nameNode = (attr as AnyNode)['name'] as AnyNode;
    // JSXNamespacedName covers aria-* and data-* attributes
    const attrName =
      nameNode['type'] === 'JSXNamespacedName'
        ? `${(nameNode['namespace'] as AnyNode)?.['name']}-${(nameNode['name'] as AnyNode)?.['name']}`
        : String(nameNode['name'] ?? '');
    attrs[attrName] = attrValue((attr as AnyNode)['value']);
  }
  return attrs;
}

function childrenHaveContent(children: AnyNode[]): boolean {
  for (const child of children) {
    const type = (child as AnyNode)['type'];
    if (type === 'JSXText') {
      if (String((child as AnyNode)['value'] ?? '').trim().length > 0) return true;
    } else if (type === 'JSXExpressionContainer') {
      const expr = (child as AnyNode)['expression'];
      if (expr && (expr as AnyNode)['type'] !== 'JSXEmptyExpression') return true;
    } else if (type === 'JSXElement' || type === 'JSXFragment') {
      return true; // nested element counts as content
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Walk the AST of a single component and extract accessibility-relevant
 * information for every JSX element found.
 */
export function extractA11yEvidence(component: ComponentMeta): A11yFileEvidence {
  const { filePath, ast } = component;
  const elements: A11yElementInfo[] = [];
  const allIds: string[] = [];

  walkAST(ast, (node) => {
    if (node['type'] !== 'JSXElement') return;

    const opening = node['openingElement'] as AnyNode | undefined;
    if (!opening) return;

    const nameNode = opening['name'] as AnyNode | undefined;
    if (!nameNode || nameNode['type'] !== 'JSXIdentifier') return;
    const rawName = String(nameNode['name'] ?? '');
    // Skip React components (uppercase first letter) — only process HTML elements
    if (/^[A-Z]/.test(rawName)) return;
    const tag = rawName.toLowerCase();

    const rawAttrs = (opening['attributes'] as AnyNode[]) ?? [];
    const attrs = collectAttrs(rawAttrs);
    const selfClosing = Boolean(opening['selfClosing']);
    const children = (node['children'] as AnyNode[]) ?? [];

    const loc = (opening['loc'] as { start: { line: number; column: number } } | undefined)?.start;
    elements.push({
      filePath,
      line: loc?.line ?? 0,
      column: (loc?.column ?? 0) + 1, // 1-based
      tag,
      attrs,
      hasTextChildren: !selfClosing && childrenHaveContent(children),
      selfClosing,
    });

    if (attrs['id'] && attrs['id'] !== '__dynamic__') {
      allIds.push(attrs['id']);
    }
  });

  return { filePath, elements, allIds };
}

/**
 * Extract accessibility evidence from all JSX/TSX components in a crawl result.
 * HTML files are skipped — they use a different parser without loc info.
 */
export function extractA11yEvidenceFromAll(components: ComponentMeta[]): A11yFileEvidence[] {
  return components
    .filter((c) => c.framework !== 'html')
    .map(extractA11yEvidence);
}
