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

interface InteractiveElement {
  type: ElementType;
  /** Best CSS / ARIA selector for Playwright */
  selector: string;
  label?: string;
  /** e.g. ['click', 'fill', 'check'] */
  actions: string[];
}

interface AnalysisResult {
  component: ComponentMeta;
  /** Testability score 0–100 */
  score: number;
  interactiveElements: InteractiveElement[];
  complexity: Complexity;
}
```

## Scoring heuristic

```
score = min(100, 40 + labelled_elements × 15)
```

A component with zero labelled elements scores **40** (baseline). Each additional labelled interactive element adds **15** points, capped at **100**.

## Complexity thresholds

| Interactive elements | Complexity |
|----------------------|------------|
| ≤ 2 | `low` |
| 3 – 6 | `medium` |
| > 6 | `high` |

The CLI uses complexity to set the number of test cases Claude generates per component.

## Source

`packages/analyzer/src/index.ts`
