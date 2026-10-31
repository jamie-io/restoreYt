import { chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Launch Chromium with the unpacked extension from the repository root. */
export async function launchWithExtension() {
  const profile = await mkdtemp(join(tmpdir(), 'restoreyt-e2e-'));
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: true,
    args: [`--disable-extensions-except=${process.cwd()}`, `--load-extension=${process.cwd()}`],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  return {
    context,
    worker,
    extensionId,
    async close() {
      await context.close().catch(() => undefined);
      await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    },
  };
}

/**
 * Serve fixture documents for youtube.com URLs (by pathname, falling back to
 * `pages.default`) and answer oEmbed lookups from `titles`
 * ({ videoId: originalTitle }). No request leaves the machine.
 */
export async function fakeYouTube(context, pages, titles) {
  await context.route('https://www.youtube.com/oembed**', route => {
    const target = new URL(route.request().url()).searchParams.get('url') ?? '';
    const id = new URL(target).searchParams.get('v');
    const title = id ? titles[id] : undefined;
    return title
      ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title }) })
      : route.fulfill({ status: 404, body: 'Not Found' });
  });
  await context.route(/^https:\/\/www\.youtube\.com\/(?!oembed)/, route => {
    const { pathname } = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pages[pathname] ?? pages.default });
  });
  await context.route(/^https:\/\/i\.ytimg\.com\//, route => route.fulfill({ status: 404, body: '' }));
}

export const FEED_FIXTURE = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>YouTube</title></head><body>
<ytd-app>
  <ytd-rich-item-renderer>
    <yt-lockup-view-model>
      <div class="ytLockupViewModelHost content-id-_c2e1NcI3Sc">
        <a href="/watch?v=_c2e1NcI3Sc"><img src="https://i.ytimg.com/vi_lc/_c2e1NcI3Sc/hq720_de.jpg?sqp=x" alt=""></a>
        <yt-lockup-metadata-view-model>
          <h3 title="Besiege Haaland und gewinne 100.000 $"><a href="/watch?v=_c2e1NcI3Sc"><span>Besiege Haaland und gewinne 100.000 $</span></a></h3>
        </yt-lockup-metadata-view-model>
      </div>
    </yt-lockup-view-model>
  </ytd-rich-item-renderer>
  <ytd-video-renderer>
    <a id="thumbnail" href="/watch?v=hTSaweR8qMI"><img src="https://i.ytimg.com/vi/hTSaweR8qMI/hq720_custom_2.jpg?sqp=y" alt=""></a>
    <a id="video-title" title="1$ vs. 500.000$ Date" href="/watch?v=hTSaweR8qMI"><yt-formatted-string>1$ vs. 500.000$ Date</yt-formatted-string></a>
  </ytd-video-renderer>
  <ytd-video-renderer>
    <a id="thumbnail" href="/watch?v=jNQXAC9IVRw"></a>
    <a id="video-title" title="Me at the zoo" href="/watch?v=jNQXAC9IVRw"><yt-formatted-string>Me at the zoo</yt-formatted-string></a>
  </ytd-video-renderer>
