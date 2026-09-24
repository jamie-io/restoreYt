# Security Policy

## Reporting

Report vulnerabilities privately to the repository maintainer before opening a public issue. Include reproduction steps, affected version, browser, and a minimal sanitized fixture. Never include cookies, tokens, visitor data, account IDs, or private URLs.

## Security boundaries

- User-controlled channel IDs render through DOM text APIs.
- Extension settings use `storage.local`; write failures are surfaced in UI.
- Content bootstrap passes settings through a non-executable JSON data block and a named event.
- InnerTube response data is narrowed before feature code uses it.
- No remote code, telemetry, OAuth, or content download path exists.
