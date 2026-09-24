export const THUMBNAIL_QUALITIES = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault'] as const;
export type ThumbnailQuality = typeof THUMBNAIL_QUALITIES[number];

function isVideoId(videoId: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(videoId);
}

export function buildThumbnailUrl(videoId: string, quality: ThumbnailQuality = 'maxresdefault'): string | null {
  if (!isVideoId(videoId) || !THUMBNAIL_QUALITIES.includes(quality)) return null;
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

export function buildThumbnailCandidates(videoId: string): string[] {
  if (!isVideoId(videoId)) return [];
  return THUMBNAIL_QUALITIES.map(quality => `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`);
}
