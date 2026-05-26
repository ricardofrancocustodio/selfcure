# Implementation: /lint page — GitHub "Files changed" redesign

**Commit**: `d548a0a`  
**File changed**: `packages/web/src/lintPage.ts`

## What changed

Replaced the old flat stats-bar + issue-row layout with a GitHub PR "Files changed"–style interface.

## New layout

```
[nav]
[run-bar: config input · threshold · Run lint button]
[pro-bar: Auto-fix · Open GitHub PR]
[diff-sum: N files · M issues · 10 score squares · Collapse all]
[page-wrap]
  [file-sidebar 256px sticky]         [diff-area flex:1]
    Jump to file  N files               [diff-card per file]
    [filter input]                        [diff-head: ▼ path · pill · Copy path]
    [fn-item links per file]              [diff-body]
                                            [diff-tbl]
                                              r-hunk: type · pips · score · component @@
                                              r-del:  current selector  [strategy tag]
                                              r-detail: selector candidates
                                              r-add:  data-testid="suggested"  [suggested]
```

## New CSS system

GitHub color palette via CSS custom properties — both light and dark (auto via `prefers-color-scheme`):

| Token | Light | Dark |
|-------|-------|------|
| `--bg` | `#ffffff` | `#0d1117` |
| `--canvas` | `#f6f8fa` | `#161b22` |
| `--hunk-bg` | `#ddf4ff` | `#0c2d6b` |
| `--del-bg` | `#ffebe9` | `#2d0f0f` |
| `--add-bg` | `#dafbe1` | `#0f2c18` |

## New JavaScript logic

- `render(data, threshold)` — groups issues by file, builds sidebar + diff cards
- `toggleCard(hd)` — collapse/expand a single diff-card
- `copyFp(e, fp)` — clipboard copy with "✓ Copied!" feedback
- `toggleAll` button — collapse/expand all cards at once
- `fileFilter` input — hides/shows sidebar fn-item links by filename match
- `pips(score)` — renders 10 coloured pip squares proportional to score
- `stratCls(strategy)` — returns `stag-ok` for stable strategies (`data-testid`, `aria-label`, `id`, `name`), else `stag-bad`

## ID changes (old → new)

| Old | New |
|-----|-----|
| `statsBar` | `diffSum` |
| `statFiles` | `sumFiles` |
| `statIssues` | `sumIssues` |
| `statFixed` | `sumFixed` |
| `status` | `runStatus` |
| `content` | `diffArea` |
| `thresholdLabel` | `thrLabel` |
| `elemDetailOverlay` | removed |
| `statSkipped` | removed |
| — | `sqRow`, `toggleAll`, `sidebar`, `sbCount`, `navList`, `fileFilter` (new) |
