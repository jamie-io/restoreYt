(async function () {
  'use strict';

  const api = window.DeslopifyAPI;
  const dom = window.DeslopifyDOM;
  const cache = window.DeslopifyCache;

  if (!api || !dom) {
    console.warn('[Deslopify] title.js: Missing dependencies');
    return;
  }

  const PROCESSED = new WeakSet();
  const titleCache = new Map();

  const TITLE_SELECTORS = [
    '#title > h1 > yt-formatted-string',
    'h1.title yt-formatted-string',
    '.slim-video-information-title .yt-core-attributed-string',
    'yt-shorts-video-title-view-model h2 span',
    '#anchored-panel #title yt-formatted-string',
    'a.ytp-title-link',
    'div.fullscreen-recommendation h2',
    '#player-controls a.ytmVideoInfoVideoTitle span',
    'ytd-video-description-header-renderer .title span'
  ];

  function getTitleElement(root) {
    for (const selector of TITLE_SELECTORS) {
      const el = root.querySelector(selector);
      if (el && el.textContent?.trim()) return el;
    }
    return null;
  }

  function getVideoIdForElement(titleEl) {
    const linkEl = titleEl.closest('a[href]') || titleEl.querySelector('a[href]');
    if (linkEl) return api.extractVideoId(linkEl.href);

    const container = titleEl.closest('ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, ytm-video-card-renderer, yt-lockup-view-model');
    if (container) {
      const link = container.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
      if (link) return api.extractVideoId(link.href);
    }

    return api.extractVideoId(window.location.href);
  }

  async function untranslateTitle(titleEl) {
    if (!titleEl || PROCESSED.has(titleEl)) return;

    const videoId = getVideoIdForElement(titleEl);
    if (!videoId) return;

    const cacheKey = `title:${videoId}`;
    let originalTitle = cache.get(cacheKey);

    if (originalTitle === undefined) {
      const details = await api.getVideoDetails(videoId);
      originalTitle = details?.title || null;
      cache.set(cacheKey, originalTitle);
    }

    if (!originalTitle) return;

    const currentTitle = titleEl.textContent?.trim();
    if (currentTitle === originalTitle) return;

    PROCESSED.add(titleEl);

    if (titleEl.tagName === 'A') {
      titleEl.textContent = originalTitle;
    } else {
      dom.replaceTextOnly(titleEl, originalTitle);
    }
  }

  async function processVisibleTitles() {
    for (const selector of TITLE_SELECTORS) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        if (dom.isVisible(el, true) && !PROCESSED.has(el)) {
          await untranslateTitle(el);
        }
      }
    }
  }

  const debouncedProcess = dom.debounce(processVisibleTitles, 100);

  if (document.body) {
    dom.createObserver(debouncedProcess);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      dom.createObserver(debouncedProcess);
    });
  }

  processVisibleTitles();
  window.addEventListener('yt-navigate-finish', debouncedProcess);
  window.addEventListener('yt-page-data-updated', debouncedProcess);
})();
