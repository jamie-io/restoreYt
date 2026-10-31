/**
 * Every place YouTube (desktop) renders a video title, with how to find its
 * video ID and the element holding the text. All YouTube DOM knowledge for
 * titles lives here; when YouTube ships new markup this is the file to change.
 */

import { isVideoId, videoIdFromContentClass, videoIdFromUrl } from '../shared/youtube.js';

export interface PageContext {
  /** Video ID of the watch page (also while it sits behind the miniplayer). */
  watchVideoId(): string | null;
  /** Video ID of the active Short. */
  shortsVideoId(): string | null;
  /** Video the main player has loaded, as reported by the page world (also without a watch page). */
  playerVideoId(): string | null;
}

export interface TitleSurface {
  name: string;
  selector: string;
  /** Element whose text is the title. */
  text(host: Element): Element | null;
  videoId(host: Element, page: PageContext): string | null;
  /** Elements whose `title` / `aria-label` repeat the title. */
  attributeHosts(host: Element): Element[];
}

const VIDEO_LINK = 'a[href*="/watch?v="], a[href^="/shorts/"], a[href*="youtube.com/shorts/"]';

const LEGACY_RENDERERS = [
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-playlist-video-renderer',
  'ytd-playlist-panel-video-renderer',
  'ytd-rich-grid-media',
  'ytd-reel-item-renderer',
  'ytd-movie-renderer',
  'ytd-compact-movie-renderer',
  'ytd-child-video-renderer',
  'ytd-channel-video-player-renderer',
  'ytd-promoted-video-renderer',
  'ytd-structured-description-video-lockup-renderer',
  'ytd-video-description-header-renderer',
].join(', ');

/** Containers whose `#video-title` is a playlist or mix name, not a video title. */
const PLAYLIST_RENDERERS = [
  'ytd-playlist-renderer',
  'ytd-grid-playlist-renderer',
  'ytd-compact-playlist-renderer',
  'ytd-radio-renderer',
  'ytd-compact-radio-renderer',
  'ytd-grid-radio-renderer',
  'ytd-grid-show-renderer',
].join(', ');

export function lockupContentId(lockup: Element): string | null {
  const holder = lockup.querySelector('[class*="content-id-"]') ?? (lockup.className.includes('content-id-') ? lockup : null);
  const match = holder ? /(?:^|\s)content-id-([A-Za-z0-9_-]+)/.exec(holder.className) : null;
  return match?.[1] ?? null;
}

function lockupVideoId(host: Element): string | null {
  const lockup = host.closest('yt-lockup-view-model');
  if (lockup) {
    const contentId = lockupContentId(lockup);
    // Playlists, mixes and podcasts carry longer content IDs: their title is not a video title.
    if (contentId !== null) return isVideoId(contentId) ? contentId : null;
    const lockupClass = videoIdFromContentClass(lockup.className);
    if (lockupClass) return lockupClass;
  }
  const href = host.querySelector('a[href]')?.getAttribute('href') ?? null;
  if (!href || /[?&]list=/.test(href)) return null;
  return videoIdFromUrl(href);
}

/**
 * Video ID of the item around `start`: climbs until an ancestor contains video
 * links, and accepts it only when all links agree (one item, not a whole list).
 */
export function itemVideoId(start: Element, maxDepth = 6): string | null {
  const ownLink = start.closest('a[href]');
  const own = videoIdFromUrl(ownLink?.getAttribute('href'));
  if (own) return own;
  let node: Element | null = start;
  for (let depth = 0; node && depth < maxDepth; depth += 1, node = node.parentElement) {
    const links = node.querySelectorAll(VIDEO_LINK);
    if (links.length === 0) continue;
    const ids = new Set<string>();
    for (const link of links) {
      const id = videoIdFromUrl(link.getAttribute('href'));
      if (id) ids.add(id);
    }
    return ids.size === 1 ? [...ids][0] ?? null : null;
  }
  return null;
}

/** Video ID from the first YouTube thumbnail inside `root`. */
function thumbnailVideoId(root: Element | null): string | null {
  const image = root?.querySelector('img[src*="ytimg.com/vi"]');
  return videoIdFromUrl(image?.getAttribute('src'));
}

function textHolder(host: Element, inner: string): Element {
  return host.querySelector(inner) ?? host;
}

function selfAndDescendants(host: Element, selector: string): Element[] {
  return [host, ...host.querySelectorAll(selector)];
}

function activeReel(host: Element): boolean {
  const reel = host.closest('ytd-reel-video-renderer');
  if (!reel) return true;
  return reel.hasAttribute('is-active') || reel.querySelector('#shorts-player') !== null;
}

