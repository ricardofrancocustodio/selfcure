import type { TestIdInventory, InventoryElement } from '../testids/schema.js';
import type { TmlInventoryEntry } from './schema.js';
import { assessTagMaturity } from './score.js';

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/** Build a set of testId values that appear more than once in the inventory. */
export function buildDuplicateSet(inventory: TestIdInventory): Set<string> {
  const counts = new Map<string, number>();
  for (const route of inventory.routes) {
    for (const el of route.elements) {
      counts.set(el.testId, (counts.get(el.testId) ?? 0) + 1);
    }
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
}

// ---------------------------------------------------------------------------
// Naming convention validation
//
// Expected pattern: domain.screen-or-flow.element(.role-or-action)?
// e.g. "checkout.summary.apply-coupon-button"
// ---------------------------------------------------------------------------

export function isValidTmlNaming(testId: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,4}$/.test(testId);
}

// ---------------------------------------------------------------------------
// Inventory lookup
// ---------------------------------------------------------------------------

/**
 * Find inventory metadata for a given testId across all routes.
 * Returns undefined when the testId is not registered.
 */
export function buildTmlInventoryEntry(
  testId:       string,
  inventory:    TestIdInventory,
  duplicateIds: Set<string>,
): TmlInventoryEntry | undefined {
  for (const route of inventory.routes) {
    const invEl: InventoryElement | undefined = route.elements.find((e) => e.testId === testId);
    if (invEl) {
      return {
        hasOwner:     Boolean(invEl.owner ?? route.owner),
        hasIntent:    Boolean(invEl.intent),
        hasRoute:     Boolean(route.path),
        isDeprecated: invEl.status === 'deprecated' || invEl.status === 'removed',
        isDuplicate:  duplicateIds.has(testId),
        namingValid:  isValidTmlNaming(testId),
      };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Strip the CSS selector wrapper to get the raw testId string
// ---------------------------------------------------------------------------

function extractTestIdValue(dataTestIdSelector: string | undefined): string | undefined {
  if (!dataTestIdSelector) return undefined;
  // [data-testid="checkout.submit"] → checkout.submit
  const m = dataTestIdSelector.match(/\[data-testid=["']([^"']+)["']\]/);
  return m ? m[1] : undefined;
}

// ---------------------------------------------------------------------------
// Structural type — avoids circular import with ../../index.ts
// ---------------------------------------------------------------------------

interface EnrichableElement {
  testabilityScore: number;
  ambiguous:        boolean;
  label?:           string;
  type:             string;
  selectors: {
    dataTestId?: string;
  };
  selectorRanking: Array<{ strategy: string }>;
  tml?: unknown;   // TagMaturityResult — written in place
}

/**
 * Re-compute TML for all elements, enriching with inventory metadata.
 * Mutates each element's `tml` field in place.
 *
 * Call this after `analyze()` when a TestId Inventory is available.
 */
export function enrichTmlWithInventory(
  results:   Array<{ interactiveElements: EnrichableElement[] }>,
  inventory: TestIdInventory,
): void {
  const duplicates = buildDuplicateSet(inventory);

  for (const { interactiveElements } of results) {
    for (const el of interactiveElements) {
      const rawTestId  = extractTestIdValue(el.selectors.dataTestId);
      const invEntry   = rawTestId
        ? buildTmlInventoryEntry(rawTestId, inventory, duplicates)
        : undefined;

      const best = el.selectorRanking[0];
      el.tml = assessTagMaturity({
        testabilityScore: el.testabilityScore,
        ambiguous:        el.ambiguous,
        bestStrategy:     (best?.strategy ?? 'css') as 'data-testid' | 'id' | 'aria-label' | 'name' | 'css' | 'xpath',
        label:            el.label,
        elementType:      el.type,
        inventory:        invEntry,
      });
    }
  }
}
