# Disconnect with remote token revocation

## Summary

Improved SCM disconnect flow so it attempts to revoke the provider access token remotely before removing local connection state.

## Changes

- Updated `packages/web/src/integrations.ts`:
  - Added token revocation helper for providers:
    - GitHub: `DELETE /applications/{client_id}/grant`
    - GitLab: `POST /oauth/revoke`
    - Bitbucket: `POST /site/oauth2/revoke`
  - `disconnectProvider(...)` now:
    1. attempts remote revoke when the saved token is revocable,
    2. always removes local provider connection data afterwards.
- Added guard to skip revoke for managed placeholder token (`managed-by-connector`).
- Kept behavior best-effort so local disconnect is never blocked by provider/network errors.

## Validation

- `npm run build -w packages/web` succeeds.
- API behavior verified:
  - local state disconnect still works (`connected` changes to `false`).

## Notes

- Managed connector mode currently stores a placeholder local token, so remote revoke is skipped in that case.
- Full managed revoke can be added later via a connector-side revocation endpoint and connector-side token persistence.
