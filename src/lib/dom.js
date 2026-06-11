const DeslopifyDOM = (() => {
  function isVisible(element, checkViewport = true) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || parseFloat(style.opacity) === 0) {
      return false;
    }

    let parent = element.parentElement;
    let depth = 0;
    while (parent && depth < 25) {
      const parentStyle = getComputedStyle(parent);
      if (parentStyle.display === 'none' || parentStyle.visibility === 'hidden' || parentStyle.visibility === 'collapse' || parseFloat(parentStyle.opacity) === 0) {
        return false;
      }
      parent = parent.parentElement;
      depth++;
    }

    if (checkViewport) {
      const rect = element.getBoundingClientRect();
      const margin = window.innerHeight * 0.25;
      const top = -margin;
      const bottom = window.innerHeight + margin;
      const left = -margin;
      const right = window.innerWidth + margin;
      return rect.top <= bottom && rect.bottom >= top && rect.left <= right && rect.right >= left;
    }

    return true;
  }

  function debounce(fn, waitMs = 90) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), waitMs);
    };
  }

  function createObserver(callback, options = {}) {
    const defaultOptions = {
      childList: true,
      subtree: true
    };
    const observer = new MutationObserver(debounce(callback, 50));
    observer.observe(document.body || document.documentElement, { ...defaultOptions, ...options });
    return observer;
  }

  function extractVideoIdFromElement(element) {
    if (!element) return null;

    const link = element.closest('a[href]');
    if (link) {
      return window.DeslopifyAPI?.extractVideoId(link.href);
    }

    const img = element.querySelector('img');
    if (img?.src) {
      return window.DeslopifyAPI?.extractVideoId(img.src);
    }

    return null;
  }

  function replaceTextOnly(element, text) {
    if (!element) return;
    for (const node of Array.from(element.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = text;
        break;
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.DeslopifyDOM = { isVisible, debounce, createObserver, extractVideoIdFromElement, replaceTextOnly };
  }

  return { isVisible, debounce, createObserver, extractVideoIdFromElement, replaceTextOnly };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeslopifyDOM;
}
