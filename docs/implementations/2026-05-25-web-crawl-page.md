# Web crawl page

## Summary

Implemented a browser page for running the selfcure crawler/analyzer from `selfcure web`.

## Changes

- Added `GET /crawl` to serve the crawl results page.
- Added `POST /api/crawl` to load `selfcure.config.mjs`, run `crawl()`, run `analyze()`, and return serializable JSON.
- Added `packages/web/src/crawlPage.ts` with a plain HTML page for listing components, props, and interactive tags.
- Added client-side filters for search text, framework, complexity, tag type, minimum score, and components with tags.
- Added sort modes for file path, component name, score, and number of tags.
- Added `@selfcure/crawler` and `@selfcure/analyzer` as web package dependencies.

## Validation

- Pending: `npm install` to refresh workspace lockfile after dependency changes.
- Pending: `npm run build`.
