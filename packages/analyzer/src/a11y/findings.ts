import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { FindingInventory, AccessibilityFinding, WcagLevel } from './schema.js';

export type FindingsParseResult =
  | { ok: true; inventory: FindingInventory }
  | { ok: false; errors: string[] };

// ---------------------------------------------------------------------------
// Parse & validate
// ---------------------------------------------------------------------------

export function parseFindings(raw: string): FindingsParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ['Invalid JSON: could not parse findings file'] };
  }

  const errors = validateFindings(data);
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, inventory: data as FindingInventory };
}

function validateFindings(data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Root must be a JSON object'];
  }
  const obj = data as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof obj['version'] !== 'string') errors.push('"version" must be a string');
  if (typeof obj['app']     !== 'string') errors.push('"app" must be a string');
  if (obj['standard']       !== 'WCAG')   errors.push('"standard" must be "WCAG"');
  if (!Array.isArray(obj['findings']))    errors.push('"findings" must be an array');
  return errors;
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

export async function loadFindings(filePath: string): Promise<FindingsParseResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [`Cannot read findings file: ${msg}`] };
  }
  return parseFindings(raw);
}

export async function saveFindings(filePath: string, inventory: FindingInventory): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(inventory, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Empty inventory factory
// ---------------------------------------------------------------------------

export function emptyInventory(opts: { app: string; targetLevel?: WcagLevel }): FindingInventory {
  return {
    version: '1.0',
    app: opts.app,
    standard: 'WCAG',
    targetLevel: opts.targetLevel ?? 'AA',
    generatedAt: new Date().toISOString(),
    findings: [],
  };
}

// ---------------------------------------------------------------------------
// Merge — lifecycle management
// ---------------------------------------------------------------------------

/**
 * Merge findings from a new static scan into the existing inventory.
 *
 * Rules:
 * - Suppressed findings are never touched.
 * - Existing open/resolved findings that still appear → status 'open', lastSeenAt updated.
 * - Existing open findings that no longer appear → status 'resolved'.
 * - Previously resolved findings that reappear → status 'open', lastSeenAt updated.
 * - New findings not in inventory → appended as 'open'.
 *
 * Match key: ruleId + sourceFile + line + column.
 */
export function mergeFindings(
  existing: FindingInventory,
  newFindings: AccessibilityFinding[],
): FindingInventory {
  const now = new Date().toISOString();

  // Index new findings by key
  const newByKey = new Map<string, AccessibilityFinding>();
  for (const f of newFindings) {
    newByKey.set(findingKey(f), f);
  }

  const merged: AccessibilityFinding[] = [];

  for (const f of existing.findings) {
    if (f.status === 'suppressed') {
      merged.push(f);
      // Consume the new match so the suppressed finding isn't re-added as a fresh entry
      newByKey.delete(findingKey(f));
      continue;
    }
    const key = findingKey(f);
    if (newByKey.has(key)) {
      // Still present → keep/reopen, refresh timestamp
      merged.push({ ...f, status: 'open', lastSeenAt: now });
      newByKey.delete(key);
    } else if (f.status === 'open') {
      // Was open, now gone → resolve
      merged.push({ ...f, status: 'resolved', lastSeenAt: now });
    } else {
      // Already resolved, still absent — leave as-is
      merged.push(f);
    }
  }

  // Add genuinely new findings
  for (const f of newByKey.values()) {
    merged.push({ ...f, status: 'open', firstSeenAt: now, lastSeenAt: now });
  }

  return { ...existing, generatedAt: now, findings: merged };
}

function findingKey(f: AccessibilityFinding): string {
  return `${f.ruleId}::${f.sourceFile}::${f.line}::${f.column}`;
}
