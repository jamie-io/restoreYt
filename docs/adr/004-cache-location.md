# ADR 004: Title cache

Status: Accepted (revised 2026-10-31)

Original titles are cached in memory (per tab) and in `storage.local` with one key per video (`t:<id>`), so tabs never overwrite each other's entries and the page's own storage quota is untouched. Each entry stores the original, the text YouTube displayed at lookup time and a timestamp.

- Within 30 minutes an entry is trusted as is.
- After that it is used only while YouTube still displays the same text; a different text (creator renamed the video, new translation) triggers a fresh lookup.
- Videos without an original (private, removed) are remembered for a day; network failures for two minutes and only in memory.
- The background prunes entries older than 14 days and keeps at most 20,000.
