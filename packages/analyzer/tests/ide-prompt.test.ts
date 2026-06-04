import { describe, it, expect } from 'vitest';
import { buildIdePrompt } from '../src/ide-prompt.js';
import type { IdePromptIssue } from '../src/ide-prompt.js';

function issue(overrides: Partial<IdePromptIssue> = {}): IdePromptIssue {
  return {
    filePath:        'src/pages/Checkout.tsx',
    componentName:   'Checkout',
    elementType:     'button',
    selector:        '//button',
    kind:            'low-score',
    suggestedTestId: 'submit',
    ...overrides,
  };
}

describe('buildIdePrompt', () => {
  it('returns empty string for no issues', () => {
    expect(buildIdePrompt([])).toBe('');
  });

  it('includes the suggested data-testid for each element', () => {
    const out = buildIdePrompt([issue({ suggestedTestId: 'pay-now' })]);
    expect(out).toContain('data-testid="pay-now"');
  });

  it('describes low-score elements as lacking a stable selector', () => {
    const out = buildIdePrompt([issue({ kind: 'low-score' })]);
    expect(out).toContain('no stable selector');
  });

  it('describes ambiguous elements with their reason (trailing period trimmed)', () => {
    const out = buildIdePrompt([
      issue({ kind: 'ambiguous', ambiguityReason: 'matches 3 siblings.' }),
    ]);
    expect(out).toContain('ambiguous — matches 3 siblings.');
    expect(out).not.toContain('siblings..');
  });

  it('falls back to a generic ambiguity reason when none is given', () => {
    const out = buildIdePrompt([issue({ kind: 'ambiguous', ambiguityReason: undefined })]);
    expect(out).toContain('also matches a sibling');
  });

  it('groups issues by file under a heading', () => {
    const out = buildIdePrompt([
      issue({ filePath: 'src/A.tsx', suggestedTestId: 'a' }),
      issue({ filePath: 'src/A.tsx', suggestedTestId: 'b' }),
      issue({ filePath: 'src/B.tsx', suggestedTestId: 'c' }),
    ]);
    expect(out).toContain('### src/A.tsx');
    expect(out).toContain('### src/B.tsx');
    expect(out).toContain('3 across 2 file(s)');
  });

  it('includes the line number when present and omits it otherwise', () => {
    expect(buildIdePrompt([issue({ line: 42 })])).toContain('L42');
    expect(buildIdePrompt([issue({ line: undefined })])).not.toContain('L42');
  });

  it('relativises file paths against baseDir and normalises slashes', () => {
    const out = buildIdePrompt(
      [issue({ filePath: 'C:\\repo\\src\\A.tsx' })],
      { baseDir: 'C:\\repo' },
    );
    expect(out).toContain('### src/A.tsx');
    expect(out).not.toContain('C:');
  });

  it('uses a custom naming convention when provided', () => {
    const out = buildIdePrompt([issue()], { convention: 'snake_case only' });
    expect(out).toContain('Naming convention: snake_case only.');
  });

  it('is deterministic — same input, same output', () => {
    const issues = [issue({ suggestedTestId: 'x' }), issue({ filePath: 'src/B.tsx', suggestedTestId: 'y' })];
    expect(buildIdePrompt(issues)).toBe(buildIdePrompt(issues));
  });

  it('includes the current selector to help the agent locate the element', () => {
    const out = buildIdePrompt([issue({ selector: '.btn-primary' })]);
    expect(out).toContain('matched by `.btn-primary`');
  });

  it('names the element type as a word, not a fake HTML tag', () => {
    const out = buildIdePrompt([issue({ elementType: 'link', selector: '//a' })]);
    expect(out).toContain('the `link` element');
    expect(out).not.toContain('<link>');
  });
});
