import { glob } from 'glob';
import fs from 'fs-extra';
import { parse } from '@typescript-eslint/parser';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CrawlOptions {
  rootDir: string;
  include: string[];
  exclude: string[];
}

export type Framework = 'react' | 'vue' | 'angular' | 'unknown';

export interface PropMeta {
  name: string;
  type: string;
  required: boolean;
}

export interface ComponentMeta {
  filePath: string;
  componentName: string;
  framework: Framework;
  props: PropMeta[];
  /** Raw ESTree AST produced by @typescript-eslint/parser */
  ast: ReturnType<typeof parse>;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function detectFramework(filePath: string, source: string): Framework {
  if (filePath.endsWith('.vue')) return 'vue';
  if (filePath.endsWith('.component.ts') || source.includes('@Component')) return 'angular';
  if (source.includes('React') || source.includes('jsx') || filePath.endsWith('.tsx')) return 'react';
  return 'unknown';
}

function deriveComponentName(filePath: string): string {
  return path.basename(filePath).replace(/\.(tsx?|vue)$/, '');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Crawl {@link CrawlOptions.rootDir} with the given glob patterns and return
 * component metadata extracted from each matching file's AST.
 */
export async function crawl(options: CrawlOptions): Promise<ComponentMeta[]> {
  const { rootDir, include, exclude } = options;

  const files = await glob(include, {
    cwd: rootDir,
    ignore: exclude,
    absolute: true,
  });

  const results: ComponentMeta[] = [];

  for (const filePath of files) {
    const source = await fs.readFile(filePath, 'utf-8');
    const ast = parse(source, {
      jsx: true,
      loc: true,
      range: true,
    });

    results.push({
      filePath,
      componentName: deriveComponentName(filePath),
      framework: detectFramework(filePath, source),
      props: [], // TODO: walk AST declarations and extract prop types
      ast,
    });
  }

  return results;
}

export default crawl;
