# Changelog

## 2026-10-31

- Rewrote restoreyt as 2.0.0; runs on every YouTube page, including after in-app navigation
- Restored original titles everywhere, including A/B test titles
- Restored original descriptions with working links and timestamps
- Redirected localized and test thumbnails to the originals
- Switched dubbed audio to the original track and turned off auto-enabled subtitles
- Hid AI video summaries
- Restored titles in session-restored miniplayer, end-screen cards and autoplay overlay
- Split Chrome and Firefox manifests so Chrome no longer warns about background.scripts
- Redesigned popup with per-page change log, new settings page and new icon
- Replaced evidence-gate and spike tooling with unit, browser and live YouTube tests
- Removed GitHub Actions workflows, Dependabot config and unused tooling

## 2026-09-24

- Renamed product to restoreyt
- Added strict TypeScript/esbuild platform and core layers
- Replaced DNR thumbnail redirects with DOM fallback chain
- Added hermetic Chromium extension tests and sanitized evidence tooling
- Removed chapters, avatars, banners, audio and channel branding claims until verified
- Updated manifest, package, README, store copy and evidence report to match shipped behavior
