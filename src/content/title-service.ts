/**
 * Resolves the creator's original title for a video.
 *
 * Order: memory -> storage.local -> oEmbed (tiny, cookie-less) -> YouTube's
 * player endpoint through the page world (for videos oEmbed refuses).
 * Entries remember what YouTube displayed at lookup time; when YouTube later
 * shows a different text the entry is revalidated, so creator renames are
 * picked up instead of being overwritten with a stale title.
 */

import { sameText } from '../shared/youtube.js';
import type { BridgeLookupResult } from './bridge.js';
import { MISSING_MAX_AGE_MS, type TitleStore } from './title-store.js';

export interface TitleBridge {
  readonly ready: boolean;
  lookup(videoId: string): Promise<BridgeLookupResult>;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

interface Entry {
  original: string | null;
  seen: string | null;
  at: number;
  /** Network failure, not a definitive answer: retried soon. */
  transient: boolean;
}

type NetworkOutcome =
  | { status: 'ok'; title: string }
  | { status: 'missing' | 'error' | 'blocked' };

export interface LookupStats {
  pending: number;
  failed: number;
  blocked: boolean;
}

/** Window in which a fetched original is trusted without comparing display text. */
export const FRESH_MS = 30 * 60 * 1000;
export const ERROR_RETRY_MS = 2 * 60 * 1000;
const MAX_MEMORY = 5000;
const CONCURRENCY = 6;
const MIN_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 10 * 60 * 1000;

export function oembedUrl(videoId: string): string {
  const watch = `https://www.youtube.com/watch?v=${videoId}`;
  return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watch)}`;
}

export class TitleService {
  private readonly memory = new Map<string, Entry>();
  private readonly displayedAtRequest = new Map<string, string>();
  private readonly storeReads = new Set<string>();
  private readonly queued = new Set<string>();
  private readonly queue: string[] = [];
  private readonly listeners = new Set<(videoId: string) => void>();
  private storeTimer: ReturnType<typeof setTimeout> | null = null;
  private wakeTimer: ReturnType<typeof setTimeout> | null = null;
  private active = 0;
  private blockedUntil = 0;
  private backoffMs = 0;
  private failures = 0;

  constructor(
    private readonly store: TitleStore,
    private readonly bridge: TitleBridge,
    private readonly fetchImpl: FetchLike = (url, init) => fetch(url, init),
    private readonly now: () => number = Date.now,
  ) {}

  onResolved(listener: (videoId: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Record an original known from the page itself (player response). */
  seed(videoId: string, original: string, displayed: string | null = null): void {
    const known = this.memory.get(videoId);
    if (known && known.original === original && !known.transient) return;
    const entry: Entry = { original, seen: displayed, at: this.now(), transient: false };
    this.remember(videoId, entry);
    this.store.write(videoId, { o: original, s: displayed, at: entry.at });
    this.emit(videoId);
  }

  /**
   * Original title to show where YouTube displays `displayed`.
   * `undefined`: unknown or needs revalidation. `null`: YouTube has no original to give.
   */
  peek(videoId: string, displayed: string): string | null | undefined {
    const entry = this.memory.get(videoId);
    if (!entry) return undefined;
    const age = this.now() - entry.at;
    if (entry.original === null) {
      return age < (entry.transient ? ERROR_RETRY_MS : MISSING_MAX_AGE_MS) ? null : undefined;
    }
    if (age < FRESH_MS) return entry.original;
    if (sameText(displayed, entry.original)) return entry.original;
    if (entry.seen !== null && sameText(displayed, entry.seen)) return entry.original;
    return undefined;
  }

  request(videoId: string, displayed: string): void {
    if (this.queued.has(videoId) || this.storeReads.has(videoId)) return;
    // Already answered for this text (including "no original"): nothing to fetch.
    if (this.peek(videoId, displayed) !== undefined) return;
    this.displayedAtRequest.set(videoId, displayed);
    if (this.memory.has(videoId)) {
      this.enqueue(videoId);
      return;
    }
    this.storeReads.add(videoId);
    this.storeTimer ??= setTimeout(() => void this.readStore(), 0);
  }

  stats(): LookupStats {
    return {
      pending: this.queue.length + this.active + this.storeReads.size,
      failed: this.failures,
      blocked: this.now() < this.blockedUntil,
    };
  }

  private remember(videoId: string, entry: Entry): void {
    this.memory.delete(videoId);
    this.memory.set(videoId, entry);
    if (this.memory.size > MAX_MEMORY) {
      const oldest = this.memory.keys().next().value;
      if (oldest !== undefined) this.memory.delete(oldest);
    }
  }

  private emit(videoId: string): void {
    for (const listener of this.listeners) {
      try {
        listener(videoId);
      } catch {
        // ignore listener failures
      }
    }
  }

  private async readStore(): Promise<void> {
    this.storeTimer = null;
    const ids = [...this.storeReads];
    const found = await this.store.read(ids);
    for (const id of ids) {
      this.storeReads.delete(id);
      const stored = found.get(id);
      if (stored && !this.memory.has(id)) {
        this.remember(id, { original: stored.o, seen: stored.s, at: stored.at, transient: false });
      }
      const displayed = this.displayedAtRequest.get(id) ?? '';
      if (this.peek(id, displayed) !== undefined) {
        this.displayedAtRequest.delete(id);
        this.emit(id);
      } else {
        this.enqueue(id);
      }
    }
  }

  private enqueue(videoId: string): void {
    if (this.queued.has(videoId)) return;
    this.queued.add(videoId);
    this.queue.push(videoId);
    this.pump();
  }

  private pump(): void {
    const wait = this.blockedUntil - this.now();
    if (wait > 0) {
      this.wakeTimer ??= setTimeout(() => {
        this.wakeTimer = null;
        this.pump();
      }, wait);
      return;
    }
    while (this.active < CONCURRENCY && this.queue.length > 0) {
      const videoId = this.queue.shift();
      if (videoId === undefined) break;
      this.active += 1;
      void this.run(videoId);
    }
  }

  private async run(videoId: string): Promise<void> {
    try {
      const done = await this.resolveFromNetwork(videoId);
      if (done) this.queued.delete(videoId);
      else this.queue.unshift(videoId);
    } finally {
      this.active -= 1;
      this.pump();
    }
  }

  /** Returns false when the request must be retried after a rate-limit pause. */
  private async resolveFromNetwork(videoId: string): Promise<boolean> {
    const displayed = this.displayedAtRequest.get(videoId) ?? null;
    let outcome = await this.fetchOembed(videoId);
    if (outcome.status === 'blocked') {
      this.backoffMs = Math.min(Math.max(this.backoffMs * 2, MIN_BACKOFF_MS), MAX_BACKOFF_MS);
      this.blockedUntil = this.now() + this.backoffMs;
      return false;
    }
    this.displayedAtRequest.delete(videoId);
    if (outcome.status !== 'ok' && this.bridge.ready) {
      const viaPlayer = await this.bridge.lookup(videoId);
      if (viaPlayer.status === 'ok' && viaPlayer.title) outcome = { status: 'ok', title: viaPlayer.title };
      else if (viaPlayer.status === 'missing' && outcome.status === 'error') outcome = { status: 'missing' };
    }
    const at = this.now();
    if (outcome.status === 'ok') {
      this.backoffMs = 0;
      this.remember(videoId, { original: outcome.title, seen: displayed, at, transient: false });
      this.store.write(videoId, { o: outcome.title, s: displayed, at });
    } else if (outcome.status === 'missing') {
      this.remember(videoId, { original: null, seen: displayed, at, transient: false });
      this.store.write(videoId, { o: null, s: displayed, at });
    } else {
      this.failures += 1;
      this.remember(videoId, { original: null, seen: displayed, at, transient: true });
    }
    this.emit(videoId);
    return true;
  }

  private async fetchOembed(videoId: string): Promise<NetworkOutcome> {
    const init: RequestInit = { credentials: 'omit' };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') init.signal = AbortSignal.timeout(8000);
    let response: Response;
    try {
      response = await this.fetchImpl(oembedUrl(videoId), init);
    } catch {
      return { status: 'error' };
    }
    if (response.status === 429) return { status: 'blocked' };
    if ([400, 401, 403, 404].includes(response.status)) return { status: 'missing' };
    if (!response.ok) return { status: 'error' };
    try {
      const body: unknown = await response.json();
      const title = body && typeof body === 'object' ? (body as { title?: unknown }).title : undefined;
      return typeof title === 'string' && title.length > 0 ? { status: 'ok', title } : { status: 'missing' };
    } catch {
      return { status: 'error' };
    }
  }
}
