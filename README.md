# Deslopify

Remove AI auto-translated titles, thumbnails, descriptions, and audio from YouTube.

When YouTube auto-translates a video, it replaces the creator's original title, thumbnail, description, and sometimes audio with AI-generated versions. Deslopify restores the originals by intercepting the translated content and replacing it with data fetched directly from YouTube's own API.

## Features

- **Untranslate Titles** — Restores original video titles on watch pages, search results, and recommendations
- **Untranslate Thumbnails** — Replaces AI-modified thumbnails (`hq720`, `hqdefault`, `sddefault`) with the creator's `maxresdefault` via `declarativeNetRequest`
- **Untranslate Descriptions** — Restores original video descriptions
- **Untranslate Chapters** — Restores original chapter titles
- **Disable AI Audio** — Prevents auto-dubbed audio tracks from playing
- **Untranslate Channel Branding** — Restores original channel header images and names
- **Channel Whitelist** — Skip certain channels (opt-out for channels whose translations you prefer)

## Installation

### Chrome Web Store

Available on the Chrome Web Store (link TBD).

### Manual (Developer Mode)

1. Clone this repository
2. Open `chrome://extensions`
3. Enable "Developer mode" (toggle in top-right)
4. Click "Load unpacked" and select the `deslopify` directory

### Firefox

This extension targets the Chrome MV3 API. Firefox support requires adapting to `browser` namespace conventions and may need additional work.

## How It Works

1. `manifest.json` registers a **content script** (`src/content/inject.js`) that runs at `document_start` on YouTube
2. The injector reads settings from `chrome.storage.sync`, then dynamically injects feature scripts into the page's JavaScript context
3. **Title restoration** (`title.js`) queries YouTube's InnerTube API (`youtubei/v1/player`) using the page's own authentication (SAPISID cookie) to fetch the original video title
4. **Thumbnail redirection** (`rules.json`) uses `declarativeNetRequest` to transparently redirect slop thumbnail requests (`i.ytimg.com/*hq720*`) to the original versions (`img.youtube.com/vi/*/maxresdefault.jpg`)
5. **Description/chapter restoration** (`description.js`) replaces the translated DOM content with the original text from the API
6. **Audio track interception** (`audio.js`) intercepts `audiotrackchange` events to prefer the original audio language
7. **Channel branding** (`channel.js`) restores original channel header images via the YouTube browse API

All API calls remain within `*.youtube.com` — no third-party servers are contacted.

## Development

```bash
# Install dependencies
npm install

# Run unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run e2e tests (requires Playwright browsers)
npx playwright install
npm run test:e2e
```

No build step is needed — load the root directory as an unpacked extension.

## Permissions

- `declarativeNetRequest` — Redirect thumbnail requests to originals
- `storage` — Save settings (sync across devices)
- Host permissions for `*.youtube.com`, `*.youtube-nocookie.com`, `i.ytimg.com`, `img.youtube.com` — Required for content script injection and thumbnail redirection

## Contributing

Contributions welcome! Please see the issue tracker for open items.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/foo`)
3. Commit your changes (`git commit -am 'feat: add foo'`)
4. Push to the branch (`git push origin feature/foo`)
5. Open a Pull Request

## License

[MIT](LICENSE)

## Disclaimer

This extension is not affiliated with, maintained by, or endorsed by YouTube or Google. It is an independent tool that modifies how YouTube content is displayed in your browser.

The extension interacts with YouTube's internal API (InnerTube) using your existing session cookie. No authentication credentials are sent to any third party.
