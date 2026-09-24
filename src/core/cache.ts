export interface LruCacheOptions {
  capacity?: number;
  ttlMs?: number;
  negativeTtlMs?: number;
  now?: () => number;
}

interface CacheEntry<Value> {
  value: Value;
  expiresAt: number;
}

export interface LruCache<Value> {
  get(key: string): Value | undefined;
  set(key: string, value: Value): void;
  delete(key: string): boolean;
  clear(): void;
  readonly size: number;
}

export function createLruCache<Value>(options: LruCacheOptions = {}): LruCache<Value> {
  const capacity = options.capacity ?? 128;
  const ttlMs = options.ttlMs ?? 5 * 60_000;
  const negativeTtlMs = options.negativeTtlMs ?? 15_000;
  const now = options.now ?? Date.now;
  if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError('capacity must be a positive integer');

  const entries = new Map<string, CacheEntry<Value>>();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },
    set(key, value) {
      const ttl = value === null ? negativeTtlMs : ttlMs;
      entries.delete(key);
      entries.set(key, { value, expiresAt: now() + ttl });
      while (entries.size > capacity) {
        const oldestKey = entries.keys().next().value;
        if (oldestKey === undefined) break;
        entries.delete(oldestKey);
      }
    },
    delete(key) {
      return entries.delete(key);
    },
    clear() {
      entries.clear();
    },
    get size() {
      return entries.size;
    },
  };
}
