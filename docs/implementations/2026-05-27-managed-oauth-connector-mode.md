# Managed OAuth connector mode

## Summary

Implemented a commercial-friendly managed OAuth mode for SCM integrations in `selfcure web`.

When `SELFCURE_CONNECTOR_BASE_URL` is configured, end users no longer need to provide per-provider OAuth app credentials (`CLIENT_ID` / `CLIENT_SECRET`) locally.

## Changes

- Added managed connector detection in `packages/web/src/integrations.ts`:
  - `SELFCURE_CONNECTOR_BASE_URL` read from `process.env` with `.env` fallback.
- Updated OAuth start flow:
  - In managed mode, `/oauth/connect/:provider` now redirects to `${SELFCURE_CONNECTOR_BASE_URL}/oauth/connect/:provider`.
  - Sends `state` and `return_to` (local callback URL) parameters.
- Added managed callback handler:
  - New helper `handleManagedOAuthCallback(...)` validates state and stores connected account in `.selfcure/integrations.json`.
- Added route in `packages/web/src/index.ts`:
  - `GET /oauth/managed/callback/:provider`.
- Updated integrations UI footer to show managed mode env key.

## Validation

- `npm run build -w packages/web` passes after changes.
- Existing local OAuth mode (per-provider env vars) remains available as fallback.

## Commercial rollout note

This implementation enables the product-side UX to be one-click OAuth for customers once the connector backend is deployed and configured.
