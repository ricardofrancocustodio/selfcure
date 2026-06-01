import { readFile } from 'node:fs/promises';
import { glob } from 'glob';

export interface TestIdUsage {
  filePath: string;
  line: number;
  column: number;
  /** 'frontend' = data-testid attribute in source; 'test' = getByTestId() call */
  kind: 'frontend' | 'test';
  value: string;
}

export interface ExtractOptions {
  rootDir: string;
  sourceGlobs: string[];
  testGlobs: string[];
  exclude?: string[];
}

export interface ExtractResult {
  usages: TestIdUsage[];
  scannedFiles: number;
}

// Each pattern has a regex (with g flag — reset lastIndex per line) and the usage kind.
// Order matters: more specific patterns first (JSX expression before bare attribute).
const PATTERNS: ReadonlyArray<{ re: RegExp; kind: TestIdUsage['kind'] }> = [
  // data-testid={'value'} or data-testid={"value"}
  { re: /data-testid=\{["']([^"']+)["']\}/g, kind: 'frontend' },
  // data-testid="value" or data-testid='value'
  { re: /data-testid=["']([^"']+)["']/g, kind: 'frontend' },
  // page.getByTestId('value') / locator.getByTestId("value") etc.
  { re: /getByTestId\(["']([^"']+)["']\)/g, kind: 'test' },
];

/**
 * Extract all test ID usages from a single file's content.
 * Returns only literal string values — dynamic expressions are not captured.
 */
export function extractFromSource(filePath: string, content: string): TestIdUsage[] {
  const lines = content.split('\n');
  const usages: TestIdUsage[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1; // 1-based

    for (const { re, kind } of PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        usages.push({
          filePath,
          line: lineNum,
          column: m.index + 1, // 1-based
          kind,
          value: m[1]!,
        });
      }
    }
  }

  return usages;
}

/**
 * Crawl all files matched by the given globs and extract test ID usages.
 * sourceGlobs and testGlobs may overlap — the kind is determined by the
 * usage pattern found (data-testid → frontend; getByTestId → test), not
 * by which glob matched the file.
 */
export async function extractTestIds(options: ExtractOptions): Promise<ExtractResult> {
  const { rootDir, sourceGlobs, testGlobs, exclude = [] } = options;

  const allFiles = await glob([...sourceGlobs, ...testGlobs], {
    cwd: rootDir,
    ignore: exclude,
    absolute: true,
  });

  // Deduplicate in case globs overlap
  const uniqueFiles = [...new Set(allFiles)];

  const usages: TestIdUsage[] = [];

  for (const filePath of uniqueFiles) {
    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch {
      continue;
    }
    usages.push(...extractFromSource(filePath, content));
  }

  return { usages, scannedFiles: uniqueFiles.length };
}
