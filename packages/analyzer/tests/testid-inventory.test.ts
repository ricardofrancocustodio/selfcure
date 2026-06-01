import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseInventory, loadInventory, allTestIds } from '../src/testids/inventory.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_FULL = JSON.stringify({
  version: '1.0',
  app: 'checkout-web',
  generatedAt: '2026-05-29T00:00:00.000Z',
  routes: [
    {
      path: '/checkout',
      screen: 'CheckoutPage',
      owner: 'payments-frontend',
      elements: [
        {
          testId: 'checkout.payment-method.select',
          component: 'PaymentMethodSelect',
          elementType: 'select',
          intent: 'choose_payment_method',
          label: 'Payment method',
          sourceFile: 'src/pages/CheckoutPage.tsx',
          status: 'active',
          stability: 'stable',
          firstSeenAt: '2026-05-29T00:00:00.000Z',
          lastSeenAt: '2026-05-29T00:00:00.000Z',
        },
        {
          testId: 'checkout.coupon.input',
          status: 'active',
          stability: 'stable',
        },
      ],
    },
    {
      path: '/auth/login',
      elements: [
        {
          testId: 'auth.login.email-input',
          status: 'active',
          stability: 'stable',
        },
        {
          testId: 'auth.login.submit-button',
          status: 'deprecated',
          stability: 'unstable',
        },
      ],
    },
  ],
});

const MINIMAL_VALID = JSON.stringify({
  version: '1.0',
  app: 'my-app',
  routes: [{ path: '/home', elements: [{ testId: 'home.hero.cta' }] }],
});

const EMPTY_ROUTES = JSON.stringify({
  version: '1.0',
  app: 'my-app',
  routes: [],
});

// ---------------------------------------------------------------------------
// parseInventory — success cases
// ---------------------------------------------------------------------------