</ytd-app>
</body></html>`;

export const FEED_TITLES = {
  _c2e1NcI3Sc: 'Beat LeBron, Win $100,000',
  hTSaweR8qMI: '$1 vs $500,000 Date!',
  jNQXAC9IVRw: 'Me at the zoo',
};

// Captured audio track ids: German dub and English original.
const DUBBED_DE = '251;Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICZGU';
const ORIGINAL_EN = '251;ChEKBWFjb250EghvcmlnaW5hbAoKCgRsYW5nEgJlbg';

/** Watch page with a scripted stand-in for YouTube's player API. */
export const WATCH_FIXTURE = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Ich habe 100 Tage in der Wildnis überlebt - YouTube</title></head><body>
<ytd-app>
  <ytd-watch-flexy video-id="demoVideo01">
    <div id="movie_player" class="html5-video-player"><button class="ytp-subtitles-button" aria-pressed="true"></button></div>
    <ytd-watch-metadata>
      <div id="title"><h1><yt-formatted-string title="Ich habe 100 Tage in der Wildnis überlebt">Ich habe 100 Tage in der Wildnis überlebt</yt-formatted-string></h1></div>
      <div id="description">
        <ytd-text-inline-expander id="description-inline-expander">
          <div id="expanded"><yt-attributed-string></yt-attributed-string></div>
          <div id="snippet"><span id="snippet-text"><yt-attributed-string id="attributed-snippet-text"><span>Ich habe 100 Tage allein in der Wildnis verbracht und alles gefilmt. Kapitel: 0:00 Anfang</span></yt-attributed-string></span></div>
        </ytd-text-inline-expander>
      </div>
    </ytd-watch-metadata>
  </ytd-watch-flexy>
</ytd-app>
<script>
(() => {
  const DE = { id: '${DUBBED_DE}', Pb: { name: 'Deutsch', id: 'de.3', isDefault: true, isAutoDubbed: true }, captionsInitialState: 'CAPTIONS_INITIAL_STATE_ON_RECOMMENDED' };
  const EN = { id: '${ORIGINAL_EN}', Pb: { name: 'English (original)', id: 'en.4', isDefault: false, isAutoDubbed: false }, captionsInitialState: 'CAPTIONS_INITIAL_STATE_ON_RECOMMENDED' };
  let current = DE;
  let captions = { languageCode: 'de', displayName: 'Deutsch (automatisch übersetzt)' };
  const player = document.getElementById('movie_player');
  player.getPlayerResponse = () => ({ videoDetails: { videoId: 'demoVideo01', title: 'I Survived 100 Days in the Wild', author: 'Example Creator', shortDescription: 'I spent 100 days alone in the wild and filmed everything.\\n\\n0:00 Start\\n12:30 Shelter\\nhttps://example.com/gear' } });
  player.getVideoData = () => ({ video_id: 'demoVideo01', title: 'Ich habe 100 Tage in der Wildnis überlebt', author: 'Example Creator' });
  player.getAvailableAudioTracks = () => [DE, EN];
  player.getAudioTrack = () => current;
  player.setAudioTrack = track => { current = track; return true; };
  player.getOption = (module, option) => (module === 'captions' && option === 'track' ? (captions ?? {}) : null);
  player.setOption = (module, option, value) => { if (module === 'captions' && option === 'track' && !(value && value.languageCode)) captions = null; };
  player.seekTo = seconds => { window.__seekedTo = seconds; };
  player.playVideo = () => {};
  window.__fakePlayer = { audio: () => current.Pb.id, captions: () => captions, pick: track => { current = track === 'de' ? DE : EN; } };
})();
</script>
</body></html>`;

const DEMO_RELATED = [
  ['demoVideo02', 'Wir haben das kleinste Haus der Welt gebaut', 'We Built the World’s Smallest House'],
  ['demoVideo03', 'Ich habe jedes Gericht auf der Speisekarte probiert', 'I Tried Every Dish on the Menu'],
  ['demoVideo04', 'Der schnellste Weg, Japanisch zu lernen', 'The Fastest Way to Learn Japanese'],
  ['demoVideo05', 'Warum dieses Flugzeug nie gelandet ist', 'Why This Plane Never Landed'],
  ['demoVideo06', 'Morning walk in Lisbon', 'Morning walk in Lisbon'],
];

/** Watch page with invented videos for screenshots: translated titles in the related column. */
export const DEMO_WATCH_FIXTURE = WATCH_FIXTURE.replace('</ytd-watch-flexy>', `<div id="related">${DEMO_RELATED.map(([id, shown]) => `
    <yt-lockup-view-model><div class="ytLockupViewModelHost content-id-${id}">
      <a href="/watch?v=${id}"><img src="https://i.ytimg.com/vi_lc/${id}/hq720_de.jpg?sqp=x" alt=""></a>
      <yt-lockup-metadata-view-model><h3 title="${shown}"><a href="/watch?v=${id}"><span>${shown}</span></a></h3></yt-lockup-metadata-view-model>
    </div></yt-lockup-view-model>`).join('')}</div></ytd-watch-flexy>`);

export const DEMO_TITLES = Object.fromEntries([['demoVideo01', 'I Survived 100 Days in the Wild'], ...DEMO_RELATED.map(([id, , original]) => [id, original])]);
