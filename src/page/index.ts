/**
 * Page-world (MAIN) script. Owns everything that needs YouTube's own player
 * object: reading the creator's metadata from the player response, switching to
 * the original audio track, and undoing subtitles YouTube switched on by itself.
 * Talks to the isolated content script through DOM CustomEvents.
 */

import {
  BRIDGE_TO_CONTENT,
  BRIDGE_TO_PAGE,
  decodeBridge,
  encodeBridge,
  type ContentToPage,
  type PageToContent,
  type PlayerSurface,
} from '../shared/messages.js';
import type { Settings } from '../shared/settings.js';
import { classifyTrack, findOriginalTrack, trackLabel } from './audio.js';
import { lookupPlayerTitle } from './innertube.js';
import {
  audioTracks,
  call,
  captionTrack,
  captionsInitialState,
  currentAudioTrack,
  findPlayers,
  readVideoInfo,
  type YtPlayer,
} from './player.js';

const AUTO_CAPTIONS = 'CAPTIONS_INITIAL_STATE_ON_RECOMMENDED';
const MAX_ATTEMPTS = 12;

interface LoadState {
  videoId: string;
  fingerprint: string;
  audioAttempts: number;
  audioSwitches: number;
  audioFrom: string | null;
  audioDone: boolean;
  captionAttempts: number;
  captionsDone: boolean;
}

const MAX_SWITCHES = 3;

function send(message: PageToContent): void {
  document.dispatchEvent(new CustomEvent(BRIDGE_TO_CONTENT, { detail: encodeBridge(message) }));
}

function sameTrack(a: unknown, b: unknown): boolean {
  const left = (a as { id?: unknown } | null)?.id;
  return typeof left === 'string' && left === (b as { id?: unknown } | null)?.id;
}

function isAdShowing(player: YtPlayer): boolean {
  return player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
}

function start(): void {
  let settings: Settings | null = null;
  const loads = new Map<PlayerSurface, LoadState>();

  /**
   * Switch to the original track once per video load. The switch is confirmed on
   * a later tick before it is reported; after that the user's own choice wins.
   */
  function fixAudio(player: YtPlayer, state: LoadState): void {
    if (state.audioDone) return;
    state.audioAttempts += 1;
    const tracks = audioTracks(player);
    const original = tracks.length >= 2 ? findOriginalTrack(tracks) : null;
    if (!original) {
      // Single-language video, no tagged original, or the track list is not loaded yet.
      if (state.audioAttempts >= MAX_ATTEMPTS) state.audioDone = true;
      return;
    }
    const current = currentAudioTrack(player);
    if (classifyTrack(current).original === true || sameTrack(current, original)) {
      state.audioDone = true;
      if (state.audioFrom !== null) {
        send({ type: 'audio', change: { videoId: state.videoId, from: state.audioFrom, to: trackLabel(current) } });
      }
      return;
    }
    if (state.audioSwitches >= MAX_SWITCHES) {
      state.audioDone = true;
      return;
    }
    state.audioSwitches += 1;
    state.audioFrom ??= trackLabel(current);
    call(player, 'setAudioTrack', original);
  }

  function fixCaptions(player: YtPlayer, state: LoadState): void {
    if (state.captionsDone) return;
    // Let the audio decision settle first; YouTube re-evaluates subtitles on track change.
    if (settings?.audio && !state.audioDone && audioTracks(player).length >= 2) return;
    state.captionAttempts += 1;
    if (captionsInitialState(player) !== AUTO_CAPTIONS) {
      if (state.captionAttempts >= 3) state.captionsDone = true;
      return;
    }
    const track = captionTrack(player);
    if (!track) {
      if (state.captionAttempts >= 4) state.captionsDone = true;
      return;
    }
    call(player, 'setOption', 'captions', 'track', {});
    if (captionTrack(player)) {
      const button = player.querySelector<HTMLButtonElement>('.ytp-subtitles-button[aria-pressed="true"]');
      button?.click();
    }
    state.captionsDone = true;
    send({ type: 'captions', change: { videoId: state.videoId, track: track.displayName ?? track.languageCode ?? '' } });
  }

  function tick(): void {
    for (const { surface, player } of findPlayers(document)) {
      const info = readVideoInfo(player, surface);
      if (!info) continue;
      let state = loads.get(surface);
      if (!state || state.videoId !== info.videoId) {
        state = {
          videoId: info.videoId,
          fingerprint: '',
          audioAttempts: 0,
          audioSwitches: 0,
          audioFrom: null,
          audioDone: false,
          captionAttempts: 0,
          captionsDone: false,
        };
        loads.set(surface, state);
      }
      const fingerprint = `${info.displayedTitle ?? ''}\u0000${info.title}\u0000${info.description?.length ?? -1}`;
      if (state.fingerprint !== fingerprint) {
        state.fingerprint = fingerprint;
        send({ type: 'video', video: info });
      }
      if (!settings?.enabled || isAdShowing(player)) continue;
      if (settings.audio) fixAudio(player, state);
      if (settings.captions) fixCaptions(player, state);
    }
  }

  document.addEventListener(BRIDGE_TO_PAGE, event => {
    const message = decodeBridge<ContentToPage>((event as CustomEvent<unknown>).detail);
    if (!message) return;
    if (message.type === 'settings') {
      const first = settings === null;
      settings = message.settings;
      if (first) {
        // The content script may have started after our first hello: greet again
        // and resend what is already known.
        send({ type: 'hello' });
        for (const state of loads.values()) state.fingerprint = '';
      }
      tick();
    } else if (message.type === 'lookup') {
      const { requestId, videoId } = message;
      void lookupPlayerTitle(videoId).then(result => send({ type: 'lookup-result', requestId, videoId, ...result }));
    } else if (message.type === 'seek') {
      const player = document.getElementById('movie_player') as YtPlayer | null;
      if (player && Number.isFinite(message.seconds) && message.seconds >= 0) {
        call(player, 'seekTo', message.seconds, true);
        call(player, 'playVideo');
      }
    }
  });

  for (const name of ['yt-navigate-finish', 'yt-page-data-updated', 'yt-player-updated', 'loadeddata', 'playing']) {
    document.addEventListener(name, tick, true);
  }
  window.setInterval(tick, 1000);
  send({ type: 'hello' });
}

const flag = '__restoreytPageWorld';
const root = window as unknown as Record<string, unknown>;
if (!root[flag]) {
  root[flag] = true;
  start();
}
