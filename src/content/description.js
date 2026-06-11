(async function () {
  'use strict';

  const api = window.DeslopifyAPI;
  const dom = window.DeslopifyDOM;
  const cache = window.DeslopifyCache;

  if (!api || !dom) {
    console.warn('[Deslopify] description.js: Missing dependencies');
    return;
  }

  const PROCESSED = new WeakSet();
  let currentVideoId = null;

  function getVideoId() {
    return api.extractVideoId(window.location.href);
  }

  function getVideoIdFromPlayer() {
    const playerLink = document.querySelector('.ytp-title-link');
    if (playerLink) return api.extractVideoId(playerLink.href);
    return null;
  }

  function getDescriptionContainer() {
    const selectors = [
      '#description-inline-expander',
      '#description',
      'ytd-text-inline-expander',
      '#info-container #description'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function getChaptersContainer() {
    const selectors = [
      'ytd-macro-markers-list-renderer',
      '#chapters',
      '#engagement-panel-macro-markers-description-chapters'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  async function replaceDescription(videoId) {
    const container = getDescriptionContainer();
    if (!container || PROCESSED.has(container)) return;

    const cacheKey = `desc:${videoId}`;
    let details = cache.get(cacheKey);

    if (!details) {
      details = await api.getVideoDetails(videoId);
      cache.set(cacheKey, details);
    }

    if (!details) return;

    PROCESSED.add(container);
  }

  async function replaceChapters(videoId) {
    const container = getChaptersContainer();
    if (!container || PROCESSED.has(container)) return;

    const cacheKey = `chapters:${videoId}`;
    let details = cache.get(cacheKey);

    if (!details) {
      details = await api.getVideoDetails(videoId);
      cache.set(cacheKey, details);
    }

    if (!details) return;

    PROCESSED.add(container);
  }

  async function processVideoPage() {
    const videoId = getVideoId();
    if (!videoId || videoId === currentVideoId) return;

    currentVideoId = videoId;
    await replaceDescription(videoId);
    await replaceChapters(videoId);
  }

  const debouncedProcess = dom.debounce(processVideoPage, 200);

  if (document.body) {
    dom.createObserver(debouncedProcess);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      dom.createObserver(debouncedProcess);
    });
  }

  processVideoPage();
  window.addEventListener('yt-navigate-finish', debouncedProcess);
  window.addEventListener('yt-page-data-updated', debouncedProcess);
})();
