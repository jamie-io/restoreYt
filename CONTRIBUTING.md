# Contributing to restoreyt

## Setup

Requirements: Node.js 20 or 22, Git, and Chromium for E2E tests.

```bash
npm ci
npm run verify
npm run test:e2e
```

E2E runs against a hermetic mocked YouTube page. It does not contact live YouTube.

## Architecture

- `src/platform/`: runtime `ytcfg`, InnerTube request/response contracts, selectors, thumbnail builders, player accessors.
- `src/core/`: strict settings schema, in-memory cache, request queue, timeout, navigation abort, diagnostics, circuit breaker.
- `src/content/bootstrap.ts`: CSP-safe JSON settings block and sequential classic MAIN-world injection.
- `src/features/`: title, description, thumbnail, audio, and channel restoration flows.
- `src/background.ts`: classic background/service-worker runtime, settings fan-out, badge, diagnostics state.
- `src/popup/` and `src/options/`: local settings surfaces.
- `tools/spike/`: evidence probe and redaction utilities. Live probe uses one existing CDP session only.

Keep YouTube-specific assumptions in `src/platform/`. Keep pure logic testable without browser globals. Add focused tests before implementation for behavior changes, then run the full `npm run verify` gate.

## Pull requests

1. Create focused branch: `feat/<name>`, `fix/<name>`, `docs/<name>`, or `test/<name>`.
2. Use Conventional Commits.
3. Add or update tests and documentation for changed behavior.
4. Run `npm run verify`, `npm run test:e2e`, and `npm run package` when relevant.
5. Never include cookies, tokens, visitor data, account IDs, raw private URLs, or live fixture payloads.

## Scope rules

Do not add third-party telemetry, OAuth, content download, subtitle editing, regional bypasses, or speculative feature toggles. Chapters, avatars, and banners require passing evidence and fixtures before shipping.

Read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before participating.
