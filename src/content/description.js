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

  function findDescriptionTextContainer() {
    const selectors = [
      '#description-inline-expander #description-text',
      '#description yt-attributed-string',
      '#description .ytd-video-description-body-renderer',
      '#description span[slot="content"]'
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

    if (!details || !details.shortDescription) return;

    const textContainer = findDescriptionTextContainer();
    if (!textContainer) return;

    const currentText = textContainer.textContent?.trim();
    if (currentText === details.shortDescription) return;

    PROCESSED.add(container);
    dom.replaceTextOnly(textContainer, details.shortDescription);
  }

  async function processVideoPage() {
    const videoId = getVideoId();
    if (!videoId || videoId === currentVideoId) return;

    currentVideoId = videoId;
    await replaceDescription(videoId);
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
