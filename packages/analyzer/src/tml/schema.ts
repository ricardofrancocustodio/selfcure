// ---------------------------------------------------------------------------
// Tag Maturity Level (TML) — public types
// ---------------------------------------------------------------------------

export type TagMaturityLevel = 0 | 1 | 2 | 3 | 4;

export type TagMaturityLabel = 'unusable' | 'fragile' | 'usable' | 'stable' | 'governed';

export const TML_LABELS: Record<TagMaturityLevel, TagMaturityLabel> = {
  0: 'unusable',
  1: 'fragile',
  2: 'usable',
  3: 'stable',
  4: 'governed',
};

// ---------------------------------------------------------------------------
// Reason codes — one per observable condition
// ---------------------------------------------------------------------------

export type TagMaturityReasonCode =
  | 'stable-testid'
  | 'missing-testid'
  | 'invalid-testid-name'
  | 'duplicate-testid'
  | 'deprecated-testid'
  | 'strong-role-name'
  | 'generic-accessible-name'
  | 'missing-accessible-name'
  | 'ambiguous-selector'
  | 'weak-css-selector'
  | 'runtime-not-observed'
  | 'runtime-unique'
  | 'missing-owner'
  | 'missing-intent';

export interface TagMaturityReason {
  code:      TagMaturityReasonCode;
  severity:  'info' | 'warning' | 'error';
  message:   string;
  evidence?: string[];
}

// ---------------------------------------------------------------------------
// Required changes — what must change to raise the level
// ---------------------------------------------------------------------------

export type TagMaturityChangeType =
  | 'add-testid'
  | 'rename-testid'
  | 'dedupe-testid'
  | 'add-accessible-name'
  | 'add-inventory-entry'
  | 'add-owner'
  | 'add-intent'
  | 'replace-selector'
  | 'confirm-runtime-state';

export interface TagMaturityChange {
  type:            TagMaturityChangeType;
  priority:        'low' | 'medium' | 'high';
  description:     string;
  suggestedValue?: string;
  /** True when selfcure can auto-patch this without user review */
  patchAvailable?: boolean;
}

// ---------------------------------------------------------------------------
// Composite result
// ---------------------------------------------------------------------------

export interface TagMaturityResult {
  level:           TagMaturityLevel;
  label:           TagMaturityLabel;
  /** Mirrors the element's testabilityScore at assessment time */
  score:           number;
  reasons:         TagMaturityReason[];
  requiredChanges: TagMaturityChange[];
  /** 0–1 confidence in this assessment (lower when evidence is ambiguous) */
  confidence:      number;
}

// ---------------------------------------------------------------------------
// Input — what assessTagMaturity() needs per element
// ---------------------------------------------------------------------------

export interface TmlInventoryEntry {
  hasOwner:    boolean;
  hasIntent:   boolean;
  hasRoute:    boolean;
  isDeprecated: boolean;
  isDuplicate:  boolean;
  namingValid:  boolean;
}

export interface TagMaturityInput {
  /** 0–100 testability score (after ambiguity penalties) */
  testabilityScore: number;
  /** True when the best selector matches multiple siblings in the same component */
  ambiguous:        boolean;
  /** Best selector strategy (from selectorRanking[0].strategy) */
  bestStrategy:     'data-testid' | 'id' | 'aria-label' | 'name' | 'css' | 'xpath';
  /** Label for testid suggestion (label → id → aria-label) */
  label?:           string;
  /** Element tag for suggestion building */
  elementType:      string;
  /** Inventory metadata — only set when TestId Inventory Phase 3 is wired up */
  inventory?:       TmlInventoryEntry;
  /** Runtime data — only set when agentic discovery Phase 7 is wired up */
  runtime?: {
    observed: boolean;
    unique:   boolean;
  };
}
