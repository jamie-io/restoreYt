# ADR 007: Where original titles come from

Status: Accepted (2026-10-31)

Live checks with a German interface showed: feed, search and watch-page renderers carry translated titles; `videoDetails.title` in the player response and the oEmbed endpoint carry the creator's title.

- Watch page and Shorts: the page's own player response, no request.
- Everything else: `GET https://www.youtube.com/oembed?format=json&url=…` per video, without cookies. About 700 bytes per lookup and cacheable.
- oEmbed refuses videos with embedding disabled (401). For those the page-world script asks YouTube's player endpoint (`/youtubei/v1/player`) with the page's client context; the response is small because playback data is withheld.

Differences between oEmbed and the displayed title also cover creator A/B title tests: restoreyt shows the creator's main title.
