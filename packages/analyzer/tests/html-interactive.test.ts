import { describe, it, expect } from 'vitest';
import { analyze } from '../src/index.js';
import type { ComponentMeta } from '@selfcure/crawler';

// ---------------------------------------------------------------------------
// Helper: build a minimal HTML-framework component with given elements
// ---------------------------------------------------------------------------

function htmlComponent(htmlElements: Array<{ tag: string; attrs: Record<string, string> }>): ComponentMeta {
  return {
    filePath:      'src/app/x.component.html',
    componentName: 'X',
    framework:     'html',
    props:         [],
    // ast is unused on the HTML path
    ast:           { type: 'Program', body: [], sourceType: 'module' } as unknown as ComponentMeta['ast'],
    htmlElements,
  };
}

async function elementsOf(htmlElements: Array<{ tag: string; attrs: Record<string, string> }>) {
  const [result] = await analyze([htmlComponent(htmlElements)]);
  return result!.interactiveElements;
}

// ---------------------------------------------------------------------------
// Native elements still work
// ---------------------------------------------------------------------------

describe('HTML extraction — native elements', () => {
  it('classifies <button> as button', async () => {
    const els = await elementsOf([{ tag: 'button', attrs: {} }]);
    expect(els).toHaveLength(1);
    expect(els[0]!.type).toBe('button');
  });

  it('classifies <a> as link', async () => {
    const els = await elementsOf([{ tag: 'a', attrs: { href: '/x' } }]);
    expect(els[0]!.type).toBe('link');
  });
});

// ---------------------------------------------------------------------------
// Non-semantic interactive elements (the Angular div-as-button case)
// ---------------------------------------------------------------------------

describe('HTML extraction — non-semantic interactive', () => {
  it('detects a <div> with ng-click as custom interactive', async () => {
    const els = await elementsOf([{ tag: 'div', attrs: { 'ng-click': 'vm.toggle()' } }]);
    expect(els).toHaveLength(1);
    expect(els[0]!.type).toBe('custom');
  });

  it('detects a <div> with (click) (Angular 2+) as custom', async () => {
    const els = await elementsOf([{ tag: 'div', attrs: { '(click)': 'onToggle()' } }]);
    expect(els[0]!.type).toBe('custom');
  });

  it('classifies role="button" div as button', async () => {
    const els = await elementsOf([{ tag: 'div', attrs: { role: 'button' } }]);
    expect(els[0]!.type).toBe('button');
  });

  it('classifies role="link" span as link', async () => {
    const els = await elementsOf([{ tag: 'span', attrs: { role: 'link' } }]);
    expect(els[0]!.type).toBe('link');
  });

  it('detects a div with tabindex as interactive', async () => {
    const els = await elementsOf([{ tag: 'div', attrs: { tabindex: '0' } }]);
    expect(els[0]!.type).toBe('custom');
  });

  it('ignores a plain <div> with no interactivity signal', async () => {
    const els = await elementsOf([{ tag: 'div', attrs: { class: 'wrapper' } }]);
    expect(els).toHaveLength(0);
  });

  it('flags a non-semantic interactive div as low-score (no stable locator)', async () => {
    const els = await elementsOf([{ tag: 'div', attrs: { 'ng-click': 'vm.toggle()' } }]);
    expect(els[0]!.testabilityScore).toBeLessThan(65);
  });
});

// ---------------------------------------------------------------------------
// testid alias recognition
// ---------------------------------------------------------------------------

describe('HTML extraction — testid alias', () => {
  it('recognises non-standard `testid` as a stable locator', async () => {
    const els = await elementsOf([{ tag: 'div', attrs: { testid: 'mabl-op-hours', 'ng-click': 'vm.x()' } }]);
    expect(els).toHaveLength(1);
    expect(els[0]!.testabilityScore).toBe(100);
  });

  it('prefers data-testid when both present', async () => {
    const els = await elementsOf([{ tag: 'div', attrs: { 'data-testid': 'a', testid: 'b', role: 'button' } }]);
    expect(els[0]!.selectors.dataTestId).toContain('a');
  });
});
