# ADR 003: TypeScript plus esbuild

Status: Accepted

Strict TypeScript covers every extension context: background, the isolated content script, the page-world script and the extension pages. esbuild emits one classic IIFE bundle per context plus the stylesheets, so no module loader is needed in any world. Unit tests run on vitest (happy-dom for DOM code); browser tests run the built extension in Chromium with Playwright.
