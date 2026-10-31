# restoreyt Privacy Policy

Last updated: 2026-10-31

restoreyt runs entirely in your browser. It has no server, no analytics and no telemetry, and it does not sell or share data.

## What it stores on your device

- **Settings** (which features are on) in the browser's extension storage. If browser sync is on, the browser syncs them between your devices.
- **Original titles** it looked up, with the text YouTube showed at the time and a timestamp, in local extension storage. Entries are removed after 14 days at the latest. You can clear them on the settings page.
- **Counters** of how many titles, thumbnails, descriptions, audio tracks and subtitle tracks were restored, in local extension storage. You can reset them on the settings page.

It does not store your watch history, account details, cookies or tokens.

## Network requests

All requests go to YouTube:

- `https://www.youtube.com/oembed` to look up a video's original title. These requests are sent without cookies.
- `https://www.youtube.com/youtubei/v1/player` for videos the oEmbed endpoint refuses. The request is made from the YouTube page with that page's normal YouTube context, like the requests YouTube itself makes.
- `https://i.ytimg.com` for original thumbnails, which replace the localized ones YouTube would have loaded.

No request goes anywhere else.

## Your choices

Switch off any feature, or restoreyt as a whole, from the popup or the settings page. Clear cached titles and reset counters on the settings page. Removing the extension deletes everything it stored.

## Contact

Report privacy issues privately as described in [SECURITY.md](SECURITY.md). Do not attach cookies, tokens or account data.
