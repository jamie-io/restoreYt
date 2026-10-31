/**
 * Fallback title lookup through YouTube's own player endpoint, used when oEmbed
 * refuses a video (embedding disabled, age gate). Runs in the page world because
 * it needs the page's `ytcfg` client context. `videoDetails.title` carries the
 * creator's title regardless of the viewer's language.
 */

type Ytcfg = { get?: (key: string) => unknown; data_?: Record<string, unknown> };

function readConfig(key: string): unknown {
  const ytcfg = (window as unknown as { ytcfg?: Ytcfg }).ytcfg;
  try {
    return ytcfg?.get?.(key) ?? ytcfg?.data_?.[key];
  } catch {
    return undefined;
  }
}

export interface LookupResult {
  title: string | null;
  status: 'ok' | 'missing' | 'error';
}

export async function lookupPlayerTitle(videoId: string, timeoutMs = 8000): Promise<LookupResult> {
  const context = readConfig('INNERTUBE_CONTEXT');
  const clientVersion = readConfig('INNERTUBE_CLIENT_VERSION');
  if (!context || typeof clientVersion !== 'string') return { title: null, status: 'error' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-youtube-client-name': String(readConfig('INNERTUBE_CONTEXT_CLIENT_NAME') ?? 1),
        'x-youtube-client-version': clientVersion,
      },
      body: JSON.stringify({ context, videoId, contentCheckOk: true, racyCheckOk: true }),
    });
    if (!response.ok) return { title: null, status: response.status === 404 ? 'missing' : 'error' };
    const body: unknown = await response.json();
    const details = body && typeof body === 'object' ? (body as { videoDetails?: { videoId?: unknown; title?: unknown } }).videoDetails : undefined;
    if (details?.videoId === videoId && typeof details.title === 'string' && details.title.length > 0) {
      return { title: details.title, status: 'ok' };
    }
    return { title: null, status: 'missing' };
  } catch {
    return { title: null, status: 'error' };
  } finally {
    clearTimeout(timer);
  }
}
