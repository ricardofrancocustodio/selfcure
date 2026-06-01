import { describe, it, expect } from 'vitest';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseFindings, loadFindings, saveFindings, mergeFindings, emptyInventory } from '../src/a11y/findings.js';
import { runAudit } from '../src/a11y/audit.js';
import type { FindingInventory, AccessibilityFinding } from '../src/a11y/schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(overrides: Partial<AccessibilityFinding> = {}): AccessibilityFinding {
  return {
    id:           'a11y_test001',
    ruleId:       'a11y.button-accessible-name',
    wcag:         ['4.1.2'],
    level:        'A',
    severity:     'critical',
    status:       'open',
    sourceFile:   'src/Page.tsx',
    line:         10,
    column:       3,
    message:      'Button has no accessible name.',
    remediation:  'Add aria-label or text content.',
    firstSeenAt:  '2026-05-29T00:00:00.000Z',
    lastSeenAt:   '2026-05-29T00:00:00.000Z',
    ...overrides,
  };
}

function makeInventory(findings: Partial<AccessibilityFinding>[] = []): FindingInventory {
  return {
    version:      '1.0',
    app:          'test-app',
    standard:     'WCAG',
    targetLevel:  'AA',
    generatedAt:  '2026-05-29T00:00:00.000Z',
    findings:     findings.map((f) => makeFinding(f)),
  };
}

// ---------------------------------------------------------------------------
// parseFindings
// ---------------------------------------------------------------------------

describe('parseFindings — valid', () => {
  it('parses a valid findings file', () => {
    const raw = JSON.stringify(makeInventory());
    const result = parseFindings(raw);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.inventory.standard).toBe('WCAG');
  });

  it('accepts an empty findings array', () => {
    const result = parseFindings(JSON.stringify(makeInventory([])));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.inventory.findings).toHaveLength(0);
  });
});