export const TITLE_SURFACES: readonly TitleSurface[] = [
  {
    // Home, subscriptions, channel pages, related videos, search shelves.
    name: 'lockup',
    selector: 'yt-lockup-metadata-view-model h3',
    text: host => host.querySelector('a span') ?? host.querySelector('span') ?? host,
    videoId: lockupVideoId,
    attributeHosts: host => selfAndDescendants(host, 'a'),
  },
  {
    name: 'shorts-lockup',
    selector: 'ytm-shorts-lockup-view-model h3',
    text: host => host.querySelector('a span') ?? host.querySelector('span'),
    videoId: host => videoIdFromUrl(host.querySelector('a[href]')?.getAttribute('href')),
    attributeHosts: host => [...host.querySelectorAll('a')],
  },
  {
    // Search results, playlists, playlist panel, older layouts.
    name: 'renderer',
    selector: '#video-title',
    text: host => textHolder(host, 'yt-formatted-string'),
    videoId: host => {
      if (host.closest(PLAYLIST_RENDERERS)) return null;
      const container = host.closest(LEGACY_RENDERERS);
      return container ? itemVideoId(host, 8) : null;
    },
    attributeHosts: host => selfAndDescendants(host, 'yt-formatted-string'),
  },
  {
    name: 'watch',
    selector: 'ytd-watch-metadata #title h1',
    text: host => textHolder(host, 'yt-formatted-string'),
    videoId: (host, page) => {
      // During SPA navigation the URL and the page element briefly disagree; wait
      // until both name the same video so a title never lands on the wrong page.
      const id = host.closest('ytd-watch-flexy')?.getAttribute('video-id') ?? page.watchVideoId();
      const location = host.ownerDocument.location;
      if (!isVideoId(id) || location?.pathname !== '/watch') return null;
      return videoIdFromUrl(location.href) === id ? id : null;
    },
    attributeHosts: host => [...host.querySelectorAll('yt-formatted-string')],
  },
  {
    // Player title bar (embeds, fullscreen) and the end-of-video wall.
    name: 'player',
    selector: 'a.ytp-title-link',
    text: host => host,
    videoId: (host, page) => {
      // During ads the title bar names the ad.
      if (host.closest('.ad-showing, .ad-interrupting')) return null;
      const linked = videoIdFromUrl(host.getAttribute('href'));
      if (linked) return linked;
      // The watch player (also as miniplayer) leaves the link empty until fullscreen.
      if (host.closest('#shorts-player')) return page.shortsVideoId();
      if (!host.closest('#movie_player')) return null;
      const id = page.watchVideoId() ?? page.playerVideoId();
      const location = host.ownerDocument.location;
      // On the watch page itself, wait until the URL agrees (see the watch surface).
      if (location?.pathname === '/watch' && videoIdFromUrl(location.href) !== id) return null;
      return id;
    },
    attributeHosts: () => [],
  },
  {
    name: 'videowall',
    selector: '.ytp-videowall-still-info-title',
    text: host => host,
    videoId: host => videoIdFromUrl(host.closest('a[href]')?.getAttribute('href')),
    attributeHosts: host => {
      const link = host.closest('a[href]');
      return link ? [link] : [];
    },
  },
  {
    // End-screen cards, the autoplay "up next" overlay and embed suggestions inside the player.
    name: 'player-cards',
    selector: '.ytp-ce-video-title, .ytp-autonav-endscreen-upnext-title, .ytp-suggestion-title',
    text: host => host,
    videoId: host => itemVideoId(host, 5),
    attributeHosts: host => {
      const link = host.closest('a[href]');
      return link ? [link] : [];
    },
  },
  {
    name: 'shorts-overlay',
    selector: 'yt-shorts-video-title-view-model h1, yt-shorts-video-title-view-model h2',
    text: host => textHolder(host, 'span'),
    videoId: (host, page) => (activeReel(host) ? page.shortsVideoId() : null),
    attributeHosts: () => [],
  },
  {
    // Description panel header (Shorts and watch page).
    name: 'title-header',
    selector: 'yt-video-title-header-view-model h2',
    text: host => textHolder(host, 'span'),
    videoId: (host, page) => (host.closest('ytd-shorts') ? page.shortsVideoId() : page.watchVideoId()),
    attributeHosts: () => [],
  },
  {
    // Also shown on a fresh page when YouTube restores the last session ("continue watching"),
    // when there is no watch page: the player's own video is the reliable source then.
    name: 'miniplayer',
    selector: 'ytd-miniplayer-info-bar .ytdMiniplayerInfoBarTitle, ytd-miniplayer-info-bar h2',
    text: host => textHolder(host, 'span'),
    videoId: (host, page) => page.playerVideoId() ?? itemVideoId(host, 10) ?? thumbnailVideoId(host.closest('ytd-miniplayer')) ?? page.watchVideoId(),
    attributeHosts: host => [host],
  },
];

export function createPageContext(doc: Document, playerVideoId: () => string | null = () => null): PageContext {
  return {
    playerVideoId,
    watchVideoId() {
      const flexy = doc.querySelector('ytd-watch-flexy');
      const id = flexy?.getAttribute('video-id');
      if (isVideoId(id)) return id;
      return doc.location?.pathname === '/watch' ? videoIdFromUrl(doc.location.href) : null;
    },
    shortsVideoId() {
      const path = doc.location?.pathname ?? '';
      return path.startsWith('/shorts/') ? videoIdFromUrl(doc.location.href) : null;
    },
  };
}
