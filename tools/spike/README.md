# Phase 0 evidence spike

Install project dependencies with `npm ci`, then ensure persistent Chromium is already available at `http://127.0.0.1:9334`. The probe connects once to that session, reuses its default context and one page, and never launches or closes Chromium.

Run the live probe:

```sh
node tools/spike/run.mjs
```

Set `SPIKE_VIDEO_MATRIX` to JSON arrays named `title`, `thumbnail`, `audio`, `chapters`, and `channelBranding`. Provide only curated sample video IDs. The probe keeps IDs in memory and writes only redacted structural evidence to `tests/fixtures/phase-0-evidence.json` and `docs/spike-report.md`.

If CDP connection fails, the probe records `BLOCKED` and does not retry or start a browser. Use `node tools/spike/run.mjs --offline` to regenerate artifacts while recording that probing was skipped. Add `--browser-unavailable` only after launcher status confirms that CDP session is down.

Run deterministic redaction checks with `node --test tools/spike/redaction.test.mjs`. Never capture HAR files, cookie values, tokens, visitor data, account IDs, page titles, or raw request URLs.