describe('parseFindings — invalid', () => {
  it('returns error for invalid JSON', () => {
    const result = parseFindings('{bad');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/invalid json/i);
  });

  it('returns error when standard is not WCAG', () => {
    const raw = JSON.stringify({ ...makeInventory(), standard: 'AXE' });
    const result = parseFindings(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.includes('standard'))).toBe(true);
  });

  it('returns error when findings is not an array', () => {
    const raw = JSON.stringify({ ...makeInventory(), findings: {} });
    const result = parseFindings(raw);
    expect(result.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loadFindings & saveFindings
// ---------------------------------------------------------------------------

describe('loadFindings', () => {
  it('reads a findings file from disk', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sc-a11y-'));
    try {
      const file = join(dir, 'a11y-findings.json');
      await writeFile(file, JSON.stringify(makeInventory([{ id: 'f001' }])), 'utf-8');
      const result = await loadFindings(file);
      expect(result.ok).toBe(true);
    } finally { await rm(dir, { recursive: true }); }
  });

  it('returns error when file does not exist', async () => {
    const result = await loadFindings('/nonexistent/a11y-findings.json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/cannot read/i);
  });
});

describe('saveFindings', () => {
  it('writes inventory to disk and reads it back', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sc-a11y-'));
    try {
      const file = join(dir, '.selfcure', 'a11y-findings.json');
      const inv  = makeInventory([{ id: 'f001' }]);
      await saveFindings(file, inv);
      const result = await loadFindings(file);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.inventory.findings).toHaveLength(1);
    } finally { await rm(dir, { recursive: true }); }
  });
});

// ---------------------------------------------------------------------------
// emptyInventory
// ---------------------------------------------------------------------------

describe('emptyInventory', () => {
  it('creates an inventory with no findings', () => {
    const inv = emptyInventory({ app: 'my-app', targetLevel: 'AA' });
    expect(inv.findings).toHaveLength(0);
    expect(inv.app).toBe('my-app');
    expect(inv.targetLevel).toBe('AA');
    expect(inv.standard).toBe('WCAG');
  });

  it('defaults targetLevel to AA', () => {
    const inv = emptyInventory({ app: 'x' });
    expect(inv.targetLevel).toBe('AA');
  });
});

// ---------------------------------------------------------------------------
// mergeFindings — lifecycle
// ---------------------------------------------------------------------------

describe('mergeFindings — new finding (not in inventory)', () => {
  it('adds new findings as open', () => {
    const inv = makeInventory();
    const f   = makeFinding({ id: 'new001', ruleId: 'a11y.img-alt-text', line: 5 });
    const result = mergeFindings(inv, [f]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.status).toBe('open');
  });
});

describe('mergeFindings — existing open finding still present', () => {
  it('keeps status open and updates lastSeenAt', () => {
    const existing = makeFinding({ status: 'open', lastSeenAt: '2026-01-01T00:00:00.000Z' });
    const inv = makeInventory([existing]);
    const newF = makeFinding({ id: 'different-id' }); // same ruleId+file+line+col
    const result = mergeFindings(inv, [newF]);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.status).toBe('open');
    expect(result.findings[0]!.lastSeenAt).not.toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('mergeFindings — existing open finding now gone', () => {
  it('marks finding as resolved', () => {
    const inv = makeInventory([{ status: 'open' }]);
    const result = mergeFindings(inv, []); // empty new scan
    expect(result.findings[0]!.status).toBe('resolved');
  });
});

describe('mergeFindings — previously resolved finding reappears', () => {
  it('reopens the finding', () => {
    const inv = makeInventory([{ status: 'resolved' }]);
    const f   = makeFinding(); // same key
    const result = mergeFindings(inv, [f]);
    expect(result.findings[0]!.status).toBe('open');
  });
});

describe('mergeFindings — suppressed finding', () => {
  it('never touches suppressed findings', () => {
    const inv = makeInventory([{ status: 'suppressed' }]);
    const result = mergeFindings(inv, []); // gone from scan — but suppressed
    expect(result.findings[0]!.status).toBe('suppressed');
  });

  it('does not re-add a suppressed finding that reappears', () => {
    const inv = makeInventory([{ status: 'suppressed' }]);
    const f   = makeFinding(); // same key
    const result = mergeFindings(inv, [f]);
    // suppressed stays suppressed; the new finding should NOT be added again
    expect(result.findings.filter((x) => x.status === 'suppressed')).toHaveLength(1);
    // the new scan's finding was "consumed" by the suppressed match
    expect(result.findings).toHaveLength(1);
  });
});

describe('mergeFindings — generatedAt updated', () => {
  it('updates generatedAt timestamp on every merge', () => {
    const inv = makeInventory();
    const result = mergeFindings(inv, []);
    expect(result.generatedAt).not.toBe('2026-05-29T00:00:00.000Z');
  });
});

// ---------------------------------------------------------------------------
// runAudit
// ---------------------------------------------------------------------------

describe('runAudit — counts', () => {
  it('counts open, resolved, suppressed correctly', () => {
    const inv = makeInventory([
      { status: 'open',       severity: 'critical' },
      { status: 'open',       severity: 'major',   line: 20 },
      { status: 'resolved',   severity: 'minor',   line: 30 },
      { status: 'suppressed', severity: 'info',    line: 40 },
    ]);
    const result = runAudit(inv);
    expect(result.counts.open).toBe(2);
    expect(result.counts.resolved).toBe(1);
    expect(result.counts.suppressed).toBe(1);
  });

  it('counts bySeverity only for open findings', () => {
    const inv = makeInventory([
      { status: 'open',     severity: 'critical' },
      { status: 'open',     severity: 'critical', line: 20 },
      { status: 'open',     severity: 'major',    line: 30 },
      { status: 'resolved', severity: 'critical', line: 40 }, // resolved, not counted
    ]);
    const result = runAudit(inv);
    expect(result.counts.bySeverity.critical).toBe(2);
    expect(result.counts.bySeverity.major).toBe(1);
    expect(result.counts.bySeverity.minor).toBe(0);
  });
});

describe('runAudit — wouldFailCI', () => {
  it('returns true when open finding meets failOn threshold (major)', () => {
    const inv = makeInventory([{ status: 'open', severity: 'major' }]);
    expect(runAudit(inv, { failOn: 'major' }).wouldFailCI).toBe(true);
  });

  it('returns true when open finding exceeds failOn threshold (critical > major)', () => {
    const inv = makeInventory([{ status: 'open', severity: 'critical' }]);
    expect(runAudit(inv, { failOn: 'major' }).wouldFailCI).toBe(true);
  });

  it('returns false when open finding is below failOn threshold (minor < major)', () => {
    const inv = makeInventory([{ status: 'open', severity: 'minor' }]);
    expect(runAudit(inv, { failOn: 'major' }).wouldFailCI).toBe(false);
  });

  it('returns false when no open findings exist', () => {
    const inv = makeInventory([{ status: 'resolved', severity: 'critical' }]);
    expect(runAudit(inv).wouldFailCI).toBe(false);
  });

  it('defaults failOn to major', () => {
    const inv = makeInventory([{ status: 'open', severity: 'minor' }]);
    expect(runAudit(inv).wouldFailCI).toBe(false); // minor < major default
  });

  it('failOn critical only triggers on critical findings', () => {
    const inv = makeInventory([{ status: 'open', severity: 'major' }]);
    expect(runAudit(inv, { failOn: 'critical' }).wouldFailCI).toBe(false);
  });

  it('suppressed findings never contribute to wouldFailCI', () => {
    const inv = makeInventory([{ status: 'suppressed', severity: 'critical' }]);
    expect(runAudit(inv, { failOn: 'minor' }).wouldFailCI).toBe(false);
  });
});

describe('runAudit — findings array', () => {
  it('returns all findings regardless of status', () => {
    const inv = makeInventory([
      { status: 'open' },
      { status: 'resolved', line: 20 },
      { status: 'suppressed', line: 30 },
    ]);
    expect(runAudit(inv).findings).toHaveLength(3);
  });
});
