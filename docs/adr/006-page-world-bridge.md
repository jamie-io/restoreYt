# ADR 006: Page-world script declared in the manifest

Status: Accepted (2026-10-31)

Reading the creator's metadata from the player response and switching audio tracks needs YouTube's own player object, which only exists in the page's JavaScript world. restoreyt declares `build/page.js` as a content script with `"world": "MAIN"` (Chromium 111+, Firefox 128+) instead of injecting `<script>` tags, which YouTube's Trusted Types policy and CSP can block.

The page-world script and the isolated content script talk through `CustomEvent`s on `document` whose `detail` is a JSON string (strings cross world boundaries in every browser). Messages are validated on receipt; nothing from the page is executed. Either side may start first: the page script greets on start and again on its first settings message, and resends known video data.
