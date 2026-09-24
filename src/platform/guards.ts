export interface PlayerVideoDetails {
  videoId: string;
  title: string;
  author?: string;
  [key: string]: unknown;
}

export interface VideoDetailsResponse {
  videoDetails: PlayerVideoDetails;
  [key: string]: unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isVideoDetailsResponse(value: unknown): value is VideoDetailsResponse {
  if (!isRecord(value) || !isRecord(value.videoDetails)) return false;
  const details = value.videoDetails;
  return typeof details.videoId === 'string'
    && details.videoId.length > 0
    && typeof details.title === 'string'
    && details.title.length > 0
    && (details.author === undefined || typeof details.author === 'string');
}
