# No port 3000 defaults

## Summary

Adjusted defaults and examples to avoid using port 3000, since it is reserved for Grafana in the target environment.

## Changes

- Updated the default `baseURL` in `selfcure.config.mjs` from `http://localhost:3000` to `http://localhost:5000`.
- Updated documentation examples and references from port 3000 to 5000 in:
  - `docs/configuration.md`
  - `docs/getting-started.md`
  - `docs/packages/runner.md`
  - `docs/SELFCURE_BUILD.md`
- Removed the local test artifact `C:\Projects\qnexyTest\.selfcure\session.json` that was restoring `baseURL` as `http://localhost:3000`.

## Validation

- Searched repository for `localhost:3000` and replaced remaining default/example references.
- Confirmed external session test file was removed and no longer forces port 3000 on form restore.