describe('parseInventory — valid input', () => {
  it('parses a full valid inventory', () => {
    const result = parseInventory(VALID_FULL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inventory.version).toBe('1.0');
    expect(result.inventory.app).toBe('checkout-web');
    expect(result.inventory.routes).toHaveLength(2);
    expect(result.inventory.routes[0]!.elements).toHaveLength(2);
  });

  it('parses a minimal inventory without optional fields', () => {
    const result = parseInventory(MINIMAL_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inventory.routes[0]!.path).toBe('/home');
    expect(result.inventory.routes[0]!.elements[0]!.testId).toBe('home.hero.cta');
  });

  it('parses an inventory with empty routes', () => {
    const result = parseInventory(EMPTY_ROUTES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inventory.routes).toHaveLength(0);
  });

  it('preserves route-level screen and owner', () => {
    const result = parseInventory(VALID_FULL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inventory.routes[0]!.screen).toBe('CheckoutPage');
    expect(result.inventory.routes[0]!.owner).toBe('payments-frontend');
  });

  it('preserves full element metadata', () => {
    const result = parseInventory(VALID_FULL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const el = result.inventory.routes[0]!.elements[0]!;
    expect(el.component).toBe('PaymentMethodSelect');
    expect(el.elementType).toBe('select');
    expect(el.intent).toBe('choose_payment_method');
    expect(el.sourceFile).toBe('src/pages/CheckoutPage.tsx');
  });
});

// ---------------------------------------------------------------------------
// parseInventory — normalization
// ---------------------------------------------------------------------------

describe('parseInventory — normalization', () => {
  it('defaults status to "active" when omitted', () => {
    const result = parseInventory(MINIMAL_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inventory.routes[0]!.elements[0]!.status).toBe('active');
  });

  it('defaults stability to "stable" when omitted', () => {
    const result = parseInventory(MINIMAL_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inventory.routes[0]!.elements[0]!.stability).toBe('stable');
  });

  it('sets generatedAt when omitted', () => {
    const result = parseInventory(MINIMAL_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inventory.generatedAt).toBeTruthy();
    expect(() => new Date(result.inventory.generatedAt)).not.toThrow();
  });

  it('sets firstSeenAt and lastSeenAt when omitted', () => {
    const result = parseInventory(MINIMAL_VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const el = result.inventory.routes[0]!.elements[0]!;
    expect(el.firstSeenAt).toBeTruthy();
    expect(el.lastSeenAt).toBeTruthy();
  });

  it('trims whitespace from testId', () => {
    const raw = JSON.stringify({
      version: '1.0',
      app: 'x',
      routes: [{ path: '/', elements: [{ testId: '  foo.bar  ' }] }],
    });
    const result = parseInventory(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.inventory.routes[0]!.elements[0]!.testId).toBe('foo.bar');
  });
});

// ---------------------------------------------------------------------------
// parseInventory — error cases
// ---------------------------------------------------------------------------

describe('parseInventory — invalid input', () => {
  it('returns error for invalid JSON', () => {
    const result = parseInventory('{not json}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/invalid json/i);
  });

  it('returns error when root is not an object', () => {
    const result = parseInventory('[]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/json object/i);
  });

  it('returns error for missing version', () => {
    const result = parseInventory(JSON.stringify({ app: 'x', routes: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('version'))).toBe(true);
  });

  it('returns error for missing app', () => {
    const result = parseInventory(JSON.stringify({ version: '1.0', routes: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('app'))).toBe(true);
  });

  it('returns error when routes is not an array', () => {
    const result = parseInventory(JSON.stringify({ version: '1.0', app: 'x', routes: {} }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('routes'))).toBe(true);
  });

  it('returns error when a route is missing path', () => {
    const result = parseInventory(
      JSON.stringify({ version: '1.0', app: 'x', routes: [{ elements: [] }] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('path'))).toBe(true);
  });

  it('returns error when an element testId is empty', () => {
    const result = parseInventory(
      JSON.stringify({
        version: '1.0',
        app: 'x',
        routes: [{ path: '/', elements: [{ testId: '   ' }] }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('testId'))).toBe(true);
  });

  it('returns error for invalid status value', () => {
    const result = parseInventory(
      JSON.stringify({
        version: '1.0',
        app: 'x',
        routes: [{ path: '/', elements: [{ testId: 'a.b', status: 'unknown' }] }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('status'))).toBe(true);
  });

  it('returns error for invalid stability value', () => {
    const result = parseInventory(
      JSON.stringify({
        version: '1.0',
        app: 'x',
        routes: [{ path: '/', elements: [{ testId: 'a.b', stability: 'very-stable' }] }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.includes('stability'))).toBe(true);
  });

  it('collects multiple errors in a single pass', () => {
    const result = parseInventory(JSON.stringify({ routes: [] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// allTestIds
// ---------------------------------------------------------------------------

describe('allTestIds', () => {
  it('returns all testIds in insertion order', () => {
    const result = parseInventory(VALID_FULL);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = allTestIds(result.inventory);
    expect(ids).toEqual([
      'checkout.payment-method.select',
      'checkout.coupon.input',
      'auth.login.email-input',
      'auth.login.submit-button',
    ]);
  });

  it('deduplicates testIds that appear in multiple routes', () => {
    const raw = JSON.stringify({
      version: '1.0',
      app: 'x',
      routes: [
        { path: '/a', elements: [{ testId: 'shared.id' }] },
        { path: '/b', elements: [{ testId: 'shared.id' }, { testId: 'unique.id' }] },
      ],
    });
    const result = parseInventory(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(allTestIds(result.inventory)).toEqual(['shared.id', 'unique.id']);
  });

  it('returns empty array for empty routes', () => {
    const result = parseInventory(EMPTY_ROUTES);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(allTestIds(result.inventory)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// loadInventory
// ---------------------------------------------------------------------------

describe('loadInventory', () => {
  it('reads a valid inventory file from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'selfcure-testid-'));
    const file = join(dir, 'testid-inventory.json');
    try {
      await writeFile(file, VALID_FULL, 'utf8');
      const result = await loadInventory(file);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.inventory.app).toBe('checkout-web');
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it('returns error when file does not exist', async () => {
    const result = await loadInventory('/nonexistent/path/testid-inventory.json');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatch(/cannot read/i);
  });

  it('returns error when file contains invalid JSON', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'selfcure-testid-'));
    const file = join(dir, 'bad.json');
    try {
      await writeFile(file, '{broken', 'utf8');
      const result = await loadInventory(file);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.errors[0]).toMatch(/invalid json/i);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
