const DeslopifyAPI = (() => {
  const PENDING = new Map();

  function isMobile() {
    return window.location.hostname === 'm.youtube.com';
  }

  function getClientName() {
    return isMobile() ? 'MWEB' : 'WEB';
  }

  function getClientVersion() {
    return '2.20250731.09.00';
  }

  function getOrigin() {
    return isMobile() ? 'https://m.youtube.com' : 'https://www.youtube.com';
  }

  function getApiHost() {
    return isMobile() ? 'm.youtube.com' : 'www.youtube.com';
  }

  function getSAPISID() {
    const match = document.cookie.match(/SAPISID=([^\s;]+)/);
    return match ? match[1] : null;
  }

  async function sha1Hash(msg) {
    const encoder = new TextEncoder();
    const data = encoder.encode(msg);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function getSAPISIDHash() {
    const sapisid = getSAPISID();
    if (!sapisid) return null;

    const timestamp = Math.floor(Date.now() / 1000);
    const message = `${timestamp} ${sapisid} ${getOrigin()}`;
    const hash = await sha1Hash(message);
    return `SAPISIDHASH ${timestamp}_${hash}`;
  }

  async function getHeaders(withAuth = true) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (withAuth) {
      const sapisidhash = await getSAPISIDHash();
      if (sapisidhash) {
        headers['Authorization'] = sapisidhash;
        headers['Origin'] = getOrigin();
        headers['X-Youtube-Client-Name'] = '1';
        headers['X-Youtube-Client-Version'] = getClientVersion();
      }
    }

    return headers;
  }

  async function cachedRequest(url, postData = null, headers = null, cacheKey = null) {
    if (cacheKey) {
      const cached = window.DeslopifyCache?.get(cacheKey);
      if (cached !== undefined) return cached;
    }

    if (PENDING.has(url)) {
      return PENDING.get(url);
    }

    const promise = (async () => {
      try {
        const response = await fetch(url, {
          method: postData ? 'POST' : 'GET',
          headers: headers || await getHeaders(),
          body: postData || undefined
        });

        if (!response.ok) {
          if (cacheKey) window.DeslopifyCache?.set(cacheKey, null);
          return null;
        }

        const data = await response.json();
        if (cacheKey) window.DeslopifyCache?.set(cacheKey, data);
        return data;
      } catch (err) {
        console.warn('[Deslopify] API request failed:', err);
        if (cacheKey) window.DeslopifyCache?.set(cacheKey, null);
        return null;
      } finally {
        PENDING.delete(url);
      }
    })();

    PENDING.set(url, promise);
    return promise;
  }

  async function getVideoDetails(videoId) {
    if (!videoId) return null;

    const cacheKey = `video:${videoId}`;
    const body = {
      context: {
        client: {
          clientName: getClientName(),
          clientVersion: getClientVersion()
        }
      },
      videoId
    };

    const headers = await getHeaders();
    const data = await cachedRequest(
      `https://${getApiHost()}/youtubei/v1/player?prettyPrint=false`,
      JSON.stringify(body),
      headers,
      cacheKey
    );

    if (!data?.videoDetails) return null;

    const details = data.videoDetails;
    let thumbnailUrl = details.thumbnail?.thumbnails?.[0]?.url || null;

    if (thumbnailUrl) {
      try {
        const urlObj = new URL(thumbnailUrl);
        urlObj.search = '';
        thumbnailUrl = urlObj.toString();
      } catch {}
    }

    return {
      title: details.title || null,
      author: details.author || null,
      channelId: details.channelId || null,
      thumbnailUrl,
      lengthSeconds: details.lengthSeconds || null
    };
  }

  async function getChannelDetails(channelId) {
    if (!channelId) return null;

    const cacheKey = `channel:${channelId}`;
    const body = {
      context: {
        client: {
          clientName: getClientName(),
          clientVersion: getClientVersion()
        }
      },
      browseId: channelId
    };

    const headers = await getHeaders();
    const data = await cachedRequest(
      `https://${getApiHost()}/youtubei/v1/browse?prettyPrint=false`,
      JSON.stringify(body),
      headers,
      cacheKey
    );

    if (!data) return null;

    return {
      title: data?.header?.c4TabbedHeaderRenderer?.title || null,
      description: data?.metadata?.channelMetadataRenderer?.description || null
    };
  }

  function extractVideoId(url) {
    try {
      const u = new URL(url, window.location.origin);

      if (u.pathname === '/watch') return u.searchParams.get('v');
      if (u.pathname.startsWith('/shorts/')) return u.pathname.split('/')[2] || null;
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/')[2] || null;

      if (u.hostname.includes('i.ytimg.com') || u.hostname.includes('img.youtube.com')) {
        const parts = u.pathname.split('/');
        if (parts.length >= 3 && (parts[1] === 'vi' || parts[1] === 'vi_lc')) {
          return parts[2];
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  if (typeof window !== 'undefined') {
    window.DeslopifyAPI = { getVideoDetails, getChannelDetails, extractVideoId, isMobile };
  }

  return { getVideoDetails, getChannelDetails, extractVideoId, isMobile };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeslopifyAPI;
}
