# ADR 002: Restore thumbnails in DOM

Status: Superseded by [ADR 005](005-thumbnail-redirects.md) (2026-10-31)

restoreyt 1.x rewrote `<img>` sources in the DOM with an `onerror` fallback chain, because the earlier redirect rules upgraded every thumbnail to `maxresdefault`, which does not exist for all videos. That approach only reached `<img>` elements, downloaded the swapped image first and flickered.
