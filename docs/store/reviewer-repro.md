# Reviewer reproduction

1. Run `npm ci && npm run package`.
2. Load `.dist/restoreyt.zip` in a clean Chromium or Firefox profile.
3. Open the extension popup and toggle title restoration.
4. Open options, add and remove a channel ID, and verify it is rendered as text.
5. Run `npm run test:e2e` for the blocking hermetic mock flow.
6. For live validation, use the separate Phase 0 matrix only with a disposable profile and sanitized output.

Automated blocking coverage targets Chromium. Firefox clean-profile installation and live YouTube canary validation remain manual follow-up checks; this package makes no passing claim for either.
