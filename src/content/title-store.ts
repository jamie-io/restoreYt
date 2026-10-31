/**
 * Persistent title cache in `storage.local`, one key per video (`t:<id>`), so
 * tabs never overwrite each other's entries. Writes are batched.
 */

export const TITLE_KEY_PREFIX = 't:';
/** Entries older than this are ignored on read and pruned by the background. */
export const TITLE_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
export const MISSING_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface StoredTitle {
  /** Original title, or null when YouTube has none to give (private, removed). */
  o: string | null;
  /** Text YouTube displayed when the original was looked up. */
  s: string | null;
  /** Lookup time (ms since epoch). */
  at: number;
}

export interface StorageAreaLike {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
}

export function isStoredTitle(value: unknown): value is StoredTitle {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (typeof record.o === 'string' || record.o === null)
    && (typeof record.s === 'string' || record.s === null)
    && typeof record.at === 'number' && Number.isFinite(record.at);
}

export function isExpired(entry: StoredTitle, now: number): boolean {
  const age = now - entry.at;
  return age < 0 || age > (entry.o === null ? MISSING_MAX_AGE_MS : TITLE_MAX_AGE_MS);
}

export class TitleStore {
  private readonly buffer = new Map<string, StoredTitle>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly area: StorageAreaLike | null,
    private readonly now: () => number = Date.now,
    private readonly flushDelayMs = 1500,
  ) {}

  async read(videoIds: string[]): Promise<Map<string, StoredTitle>> {
    const result = new Map<string, StoredTitle>();
    if (!this.area || videoIds.length === 0) return result;
    let raw: Record<string, unknown>;
    try {
      raw = await this.area.get(videoIds.map(id => TITLE_KEY_PREFIX + id));
    } catch {
      return result;
    }
    const now = this.now();
    for (const id of videoIds) {
      const value = raw[TITLE_KEY_PREFIX + id];
      if (isStoredTitle(value) && !isExpired(value, now)) result.set(id, value);
    }
    return result;
  }

  write(videoId: string, entry: StoredTitle): void {
    if (!this.area) return;
    this.buffer.set(videoId, entry);
    if (this.timer === null) this.timer = setTimeout(() => void this.flush(), this.flushDelayMs);
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.area || this.buffer.size === 0) return;
    const items: Record<string, StoredTitle> = {};
    for (const [id, entry] of this.buffer) items[TITLE_KEY_PREFIX + id] = entry;
    this.buffer.clear();
    try {
      await this.area.set(items);
    } catch {
      // Quota or invalidated context: the in-memory cache still works.
    }
  }
}
