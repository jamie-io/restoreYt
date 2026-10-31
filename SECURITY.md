# Security Policy

## Reporting

Report vulnerabilities privately to the repository maintainer before opening a public issue. Include reproduction steps, the restoreyt version, the browser and a minimal sanitized example. Never include cookies, tokens, visitor data, account IDs or private URLs.

## Security boundaries

- Creator text (titles, descriptions) is written through DOM text nodes; descriptions are tokenized, never parsed as HTML. Only `http:` and `https:` links become anchors, with `rel="noopener noreferrer nofollow"`.
- The page-world script and the content script exchange JSON strings through DOM events; every message is validated and nothing received is executed.
- No remote code, eval, telemetry, OAuth or content download. Requests go only to YouTube.
- Thumbnail redirect rules only match `i.ytimg.com` image requests initiated by YouTube pages.
- Extension pages use the default Manifest V3 content security policy.
