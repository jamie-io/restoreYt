import { createLruCache, type LruCache } from '../core/cache.js';
import { createRequestQueue } from '../core/request-queue.js';
import { withTimeout } from '../core/timeout.js';
import { isRecord, isVideoDetailsResponse, type VideoDetailsResponse } from './guards.js';
import type { RuntimeClientConfig } from './config.js';

export interface VideoDetails {
  videoId: string;
  title: string;
  author: string | null;
  channelId: string | null;
  thumbnailUrl: string | null;
  lengthSeconds: string | null;
  shortDescription: string | null;
}

export interface ChannelDetails {
  title: string | null;
  description: string | null;
}

interface FetchResponse {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
}

type FetchImplementation = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<FetchResponse>;

export interface InnerTubeClientOptions {
  config: RuntimeClientConfig;
  fetchImpl?: FetchImplementation;
  cache?: LruCache<VideoDetails | null>;
  timeoutMs?: number;
}

export interface InnerTubeClient {
  getVideoDetails(videoId: string | null | undefined): Promise<VideoDetails | null>;
  getChannelDetails(channelId: string | null | undefined): Promise<ChannelDetails | null>;
  extractVideoId(url: string): string | null;
}

function normalizeThumbnailUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  try {
    const url = new URL(value);
    url.search = '';
    return url.toString();
  } catch {
    return null;
  }
}

function selectThumbnailUrl(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.thumbnails)) return null;
  const candidates = value.thumbnails.flatMap(entry => {
    if (!isRecord(entry)) return [];
    const url = normalizeThumbnailUrl(entry.url);
    if (!url) return [];
    const width = entry.width;
    const height = entry.height;
    const pixelArea = typeof width === 'number' && Number.isFinite(width) && width > 0
      && typeof height === 'number' && Number.isFinite(height) && height > 0
      ? width * height
      : null;
    return [{ url, pixelArea: pixelArea !== null && Number.isFinite(pixelArea) ? pixelArea : null }];
  });
  const measured = candidates.filter(candidate => candidate.pixelArea !== null);
  if (measured.length === 0) return candidates[0]?.url ?? null;
  let best: (typeof candidates)[number] | undefined;
  for (const candidate of measured) {
    if (!best || (candidate.pixelArea ?? 0) > (best.pixelArea ?? 0)) best = candidate;
  }
  return best?.url ?? null;
}

function asVideoDetails(response: VideoDetailsResponse): VideoDetails {
  const details = response.videoDetails;
  return {
    videoId: details.videoId,
    title: details.title,
    author: typeof details.author === 'string' ? details.author : null,
    channelId: typeof details.channelId === 'string' ? details.channelId : null,
    thumbnailUrl: selectThumbnailUrl(details.thumbnail),
    lengthSeconds: typeof details.lengthSeconds === 'string' ? details.lengthSeconds : null,
    shortDescription: typeof details.shortDescription === 'string' ? details.shortDescription : null,
  };
}

export function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url, 'https://www.youtube.com');
    if (parsed.pathname === '/watch') return parsed.searchParams.get('v');
    if (parsed.pathname.startsWith('/shorts/')) return parsed.pathname.split('/')[2] || null;
    if (parsed.pathname.startsWith('/embed/')) return parsed.pathname.split('/')[2] || null;
    if (parsed.hostname === 'i.ytimg.com' || parsed.hostname === 'img.youtube.com') {
      const segments = parsed.pathname.split('/');
      if (segments[1] === 'vi' || segments[1] === 'vi_lc') return segments[2] || null;
    }
    return null;
  } catch {
    return null;
  }
}

