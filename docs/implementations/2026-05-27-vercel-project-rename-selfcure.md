# Vercel project rename to selfcure

## Summary

Renamed the Vercel connector project from `connector` to `selfcure` to match product naming and reduce confusion.

## Changes

- Renamed Vercel project:
  - from: `connector`
  - to: `selfcure`
- Re-linked local folder `connector/` to the renamed Vercel project.
- Added canonical alias:
  - `https://selfcure.vercel.app`
- Kept existing alias active:
  - `https://connector-ten-khaki.vercel.app`
- Updated `connector/.gitignore` to ignore local env files created by Vercel tooling:
  - `.env*.local`

## Outcome

- Project naming is now consistent with the product.
- Deployment/connector can be referenced with a clean public URL (`selfcure.vercel.app`).
