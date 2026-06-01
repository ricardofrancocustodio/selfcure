import type {
  TagMaturityLevel,
  TagMaturityResult,
  TagMaturityReason,
  TagMaturityChange,
  TagMaturityInput,
} from './schema.js';
import { TML_LABELS } from './schema.js';

// ---------------------------------------------------------------------------
// Level ceiling model
//
// Conditions are applied as hard caps. The highest achievable level is
// reduced each time a blocking condition is met. This prevents a high
// testabilityScore from masking a disqualifying defect (e.g. duplicate ID).
// ---------------------------------------------------------------------------

function computeStaticCeiling(input: TagMaturityInput): TagMaturityLevel {
  const { testabilityScore, ambiguous, bestStrategy, inventory } = input;

  if (testabilityScore <= 10) return 0;
  if (ambiguous) return 1;
  if (bestStrategy === 'css' || bestStrategy === 'xpath') return 1;
  if (bestStrategy === 'id' || bestStrategy === 'aria-label' || bestStrategy === 'name') return 2;

  if (bestStrategy === 'data-testid') {
    if (!inventory) return 3;
    if (inventory.isDuplicate || inventory.isDeprecated || !inventory.namingValid) return 2;
    if (inventory.hasOwner && inventory.hasIntent) return 4;
    return 3;
  }

  return 1;
}

function computeCeilingLevel(input: TagMaturityInput): TagMaturityLevel {
  let level = computeStaticCeiling(input);

  // Phase 7: runtime caps — mutually exclusive checks
  // Not observed → cap at TML 2 (element absent from rendered DOM)
  // Observed but not unique → cap at TML 1 (locator resolves to multiple nodes)
  if (input.runtime) {
    if (!input.runtime.observed) {
      if (level > 2) level = 2 as TagMaturityLevel;
    } else if (!input.runtime.unique) {
      if (level > 1) level = 1 as TagMaturityLevel;
    }
  }

  return level;
}

// ---------------------------------------------------------------------------
// Reason builders
// ---------------------------------------------------------------------------

function buildReasons(input: TagMaturityInput, level: TagMaturityLevel): TagMaturityReason[] {
  const { testabilityScore, ambiguous, bestStrategy, inventory, runtime } = input;
  const reasons: TagMaturityReason[] = [];

  // Positive signals first
  if (bestStrategy === 'data-testid' && !ambiguous) {
    reasons.push({
      code:     'stable-testid',
      severity: 'info',
      message:  'Governed data-testid provides a stable, refactor-proof locator.',
    });
  } else if (bestStrategy === 'aria-label' || bestStrategy === 'id' || bestStrategy === 'name') {
    reasons.push({
      code:    'strong-role-name',
      severity: 'info',
      message:  `Selector uses ${bestStrategy} — stable but can drift on copy-changes.`,
    });
  }

  // Missing testid (the most common upgrade path)
  if (bestStrategy !== 'data-testid') {
    reasons.push({
      code:     'missing-testid',
      severity: level <= 1 ? 'error' : 'warning',
      message:  'No data-testid found. Adding one raises the ceiling to TML 3.',
    });
  }

  // Weak CSS/XPath
  if (bestStrategy === 'css' || bestStrategy === 'xpath') {
    reasons.push({
      code:     'weak-css-selector',
      severity: 'error',
      message:  `Best available selector is ${bestStrategy} (score ${testabilityScore}) — brittle under refactoring.`,
    });
  }

  // Ambiguity
  if (ambiguous) {
    reasons.push({
      code:     'ambiguous-selector',
      severity: 'error',
      message:  'Best selector matches multiple siblings — Playwright would resolve to several nodes.',
    });
  }

  // No accessible name at all
  if (testabilityScore <= 10) {
    reasons.push({
      code:     'missing-accessible-name',
      severity: 'error',
      message:  'Element has no accessible name, role, or identifier — not reliably targetable.',
    });
  }

  // Inventory issues (Phase 3+)
  if (inventory) {
    if (inventory.isDuplicate) {
      reasons.push({ code: 'duplicate-testid', severity: 'error', message: 'data-testid is shared with another element — violates the stable selector contract.' });
    }
    if (inventory.isDeprecated) {
      reasons.push({ code: 'deprecated-testid', severity: 'warning', message: 'data-testid is marked deprecated in the inventory.' });
    }
    if (!inventory.namingValid) {
      reasons.push({ code: 'invalid-testid-name', severity: 'warning', message: 'data-testid does not follow the configured naming convention.' });
    }
    if (!inventory.hasOwner) {
      reasons.push({ code: 'missing-owner', severity: 'info', message: 'No owner in inventory — add to enable TML 4 governance.' });
    }
    if (!inventory.hasIntent) {
      reasons.push({ code: 'missing-intent', severity: 'info', message: 'No intent in inventory — add to enable TML 4 governance.' });
    }
  }

  // Runtime signals (Phase 7+)
  if (runtime) {
    if (!runtime.observed) {
      reasons.push({ code: 'runtime-not-observed', severity: 'warning', message: 'Element was not found in the rendered DOM during runtime discovery.' });
    } else if (runtime.unique) {
      reasons.push({ code: 'runtime-unique', severity: 'info', message: 'Locator resolved to exactly one element in the rendered DOM.' });
    }
  }

  return reasons;
}

