import { describe, it, expect } from 'vitest';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { toSonarQubeReport, exportSonarQube } from '../src/sonarqube.js';
import type { SelfcureSonarIssue } from '../src/sonarqube.js';

describe('toSonarQubeReport — kind → type/severity mapping', () => {
  it('maps ambiguous → BUG / MAJOR', () => {
    const [issue] = toSonarQubeReport([
      { kind: 'ambiguous', filePath: 'src/Foo.tsx', line: 12, message: 'm' },
    ]).issues;
    expect(issue.type).toBe('BUG');
    expect(issue.severity).toBe('MAJOR');
    expect(issue.ruleId).toBe('ambiguous-selector');
    expect(issue.engineId).toBe('selfcure');
  });

  it('maps low-score → CODE_SMELL / MAJOR', () => {
    const [issue] = toSonarQubeReport([
      { kind: 'low-score', filePath: 'src/Foo.tsx', message: 'm' },
    ]).issues;
    expect(issue.type).toBe('CODE_SMELL');
    expect(issue.severity).toBe('MAJOR');
    expect(issue.ruleId).toBe('low-testability');
  });

  it('maps missing-testid → CODE_SMELL / MINOR', () => {
    const [issue] = toSonarQubeReport([
      { kind: 'missing-testid', filePath: 'src/Foo.tsx', message: 'm' },
    ]).issues;
    expect(issue.type).toBe('CODE_SMELL');
    expect(issue.severity).toBe('MINOR');
    expect(issue.ruleId).toBe('missing-testid');
  });

  it('maps a11y-violation → BUG with severity by WCAG level', () => {
    const mk = (level: 'A' | 'AA' | 'AAA'): SelfcureSonarIssue =>
      ({ kind: 'a11y-violation', filePath: 'src/Foo.tsx', message: 'm', wcagLevel: level });
    const sev = (level: 'A' | 'AA' | 'AAA') =>
      toSonarQubeReport([mk(level)]).issues[0].severity;
    expect(sev('A')).toBe('CRITICAL');
    expect(sev('AA')).toBe('MAJOR');
    expect(sev('AAA')).toBe('MINOR');
    expect(toSonarQubeReport([mk('A')]).issues[0].type).toBe('BUG');
  });

  it('defaults a11y severity to AA-level MAJOR when wcagLevel is absent', () => {
    const [issue] = toSonarQubeReport([
      { kind: 'a11y-violation', filePath: 'src/Foo.tsx', message: 'm' },
    ]).issues;
    expect(issue.severity).toBe('MAJOR');
  });

  it('honours an explicit ruleId override (e.g. WCAG rule key)', () => {
    const [issue] = toSonarQubeReport([
      { kind: 'a11y-violation', filePath: 'src/Foo.tsx', message: 'm', ruleId: 'img-alt' },
    ]).issues;
    expect(issue.ruleId).toBe('img-alt');
  });
});

describe('toSonarQubeReport — locations', () => {
  it('defaults missing/zero line to 1 and sets endLine = startLine', () => {
    const r = toSonarQubeReport([
      { kind: 'low-score', filePath: 'a.tsx', message: 'm' },
      { kind: 'low-score', filePath: 'b.tsx', line: 0, message: 'm' },
      { kind: 'a11y-violation', filePath: 'c.tsx', line: 42, message: 'm' },
    ]);
    expect(r.issues[0].primaryLocation.textRange).toEqual({ startLine: 1, endLine: 1 });
    expect(r.issues[1].primaryLocation.textRange).toEqual({ startLine: 1, endLine: 1 });
    expect(r.issues[2].primaryLocation.textRange).toEqual({ startLine: 42, endLine: 42 });
  });

  it('relativises absolute paths against projectBaseDir and uses forward slashes', () => {
    const base = process.platform === 'win32' ? 'C:\\repo' : '/repo';
    const abs  = process.platform === 'win32' ? 'C:\\repo\\src\\Foo.tsx' : '/repo/src/Foo.tsx';
    const [issue] = toSonarQubeReport(
      [{ kind: 'ambiguous', filePath: abs, message: 'm' }],
      { projectBaseDir: base },
    ).issues;
    expect(issue.primaryLocation.filePath).toBe('src/Foo.tsx');
  });

  it('keeps already-relative paths untouched (slashes normalised)', () => {
    const [issue] = toSonarQubeReport(
      [{ kind: 'ambiguous', filePath: 'src/Foo.tsx', message: 'm' }],
    ).issues;
    expect(issue.primaryLocation.filePath).toBe('src/Foo.tsx');
  });

  it('passes the message through verbatim', () => {
    const [issue] = toSonarQubeReport([
      { kind: 'ambiguous', filePath: 'a.tsx', message: 'hello world' },
    ]).issues;
    expect(issue.primaryLocation.message).toBe('hello world');
  });
});

describe('toSonarQubeReport — options', () => {
  it('allows overriding the engineId', () => {
    const [issue] = toSonarQubeReport(
      [{ kind: 'ambiguous', filePath: 'a.tsx', message: 'm' }],
      { engineId: 'custom' },
    ).issues;
    expect(issue.engineId).toBe('custom');
  });

  it('returns an empty issues array for empty input', () => {
    expect(toSonarQubeReport([]).issues).toEqual([]);
  });
});

describe('exportSonarQube — file output', () => {
  it('writes valid pretty-printed JSON and returns the report', async () => {
    const dir  = await mkdtemp(join(tmpdir(), 'selfcure-sonar-'));
    const out  = join(dir, 'nested', 'sonar-issues.json'); // nested dir must be created
    try {
      const report = await exportSonarQube(
        [{ kind: 'ambiguous', filePath: 'src/Foo.tsx', line: 5, message: 'm' }],
        out,
      );
      const raw    = await readFile(out, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed).toEqual(report);
      expect(parsed.issues).toHaveLength(1);
      expect(parsed.issues[0].primaryLocation.filePath).toBe('src/Foo.tsx');
      expect(raw.endsWith('\n')).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
