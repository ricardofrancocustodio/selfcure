import { glob } from 'glob';
import fs from 'fs-extra';
import { parse } from '@typescript-eslint/parser';
import { parse as parseHtml } from 'node-html-parser';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CrawlOptions {
  rootDir: string;
  include: string[];
  exclude: string[];
  /**
   * Framework hint — skips auto-detection when set to a specific value.
   * @default 'auto'
   */
  framework?: 'react' | 'vue' | 'angular' | 'auto';
}

export type Framework = 'react' | 'vue' | 'angular' | 'html' | 'unknown';

export interface PropMeta {
  name: string;
  type: string;
  required: boolean;
}

/** A single interactive element pre-extracted from an HTML file. */
export interface HtmlElementMeta {
  tag: string;
  attrs: Record<string, string>;
}

export interface ComponentMeta {
  filePath: string;
  componentName: string;
  framework: Framework;
  props: PropMeta[];
  /** Raw ESTree AST produced by @typescript-eslint/parser */
  ast: ReturnType<typeof parse>;
  /** Pre-extracted elements from HTML files — only set when framework is 'html' */
  htmlElements?: HtmlElementMeta[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function detectFramework(filePath: string, source: string): Framework {
  if (filePath.endsWith('.html')) return 'html';
  if (filePath.endsWith('.vue')) return 'vue';
  if (filePath.endsWith('.component.ts') || source.includes('@Component')) return 'angular';
  if (source.includes('React') || source.includes('jsx') || filePath.endsWith('.tsx')) return 'react';
  return 'unknown';
}

function deriveComponentName(filePath: string): string {
  return path.basename(filePath).replace(/\.(tsx?|vue|jsx?)$/, '');
}

// ---------------------------------------------------------------------------
// Prop extraction from TypeScript AST
// ---------------------------------------------------------------------------

type AnyNode = Record<string, unknown>;

function typeName(node: AnyNode | null | undefined): string {
  if (!node) return 'unknown';
  switch ((node as { type?: string }).type) {
    case 'TSStringKeyword':    return 'string';
    case 'TSNumberKeyword':    return 'number';
    case 'TSBooleanKeyword':   return 'boolean';
    case 'TSVoidKeyword':      return 'void';
    case 'TSAnyKeyword':       return 'any';
    case 'TSNullKeyword':      return 'null';
    case 'TSUndefinedKeyword': return 'undefined';
    case 'TSArrayType':        return `${typeName((node as { elementType?: AnyNode }).elementType)}[]`;
    case 'TSFunctionType':     return 'function';
    case 'TSTypeReference': {
      const ref = node as { typeName?: { name?: string } };
      return ref.typeName?.name ?? 'object';
    }
    case 'TSUnionType': {
      const union = node as { types?: AnyNode[] };
      return (union.types ?? []).map(typeName).join(' | ');
    }
    default: return 'unknown';
  }
}

function extractPropsFromMembers(members: AnyNode[]): PropMeta[] {
  return members
    .filter((m) => (m as { type?: string }).type === 'TSPropertySignature')
    .map((m) => {
      const prop = m as {
        key?: { name?: string };
        optional?: boolean;
        typeAnnotation?: { typeAnnotation?: AnyNode };
      };
      return {
        name: prop.key?.name ?? '',
        type: typeName(prop.typeAnnotation?.typeAnnotation ?? null),
        required: !prop.optional,
      } satisfies PropMeta;
    })
    .filter((p) => p.name !== '');
}

function extractProps(ast: ReturnType<typeof parse>): PropMeta[] {
  const body = ((ast as unknown as { body?: AnyNode[] }).body) ?? [];

  for (const node of body) {
    const n = node as { type?: string; id?: { name?: string }; body?: { body?: AnyNode[] }; typeAnnotation?: { type?: string; members?: AnyNode[] } };

    // interface FooProps { … }
    if (n.type === 'TSInterfaceDeclaration') {
      const name = n.id?.name ?? '';
      if (name === 'Props' || name.endsWith('Props')) {
        return extractPropsFromMembers(n.body?.body ?? []);
      }
    }

    // type Props = { … }
    if (n.type === 'TSTypeAliasDeclaration') {
      const name = n.id?.name ?? '';
      if ((name === 'Props' || name.endsWith('Props')) && n.typeAnnotation?.type === 'TSTypeLiteral') {
        return extractPropsFromMembers(n.typeAnnotation.members ?? []);
      }
    }
  }

  return [];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Crawl {@link CrawlOptions.rootDir} with the given glob patterns and return
 * component metadata extracted from each matching file's AST.
 */
export async function crawl(options: CrawlOptions): Promise<ComponentMeta[]> {
  const { rootDir, include, exclude, framework = 'auto' } = options;

  const files = await glob(include, {
    cwd: rootDir,
    ignore: exclude,
    absolute: true,
  });

  const results: ComponentMeta[] = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf-8');

    // ── HTML files: extract interactive elements via DOM parser ──────────
    if (filePath.endsWith('.html')) {
      const root = parseHtml(source);
      const htmlElements: HtmlElementMeta[] = [];
      for (const tag of ['button', 'input', 'a', 'form', 'select', 'textarea']) {
        for (const el of root.querySelectorAll(tag)) {
          htmlElements.push({ tag, attrs: el.attributes as Record<string, string> });
        }
      }
      results.push({
        filePath,
        componentName: deriveComponentName(filePath),
        framework: 'html',
        props: [],
        ast: { type: 'Program', body: [], sourceType: 'module' } as unknown as ReturnType<typeof parse>,
        htmlElements,
      });
      continue;
    }

    // ── TypeScript / JSX files: parse AST ────────────────────────────────
    let ast: ReturnType<typeof parse>;
    try {
      ast = parse(source, {
        jsx: true,
        loc: true,
        range: true,
      });
    } catch {
      // Skip files that cannot be parsed as TypeScript/JSX (e.g. minified JS, SVG)
      continue;
    }

    const detectedFramework =
      framework !== 'auto'
        ? (framework as Framework)
        : detectFramework(filePath, source);

    results.push({
      filePath,
      componentName: deriveComponentName(filePath),
      framework: detectedFramework,
      props: extractProps(ast),
      ast,
    });
  }

  return results;
}

export default crawl;
