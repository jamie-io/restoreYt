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

## Quick Start

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test in development
npm run test:watch

# Run e2e tests (requires Playwright browsers)
npx playwright install
npm run test:e2e
```

No build step is needed — load the root directory as an unpacked extension.

## Project Structure

```
deslopify/
├── src/
│   ├── content/          # Feature scripts
│   │   ├── inject.js     # Main injector
│   │   ├── title.js      # Title restoration
│   │   ├── thumbnail.js  # Thumbnail redirection
│   │   ├── description.js # Description/chapter restoration
│   │   ├── audio.js      # Audio track interception
│   │   └── channel.js    # Channel branding restoration
│   ├── lib/              # Utility modules
│   │   ├── cache.js      # Session LRU cache
│   │   ├── settings.js   # Settings management
│   │   ├── api.js        # YouTube API client
│   │   └── dom.js        # DOM manipulation utilities
│   ├── options/          # Options page
│   │   ├── options.html
│   │   └── options.js
│   └── popup/            # Popup page
│       ├── popup.html
│       └── popup.js
├── tests/                # Test suite
│   ├── unit/             # Unit tests
│   │   ├── api.test.js
│   │   └── cache.test.js
│   └── e2e/              # End-to-end tests
│       ├── extension.spec.js
│       └── helpers.js
├── icons/                # Extension icons
├── manifest.json         # Chrome extension manifest
├── rules.json            # Thumbnail redirection rules
├── package.json          # Dependencies and scripts
├── LICENSE               # MIT license
└── README.md             # Project documentation
```

## Technical Overview

### Architecture
Deslopify uses a modular architecture with clear separation of concerns:

1. **Content Scripts**: Dynamic injection based on user settings
2. **API Client**: Uses YouTube's InnerTube API with SAPISID authentication
3. **Cache Layer**: Session-based LRU cache for API responses
4. **DOM Utilities**: Safe DOM manipulation and event handling

### How It Works

1. **manifest.json** registers a **content script** (`src/content/inject.js`) that runs at `document_start` on YouTube
2. The injector reads settings from `chrome.storage.sync`, then dynamically injects feature scripts into the page's JavaScript context
3. **Title restoration** (`title.js`) queries YouTube's InnerTube API (`youtubei/v1/player`) using the page's own authentication (SAPISID cookie) to fetch the original video title
4. **Thumbnail redirection** (`rules.json`) uses `declarativeNetRequest` to transparently redirect slop thumbnail requests (`i.ytimg.com/*hq720*`) to the original versions (`img.youtube.com/vi/*/maxresdefault.jpg`)
5. **Description/chapter restoration** (`description.js`) replaces the translated DOM content with the original text from the API
6. **Audio track interception** (`audio.js`) intercepts `audiotrackchange` events to prefer the original audio language
7. **Channel branding** (`channel.js`) restores original channel header images via the YouTube browse API

All API calls remain within `*.youtube.com` — no third-party servers are contacted.

### Permissions

- `declarativeNetRequest` — Redirect thumbnail requests to originals
- `storage` — Save settings (sync across devices)
- Host permissions for `*.youtube.com`, `*.youtube-nocookie.com`, `i.ytimg.com`, `img.youtube.com` — Required for content script injection and thumbnail redirection

### API Client

The extension uses YouTube's private InnerTube API with:

- SAPISID cookie authentication for API requests
- Client headers (`WEB`/`MWEB`) for compatibility
- Request caching to reduce API calls
- Automatic error handling and fallback

## Testing

### Unit Tests
Run unit tests with Vitest:

```bash
npm test
```

### E2E Tests
Run end-to-end tests with Playwright:

```bash
npx playwright install
npm run test:e2e
```

### Code Quality

```bash
npm run lint
```

## Development

### Prerequisites

- Node.js 18+
- Chrome/Firefox browser with developer mode enabled

### Running Locally

1. Install dependencies:

```bash
npm install
```

2. Load the extension:

- Go to `chrome://extensions`
- Enable "Developer mode"
- Click "Load unpacked" and select this directory

3. Open options page: `chrome://extensions` → Deslopify → Options

### Configuration

The extension includes the following settings (accessible via Options page or popup):

- **Enable Extension**: Master toggle for all features
- **Untranslate Titles**: Restore original video titles
- **Untranslate Thumbnails**: Show original creator thumbnails
- **Untranslate Descriptions**: Restore original video descriptions
- **Untranslate Chapters**: Restore original chapter titles
- **Disable AI Audio**: Prevent AI audio dubbing
- **Untranslate Channel Branding**: Restore original channel headers

### Channel Whitelist

Add YouTube channels to the whitelist to skip them from processing (useful for channels whose translations you prefer):

1. Go to Options page
2. Use the "Whitelist Channels" section
3. Enter channel `@handle` or channel ID

## Contributing

### Code of Conduct

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

### Issues and Feature Requests

1. Search for existing issues before creating a new one
2. Provide clear, reproducible steps to reproduce the issue
3. Include reproduction steps, expected vs. actual behavior
4. If applicable, include screenshots or console logs

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/<name>`
3. Make your changes with meaningful commit messages:
   - `feat: <feature>`
   - `fix: <bug fix>`
   - `refactor: <code cleanup>`
   - `docs: <documentation>`
4. Run tests before committing
5. Push to your fork and submit a Pull Request

### Development Guidelines

1. **Branch naming**: Use `feature/<name>`, `fix/<name>`, or `docs/<name>`
2. **Commit messages**: Follow conventional commits
3. **Testing**: Ensure all tests pass before merging
4. **Code review**: Get at least one approval from a maintainer
5. **Documentation**: Update documentation for new features or changes

### Testing Your Changes

1. Unit tests for new features
2. Manual testing in browser
3. Check browser extension console for errors
4. Verify functionality on YouTube videos

## Roadmap

### Current Features (v1.0.0)

- [x] Title restoration
- [x] Thumbnail redirection
- [x] Description/chapter restoration
- [x] Audio track interception
- [x] Channel branding restoration
- [x] Channel whitelist

### Future Plans (v2.0.0+)

- [ ] Firefox support
- [ ] Dark mode support
- [ ] Performance improvements
- [ ] Additional YouTube API endpoints
- [ ] Plugin architecture for extensibility

## License

[MIT](LICENSE)

## Disclaimer

This extension is not affiliated with, maintained by, or endorsed by YouTube or Google. It is an independent tool that modifies how YouTube content is displayed in your browser.

The extension interacts with YouTube's internal API (InnerTube) using your existing session cookie. No authentication credentials are sent to any third party.

## Support

For issues, please create a GitHub issue. For general discussion, please refer to the repository's discussions section.
