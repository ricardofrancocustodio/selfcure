# selfcure Connector (Vercel)

Managed OAuth connector for GitHub, GitLab, and Bitbucket.

## Routes

- GET /
- GET /oauth/connect/:provider
- GET /oauth/callback/:provider

`/` serves the public enterprise landing page. The OAuth connector routes remain
under `/oauth/*` and are rewritten to `/api/oauth/*` by `vercel.json`.

## Required env vars

- SELFCURE_CONNECTOR_STATE_SECRET
- SELFCURE_GITHUB_CLIENT_ID
- SELFCURE_GITHUB_CLIENT_SECRET
- SELFCURE_GITLAB_CLIENT_ID
- SELFCURE_GITLAB_CLIENT_SECRET
- SELFCURE_BITBUCKET_CLIENT_ID
- SELFCURE_BITBUCKET_CLIENT_SECRET

## Deploy

From this folder:

vercel --prod

## Wire local selfcure web

In your target project .env:

SELFCURE_CONNECTOR_BASE_URL=https://<your-vercel-domain>
