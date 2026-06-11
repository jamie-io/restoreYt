/**
 * DOM manipulation utilities for Deslopify.
 * Provides safe DOM operations, event handling, and element detection.
 */
const DeslopifyDOM = (() => {
  /**
   * Check if an element is visible on screen
   * @param {Element} element - DOM element to check
   * @param {boolean} checkViewport - Whether to check if element is in viewport
   * @returns {boolean} True if element is visible
   */
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

  /**
   * Create a debounced function to limit execution frequency
   * @param {Function} fn - Function to debounce
   * @param {number} waitMs - Debounce delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(fn, waitMs = 90) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), waitMs);
    };
  }

  /**
   * Create a MutationObserver with debounced callback
   * @param {Function} callback - Observer callback function
   * @param {Object} options - Observer options
   * @returns {MutationObserver} Observer instance
   */
  function createObserver(callback, options = {}) {
    const defaultOptions = {
      childList: true,
      subtree: true
    };
    const observer = new MutationObserver(debounce(callback, 50));
    observer.observe(document.body || document.documentElement, { ...defaultOptions, ...options });
    return observer;
  }

  /**
   * Extract video ID from a DOM element
   * @param {Element} element - DOM element to search
   * @returns {string|null} Video ID or null if not found
   */
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

  /**
   * Replace text content of an element
   * @param {Element} element - DOM element
   * @param {string} text - New text content
   */
  function replaceTextOnly(element, text) {
    if (!element) return;
    const textNodes = Array.from(element.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
    if (textNodes.length === 0) {
      if (element.childNodes.length === 0) {
        element.textContent = text;
      }
      return;
    }
    textNodes[0].textContent = text;
    for (let i = 1; i < textNodes.length; i++) {
      textNodes[i].textContent = '';
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
