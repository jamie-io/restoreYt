# restoreyt

restoreyt restores creator-authored YouTube metadata when localized or auto-translated presentation replaces it.

Current runtime restores titles, descriptions, thumbnails, and channel titles. Audio changes only when player state exposes an explicit `isAutoDubbed: false` track. Chapters, avatars, and banners are not shipped: Phase 0 evidence is blocked until a persistent browser session and curated sample matrix are available. See [docs/spike-report.md](docs/spike-report.md).

## Features

- Original titles on watch pages, Shorts, search, recommendations, and embeds.
- Original descriptions with text-only DOM writes.
- Thumbnail fallback chain: max resolution → lower-quality original → original element state.
- Conservative original-audio selection when YouTube exposes an explicit auto-dub signal.
- Channel whitelist stored in `storage.local`.
- Popup and options page with quota-error feedback.
- No telemetry, third-party requests, OAuth, or content downloads.

## Install

### Development

```bash
npm ci
npm run build
```

Open `chrome://extensions` or `about:debugging`, enable developer mode, then load the repository directory. For a distributable archive:

```bash
npm run package
```

The archive is `.dist/restoreyt.zip`.

## Commands

```bash
npm run verify       # lint, strict typecheck, unit tests, build
npm run test:e2e     # build + hermetic Chromium extension tests
npm run package     # build + .dist/restoreyt.zip
node tools/spike/run.mjs --offline --browser-unavailable
```

Live Phase 0 probing uses one already-running CDP browser only. It never launches Chromium, retries a failed connection, or stores credential values. Live mode requires `SPIKE_SESSION_VARIANT` and exact sample counts in `SPIKE_VIDEO_MATRIX`; blocked status is valid evidence and is never presented as a passing canary.

## Architecture

```text
YouTube document
  └─ build/content.js       isolated bootstrap
       ├─ JSON settings block + CustomEvent handshake
       └─ build/main.js       MAIN-world feature runtime
            ├─ src/platform/  ytcfg, InnerTube shapes, selectors, player accessors
            ├─ src/core/       settings, LRU, queue, timeout, navigation, diagnostics
            └─ src/features/   title, description, thumbnail, audio, channel flows

build/background.js          classic background + service worker entry
src/popup/, src/options/      settings surfaces
tests/                        unit, contract, DOM-oriented, hermetic E2E tests
```

Platform assumptions stay in `src/platform/`. Runtime config comes from the page's `ytcfg`; responses are narrowed at runtime before feature code sees them. Requests use an in-memory LRU, short negative TTLs, a concurrency-four queue, 8-second timeout, and navigation abort signal. Each feature has an error circuit breaker and diagnostics entry.

## Permissions

| Permission | Reason |
|---|---|
| `storage` | Local settings, whitelist, feature state, diagnostics buffer. |
| YouTube host permissions | Run restoreyt on YouTube pages and embedded players. |

`declarativeNetRequest` and image-host permissions are intentionally absent. Thumbnails are restored at DOM level with an error fallback chain.

## Evidence and limitations

YouTube's InnerTube API and DOM are undocumented and can change without notice. The evidence spike records runtime shape observations and sanitizes fixtures before writing them. Current live gate is blocked, so chapter restoration, channel artwork restoration, and claims about logged-in behavior remain cut.

restoreyt is independent software. It is not affiliated with or endorsed by YouTube or Google. Use it in accordance with applicable terms and laws.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md), run `npm run verify`, and add tests for behavior changes. Report reproducible failures without including cookies, tokens, visitor data, account IDs, or raw private URLs.

## License

[MIT](LICENSE)