// ---------------------------------------------------------------------------
// Required changes
// ---------------------------------------------------------------------------

function buildChanges(input: TagMaturityInput, level: TagMaturityLevel): TagMaturityChange[] {
  const { bestStrategy, ambiguous, inventory, label, elementType } = input;
  const changes: TagMaturityChange[] = [];

  // Need a testid to reach TML 3
  if (bestStrategy !== 'data-testid') {
    const suggestion = deriveTestIdSuggestion(label, elementType);
    changes.push({
      type:           'add-testid',
      priority:       level === 0 ? 'high' : level === 1 ? 'high' : 'medium',
      description:    'Add a governed data-testid to raise the ceiling to TML 3.',
      suggestedValue: suggestion,
      patchAvailable: true,
    });
  }

  // Ambiguous — must make selector unique
  if (ambiguous) {
    changes.push({
      type:           'add-testid',
      priority:       'high',
      description:    'Selector is ambiguous. Add a unique data-testid to resolve to a single element.',
      patchAvailable: true,
    });
  }

  // Inventory entry to reach TML 4
  if (!inventory || (!inventory.hasOwner && !inventory.hasIntent)) {
    changes.push({
      type:        'add-inventory-entry',
      priority:    level >= 3 ? 'medium' : 'low',
      description: 'Register in .selfcure/testid-inventory.json (with owner + intent) to reach TML 4.',
    });
  }

  // Inventory metadata gaps
  if (inventory) {
    if (!inventory.hasOwner) {
      changes.push({ type: 'add-owner', priority: 'medium', description: 'Add owner field to the inventory entry.' });
    }
    if (!inventory.hasIntent) {
      changes.push({ type: 'add-intent', priority: 'medium', description: 'Add intent field to the inventory entry.' });
    }
    if (inventory.isDuplicate) {
      changes.push({ type: 'dedupe-testid', priority: 'high', description: 'Rename or scope the data-testid so it is unique across the codebase.' });
    }
    if (inventory.isDeprecated) {
      changes.push({ type: 'rename-testid', priority: 'high', description: 'Replace the deprecated data-testid with a current one from the inventory.' });
    }
  }

  return changes;
}

// ---------------------------------------------------------------------------
// Testid suggestion heuristic
// ---------------------------------------------------------------------------

function toKebab(s: string): string {
  return s.trim()
    .replace(/([A-Z])/g, '-$1')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function deriveTestIdSuggestion(label: string | undefined, elementType: string): string {
  if (label) return toKebab(label);
  return `${elementType}-1`;
}

// ---------------------------------------------------------------------------
// Confidence heuristic
// ---------------------------------------------------------------------------

function computeConfidence(input: TagMaturityInput): number {
  let c = 0.9;
  if (!input.runtime)   c -= 0.1;   // no runtime confirmation
  if (!input.inventory) c -= 0.05;  // no inventory cross-check
  if (input.ambiguous)  c += 0.05;  // ambiguity is very certain
  return Math.min(1, Math.max(0.5, Math.round(c * 100) / 100));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the Tag Maturity Level for a single interactive element.
 *
 * The function is pure — it does not read files or call external APIs.
 * Inventory and runtime signals are optional; when absent the assessment
 * is based entirely on static selector evidence.
 */
export function assessTagMaturity(input: TagMaturityInput): TagMaturityResult {
  const level   = computeCeilingLevel(input);
  const label   = TML_LABELS[level];
  const reasons = buildReasons(input, level);
  const changes = buildChanges(input, level);
  const confidence = computeConfidence(input);

  return {
    level,
    label,
    score: input.testabilityScore,
    reasons,
    requiredChanges: changes,
    confidence,
  };
}
