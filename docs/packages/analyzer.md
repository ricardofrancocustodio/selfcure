# @selfcure/analyzer

Walks component ASTs produced by `@selfcure/crawler`, classifies interactive elements, and computes a **testability score** used by the generator to decide test depth.

## API

### `analyze(components): Promise<AnalysisResult[]>`

```ts
import { analyze } from '@selfcure/analyzer';
import { crawl } from '@selfcure/crawler';

const components = await crawl({ rootDir: './src', include: ['**/*.tsx'], exclude: [] });
const results = await analyze(components);
```

### Types

```ts
type ElementType = 'button' | 'input' | 'link' | 'form' | 'custom';
type Complexity  = 'low' | 'medium' | 'high';

interface SelectorCandidate {
  strategy: 'data-testid' | 'id' | 'aria-label' | 'name' | 'css' | 'xpath';
  /** Ready-to-use selector string */
  value: string;
  /** Stability score 0–100 (after ambiguity penalty) */
  score: number;
  /** How many elements within the same component match this selector value */
  matchCount?: number;
  /** How many elements across all analysed components match this selector value */
  crossMatchCount?: number;
  /** True when the selector matches more than one element in the same component */
  ambiguous?: boolean;
}

interface InteractiveElement {
  type: ElementType;
  /** Best selector — always equals selectorRanking[0].value */
  selector: string;
  label?: string;
  /** e.g. ['click', 'fill', 'check'] */
  actions: string[];
  selectors: ElementSelectors;
  /** Candidates sorted from most stable (index 0) to least stable */
  selectorRanking: SelectorCandidate[];
  /** Testability score 0–100 for this element (= selectorRanking[0].score) */
  testabilityScore: number;
  /** True when the best selector also matches another element in the same component */
  ambiguous: boolean;
  /** Human-readable explanation when `ambiguous` is true */
  ambiguityReason?: string;
}

interface AnalysisResult {
  component: ComponentMeta;
  /** Average element testability score, 0–100 */
  score: number;
  interactiveElements: InteractiveElement[];
  complexity: Complexity;
}
```

## Scoring heuristic

Per-element score equals the top-ranked `SelectorCandidate.score`:

| Strategy available | Base score |
|--------------------|-----------:|
| `data-testid`      | 100 |
| `id`               |  85 |
| `aria-label`       |  75 |
| `name`             |  65 |
| `input[type=…]`    |  35 |
| xpath              |  20 |
| bare tag           |  10 |

The component-level `score` is the average of per-element `testabilityScore` values, or **40** for components with no interactive elements.

## Ambiguity detection

After collecting every interactive element in a component, the analyzer counts how many elements share each candidate selector value. When **more than one** element in the same component matches a candidate:

- The candidate is flagged `ambiguous: true`.
- Its score is multiplied by `0.4` (so an ambiguous `data-testid` drops 100 → 40 — below the default lint threshold of 65).
- After penalties are applied, the `selectorRanking` is re-sorted and the element's `selector` + `testabilityScore` are derived from the new top candidate. If the new top candidate is still ambiguous, the element is flagged `ambiguous: true` with an `ambiguityReason` explaining why.

Cross-component matches (the same selector value appearing in two different components) are recorded on each candidate as `crossMatchCount` but do **not** apply a score penalty — Playwright tests on different pages legitimately reuse identifiers.

## Complexity thresholds

| Interactive elements | Complexity |
|----------------------|------------|
| ≤ 2 | `low` |
| 3 – 6 | `medium` |
| > 6 | `high` |

The CLI uses complexity to set the number of test cases Claude generates per component.

## Source

`packages/analyzer/src/index.ts`
