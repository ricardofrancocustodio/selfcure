# Vercel managed connector deployment

## Summary

Created and deployed a managed OAuth connector on Vercel for GitHub, GitLab, and Bitbucket.

## What was implemented

- Added connector service under `connector/` with Vercel-compatible routes:
  - `GET /oauth/connect/:provider`
  - `GET /oauth/callback/:provider`
- Added signed state handling (`SELFCURE_CONNECTOR_STATE_SECRET`) to safely round-trip:
  - local `state`
  - `return_to` callback URL back to selfcure web
- Implemented provider-specific token exchange and user profile fetch for:
  - GitHub
  - GitLab
  - Bitbucket
- Redirects back to local selfcure managed callback with:
  - `status=ok|error`
  - account fields (`accountId`, `username`, `displayName`, `url`) when successful.

## Files added

- `connector/vercel.json`
- `connector/api/_lib/scm.js`
- `connector/api/oauth/connect/[provider].js`
- `connector/api/oauth/callback/[provider].js`
- `connector/README.md`

## Deployment

- Vercel project created and deployed successfully.
- Active production alias:
  - `https://connector-ten-khaki.vercel.app`

## Next required configuration

Set Vercel env vars for OAuth app credentials and state secret:

- `SELFCURE_CONNECTOR_STATE_SECRET`
- `SELFCURE_GITHUB_CLIENT_ID`
- `SELFCURE_GITHUB_CLIENT_SECRET`
- `SELFCURE_GITLAB_CLIENT_ID`
- `SELFCURE_GITLAB_CLIENT_SECRET`
- `SELFCURE_BITBUCKET_CLIENT_ID`
- `SELFCURE_BITBUCKET_CLIENT_SECRET`

Then set this in the target project `.env`:

- `SELFCURE_CONNECTOR_BASE_URL=https://connector-ten-khaki.vercel.app`
