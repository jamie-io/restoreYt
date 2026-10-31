/**
 * Audio track classification. YouTube encodes track metadata in the track id:
 * `251;<base64url protobuf>` where the protobuf is a list of key/value tags such
 * as `acont=original|dubbed|descriptive` and `lang=en`. Display names are
 * localized and `isDefault` follows the viewer's language, so neither is used
 * to find the original.
 */

export interface TrackInfo {
  original: boolean | null;
  lang: string | null;
  name: string | null;
  autoDubbed: boolean | null;
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

function readVarint(bytes: Uint8Array, start: number): [value: number, next: number] | null {
  let result = 0;
  let shift = 0;
  let position = start;
  while (position < bytes.length && shift < 35) {
    const byte = bytes[position] ?? 0;
    result |= (byte & 0x7f) << shift;
    position += 1;
    if ((byte & 0x80) === 0) return [result >>> 0, position];
    shift += 7;
  }
  return null;
}

interface Field { number: number; bytes: Uint8Array }

/** Parse length-delimited protobuf fields; other wire types are skipped. */
function parseFields(bytes: Uint8Array): Field[] | null {
  const fields: Field[] = [];
  let position = 0;
  while (position < bytes.length) {
    const key = readVarint(bytes, position);
    if (!key) return null;
    const [tag, afterKey] = key;
    const wireType = tag & 0x7;
    const number = tag >>> 3;
    position = afterKey;
    if (wireType === 2) {
      const length = readVarint(bytes, position);
      if (!length) return null;
      const [size, afterLength] = length;
      if (afterLength + size > bytes.length) return null;
      fields.push({ number, bytes: bytes.subarray(afterLength, afterLength + size) });
      position = afterLength + size;
    } else if (wireType === 0) {
      const skipped = readVarint(bytes, position);
      if (!skipped) return null;
      position = skipped[1];
    } else if (wireType === 1) {
      position += 8;
    } else if (wireType === 5) {
      position += 4;
    } else {
      return null;
    }
  }
  return fields;
}

const decoder = new TextDecoder();

/** Decode `acont`, `lang` and other tags from a player audio track id. */
export function decodeTrackTags(trackId: unknown): Map<string, string> {
  const tags = new Map<string, string>();
  if (typeof trackId !== 'string') return tags;
  const encoded = trackId.split(';')[1];
  if (!encoded) return tags;
  const bytes = base64UrlToBytes(encoded);
  if (!bytes) return tags;
  const entries = parseFields(bytes);
  if (!entries) return tags;
  for (const entry of entries) {
    if (entry.number !== 1) continue;
    const pair = parseFields(entry.bytes);
    const key = pair?.find(field => field.number === 1);
    const value = pair?.find(field => field.number === 2);
    if (key && value) tags.set(decoder.decode(key.bytes), decoder.decode(value.bytes));
  }
  return tags;
}

/** Find the obfuscated info object (`{ name, id, isDefault, isAutoDubbed }`) on a track. */
function infoObject(track: Record<string, unknown>): Record<string, unknown> | null {
  for (const value of Object.values(track)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && 'isAutoDubbed' in value) {
      return value as Record<string, unknown>;
    }
  }
  return null;
}

export function classifyTrack(track: unknown): TrackInfo {
  if (!track || typeof track !== 'object') return { original: null, lang: null, name: null, autoDubbed: null };
  const record = track as Record<string, unknown>;
  const tags = decodeTrackTags(record.id);
  const info = infoObject(record);
  const acont = tags.get('acont');
  const infoId = typeof info?.id === 'string' ? info.id : null;
  let original: boolean | null = null;
  if (acont) original = acont === 'original';
  // Fallback seen on current builds: original tracks use the `.4` format suffix, dubs `.3`.
  else if (infoId && /\.\d+$/.test(infoId)) original = infoId.endsWith('.4');
  return {
    original,
    lang: tags.get('lang') ?? (infoId ? infoId.split('.')[0] ?? null : null),
    name: typeof info?.name === 'string' ? info.name : null,
    autoDubbed: typeof info?.isAutoDubbed === 'boolean' ? info.isAutoDubbed : null,
  };
}

export function findOriginalTrack(tracks: unknown): unknown | null {
  if (!Array.isArray(tracks)) return null;
  const originals = tracks.filter(track => classifyTrack(track).original === true);
  return originals.length === 1 ? originals[0] : originals[0] ?? null;
}

export function trackLabel(track: unknown): string {
  const info = classifyTrack(track);
  return info.name ?? info.lang ?? 'unknown';
}
