(async function () {
  'use strict';

  const api = window.DeslopifyAPI;
  const dom = window.DeslopifyDOM;
  const cache = window.DeslopifyCache;

  if (!api || !dom) {
    console.warn('[Deslopify] channel.js: Missing dependencies');
    return;
  }

  const PROCESSED = new WeakSet();

  function getChannelId() {
    const link = document.querySelector('a[href*="/channel/"], a[href*="/@"], link[rel="canonical"]');
    if (link) {
      const href = link.href || link.getAttribute('href') || '';
      const match = href.match(/\/channel\/([^/]+)|\/@([^/]+)/);
      return match ? (match[1] || match[2]) : null;
    }
    return null;
  }

  function getChannelHeaderElement() {
    const selectors = [
      '#channel-header',
      'ytd-channel-header-renderer',
      '#page-header',
      'yt-page-header-renderer'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  async function restoreChannelBranding() {
    const channelId = getChannelId();
    if (!channelId) return;

    const header = getChannelHeaderElement();
    if (!header || PROCESSED.has(header)) return;

    const cacheKey = `channel:${channelId}`;
    let channelDetails = cache.get(cacheKey);

    if (!channelDetails) {
      channelDetails = await api.getChannelDetails(channelId);
      cache.set(cacheKey, channelDetails);
    }

    if (!channelDetails) return;

    PROCESSED.add(header);
  }

  const debouncedProcess = dom.debounce(restoreChannelBranding, 200);

  if (document.body) {
    dom.createObserver(debouncedProcess);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      dom.createObserver(debouncedProcess);
    });
  }

  restoreChannelBranding();
  window.addEventListener('yt-navigate-finish', debouncedProcess);
  window.addEventListener('yt-page-data-updated', debouncedProcess);
})();
