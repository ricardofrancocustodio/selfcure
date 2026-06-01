import { describe, it, expect } from 'vitest';
import { parse } from '@typescript-eslint/parser';
import { extractA11yEvidence, extractA11yEvidenceFromAll } from '../../crawler/src/a11y/extract.js';
import { runStaticAnalysis } from '../src/a11y/static.js';
import type { A11yFileEvidence } from '../../crawler/src/a11y/extract.js';
import type { ComponentMeta } from '../../crawler/src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseComponent(source: string, filePath = 'src/Test.tsx'): ComponentMeta {
  const ast = parse(source, { jsx: true, loc: true, range: true });
  return {
    filePath,
    componentName: 'Test',
    framework: 'react',
    props: [],
    ast,
  };
}

function evidence(source: string, filePath = 'src/Test.tsx'): A11yFileEvidence {
  return extractA11yEvidence(parseComponent(source, filePath));
}

function findings(source: string, level: 'A' | 'AA' | 'AAA' = 'AA') {
  return runStaticAnalysis([evidence(source)], { level });
}

function findingsByRule(source: string, ruleId: string) {
  return findings(source, 'AA').filter((f) => f.ruleId === ruleId);
}

// ---------------------------------------------------------------------------
// extractA11yEvidence — element detection
// ---------------------------------------------------------------------------

