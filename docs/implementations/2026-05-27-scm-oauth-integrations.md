# SCM OAuth integrations (GitHub, GitLab, Bitbucket)

## Summary

Implemented one-click OAuth connection flow in selfcure web so users can connect GitHub, GitLab, and Bitbucket from a dedicated page.

## Changes

- Added `GET /integrations` page with provider cards and Connect/Disconnect buttons.
- Added OAuth routes:
  - `GET /oauth/connect/:provider` starts auth flow and redirects to provider authorization screen.
  - `GET /oauth/callback/:provider` handles callback, exchanges code for token, fetches account profile, and stores the connection.
- Added integration status routes:
  - `GET /api/integrations` returns configured/connected state per provider.
  - `DELETE /api/integrations/:provider` disconnects and removes saved token data.
- Added persistent storage in `.selfcure/integrations.json`.
- Added auto `.gitignore` safeguard for `.selfcure/` when first connection is stored.
- Added navigation link `integrations` to all web pages:
  - init (`/`)
  - crawl (`/crawl`)
  - lint (`/lint`)

## Environment variables

OAuth app credentials are read from environment variables:

- `SELFCURE_GITHUB_CLIENT_ID`
- `SELFCURE_GITHUB_CLIENT_SECRET`
- `SELFCURE_GITLAB_CLIENT_ID`
- `SELFCURE_GITLAB_CLIENT_SECRET`
- `SELFCURE_BITBUCKET_CLIENT_ID`
- `SELFCURE_BITBUCKET_CLIENT_SECRET`

## Validation

- `npm run build -w packages/web` completed successfully.
- Type generation (`dist/index.d.ts`) succeeded.
- The web package now exposes and serves all new integrations/OAuth routes.
