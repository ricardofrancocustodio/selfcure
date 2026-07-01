# Releasing `@selfcure/*` to npm

How selfcure cuts and tracks an npm release. All 9 packages publish in lockstep
at the same version under the **`@selfcure`** org (public, free).

> Code-side packaging (publishConfig, `files`, pinned deps, metadata) is already
> in place — see the `chore(release)` commit. This doc covers the recurring
> release flow.

## Two ways to release

| Path | When | Auth |
|------|------|------|
| **CI — Trusted Publishing (recommended)** | Normal releases | None — GitHub Actions OIDC, no token |
| **Local** | Hotfix when CI is unavailable | `npm login` + OTP, or bypass-2FA token |

### CI path (recommended)

> **Status:** the CI publish requires a one-time [trusted-publisher setup](#ci--trusted-publishing-setup)
> per package on npmjs.com. Until every `@selfcure/*` package has it configured,
> the workflow builds/tests fine but **fails at the publish step** — use the
> [Local path](#local-path) or [Manual publish](#manual-publish-fallback) below.

```bash
npm run release -- patch --prepare  # bump + verify + commit + tag (NO publish)
git push origin main                # push the release commit
git push origin v0.1.1              # push the tag explicitly (see note below)
```

> The bump script creates a **lightweight** tag, which `git push --follow-tags`
> does **not** push. Push the `v<x.y.z>` tag explicitly to trigger the workflow.
> Also note the `--` before `patch` — without it, npm swallows `--prepare` and
> the script publishes locally (and fails on `ENEEDAUTH` if you're not logged in).

The workflow builds, tests, and publishes all 9 packages via OIDC with
[provenance](https://docs.npmjs.com/generating-provenance-statements) — no
secret stored anywhere. Requires the one-time [trusted-publisher setup](#ci--trusted-publishing-setup).

### Local path

```bash
npm run release patch              # bump + verify + publish + commit + tag, all local
npm run release minor --dry-run    # rehearse without publishing or committing
git push origin main --follow-tags
```

#### Manual publish fallback

If versions are already bumped/committed (e.g. a `--prepare` run) but the CI
publish failed for lack of a trusted publisher, publish the built packages
yourself. Requires `npm login` first (the account has 2FA — npm opens a browser
to authenticate; no OTP typing needed).

```bash
npm login                          # authenticate (browser-based)
npm run build                      # ensure dist/ is current
foreach ($p in 'crawler','analyzer','generator','runner','selfcure','reporter','web','mcp','cli') {
  npm publish -w "@selfcure/$p" --access public   # dependency order, do not reorder
}
```

Publish **in the order above** — npm rejects a package whose `@selfcure/*`
dependency isn't on the registry yet.

`scripts/release.mjs` does, in order:

1. Bumps the version of all 9 packages in lockstep.
2. Rewrites internal `@selfcure/*` dependency ranges to `^<newVersion>`.
3. `npm install` (relink workspaces + refresh lockfile).
4. Typecheck (`tsc --noEmit`) → `npm run build` → `npx vitest run`.
5. `npm publish` each package **in dependency order**, stopping on first failure.
6. `git commit -m "release: vX.Y.Z"` + `git tag vX.Y.Z` (skip with `--no-git`).

It does **not** push. Push tags yourself after verifying.

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Logged in to npm | `npm whoami` must succeed (publisher: `ricardofrancocustodio`). |
| Member of the `@selfcure` org | `npm org ls selfcure` must list you with publish rights. |
| 2FA satisfied | The account has 2FA (TOTP) enabled. For a **local** publish, let npm prompt for an OTP, or use a **granular access token with "Bypass 2FA"**. The **CI** path needs neither — OIDC is independent of account 2FA. See [Auth & 2FA](#auth--2fa). Keep your TOTP recovery codes somewhere safe. |

## Why the order matters

Each package depends on the previous ones via `^<version>`. npm validates that a
dependency already exists on the registry at publish time, so they must go up in
**topological order**:

```
crawler → analyzer → generator → runner → selfcure → reporter → web → mcp → cli
```

`scripts/release.mjs` hard-codes this order in `PUBLISH_ORDER`. If you add a new
package, insert it after its dependencies.

## The 0.x caret gotcha (why deps are re-synced every release)

Internal deps use caret ranges (`^0.1.0`). For `0.x` versions, **caret does not
cross a minor bump**: `^0.1.0` means `>=0.1.0 <0.2.0`, so it excludes `0.2.0`.

If we bumped to `0.2.0` without updating the ranges, `@selfcure/cli@0.2.0` would
still resolve `@selfcure/crawler@^0.1.0` → install a stale `0.1.x`. The release
script prevents this by rewriting every internal range to `^<newVersion>` on each
release. **Don't bump versions by hand** — use `npm run release`.

## Auth & 2FA

**Option A — OTP (no stored secret, good for a one-off):**
Run the release; when npm prompts, paste the current 6-digit code. (The script
streams npm's stdio, so the prompt is interactive.)

**Option B — granular token with bypass-2FA (smoother for multi-package runs):**

1. https://www.npmjs.com/settings/ricardofrancocustodio/tokens → *Generate New
   Token* → *Granular Access Token*.
2. Check **Bypass two-factor authentication (2FA)**.
3. Permissions: **Read and write** on the **`@selfcure`** scope. Short expiry
   (e.g. 7 days) is safer.
4. Apply it locally (keeps the token out of the repo):
   ```bash
   npm config set //registry.npmjs.org/:_authToken <TOKEN>
   ```
5. **Revoke it after the release** and clear the local credential:
   ```bash
   npm config delete //registry.npmjs.org/:_authToken
   ```

> npm's UI warns bypass-2FA tokens carry risk and suggests *Trusted Publishing*
> for CI/CD. That's the right choice **if/when** releases move into GitHub Actions
> (OIDC, no stored token). For manual local releases the short-lived token is fine.

## CI / Trusted Publishing setup

The workflow lives at [`.github/workflows/release.yml`](../.github/workflows/release.yml).
It uses GitHub Actions OIDC, so **no `NPM_TOKEN` is needed** — but each package
must trust this repo + workflow once.

**One-time, per package** (all 9), on npmjs.com:

1. Open the package → **Settings** → **Trusted Publisher**.
2. Add a publisher:
   - Provider: **GitHub Actions**
   - Organization/user: `ricardofrancocustodio`
   - Repository: `selfcure`
   - Workflow filename: `release.yml`
   - Environment: *(leave blank)*
3. Repeat for: `cli`, `mcp`, `crawler`, `analyzer`, `generator`, `runner`,
   `selfcure`, `reporter`, `web`.

> Trusted publishing can only be configured on a package that already exists on
> npm — that's why the first `0.1.0` release went out via the local path.

**How a CI release runs:**

```bash
npm run release minor --prepare    # bump + verify + commit + tag locally
git push origin main --follow-tags # the vX.Y.Z tag triggers the workflow
```

The workflow then: `npm ci` → checks the tag matches `packages/cli` version →
typecheck → build → test → `npm publish --provenance --access public` for each
package in dependency order. Provenance shows up as a verified badge on the npm
package page.

Requirements baked into the workflow: `permissions.id-token: write` and
`npm install -g npm@latest` (OIDC trusted publishing needs npm ≥ 11.5.1).

## If a release fails mid-way

Publishes are sequential and **not transactional**. If it fails at, say,
`@selfcure/web`, everything before it is already live and **cannot be
re-published at the same version** (npm forbids overwriting a version). Options:

- Fix the cause and re-run only the remaining packages manually:
  `npm publish -w @selfcure/web` … then `mcp`, then `cli`.
- Or bump to the next patch and release the whole set again.

## Published packages

| Package | npm |
|---------|-----|
| `@selfcure/cli` | https://www.npmjs.com/package/@selfcure/cli |
| `@selfcure/mcp` | https://www.npmjs.com/package/@selfcure/mcp |
| `@selfcure/crawler` | https://www.npmjs.com/package/@selfcure/crawler |
| `@selfcure/analyzer` | https://www.npmjs.com/package/@selfcure/analyzer |
| `@selfcure/generator` | https://www.npmjs.com/package/@selfcure/generator |
| `@selfcure/runner` | https://www.npmjs.com/package/@selfcure/runner |
| `@selfcure/selfcure` | https://www.npmjs.com/package/@selfcure/selfcure |
| `@selfcure/reporter` | https://www.npmjs.com/package/@selfcure/reporter |
| `@selfcure/web` | https://www.npmjs.com/package/@selfcure/web |

## Release log

Newest first. Record every published version here for tracking.

| Date | Version | Notes |
|------|---------|-------|
| 2026-06-22 | `0.1.0` | First public release — all 9 `@selfcure/*` packages. |
