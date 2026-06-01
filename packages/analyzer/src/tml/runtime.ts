import { assessTagMaturity } from './score.js';
import { buildTmlInventoryEntry, buildDuplicateSet } from './inventory.js';
import type { TmlInventoryEntry } from './schema.js';
import type { TestIdInventory } from '../testids/schema.js';

// ---------------------------------------------------------------------------
// Minimal structural types (avoid circular imports with ../../index.ts)
// ---------------------------------------------------------------------------

interface RuntimeEl {
  tag:     string;
  testId?: string;
  name?:   string;
  selector:string;
}

interface RouteEvidence {
  route:               string;
  status:              string;
  interactiveElements: RuntimeEl[];
}

export interface RuntimeMap {
  routes: RouteEvidence[];
}

interface EnrichableSelector {
  dataTestId?: string;
  ariaLabel?:  string;
  id?:         string;
}

interface EnrichableElement {
  testabilityScore: number;
  ambiguous:        boolean;
  label?:           string;
  type:             string;
  selectors:        EnrichableSelector;
  selectorRanking:  Array<{ strategy: string }>;
  tml?: unknown;
}


// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

/** Pull the raw testid string from "[data-testid="x"]" or undefined. */
function extractTestId(sel: string | undefined): string | undefined {
  if (!sel) return undefined;
  const m = sel.match(/\[data-testid=["']([^"']+)["']\]/);
  return m ? m[1] : undefined;
}

/** Pull the raw id from "#foo" or undefined. */
function extractId(sel: string | undefined): string | undefined {
  if (!sel) return undefined;
  const m = sel.match(/^#(.+)$/);
  return m ? m[1] : undefined;
}

/** Pull the aria-label value from "tag[aria-label="x"]" or "[aria-label="x"]". */
function extractAriaLabel(sel: string | undefined): string | undefined {
  if (!sel) return undefined;
  const m = sel.match(/\[aria-label=["']([^"']+)["']\]/);
  return m ? m[1] : undefined;
}

/**
 * Try to find matching runtime elements across all reachable routes.
 * Returns { found: true, unique: bool } or { found: false }.
 */
function matchRuntime(
  el:     EnrichableElement,
  routes: RouteEvidence[],
): { found: boolean; unique: boolean } {
  const reachable = routes.filter((r) => r.status === 'reachable');
  const allRt     = reachable.flatMap((r) => r.interactiveElements);

  // 1. Match by data-testid (most reliable)
  const testId = extractTestId(el.selectors.dataTestId);
  if (testId) {
    const hits = allRt.filter((r) => r.testId === testId);
    if (hits.length > 0) return { found: true, unique: hits.length === 1 };
  }

  // 2. Match by id
  const idVal = extractId(el.selectors.id);
  if (idVal) {
    const hits = allRt.filter((r) => r.selector === `#${idVal}`);
    if (hits.length > 0) return { found: true, unique: hits.length === 1 };
  }

  // 3. Match by aria-label / accessible name
  const ariaLabel = extractAriaLabel(el.selectors.ariaLabel);
  const nameToMatch = ariaLabel ?? el.label;
  if (nameToMatch) {
    const hits = allRt.filter(
      (r) => r.name === nameToMatch || r.selector === `[aria-label="${nameToMatch}"]`,
    );
    if (hits.length > 0) return { found: true, unique: hits.length === 1 };
  }

  // No reliable match found
  return { found: false, unique: false };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Re-compute TML for all elements using Playwright runtime evidence from
 * `selfcure discover --runtime`. Mutates each element's `tml` field in place.
 *
 * Pass the same `inventory` used in `enrichTmlWithInventory()` to preserve
 * governance signals while adding runtime caps.
 *
 * Effects per element:
 *  - Observed + unique    → confidence boost; static/inventory level preserved.
 *  - Observed + not unique → cap at TML 1 (locator ambiguous in live page).
 *  - Not observed          → cap at TML 2 (element absent in rendered DOM).
 */
export function enrichTmlWithRuntime(
  results:    Array<{ interactiveElements: EnrichableElement[] }>,
  runtimeMap: RuntimeMap,
  inventory?: TestIdInventory,
): void {
  const duplicates = inventory ? buildDuplicateSet(inventory) : new Set<string>();

  for (const { interactiveElements } of results) {
    for (const el of interactiveElements) {
      const match   = matchRuntime(el, runtimeMap.routes);
      const testId  = extractTestId(el.selectors.dataTestId);
      let invEntry: TmlInventoryEntry | undefined;
      if (inventory && testId) {
        invEntry = buildTmlInventoryEntry(testId, inventory, duplicates);
      }

      const best = el.selectorRanking[0];
      el.tml = assessTagMaturity({
        testabilityScore: el.testabilityScore,
        ambiguous:        el.ambiguous,
        bestStrategy:     (best?.strategy ?? 'css') as 'data-testid' | 'id' | 'aria-label' | 'name' | 'css' | 'xpath',
        label:            el.label,
        elementType:      el.type,
        inventory:        invEntry,
        runtime: {
          observed: match.found,
          unique:   match.unique,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Load route-map.json from disk
// ---------------------------------------------------------------------------

export async function loadRuntimeMap(filePath: string): Promise<RuntimeMap> {
  const { readFile } = await import('node:fs/promises');
  const raw = await readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as any)['routes'])) {
    throw new Error(`Invalid route-map.json at ${filePath}`);
  }
  return parsed as RuntimeMap;
}
