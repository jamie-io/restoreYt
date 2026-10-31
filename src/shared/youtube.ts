/**
 * YouTube URL and text knowledge that both worlds share. Pure functions only.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const THUMB_HOSTS = new Set(['i.ytimg.com', 'i9.ytimg.com', 'img.youtube.com']);

export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value);
}

/**
 * Extract a video ID from any YouTube link or thumbnail URL.
 * Relative hrefs resolve against youtube.com.
 */
export function videoIdFromUrl(href: string | null | undefined): string | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, 'https://www.youtube.com');
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  let candidate: string | null | undefined = null;

  if (THUMB_HOSTS.has(url.hostname)) {
    // /vi/ID/x.jpg, /vi_webp/ID/x.webp, /vi_lc/ID/x_de.jpg, /an_webp/ID/...
    if (parts.length >= 2 && /^(vi|vi_webp|vi_lc|vi_webp_lc|an|an_webp)$/.test(parts[0] ?? '')) candidate = parts[1];
  } else if (host === 'youtu.be') {
    candidate = parts[0];
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (parts[0] === 'watch') candidate = url.searchParams.get('v');
    else if (parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live' || parts[0] === 'v') candidate = parts[1];
  }
  return isVideoId(candidate) ? candidate : null;
}

/** Video ID from a lockup class list such as `content-id-_c2e1NcI3Sc`. */
export function videoIdFromContentClass(className: string | null | undefined): string | null {
  if (!className) return null;
  const match = /(?:^|\s)content-id-([A-Za-z0-9_-]+)(?:\s|$)/.exec(className);
  const id = match?.[1];
  return isVideoId(id) ? id : null;
}

export type ThumbnailKind = 'localized' | 'variant';

export interface ThumbnailMatch {
  videoId: string;
  kind: ThumbnailKind;
  /** Bare URL of the creator's original asset in the same size tier. */
  original: string;
}

const LOCALIZED_THUMB = /^https:\/\/i\.ytimg\.com\/vi_lc\/([A-Za-z0-9_-]{11})\/([a-z0-9]+(?:_live)?)_[A-Za-z-]+\.(?:jpg|webp)(?:[?#].*)?$/;
const VARIANT_THUMB = /^https:\/\/i\.ytimg\.com\/(vi|vi_webp)\/([A-Za-z0-9_-]{11})\/([a-z0-9]+)_custom_[0-9]+\.(jpg|webp)(?:[?#].*)?$/;

/**
 * Recognize thumbnails YouTube swapped for this viewer: per-language uploads
 * (`/vi_lc/ID/hq720_de.jpg`) and test-and-compare variants (`hq720_custom_2.jpg`).
 * Mirrors the redirect rules in `rules/thumbnails.json`.
 */
export function matchSwappedThumbnail(src: string | null | undefined): ThumbnailMatch | null {
  if (!src) return null;
  const localized = LOCALIZED_THUMB.exec(src);
  if (localized) {
    const [, videoId, tier] = localized;
    if (!videoId || !tier) return null;
    return { videoId, kind: 'localized', original: `https://i.ytimg.com/vi/${videoId}/${tier}.jpg` };
  }
  const variant = VARIANT_THUMB.exec(src);
  if (variant) {
    const [, dir, videoId, tier, ext] = variant;
    if (!dir || !videoId || !tier || !ext) return null;
    return { videoId, kind: 'variant', original: `https://i.ytimg.com/${dir}/${videoId}/${tier}.${ext}` };
  }
  return null;
}

/** Collapse whitespace and normalize Unicode so DOM text and API text compare equal. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeText(a) === normalizeText(b);
}

function words(value: string): Set<string> {
  const stripped = value.replace(/https?:\/\/\S+/g, ' ').toLowerCase();
  const tokens = stripped.match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  return new Set(tokens);
}

/**
 * Share of the words in `sample` that also occur in `source` (URLs and tokens
 * under three characters ignored). A translation shares almost no words with
 * its source; untranslated text YouTube merely reformatted or truncated stays
 * close to 1.
 */
export function textContainment(sample: string, source: string): number {
  const sampleWords = words(sample);
  if (sampleWords.size === 0) return 1;
  const sourceWords = words(source);
  let shared = 0;
  for (const token of sampleWords) if (sourceWords.has(token)) shared += 1;
  return shared / sampleWords.size;
}
