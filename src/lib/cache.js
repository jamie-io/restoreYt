const SessionLRUCache = (() => {
  const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
  const NAMESPACE = 'deslopify:cache:';

  let maxBytes = DEFAULT_MAX_BYTES;

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

  function eachEntry(cb) {
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(NAMESPACE)) {
        const v = sessionStorage.getItem(k);
        cb({ k, v });
      }
    }
  }

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

  function set(key, value) {
    const entryKey = NAMESPACE + key;
    const entry = { v: value, t: Date.now() };
    sessionStorage.setItem(entryKey, JSON.stringify(entry));
    evictIfNeeded();
  }

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

  function del(key) {
    sessionStorage.removeItem(NAMESPACE + key);
  }

  function clear() {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(NAMESPACE)) keys.push(k);
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  }

  function size() {
    let n = 0;
    eachEntry(() => { n++; });
    return n;
  }

  return { set, get, delete: del, clear, size, bytes };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SessionLRUCache;
} else {
  window.DeslopifyCache = SessionLRUCache;
}
