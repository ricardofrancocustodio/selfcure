import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { extractFromSource, extractTestIds } from '../src/testids/extract.js';

// ---------------------------------------------------------------------------
// extractFromSource
// ---------------------------------------------------------------------------

describe('extractFromSource — data-testid attribute (frontend)', () => {
  it('detects double-quoted literal', () => {
    const usages = extractFromSource('/a.tsx', '<input data-testid="auth.login.email" />');
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ kind: 'frontend', value: 'auth.login.email', line: 1, column: 8 });
  });

  it('detects single-quoted literal', () => {
    const usages = extractFromSource('/a.tsx', "<input data-testid='checkout.submit' />");
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ kind: 'frontend', value: 'checkout.submit' });
  });

  it('detects JSX expression container (double quotes inside braces)', () => {
    const usages = extractFromSource('/a.tsx', '<button data-testid={"nav.menu.open"}>');
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ kind: 'frontend', value: 'nav.menu.open' });
  });

  it('detects JSX expression container (single quotes inside braces)', () => {
    const usages = extractFromSource('/a.tsx', "<button data-testid={'nav.menu.close'}>");
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ kind: 'frontend', value: 'nav.menu.close' });
  });

  it('detects multiple testids on different lines', () => {
    const content = [
      '<input data-testid="a.b.c" />',
      '<button data-testid="d.e.f">click</button>',
    ].join('\n');
    const usages = extractFromSource('/x.tsx', content);
    expect(usages).toHaveLength(2);
    expect(usages[0]!.line).toBe(1);
    expect(usages[1]!.line).toBe(2);
    expect(usages.map((u) => u.value)).toEqual(['a.b.c', 'd.e.f']);
  });

  it('detects multiple testids on the same line', () => {
    const line = '<input data-testid="a.b" /><button data-testid="c.d" />';
    const usages = extractFromSource('/x.tsx', line);
    expect(usages).toHaveLength(2);
    expect(usages.map((u) => u.value)).toEqual(['a.b', 'c.d']);
  });

  it('reports correct file path', () => {
    const usages = extractFromSource('/src/pages/Home.tsx', '<div data-testid="home.hero" />');
    expect(usages[0]!.filePath).toBe('/src/pages/Home.tsx');
  });

  it('returns empty when no testids present', () => {
    const usages = extractFromSource('/x.tsx', '<div class="hero">hello</div>');
    expect(usages).toHaveLength(0);
  });
});

describe('extractFromSource — getByTestId (test)', () => {
  it('detects double-quoted argument', () => {
    const usages = extractFromSource('/e2e/login.spec.ts', 'await page.getByTestId("auth.login.submit").click();');
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ kind: 'test', value: 'auth.login.submit' });
  });

  it('detects single-quoted argument', () => {
    const usages = extractFromSource('/e2e/login.spec.ts', "const btn = page.getByTestId('auth.login.submit');");
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ kind: 'test', value: 'auth.login.submit' });
  });

  it('detects multiple getByTestId calls on different lines', () => {
    const content = [
      "page.getByTestId('home.hero.cta')",
      "page.getByTestId('home.hero.secondary')",
    ].join('\n');
    const usages = extractFromSource('/spec.ts', content);
    expect(usages).toHaveLength(2);
    expect(usages.every((u) => u.kind === 'test')).toBe(true);
  });
});

describe('extractFromSource — mixed content', () => {
  it('distinguishes frontend and test usages in a file with both patterns', () => {
    const content = [
      '<input data-testid="auth.email" />',
      'expect(page.getByTestId("auth.email")).toBeVisible();',
    ].join('\n');
    const usages = extractFromSource('/test-fixture.tsx', content);
    expect(usages).toHaveLength(2);
    expect(usages.find((u) => u.kind === 'frontend')?.value).toBe('auth.email');
    expect(usages.find((u) => u.kind === 'test')?.value).toBe('auth.email');
  });

  it('does not capture dynamic expressions like data-testid={fn()}', () => {
    const content = '<input data-testid={buildId(item.id)} />';
    const usages = extractFromSource('/x.tsx', content);
    expect(usages).toHaveLength(0);
  });

  it('does not capture template literals in getByTestId', () => {
    const content = 'page.getByTestId(`row-${id}`)';
    const usages = extractFromSource('/spec.ts', content);
    expect(usages).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractTestIds (full scan)
// ---------------------------------------------------------------------------

describe('extractTestIds', () => {
  it('scans source and test globs and returns usages', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'selfcure-extract-'));
    try {
      await writeFile(join(dir, 'Page.tsx'), '<button data-testid="home.cta.button">Go</button>', 'utf8');
      await writeFile(join(dir, 'page.spec.ts'), "page.getByTestId('home.cta.button')", 'utf8');
      await writeFile(join(dir, 'other.txt'), 'no testids here', 'utf8');

      const result = await extractTestIds({
        rootDir: dir,
        sourceGlobs: ['*.tsx'],
        testGlobs: ['*.spec.ts'],
      });

      expect(result.scannedFiles).toBe(2);
      expect(result.usages).toHaveLength(2);
      expect(result.usages.find((u) => u.kind === 'frontend')?.value).toBe('home.cta.button');
      expect(result.usages.find((u) => u.kind === 'test')?.value).toBe('home.cta.button');
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('deduplicates files when globs overlap', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'selfcure-extract-'));
    try {
      await writeFile(join(dir, 'comp.ts'), '<div data-testid="a.b.c" />', 'utf8');

      const result = await extractTestIds({
        rootDir: dir,
        sourceGlobs: ['*.ts'],
        testGlobs: ['*.ts'], // same glob — file should only be scanned once
      });

      expect(result.scannedFiles).toBe(1);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('respects exclude globs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'selfcure-extract-'));
    try {
      await writeFile(join(dir, 'Page.tsx'), '<div data-testid="a.b" />', 'utf8');
      await writeFile(join(dir, 'Excluded.tsx'), '<div data-testid="c.d" />', 'utf8');

      const result = await extractTestIds({
        rootDir: dir,
        sourceGlobs: ['*.tsx'],
        testGlobs: [],
        exclude: ['Excluded.tsx'],
      });

      expect(result.scannedFiles).toBe(1);
      expect(result.usages).toHaveLength(1);
      expect(result.usages[0]!.value).toBe('a.b');
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('returns empty result when no files match', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'selfcure-extract-'));
    try {
      const result = await extractTestIds({
        rootDir: dir,
        sourceGlobs: ['*.tsx'],
        testGlobs: ['*.spec.ts'],
      });
      expect(result.scannedFiles).toBe(0);
      expect(result.usages).toHaveLength(0);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
