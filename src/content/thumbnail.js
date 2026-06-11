(async function() {
  'use strict';

  const api = window.DeslopifyAPI;
  const dom = window.DeslopifyDOM;
  const cache = window.DeslopifyCache;

  if (!api || !dom) {
    console.warn('[Deslopify] thumbnail.js: Missing dependencies');
    return;
  }

  const PROCESSED = new WeakSet();
  const WHITELIST = window.__DESLOPIFY_WHITELIST__ || [];

  function getCleanThumbnailUrl(videoId) {
    return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
  }

  function getSloppyThumbnail(img) {
    const src = img.src || img.getAttribute('data-src') || '';
    if (!src) return false;

    if (src.includes('i.ytimg.com')) {
      if (src.includes('hq720') || src.includes('hqdefault') || src.includes('sddefault')) {
        return true;
      }
    }

    return false;
  }

  async function isChannelWhitelisted(videoId) {
    if (!WHITELIST.length) return false;
    const cacheKey = `th_ch:${videoId}`;
    let channelId = cache?.get(cacheKey);
    if (channelId === undefined) {
      const details = await api.getVideoDetails(videoId);
      channelId = details?.channelId || null;
      cache?.set(cacheKey, channelId);
    }
    return channelId && WHITELIST.includes(channelId);
  }

  async function replaceThumbnail(img) {
    if (!img || PROCESSED.has(img)) return;

    const src = img.src || img.getAttribute('data-src') || '';
    const videoId = api.extractVideoId(src);
    if (!videoId) return;

    if (await isChannelWhitelisted(videoId)) {
      PROCESSED.add(img);
      return;
    }

    const cleanUrl = getCleanThumbnailUrl(videoId);

    PROCESSED.add(img);

    if (img.src) img.src = cleanUrl;
    if (img.getAttribute('data-src')) img.setAttribute('data-src', cleanUrl);
  }

  async function processVisibleThumbnails() {
    const images = document.querySelectorAll('img[src*="i.ytimg.com"], img[data-src*="i.ytimg.com"]');
    for (const img of images) {
      if (dom.isVisible(img, false) && getSloppyThumbnail(img) && !PROCESSED.has(img)) {
        await replaceThumbnail(img);
      }
    }
  }

  const debouncedProcess = dom.debounce(processVisibleThumbnails, 90);

  if (document.body) {
    dom.createObserver(debouncedProcess);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      dom.createObserver(debouncedProcess);
    });
  }

  processVisibleThumbnails();
  window.addEventListener('yt-navigate-finish', debouncedProcess);
  window.addEventListener('yt-page-data-updated', debouncedProcess);
})();
