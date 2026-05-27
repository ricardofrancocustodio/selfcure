# SCM OAuth .env fallback

## Summary

Fixed disabled Connect buttons when OAuth variables are defined in the target project's `.env` instead of the server process environment.

## Changes

- Updated OAuth config resolution in `packages/web/src/integrations.ts`.
- Provider credentials (`CLIENT_ID` / `CLIENT_SECRET`) now resolve from:
  1. `process.env`
  2. target project `.env` (fallback)
- Updated connect route wiring in `packages/web/src/index.ts` to pass `cwd` for `.env` lookup.
- Updated docs in `docs/packages/web.md` to document `.env` fallback behavior.

## Validation

- Build passes for `packages/web` after the change.
- Integration status endpoint now reports providers as `configured` when vars exist only in `.env`.