export function createInnerTubeClient(options: InnerTubeClientOptions): InnerTubeClient {
  const fetchImpl = options.fetchImpl ?? (globalThis.fetch as unknown as FetchImplementation);
  const cache = options.cache ?? createLruCache<VideoDetails | null>({ capacity: 256, ttlMs: 300_000, negativeTtlMs: 15_000 });
  const channelCache = createLruCache<ChannelDetails | null>({ capacity: 128, ttlMs: 300_000, negativeTtlMs: 15_000 });
  const queue = createRequestQueue({ concurrency: 4 });
  const pendingVideos = new Map<string, Promise<VideoDetails | null>>();
  const pendingChannels = new Map<string, Promise<ChannelDetails | null>>();
  const endpoint = (path: string): string => `https://www.youtube.com/youtubei/v1/${path}?key=${encodeURIComponent(options.config.apiKey)}&prettyPrint=false`;
  const headers = {
    'Content-Type': 'application/json',
    'X-Youtube-Client-Name': options.config.clientName,
    'X-Youtube-Client-Version': options.config.clientVersion,
  };
  const context = {
    client: {
      clientName: options.config.clientName,
      clientVersion: options.config.clientVersion,
      ...(options.config.visitorData ? { visitorData: options.config.visitorData } : {}),
    },
  };

  async function request(path: string, body: Record<string, unknown>): Promise<unknown> {
    if (!fetchImpl) throw new Error(`InnerTube ${path} request unavailable: fetch is not available`);
    return withTimeout(
      signal => queue.run(async queueSignal => {
        const combined = new AbortController();
        const abort = (): void => combined.abort();
        signal.addEventListener('abort', abort, { once: true });
        queueSignal.addEventListener('abort', abort, { once: true });
        try {
          const response = await fetchImpl(endpoint(path), {
            method: 'POST',
            headers,
            body: JSON.stringify({ context, ...body }),
            signal: combined.signal,
          });
          if (!response.ok) {
            const status = typeof response.status === 'number' ? ` (HTTP ${response.status})` : ' (HTTP error)';
            throw new Error(`InnerTube ${path} request failed${status}`);
          }
          return await response.json();
        } finally {
          signal.removeEventListener('abort', abort);
          queueSignal.removeEventListener('abort', abort);
        }
      }, signal),
      options.timeoutMs === undefined ? {} : { timeoutMs: options.timeoutMs },
    );
  }

  async function loadVideo(videoId: string): Promise<VideoDetails | null> {
    const response = await request('player', { videoId });
    if (!isVideoDetailsResponse(response)) throw new Error('Invalid InnerTube player response shape');
    if (response.videoDetails.videoId !== videoId) throw new Error('InnerTube player response video ID mismatch');
    return asVideoDetails(response);
  }

  async function loadChannel(channelId: string): Promise<ChannelDetails | null> {
    const response = await request('browse', { browseId: channelId });
    if (!isRecord(response)) throw new Error('Invalid InnerTube browse response shape');
    const header = isRecord(response.header) ? response.header : undefined;
    const headerRenderer = header && isRecord(header.c4TabbedHeaderRenderer) ? header.c4TabbedHeaderRenderer : undefined;
    const metadata = isRecord(response.metadata) ? response.metadata : undefined;
    const metadataRenderer = metadata && isRecord(metadata.channelMetadataRenderer) ? metadata.channelMetadataRenderer : undefined;
    const title = typeof headerRenderer?.title === 'string' ? headerRenderer.title : null;
    const description = typeof metadataRenderer?.description === 'string' ? metadataRenderer.description : null;
    if ((!headerRenderer && !metadataRenderer) || (title === null && description === null)) {
      throw new Error('Invalid InnerTube browse response shape');
    }
    return {
      title,
      description,
    };
  }

  return {
    getVideoDetails(videoId) {
      if (!videoId) return Promise.resolve(null);
      const key = `video:${videoId}`;
      const cached = cache.get(key);
      if (cached !== undefined) return Promise.resolve(cached);
      const existing = pendingVideos.get(videoId);
      if (existing) return existing;
      const pending = loadVideo(videoId).then(result => {
        if (result) cache.set(key, result);
        return result;
      }).finally(() => pendingVideos.delete(videoId));
      pendingVideos.set(videoId, pending);
      return pending;
    },
    getChannelDetails(channelId) {
      if (!channelId) return Promise.resolve(null);
      const key = `channel:${channelId}`;
      const cached = channelCache.get(key);
      if (cached !== undefined) return Promise.resolve(cached);
      const existing = pendingChannels.get(channelId);
      if (existing) return existing;
      const pending = loadChannel(channelId).then(result => {
        if (result) channelCache.set(key, result);
        return result;
      }).finally(() => pendingChannels.delete(channelId));
      pendingChannels.set(channelId, pending);
      return pending;
    },
    extractVideoId,
  };
}
