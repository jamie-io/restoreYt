/**
 * Session-based LRU cache for Deslopify.
 * Uses sessionStorage with size limit and automatic eviction.
 */
const SessionLRUCache = (() => {
  /**
   * Maximum cache size in bytes (5MB)
   * @type {number}
   */
  const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

  /**
   * Namespace prefix for cache keys in sessionStorage
   * @type {string}
   */
  const NAMESPACE = 'deslopify:cache:';

  /**
   * Current maximum cache size in bytes
   * @type {number}
   */
  let maxBytes = DEFAULT_MAX_BYTES;

  /**
   * Calculate total size of all cached entries in bytes
   * @returns {number} Total size in bytes
   */
  function bytes() {
    let total = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(NAMESPACE)) {
        const v = sessionStorage.getItem(k);
        total += (k.length + (v ? v.length : 0)) * 2;
      }
    }
    return total;
  }

  /**
   * Iterate through all cache entries
   * @param {Function} cb - Callback function called for each entry
   */
  function eachEntry(cb) {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(NAMESPACE)) {
        const v = sessionStorage.getItem(k);
        cb({ k, v });
      }
    }
  }

  /**
   * Remove oldest entries if cache exceeds size limit
   */
  function evictIfNeeded() {
    let usage = bytes();
    if (usage <= maxBytes) return;

    const items = [];
    eachEntry(({ k, v }) => {
      try {
        const entry = JSON.parse(v || '{}');
        items.push({
          k,
          bytes: (k.length + (v ? v.length : 0)) * 2,
          t: entry.t || 0
        });
      } catch {
        items.push({ k, bytes: (k.length + (v ? v.length : 0)) * 2, t: 0 });
      }
    });

    items.sort((a, b) => a.t - b.t);

    for (const item of items) {
      sessionStorage.removeItem(item.k);
      usage -= item.bytes;
      if (usage <= maxBytes) break;
    }
  }

  /**
   * Store a value in the cache
   * @param {string} key - Cache key
   * @param {unknown} value - Value to store
   */
  function set(key, value) {
    const entryKey = NAMESPACE + key;
    const entry = { v: value, t: Date.now() };
    sessionStorage.setItem(entryKey, JSON.stringify(entry));
    evictIfNeeded();
  }

  /**
   * Retrieve a value from the cache
   * @param {string} key - Cache key
   * @returns {unknown|undefined} Cached value or undefined if not found
   */
  function get(key) {
    const entryKey = NAMESPACE + key;
    const raw = sessionStorage.getItem(entryKey);
    if (!raw) return undefined;

    try {
      const entry = JSON.parse(raw);
      entry.t = Date.now();
      sessionStorage.setItem(entryKey, JSON.stringify(entry));
      return entry.v;
    } catch {
      sessionStorage.removeItem(entryKey);
      return undefined;
    }
  }

  /**
   * Delete a value from the cache
   * @param {string} key - Cache key
   */
  function del(key) {
    sessionStorage.removeItem(NAMESPACE + key);
  }

  /**
   * Clear all cached values
   */
  function clear() {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(NAMESPACE)) keys.push(k);
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  }

  /**
   * Get number of items in cache
   * @returns {number} Number of cached items
   */
  function size() {
    let n = 0;
    eachEntry(() => { n++; });
    return n;
  }

  /**
   * Get total size of cache in bytes
   * @returns {number} Size in bytes
   */
  function bytesCount() {
    return bytes();
  }

  return { set, get, delete: del, clear, size, bytes: bytesCount };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionLRUCache;
} else {
  window.DeslopifyCache = SessionLRUCache;
}
