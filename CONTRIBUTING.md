# Contributing to restoreyt

## Setup

Requirements: Node.js 20 or newer, Git, and Chromium for browser tests (`npx playwright install chromium`).

```bash
npm ci
npm run verify     # version check, lint, strict typecheck, unit tests, build
npm run test:e2e   # built extension in Chromium against a local fake YouTube, no network
```

## Where things live

- `src/content/surfaces.ts`: every place YouTube renders a video title. Most YouTube markup changes are fixed here.
- `src/content/`: isolated content script. Title engine, title lookups and cache, description restore, tab title, page report.
- `src/page/`: page-world script. Player access for original metadata, audio tracks and subtitles; player-endpoint fallback.
- `src/shared/`: settings schema, message contracts, YouTube URL and thumbnail helpers.
- `src/background.ts`: thumbnail ruleset switch, toolbar badge, cache pruning, lifetime counters.
- `src/popup/`, `src/options/`, `src/ui/`: extension pages and their shared copy, styles and helpers.
- `rules/thumbnails.json`: redirect rules, kept in sync with `matchSwappedThumbnail` by a unit test.
- `docs/adr/`: why things are built the way they are.

## When YouTube changes

1. Run `npm run test:live`. It loads the extension in a fresh, logged-out Chromium profile with a German interface and reports what is still translated.
2. Capture the new markup (DevTools or a short Playwright script) and update `src/content/surfaces.ts`, `src/page/player.ts` or the rules.
3. Add the new shape to the fixtures in `tests/unit/title-engine.test.ts` or `tests/e2e/helpers.js`.

## Pull requests

1. Branch per change: `feat/<name>`, `fix/<name>`, `docs/<name>`.
2. Use Conventional Commits.
3. Add or update tests and docs for changed behavior.
4. Run `npm run verify` and `npm run test:e2e`; run `npm run test:live` when touching YouTube-facing code.
5. Never commit cookies, tokens, visitor data, account IDs or captured personal pages.

## Scope

restoreyt shows what creators uploaded. It does not download content, block ads, bypass regional restrictions, add telemetry or talk to servers other than YouTube's.

Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before participating.
