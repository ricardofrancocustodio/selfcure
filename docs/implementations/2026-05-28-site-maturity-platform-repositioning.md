# Site update: maturity platform repositioning

**Date:** 2026-05-28  
**Commit:** `4c807cd`  
**File changed:** `site/index.html`

## What changed

Updated the external Vercel landing page (`site/index.html`) to reflect the product's repositioned
focus: from "preventive testability layer for Playwright Test Agents" to
**"testability maturity and visibility platform — tool-agnostic"**.

### HTML structural changes

| Element | Old | New |
|---------|-----|-----|
| `<title>` | `selfcure — testability maturity for frontend codebases` | `selfcure — know if your frontend is ready to be automated` |
| `<meta name="description">` | mentions "tracks scores over time" | lists Cypress, Playwright, Selenium, TestCafe, WebdriverIO explicitly |
| `<meta property="og:description">` | "Measure, prove, and improve..." | "selfcure shows if your frontend is ready to be automated — and proves it's improving. Correction is commodity; visibility over time is the product." |
| `qs.lede` fallback | `selfcure is pre-publish — install from source while we stabilise the API.` | `Five steps from zero to a PR full of <code>data-testid</code> patches.` |
| `status.p1` HTML | listed SonarQube as "next" | SonarQube export is ✅ DONE; dogfood stat: 500 issues, 477 ambiguous, avg score 43/100; GitLab/Bitbucket OAuth are next |
| New feature card | — | SonarQube export (8th card) with `data-i18n="features.8.title"` |

### EN i18n dict changes

- `status.p1`: updated to match new HTML (SonarQube done, dogfood stats)
- `features.8.title`: `"SonarQube export"`
- `features.badge_sonar`: `"generic format"`
- `features.8.desc`: full SonarQube feature description

### PT i18n dict changes

- `status.p1`: updated to PT equivalent of new EN status
- `features.8.title`: `"Export SonarQube"`
- `features.badge_sonar`: `"generic format"`
- `features.8.desc`: PT translation of SonarQube description
- `qs.lede`: `"Cinco passos do zero a um PR cheio de patches de <code>data-testid</code>."`

## Key messaging shift

**Old mantra:** "selfcure heals tests, not components" / preventive feeder for Playwright Test Agents  
**New mantra:** "Correction is commodity — visibility over time is the product"

The site now explicitly positions selfcure as **tool-agnostic** (Cypress, Playwright, Selenium,
TestCafe, WebdriverIO) and drops the "Playwright Test Agents feeder" framing entirely.

## Deploy

Pushed to `main` → Vercel auto-deploy triggered.