describe('extractA11yEvidence — basic extraction', () => {
  it('extracts a button element', () => {
    const ev = evidence('<button>Click</button>');
    const btn = ev.elements.find((e) => e.tag === 'button');
    expect(btn).toBeDefined();
    expect(btn?.hasTextChildren).toBe(true);
  });

  it('extracts attribute values', () => {
    const ev = evidence('<input id="email" type="email" aria-label="Email address" />');
    const input = ev.elements.find((e) => e.tag === 'input');
    expect(input?.attrs['id']).toBe('email');
    expect(input?.attrs['type']).toBe('email');
    expect(input?.attrs['aria-label']).toBe('Email address');
  });

  it('marks JSX expression attrs as __dynamic__', () => {
    const ev = evidence('<button aria-label={ariaLabel}>X</button>');
    const btn = ev.elements.find((e) => e.tag === 'button');
    expect(btn?.attrs['aria-label']).toBe('__dynamic__');
  });

  it('marks onClick with __dynamic__ when expression is non-literal', () => {
    const ev = evidence('<div onClick={handleClick} />');
    const div = ev.elements.find((e) => e.tag === 'div');
    expect(div?.attrs['onClick']).toBe('__dynamic__');
  });

  it('detects self-closing elements', () => {
    const ev = evidence('<img src="logo.png" />');
    expect(ev.elements[0]?.selfClosing).toBe(true);
    expect(ev.elements[0]?.hasTextChildren).toBe(false);
  });

  it('collects all literal id values into allIds', () => {
    const ev = evidence('<div id="hero"><span id="sub"></span></div>');
    expect(ev.allIds).toContain('hero');
    expect(ev.allIds).toContain('sub');
  });

  it('does not collect dynamic id values into allIds', () => {
    const ev = evidence('<div id={dynamicId} />');
    expect(ev.allIds).toHaveLength(0);
  });

  it('returns correct line number', () => {
    const src = '<div>\n  <button>OK</button>\n</div>';
    const ev = evidence(src);
    const btn = ev.elements.find((e) => e.tag === 'button');
    expect(btn?.line).toBe(2);
  });

  it('ignores capitalized component names (React components)', () => {
    const ev = evidence('<Button aria-label="submit" />');
    // No elements should be extracted because "Button" starts with uppercase
    expect(ev.elements.filter((e) => e.tag === 'button')).toHaveLength(0);
  });

  it('extractA11yEvidenceFromAll skips html-framework components', () => {
    const htmlComp: ComponentMeta = {
      filePath: 'index.html',
      componentName: 'index',
      framework: 'html',
      props: [],
      ast: { type: 'Program', body: [], sourceType: 'module' } as unknown as ComponentMeta['ast'],
    };
    const result = extractA11yEvidenceFromAll([htmlComp]);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.button-accessible-name
// ---------------------------------------------------------------------------

describe('rule: a11y.button-accessible-name', () => {
  it('flags a button with no accessible name', () => {
    const f = findingsByRule('<button />', 'a11y.button-accessible-name');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('critical');
  });

  it('does not flag a button with text content', () => {
    expect(findingsByRule('<button>Submit</button>', 'a11y.button-accessible-name')).toHaveLength(0);
  });

  it('does not flag a button with aria-label', () => {
    expect(findingsByRule('<button aria-label="Close dialog" />', 'a11y.button-accessible-name')).toHaveLength(0);
  });

  it('does not flag a button with aria-labelledby', () => {
    expect(findingsByRule('<button aria-labelledby="title" />', 'a11y.button-accessible-name')).toHaveLength(0);
  });

  it('does not flag a button with title', () => {
    expect(findingsByRule('<button title="Delete item" />', 'a11y.button-accessible-name')).toHaveLength(0);
  });

  it('flags a button with only whitespace content', () => {
    const f = findingsByRule('<button>   </button>', 'a11y.button-accessible-name');
    expect(f).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.link-accessible-name
// ---------------------------------------------------------------------------

describe('rule: a11y.link-accessible-name', () => {
  it('flags an anchor with no text', () => {
    const f = findingsByRule('<a href="/home" />', 'a11y.link-accessible-name');
    expect(f).toHaveLength(1);
  });

  it('does not flag an anchor with text', () => {
    expect(findingsByRule('<a href="/home">Home</a>', 'a11y.link-accessible-name')).toHaveLength(0);
  });

  it('does not flag an anchor with aria-label', () => {
    expect(findingsByRule('<a href="/home" aria-label="Go home" />', 'a11y.link-accessible-name')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.input-associated-label
// ---------------------------------------------------------------------------

describe('rule: a11y.input-associated-label', () => {
  it('flags an input with no label association', () => {
    const f = findingsByRule('<input type="text" />', 'a11y.input-associated-label');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('critical');
  });

  it('does not flag an input with aria-label', () => {
    expect(findingsByRule('<input type="text" aria-label="Name" />', 'a11y.input-associated-label')).toHaveLength(0);
  });

  it('does not flag an input with aria-labelledby', () => {
    expect(findingsByRule('<input type="text" aria-labelledby="nameLabel" />', 'a11y.input-associated-label')).toHaveLength(0);
  });

  it('does not flag when a label with htmlFor points to this input id', () => {
    const src = '<div><label htmlFor="email">Email</label><input id="email" type="email" /></div>';
    expect(findingsByRule(src, 'a11y.input-associated-label')).toHaveLength(0);
  });

  it('does not flag hidden inputs', () => {
    expect(findingsByRule('<input type="hidden" />', 'a11y.input-associated-label')).toHaveLength(0);
  });

  it('flags when label htmlFor does not match the input id', () => {
    const src = '<div><label htmlFor="username">User</label><input id="email" type="email" /></div>';
    const f = findingsByRule(src, 'a11y.input-associated-label');
    expect(f).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.img-alt-text
// ---------------------------------------------------------------------------

describe('rule: a11y.img-alt-text', () => {
  it('flags an image with no alt attribute', () => {
    const f = findingsByRule('<img src="logo.png" />', 'a11y.img-alt-text');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('major');
  });

  it('does not flag an image with descriptive alt text', () => {
    expect(findingsByRule('<img src="logo.png" alt="Company logo" />', 'a11y.img-alt-text')).toHaveLength(0);
  });

  it('does not flag a decorative image with alt=""', () => {
    expect(findingsByRule('<img src="deco.png" alt="" />', 'a11y.img-alt-text')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.aria-invalid-reference
// ---------------------------------------------------------------------------

describe('rule: a11y.aria-invalid-reference', () => {
  it('flags aria-labelledby referencing a nonexistent id', () => {
    const f = findingsByRule('<button aria-labelledby="missing-id" />', 'a11y.aria-invalid-reference');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('critical');
  });

  it('does not flag when the referenced id exists in the same file', () => {
    const src = '<div><span id="title">Label</span><button aria-labelledby="title" /></div>';
    expect(findingsByRule(src, 'a11y.aria-invalid-reference')).toHaveLength(0);
  });

  it('flags aria-describedby with invalid reference', () => {
    const f = findingsByRule('<input aria-describedby="hint-text" />', 'a11y.aria-invalid-reference');
    expect(f).toHaveLength(1);
  });

  it('flags aria-controls with invalid reference', () => {
    const f = findingsByRule('<button aria-controls="menu" />', 'a11y.aria-invalid-reference');
    expect(f).toHaveLength(1);
  });

  it('does not flag dynamic aria references', () => {
    const f = findingsByRule('<button aria-labelledby={labelId} />', 'a11y.aria-invalid-reference');
    expect(f).toHaveLength(0);
  });

  it('handles space-separated ids in aria-labelledby', () => {
    const src = '<div id="a"><button aria-labelledby="a missing-b" /></div>';
    const f = findingsByRule(src, 'a11y.aria-invalid-reference');
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain('missing-b');
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.positive-tabindex
// ---------------------------------------------------------------------------

describe('rule: a11y.positive-tabindex', () => {
  it('flags tabIndex > 0', () => {
    const f = findingsByRule('<div tabIndex={2} />', 'a11y.positive-tabindex');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('major');
  });

  it('does not flag tabIndex={0}', () => {
    expect(findingsByRule('<div tabIndex={0} />', 'a11y.positive-tabindex')).toHaveLength(0);
  });

  it('does not flag tabIndex={-1}', () => {
    expect(findingsByRule('<div tabIndex={-1} />', 'a11y.positive-tabindex')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.noninteractive-click-handler
// ---------------------------------------------------------------------------

describe('rule: a11y.noninteractive-click-handler', () => {
  it('flags a div with onClick and no role/tabIndex', () => {
    const f = findingsByRule('<div onClick={handleClick} />', 'a11y.noninteractive-click-handler');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('major');
  });

  it('does not flag when role and tabIndex are both present', () => {
    const src = '<div role="button" tabIndex={0} onClick={handleClick} />';
    expect(findingsByRule(src, 'a11y.noninteractive-click-handler')).toHaveLength(0);
  });

  it('still flags when role is present but tabIndex is missing', () => {
    const src = '<div role="button" onClick={handleClick} />';
    const f = findingsByRule(src, 'a11y.noninteractive-click-handler');
    expect(f).toHaveLength(1);
  });

  it('does not flag interactive elements with onClick', () => {
    expect(findingsByRule('<button onClick={handleClick}>OK</button>', 'a11y.noninteractive-click-handler')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.missing-dialog-name
// ---------------------------------------------------------------------------

describe('rule: a11y.missing-dialog-name', () => {
  it('flags role=dialog with no name', () => {
    const f = findingsByRule('<div role="dialog" />', 'a11y.missing-dialog-name');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('critical');
  });

  it('flags role=alertdialog with no name', () => {
    const f = findingsByRule('<div role="alertdialog" />', 'a11y.missing-dialog-name');
    expect(f).toHaveLength(1);
  });

  it('does not flag dialog with aria-label', () => {
    expect(findingsByRule('<div role="dialog" aria-label="Settings" />', 'a11y.missing-dialog-name')).toHaveLength(0);
  });

  it('does not flag dialog with aria-labelledby', () => {
    expect(findingsByRule('<div role="dialog" aria-labelledby="dialogTitle" />', 'a11y.missing-dialog-name')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.heading-order
// ---------------------------------------------------------------------------

describe('rule: a11y.heading-order', () => {
  it('flags when heading level skips from h1 to h3', () => {
    const src = '<div><h1>Title</h1><h3>Sub</h3></div>';
    const f = findingsByRule(src, 'a11y.heading-order');
    expect(f).toHaveLength(1);
    expect(f[0]?.message).toContain('h3');
  });

  it('does not flag h1 followed by h2', () => {
    expect(findingsByRule('<div><h1>T</h1><h2>S</h2></div>', 'a11y.heading-order')).toHaveLength(0);
  });

  it('does not flag going from h3 back to h1 (decrease is fine)', () => {
    expect(findingsByRule('<div><h2>A</h2><h3>B</h3><h1>C</h1></div>', 'a11y.heading-order')).toHaveLength(0);
  });

  it('is only applied at WCAG AA level (not A)', () => {
    const src = '<div><h1>T</h1><h3>S</h3></div>';
    // heading-order is a Level AA rule
    const atA  = runStaticAnalysis([evidence(src)], { level: 'A' }).filter((f) => f.ruleId === 'a11y.heading-order');
    const atAA = runStaticAnalysis([evidence(src)], { level: 'AA' }).filter((f) => f.ruleId === 'a11y.heading-order');
    expect(atA).toHaveLength(0);
    expect(atAA).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Rule: a11y.duplicate-id
// ---------------------------------------------------------------------------

describe('rule: a11y.duplicate-id', () => {
  it('flags a duplicate id attribute', () => {
    const src = '<div><span id="title">A</span><span id="title">B</span></div>';
    const f = findingsByRule(src, 'a11y.duplicate-id');
    expect(f).toHaveLength(1);
    expect(f[0]?.severity).toBe('critical');
    expect(f[0]?.message).toContain('title');
  });

  it('does not flag unique ids', () => {
    const src = '<div><span id="a">A</span><span id="b">B</span></div>';
    expect(findingsByRule(src, 'a11y.duplicate-id')).toHaveLength(0);
  });

  it('does not flag dynamic ids', () => {
    const src = '<div><span id={idA} /><span id={idB} /></div>';
    expect(findingsByRule(src, 'a11y.duplicate-id')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// runStaticAnalysis — cross-cutting behaviour
// ---------------------------------------------------------------------------

describe('runStaticAnalysis — options and output', () => {
  it('returns findings sorted by file then line', () => {
    const ev1 = evidence('<div>\n<button />\n<img src="x" />\n</div>', 'src/A.tsx');
    const ev2 = evidence('<a href="/" />', 'src/B.tsx');
    const result = runStaticAnalysis([ev2, ev1], { level: 'AA' });
    // src/A.tsx comes before src/B.tsx alphabetically
    const files = result.map((f) => f.sourceFile);
    expect(files[0]).toBe('src/A.tsx');
  });

  it('excludes Level AA rules when level is A', () => {
    // heading-order is AA — must not appear when targeting Level A
    const src = '<div><h1>T</h1><h3>S</h3></div>';
    const result = runStaticAnalysis([evidence(src)], { level: 'A' });
    expect(result.find((f) => f.ruleId === 'a11y.heading-order')).toBeUndefined();
  });

  it('returns finding objects with required fields', () => {
    const result = runStaticAnalysis([evidence('<button />')]);
    expect(result.length).toBeGreaterThan(0);
    const f = result[0]!;
    expect(f.id).toMatch(/^a11y_/);
    expect(f.ruleId).toBeTruthy();
    expect(f.severity).toBeTruthy();
    expect(f.sourceFile).toBeTruthy();
    expect(f.line).toBeGreaterThan(0);
    expect(f.status).toBe('open');
    expect(f.firstSeenAt).toBeTruthy();
  });

  it('returns empty array for a clean component', () => {
    const src = [
      '<form>',
      '  <label htmlFor="email">Email</label>',
      '  <input id="email" type="email" aria-label="Email" />',
      '  <button aria-label="Submit form">Submit</button>',
      '  <img src="logo.png" alt="Company logo" />',
      '</form>',
    ].join('\n');
    expect(runStaticAnalysis([evidence(src)])).toHaveLength(0);
  });
});
