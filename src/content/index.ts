/**
 * Isolated-world content script: wires settings, the page bridge, title lookup,
 * DOM restoration and the per-page report together.
 */

import { ext, loadSettings, watchSettings } from '../shared/ext.js';
import { isVideoInfo, MESSAGE, type PageReport, type RuntimeMessage } from '../shared/messages.js';
import { DEFAULT_SETTINGS, isActive, type Settings } from '../shared/settings.js';
import { matchSwappedThumbnail } from '../shared/youtube.js';
import { PageBridge } from './bridge.js';
import { DescriptionRestorer } from './description.js';
import { DocumentTitle } from './doc-title.js';
import { PlayerTitleSweep } from './player-titles.js';
import { PageReporter, pageKey } from './report.js';
import { createPageContext } from './surfaces.js';
import { TitleEngine } from './title-engine.js';
import { TitleService } from './title-service.js';
import { TitleStore } from './title-store.js';

const SCAN_INTERVAL_MS = 80;

function contextAlive(): boolean {
  try {
    return Boolean(ext?.runtime?.id);
  } catch {
    return false;
  }
}

export function swappedThumbnailIds(doc: Document): Set<string> {
  const ids = new Set<string>();
  for (const image of doc.querySelectorAll('img[src*="ytimg.com/vi"]')) {
    const match = matchSwappedThumbnail(image.getAttribute('src'));
    if (match) ids.add(match.videoId);
  }
  return ids;
}

async function main(): Promise<void> {
  const doc = document;
  const isTop = window.top === window;
  // Listen to the page world before any await so early messages are not lost.
  const bridge = new PageBridge(doc);
  let settings: Settings = { ...DEFAULT_SETTINGS };
  let settingsLoaded = false;

  // Video loaded in the main player, from the page world (covers a restored miniplayer).
  let playerVideoId: string | null = null;
  const page = createPageContext(doc, () => playerVideoId);
  const store = new TitleStore(contextAlive() ? ext.storage.local : null);
  const service = new TitleService(store, bridge);
  const reporter = new PageReporter(location.href, {
    badge(count) {
      if (!isTop || !contextAlive()) return;
      ext.runtime.sendMessage({ type: MESSAGE.badge, count } satisfies RuntimeMessage).catch(() => undefined);
    },
    lifetime(delta) {
      // Fire and forget: the background serializes the counter update, which
      // also survives this tab closing right after.
      if (!contextAlive()) return;
      ext.runtime.sendMessage({ type: MESSAGE.stats, delta } satisfies RuntimeMessage).catch(() => undefined);
    },
  });
  const engine = new TitleEngine(doc, service, reporter, page);
  const docTitle = new DocumentTitle(doc, page);
  const playerTitles = new PlayerTitleSweep(doc, reporter);
  const description = new DescriptionRestorer(doc, reporter, page, seconds => {
    bridge.send({ type: 'seek', seconds });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const applyRootFlags = (): void => {
    doc.documentElement.toggleAttribute('data-restoreyt-hide-ai', isActive(settings, 'hideAi'));
  };
  applyRootFlags();

  let currentPage = pageKey(location.href);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastScan = 0;

  const scan = (): void => {
    const key = pageKey(location.href);
    if (key !== currentPage) {
      currentPage = key;
      reporter.reset(location.href);
    }
    if (!settingsLoaded || !settings.enabled) return;
    if (settings.titles) {
      engine.scan();
      docTitle.apply();
      playerTitles.apply();
    }
    if (settings.descriptions) description.apply();
    if (settings.thumbnails) reporter.thumbnails(swappedThumbnailIds(doc));
    reporter.aiHidden(settings.hideAi && doc.querySelector('ytd-expandable-metadata-renderer[has-video-summary]') ? 1 : 0);
    reporter.lookups(service.stats());
  };

  const schedule = (): void => {
    if (timer !== null) return;
    const wait = Math.max(0, lastScan + SCAN_INTERVAL_MS - performance.now());
    timer = setTimeout(() => {
      timer = null;
      lastScan = performance.now();
      if (!contextAlive()) {
        observer.disconnect();
        return;
      }
      try {
        scan();
      } catch (error) {
        console.debug('[restoreyt] scan failed', error);
      }
    }, wait);
  };

  // The player's clock and progress bar change several times a second during
  // playback; they never contain titles, so they do not trigger a scan.
  const NOISY = '.ytp-chrome-bottom, .ytp-progress-bar-container, .ytp-tooltip, .ytp-ad-module';
  const observer = new MutationObserver(records => {
    for (const record of records) {
      const target = record.target.nodeType === 1 ? record.target as Element : record.target.parentElement;
      if (!target?.closest(NOISY)) {
        schedule();
        return;
      }
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
  service.onResolved(schedule);
  window.addEventListener('yt-navigate-finish', schedule);
  window.addEventListener('popstate', schedule);

  bridge.on(message => {
    if (message.type === 'hello') {
      if (settingsLoaded) bridge.send({ type: 'settings', settings });
    } else if (message.type === 'video') {
      const { video } = message;
      if (!isVideoInfo(video)) return;
      if (video.surface !== 'shorts') playerVideoId = video.videoId;
      service.seed(video.videoId, video.title, video.displayedTitle);
      docTitle.remember(video.videoId, video.title, video.displayedTitle);
      playerTitles.setVideo(video);
      description.setVideo(video);
      schedule();
    } else if (message.type === 'audio') {
      const { change } = message;
      if (typeof change?.videoId === 'string' && typeof change.from === 'string' && typeof change.to === 'string') reporter.audio(change);
    } else if (message.type === 'captions') {
      const { change } = message;
      if (typeof change?.videoId === 'string' && typeof change.track === 'string') reporter.captions(change);
    }
  });

  settings = await loadSettings();
  settingsLoaded = true;
  applyRootFlags();
  bridge.send({ type: 'settings', settings });

  watchSettings(next => {
    const previous = settings;
    settings = next;
    applyRootFlags();
    bridge.send({ type: 'settings', settings });
    if (isActive(previous, 'titles') && !isActive(next, 'titles')) {
      engine.revertAll();
      docTitle.revert();
      playerTitles.revertAll();
    }
    if (isActive(previous, 'descriptions') && !isActive(next, 'descriptions')) description.revertAll();
    schedule();
  });

  ext.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (report: PageReport) => void) => {
    if ((message as RuntimeMessage | null)?.type !== MESSAGE.getReport || !isTop) return undefined;
    scan();
    sendResponse(reporter.snapshot());
    return undefined;
  });

  const flushAll = (): void => {
    reporter.flush();
    void store.flush();
  };
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
  schedule();
}

const flag = '__restoreytContent';
const root = globalThis as unknown as Record<string, unknown>;
if (!root[flag]) {
  root[flag] = true;
  void main();
}
