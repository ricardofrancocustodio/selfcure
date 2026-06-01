import { describe, it, expect } from 'vitest';
import { wcagRefsFromTags, impactToSeverity, levelFromTags } from '../src/a11y/dynamic.js';

describe('wcagRefsFromTags', () => {
  it('extracts 3-digit WCAG references', () => {
    expect(wcagRefsFromTags(['wcag412'])).toEqual(['4.1.2']);
    expect(wcagRefsFromTags(['wcag111'])).toEqual(['1.1.1']);
    expect(wcagRefsFromTags(['wcag243'])).toEqual(['2.4.3']);
  });

  it('extracts 2-digit WCAG references', () => {
    expect(wcagRefsFromTags(['wcag21'])).toEqual(['2.1']);
  });

  it('ignores non-wcag tags', () => {
    expect(wcagRefsFromTags(['wcag2a', 'wcag2aa', 'best-practice'])).toEqual([]);
  });

  it('handles mixed tags', () => {
    const refs = wcagRefsFromTags(['wcag2aa', 'wcag412', 'wcag253', 'best-practice']);
    expect(refs).toEqual(['4.1.2', '2.5.3']);
  });

  it('returns empty for empty input', () => {
    expect(wcagRefsFromTags([])).toEqual([]);
  });
});

describe('impactToSeverity', () => {
  it('maps critical → critical', () => {
    expect(impactToSeverity('critical')).toBe('critical');
  });

  it('maps serious → major', () => {
    expect(impactToSeverity('serious')).toBe('major');
  });

  it('maps moderate → minor', () => {
    expect(impactToSeverity('moderate')).toBe('minor');
  });

  it('maps minor → info', () => {
    expect(impactToSeverity('minor')).toBe('info');
  });

  it('defaults to minor for null impact', () => {
    expect(impactToSeverity(null)).toBe('minor');
  });

  it('defaults to minor for unknown impact', () => {
    expect(impactToSeverity('unknown')).toBe('minor');
  });
});

describe('levelFromTags', () => {
  it('returns AAA when wcag2aaa tag is present', () => {
    expect(levelFromTags(['wcag2a', 'wcag2aa', 'wcag2aaa'])).toBe('AAA');
  });

  it('returns AA when wcag2aa tag is present but not wcag2aaa', () => {
    expect(levelFromTags(['wcag2a', 'wcag2aa'])).toBe('AA');
  });

  it('returns A when only wcag2a is present', () => {
    expect(levelFromTags(['wcag2a', 'best-practice'])).toBe('A');
  });

  it('returns A when no wcag level tag is present', () => {
    expect(levelFromTags(['best-practice'])).toBe('A');
  });

  it('returns A for empty tags', () => {
    expect(levelFromTags([])).toBe('A');
  });
});
