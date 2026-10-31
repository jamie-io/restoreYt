/**
 * Message contracts between extension contexts.
 *
 * runtime messages: popup -> content (report), content -> background (badge).
 * bridge messages: isolated content world <-> page (MAIN) world, sent as JSON
 * strings in CustomEvent.detail so they cross world boundaries in every browser.
 */

import type { Settings } from './settings.js';

export type RestoreKind = 'title' | 'description' | 'audio' | 'captions';

export interface RestoreEntry {
  kind: RestoreKind;
  videoId: string | null;
  /** What the creator uploaded. */
  original: string;
  /** What YouTube showed instead. */
  replaced: string;
  at: number;
}

export type PageType = 'watch' | 'shorts' | 'home' | 'search' | 'channel' | 'subscriptions' | 'playlist' | 'embed' | 'other';

export interface PageReport {
  url: string;
  pageType: PageType;
  counts: {
    titles: number;
    thumbnails: number;
    descriptions: number;
    audio: number;
    captions: number;
    aiHidden: number;
  };
  recent: RestoreEntry[];
  lookups: {
    pending: number;
    failed: number;
    blocked: boolean;
  };
}

export const MESSAGE = {
  getReport: 'restoreyt:get-report',
  badge: 'restoreyt:badge',
  stats: 'restoreyt:stats',
} as const;

export type StatsCounter = 'titles' | 'descriptions' | 'thumbnails' | 'audio' | 'captions';

export interface GetReportMessage { type: typeof MESSAGE.getReport }
export interface BadgeMessage { type: typeof MESSAGE.badge; count: number }
export interface StatsMessage { type: typeof MESSAGE.stats; delta: Partial<Record<StatsCounter, number>> }
export type RuntimeMessage = GetReportMessage | BadgeMessage | StatsMessage;

/* ---------- bridge ---------- */

export const BRIDGE_TO_PAGE = 'restoreyt:to-page';
export const BRIDGE_TO_CONTENT = 'restoreyt:to-content';

export type PlayerSurface = 'watch' | 'shorts' | 'embed';

export interface VideoInfo {
  surface: PlayerSurface;
  videoId: string;
  /** Creator's title from the player response. */
  title: string;
  /** Creator's description from the player response. */
  description: string | null;
  /** Title the player itself displays (may be translated). */
  displayedTitle: string | null;
  author: string | null;
}

export interface AudioChange {
  videoId: string;
  from: string;
  to: string;
}

export interface CaptionsChange {
  videoId: string;
  track: string;
}

export type PageToContent =
  | { type: 'hello' }
  | { type: 'video'; video: VideoInfo }
  | { type: 'audio'; change: AudioChange }
  | { type: 'captions'; change: CaptionsChange }
  | { type: 'lookup-result'; requestId: number; videoId: string; title: string | null; status: 'ok' | 'missing' | 'error' };

export type ContentToPage =
  | { type: 'settings'; settings: Settings }
  | { type: 'lookup'; requestId: number; videoId: string }
  | { type: 'seek'; seconds: number };

const MAX_TITLE = 1000;
const MAX_DESCRIPTION = 20000;

/** Shape check for video data coming from the page world. */
export function isVideoInfo(value: unknown): value is VideoInfo {
  if (!value || typeof value !== 'object') return false;
  const info = value as Record<string, unknown>;
  const optionalString = (field: unknown, max: number): boolean => field === null || (typeof field === 'string' && field.length <= max);
  return (info.surface === 'watch' || info.surface === 'shorts' || info.surface === 'embed')
    && typeof info.videoId === 'string' && /^[A-Za-z0-9_-]{11}$/.test(info.videoId)
    && typeof info.title === 'string' && info.title.length > 0 && info.title.length <= MAX_TITLE
    && optionalString(info.description, MAX_DESCRIPTION)
    && optionalString(info.displayedTitle, MAX_TITLE)
    && optionalString(info.author, MAX_TITLE);
}

export function encodeBridge(message: PageToContent | ContentToPage): string {
  return JSON.stringify(message);
}

export function decodeBridge<T extends { type: string }>(detail: unknown): T | null {
  if (typeof detail !== 'string' || detail.length > 1_000_000) return null;
  try {
    const value: unknown = JSON.parse(detail);
    if (value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string') return value as T;
  } catch {
    return null;
  }
  return null;
}
