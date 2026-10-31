/**
 * Accessors for YouTube's HTML5 player element. Every call is guarded: the
 * player API is undocumented, and a throwing accessor must never break the page.
 */

import type { PlayerSurface, VideoInfo } from '../shared/messages.js';
import { isVideoId } from '../shared/youtube.js';

export interface YtPlayer extends HTMLElement {
  getPlayerResponse?: () => unknown;
  getVideoData?: () => unknown;
  getAvailableAudioTracks?: () => unknown;
  getAudioTrack?: () => unknown;
  setAudioTrack?: (track: unknown) => unknown;
  getOption?: (module: string, option: string) => unknown;
  setOption?: (module: string, option: string, value: unknown) => unknown;
  seekTo?: (seconds: number, allowSeekAhead?: boolean) => void;
  playVideo?: () => void;
}

export function call<T>(player: YtPlayer, method: keyof YtPlayer, ...args: unknown[]): T | null {
  const fn = player[method];
  if (typeof fn !== 'function') return null;
  try {
    return ((fn as (...values: unknown[]) => unknown).apply(player, args) ?? null) as T | null;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function findPlayers(doc: Document): Array<{ surface: PlayerSurface; player: YtPlayer }> {
  const found: Array<{ surface: PlayerSurface; player: YtPlayer }> = [];
  const embed = doc.location?.pathname.startsWith('/embed/') ?? false;
  const main = doc.getElementById('movie_player');
  if (main) found.push({ surface: embed ? 'embed' : 'watch', player: main as YtPlayer });
  const shorts = doc.getElementById('shorts-player');
  if (shorts) found.push({ surface: 'shorts', player: shorts as YtPlayer });
  return found;
}

export function readVideoInfo(player: YtPlayer, surface: PlayerSurface): VideoInfo | null {
  const response = asRecord(call(player, 'getPlayerResponse'));
  const details = asRecord(response?.videoDetails);
  const videoId = details?.videoId;
  const title = details?.title;
  if (!isVideoId(videoId) || typeof title !== 'string' || title.length === 0) return null;
  const data = asRecord(call(player, 'getVideoData'));
  const displayedTitle = data?.video_id === videoId && typeof data.title === 'string' ? data.title : null;
  return {
    surface,
    videoId,
    title,
    description: typeof details?.shortDescription === 'string' ? details.shortDescription : null,
    displayedTitle,
    author: typeof details?.author === 'string' ? details.author : null,
  };
}

export function currentAudioTrack(player: YtPlayer): unknown {
  return call(player, 'getAudioTrack');
}

export function audioTracks(player: YtPlayer): unknown[] {
  const tracks = call<unknown>(player, 'getAvailableAudioTracks');
  return Array.isArray(tracks) ? tracks : [];
}

export interface CaptionTrack {
  languageCode?: string;
  displayName?: string;
  kind?: string;
  translationLanguage?: unknown;
}

export function captionTrack(player: YtPlayer): CaptionTrack | null {
  const track = asRecord(call(player, 'getOption', 'captions', 'track'));
  if (!track || typeof track.languageCode !== 'string' || track.languageCode.length === 0) return null;
  return track as CaptionTrack;
}

/** Initial subtitle decision YouTube made for the active audio track. */
export function captionsInitialState(player: YtPlayer): string | null {
  const track = asRecord(currentAudioTrack(player));
  const state = track?.captionsInitialState;
  if (typeof state === 'string') return state;
  const response = asRecord(call(player, 'getPlayerResponse'));
  const renderer = asRecord(asRecord(response?.captions)?.playerCaptionsTracklistRenderer);
  const first = Array.isArray(renderer?.audioTracks) ? asRecord(renderer.audioTracks[0]) : null;
  return typeof first?.captionsInitialState === 'string' ? first.captionsInitialState : null;
}
