/**
 * What restoreyt changed on the current page, for the popup and the toolbar
 * badge, plus lifetime counters for the options page.
 */

import type {
  AudioChange,
  CaptionsChange,
  PageReport,
  PageType,
  RestoreEntry,
} from '../shared/messages.js';
import type { LookupStats } from './title-service.js';

const MAX_RECENT = 40;
export const LIFETIME_KEY = 'stats';

export interface LifetimeStats {
  titles: number;
  descriptions: number;
  thumbnails: number;
  audio: number;
  captions: number;
  since: number;
}

type Counter = Exclude<keyof LifetimeStats, 'since'>;

export function pageTypeFor(href: string): PageType {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return 'other';
  }
  const path = url.pathname;
  if (path === '/' || path === '') return 'home';
  if (path === '/watch') return 'watch';
  if (path.startsWith('/shorts/')) return 'shorts';
  if (path === '/results') return 'search';
  if (path.startsWith('/feed/subscriptions')) return 'subscriptions';
  if (path === '/playlist') return 'playlist';
  if (path.startsWith('/embed/')) return 'embed';
  if (/^\/(@|channel\/|c\/|user\/)/.test(path)) return 'channel';
  return 'other';
}

/** Key that changes when YouTube's SPA moves to another page. */
export function pageKey(href: string): string {
  try {
    const url = new URL(href);
    const v = url.searchParams.get('v');
    return `${url.pathname}${v ? `?v=${v}` : ''}${url.pathname === '/results' ? url.search : ''}`;
  } catch {
    return href;
  }
}

function emptyReport(url: string): PageReport {
  return {
    url,
    pageType: pageTypeFor(url),
    counts: { titles: 0, thumbnails: 0, descriptions: 0, audio: 0, captions: 0, aiHidden: 0 },
    recent: [],
    lookups: { pending: 0, failed: 0, blocked: false },
  };
}

export interface ReporterSinks {
  /** Toolbar badge total for this tab. */
  badge(count: number): void;
  /** Add to lifetime counters. */
  lifetime(delta: Partial<Record<Counter, number>>): void;
}

export class PageReporter {
  private report: PageReport;
  private readonly seen = {
    title: new Set<string>(),
    description: new Set<string>(),
    audio: new Set<string>(),
    captions: new Set<string>(),
    thumbnails: new Set<string>(),
  };
  private pendingLifetime: Partial<Record<Counter, number>> = {};
  private badgeTimer: ReturnType<typeof setTimeout> | null = null;
  private lifetimeTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBadge = -1;

  constructor(url: string, private readonly sinks: ReporterSinks, private readonly now: () => number = Date.now) {
    this.report = emptyReport(url);
  }

  reset(url: string): void {
    this.report = emptyReport(url);
    for (const set of Object.values(this.seen)) set.clear();
    this.changed();
  }

  title(videoId: string, original: string, replaced: string): void {
    if (this.seen.title.has(videoId)) return;
    this.seen.title.add(videoId);
    this.report.counts.titles += 1;
    this.add({ kind: 'title', videoId, original, replaced, at: this.now() }, 'titles');
  }

  description(videoId: string, original: string, replaced: string): void {
    if (this.seen.description.has(videoId)) return;
    this.seen.description.add(videoId);
    this.report.counts.descriptions += 1;
    this.add({ kind: 'description', videoId, original, replaced, at: this.now() }, 'descriptions');
  }

  audio(change: AudioChange): void {
    if (this.seen.audio.has(change.videoId)) return;
    this.seen.audio.add(change.videoId);
    this.report.counts.audio += 1;
    this.add({ kind: 'audio', videoId: change.videoId, original: change.to, replaced: change.from, at: this.now() }, 'audio');
  }

  captions(change: CaptionsChange): void {
    if (this.seen.captions.has(change.videoId)) return;
    this.seen.captions.add(change.videoId);
    this.report.counts.captions += 1;
    this.add({ kind: 'captions', videoId: change.videoId, original: 'Off', replaced: change.track, at: this.now() }, 'captions');
  }

  thumbnails(videoIds: Set<string>): void {
    let added = 0;
    for (const id of videoIds) {
      if (!this.seen.thumbnails.has(id)) {
        this.seen.thumbnails.add(id);
        added += 1;
      }
    }
    if (added === 0) return;
    this.report.counts.thumbnails = this.seen.thumbnails.size;
    this.bump('thumbnails', added);
    this.changed();
  }

  aiHidden(count: number): void {
    if (this.report.counts.aiHidden === count) return;
    this.report.counts.aiHidden = count;
    this.changed();
  }

  lookups(stats: LookupStats): void {
    this.report.lookups = stats;
  }

  /** Write pending lifetime counters now (tab closing or hidden). */
  flush(): void {
    if (this.lifetimeTimer !== null) {
      clearTimeout(this.lifetimeTimer);
      this.lifetimeTimer = null;
    }
    const delta = this.pendingLifetime;
    this.pendingLifetime = {};
    if (Object.keys(delta).length > 0) this.sinks.lifetime(delta);
  }

  snapshot(): PageReport {
    return structuredClone(this.report);
  }

  total(): number {
    const { titles, thumbnails, descriptions, audio, captions, aiHidden } = this.report.counts;
    return titles + thumbnails + descriptions + audio + captions + aiHidden;
  }

  private add(entry: RestoreEntry, counter: Counter): void {
    this.report.recent.unshift(entry);
    if (this.report.recent.length > MAX_RECENT) this.report.recent.length = MAX_RECENT;
    this.bump(counter, 1);
    this.changed();
  }

  private bump(counter: Counter, amount: number): void {
    this.pendingLifetime[counter] = (this.pendingLifetime[counter] ?? 0) + amount;
    this.lifetimeTimer ??= setTimeout(() => this.flush(), 5000);
  }

  private changed(): void {
    this.badgeTimer ??= setTimeout(() => {
      this.badgeTimer = null;
      const total = this.total();
      if (total === this.lastBadge) return;
      this.lastBadge = total;
      this.sinks.badge(total);
    }, 400);
  }
}
