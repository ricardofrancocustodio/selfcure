# @selfcure/crawler

Scans a frontend codebase with **glob** and parses each matching file with **`@typescript-eslint/parser`** to produce structured component metadata.

## API

### `crawl(options): Promise<ComponentMeta[]>`

```ts
import { crawl } from '@selfcure/crawler';

const components = await crawl({
  rootDir: './src',
  include: ['**/*.tsx', '**/*.vue'],
  exclude: ['**/*.spec.*', '**/node_modules/**'],
});
```

### Types

```ts
interface CrawlOptions {
  /** Absolute or relative path to the source root */
  rootDir: string;
  /** Glob patterns relative to rootDir */
  include: string[];
  /** Glob patterns to exclude */
  exclude: string[];
}

type Framework = 'react' | 'vue' | 'angular' | 'unknown';

interface PropMeta {
  name: string;
  type: string;
  required: boolean;
}

interface ComponentMeta {
  filePath: string;
  componentName: string;
  framework: Framework;
  props: PropMeta[];
  /** Raw ESTree AST */
  ast: ReturnType<typeof parse>;
}
```

## Framework detection

| Condition | Detected framework |
|-----------|--------------------|
| `.vue` extension | `vue` |
| `.component.ts` extension or `@Component` decorator | `angular` |
| `.tsx` extension or `React` import | `react` |
| None of the above | `unknown` |

## Runtime dependencies

| Package | Role |
|---------|------|
| `glob` | File discovery |
| `@typescript-eslint/parser` | AST parsing (TSX + TypeScript) |
| `fs-extra` | File reading |

## Source

`packages/crawler/src/index.ts`
