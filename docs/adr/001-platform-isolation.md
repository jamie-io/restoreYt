# ADR 001: Keep YouTube knowledge in a few files

Status: Accepted (revised 2026-10-31)

YouTube's markup, player API and URL formats change without notice. Everything restoreyt assumes about them lives in:

- `src/content/surfaces.ts`: every place a title is rendered, how to find its video ID and its text node.
- `src/page/player.ts` and `src/page/audio.ts`: player accessors and audio-track tags.
- `src/shared/youtube.ts`: URL, video ID and thumbnail patterns.
- `rules/thumbnails.json`: thumbnail redirect rules, mirrored by `matchSwappedThumbnail` and checked against it in unit tests.

Feature code consumes these through small typed functions. When YouTube ships new markup, the live check (`npm run test:live`) shows which surface broke and the fix stays in one file.
