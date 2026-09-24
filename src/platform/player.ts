import { isRecord } from './guards.js';

function readPlayerValue(player: unknown, accessor: string): unknown | null {
  if (!isRecord(player) || typeof player[accessor] !== 'function') return null;
  try {
    return (player[accessor] as () => unknown).call(player) ?? null;
  } catch {
    return null;
  }
}

export function getPlayerResponse(player: unknown): unknown | null {
  return readPlayerValue(player, 'getPlayerResponse');
}

export function getChapterMarkers(player: unknown): unknown[] | null {
  const markers = readPlayerValue(player, 'getChapterMarkers');
  return Array.isArray(markers) ? markers : null;
}

export function getAvailableAudioTracks(player: unknown): unknown[] | null {
  const tracks = readPlayerValue(player, 'getAvailableAudioTracks');
  return Array.isArray(tracks) ? tracks : null;
}

export function getCurrentAudioTrack(player: unknown): unknown | null {
  return readPlayerValue(player, 'getCurrentAudioTrack');
}
