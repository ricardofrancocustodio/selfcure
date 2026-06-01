import { readFile } from 'node:fs/promises';
import type { TestIdInventory, InventoryRoute, InventoryElement, InventoryElementStatus, InventoryElementStability } from './schema.js';

export type { TestIdInventory, InventoryRoute, InventoryElement };

export type ParseResult =
  | { ok: true; inventory: TestIdInventory }
  | { ok: false; errors: string[] };

const VALID_STATUSES: InventoryElementStatus[] = ['active', 'deprecated', 'removed'];
const VALID_STABILITIES: InventoryElementStability[] = ['stable', 'unstable', 'dynamic'];

export function parseInventory(raw: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, errors: ['Invalid JSON: could not parse inventory file'] };
  }

  const errors = validateInventory(data);
  if (errors.length > 0) return { ok: false, errors };

  return { ok: true, inventory: normalizeInventory(data as TestIdInventory) };
}

export async function loadInventory(filePath: string): Promise<ParseResult> {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [`Cannot read inventory file: ${msg}`] };
  }
  return parseInventory(raw);
}

/**
 * Return all testId strings from a parsed inventory in insertion order,
 * deduplicating across routes.
 */
export function allTestIds(inventory: TestIdInventory): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const route of inventory.routes) {
    for (const el of route.elements) {
      if (!seen.has(el.testId)) {
        seen.add(el.testId);
        ids.push(el.testId);
      }
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateInventory(data: unknown): string[] {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Root must be a JSON object'];
  }
  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj['version'] !== 'string' || !obj['version']) {
    errors.push('"version" must be a non-empty string');
  }
  if (typeof obj['app'] !== 'string' || !obj['app']) {
    errors.push('"app" must be a non-empty string');
  }
  if (!Array.isArray(obj['routes'])) {
    errors.push('"routes" must be an array');
    return errors;
  }

  for (let i = 0; i < (obj['routes'] as unknown[]).length; i++) {
    errors.push(...validateRoute((obj['routes'] as unknown[])[i], i));
  }

  return errors;
}

function validateRoute(data: unknown, index: number): string[] {
  const prefix = `routes[${index}]`;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [`${prefix} must be an object`];
  }
  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj['path'] !== 'string' || !obj['path']) {
    errors.push(`${prefix}.path must be a non-empty string`);
  }
  if (!Array.isArray(obj['elements'])) {
    errors.push(`${prefix}.elements must be an array`);
    return errors;
  }

  for (let j = 0; j < (obj['elements'] as unknown[]).length; j++) {
    errors.push(...validateElement((obj['elements'] as unknown[])[j], index, j));
  }

  return errors;
}

function validateElement(data: unknown, ri: number, ei: number): string[] {
  const prefix = `routes[${ri}].elements[${ei}]`;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return [`${prefix} must be an object`];
  }
  const obj = data as Record<string, unknown>;
  const errors: string[] = [];

  if (typeof obj['testId'] !== 'string' || !(obj['testId'] as string).trim()) {
    errors.push(`${prefix}.testId must be a non-empty string`);
  }
  if (obj['status'] !== undefined && !VALID_STATUSES.includes(obj['status'] as InventoryElementStatus)) {
    errors.push(`${prefix}.status must be one of: ${VALID_STATUSES.join(', ')}`);
  }
  if (obj['stability'] !== undefined && !VALID_STABILITIES.includes(obj['stability'] as InventoryElementStability)) {
    errors.push(`${prefix}.stability must be one of: ${VALID_STABILITIES.join(', ')}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Normalization — applies defaults so consumers never need to null-check status/stability
// ---------------------------------------------------------------------------

function normalizeInventory(raw: TestIdInventory): TestIdInventory {
  return {
    version: raw.version,
    app: raw.app,
    generatedAt: raw.generatedAt ?? new Date().toISOString(),
    routes: (raw.routes ?? []).map(normalizeRoute),
  };
}

function normalizeRoute(raw: InventoryRoute): InventoryRoute {
  const result: InventoryRoute = {
    path: raw.path,
    elements: (raw.elements ?? []).map(normalizeElement),
  };
  if (raw.screen !== undefined) result.screen = raw.screen;
  if (raw.owner !== undefined) result.owner = raw.owner;
  return result;
}

function normalizeElement(raw: InventoryElement): InventoryElement {
  const now = new Date().toISOString();
  const result: InventoryElement = {
    testId: raw.testId.trim(),
    status: raw.status ?? 'active',
    stability: raw.stability ?? 'stable',
    firstSeenAt: raw.firstSeenAt ?? now,
    lastSeenAt: raw.lastSeenAt ?? now,
  };
  if (raw.component !== undefined) result.component = raw.component;
  if (raw.elementType !== undefined) result.elementType = raw.elementType;
  if (raw.intent !== undefined) result.intent = raw.intent;
  if (raw.label !== undefined) result.label = raw.label;
  if (raw.sourceFile !== undefined) result.sourceFile = raw.sourceFile;
  if (raw.pattern !== undefined) result.pattern = raw.pattern;
  if (raw.owner !== undefined) result.owner = raw.owner;
  return result;
}
