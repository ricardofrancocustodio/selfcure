import { describe, it, expect } from 'vitest';
import { scoreElement, buildRuntimeSelector } from '../src/discovery/runtime.js';

// Pure-function tests — no browser required.
// Integration tests (actual Playwright) are left to manual / CI browser environments.

describe('scoreElement', () => {
  it('returns 100 when testId is present', () => {
    expect(scoreElement({ testId: 'checkout.submit', tag: 'button' })).toBe(100);
  });

  it('returns 85 when id is present (no testId)', () => {
    expect(scoreElement({ id: 'submit-btn', tag: 'button' })).toBe(85);
  });

  it('returns 75 when accessible name is present (no testId/id)', () => {
    expect(scoreElement({ name: 'Submit order', tag: 'button' })).toBe(75);
  });

  it('returns 50 when only type is present', () => {
    expect(scoreElement({ type: 'email', tag: 'input' })).toBe(50);
  });

  it('returns 30 for a bare button tag', () => {
    expect(scoreElement({ tag: 'button' })).toBe(30);
  });

  it('returns 30 for a bare anchor tag', () => {
    expect(scoreElement({ tag: 'a' })).toBe(30);
  });

  it('returns 20 for a bare div tag', () => {
    expect(scoreElement({ tag: 'div' })).toBe(20);
  });

  it('prioritises testId over id and name', () => {
    expect(scoreElement({ testId: 'x', id: 'y', name: 'z', tag: 'button' })).toBe(100);
  });

  it('prioritises id over name', () => {
    expect(scoreElement({ id: 'y', name: 'z', tag: 'button' })).toBe(85);
  });
});

describe('buildRuntimeSelector', () => {
  it('uses data-testid selector when present', () => {
    expect(buildRuntimeSelector({ testId: 'checkout.submit', tag: 'button' }))
      .toBe('[data-testid="checkout.submit"]');
  });

  it('uses id selector when testId absent', () => {
    expect(buildRuntimeSelector({ id: 'submit-btn', tag: 'button' }))
      .toBe('#submit-btn');
  });

  it('uses aria-label selector when name present (no testId/id)', () => {
    expect(buildRuntimeSelector({ name: 'Close dialog', tag: 'button' }))
      .toBe('[aria-label="Close dialog"]');
  });

  it('falls back to tag name when no other info', () => {
    expect(buildRuntimeSelector({ tag: 'button' })).toBe('button');
  });

  it('prioritises testId over id and name', () => {
    expect(buildRuntimeSelector({ testId: 'a', id: 'b', name: 'c', tag: 'button' }))
      .toBe('[data-testid="a"]');
  });
});
