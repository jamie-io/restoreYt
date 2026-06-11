import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DeslopifyAPI.getVideoDetails', () => {
  let api;

  beforeEach(() => {
    global.window = {
      location: { origin: 'https://www.youtube.com', hostname: 'www.youtube.com' },
      DeslopifyCache: {
        get: vi.fn(),
        set: vi.fn()
      }
    };
    global.fetch = vi.fn();
    global.document = { cookie: '' };
    // Mock crypto.subtle.digest
    const mockDigest = vi.fn().mockResolvedValue(new ArrayBuffer(20));
    Object.defineProperty(global, 'crypto', {
      value: {
        subtle: {
          digest: mockDigest
        }
      },
      writable: true,
      configurable: true
    });
    global.TextEncoder = class {
      encode(str) { return new Uint8Array([...str].map(c => c.charCodeAt(0))); }
    };

    delete require.cache[require.resolve('../../src/lib/api.js')];
    api = require('../../src/lib/api.js');
  });

  it('returns null for empty video ID', async () => {
    const result = await api.getVideoDetails('');
    expect(result).toBeNull();
  });

  it('returns null for null video ID', async () => {
    const result = await api.getVideoDetails(null);
    expect(result).toBeNull();
  });

  it('returns null when fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));
    const result = await api.getVideoDetails('dQw4w9WgXcQ');
    expect(result).toBeNull();
  });

  it('returns null when API returns no videoDetails', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({})
    });
    const result = await api.getVideoDetails('dQw4w9WgXcQ');
    expect(result).toBeNull();
  });

  it('returns video details on success', async () => {
    const mockResponse = {
      videoDetails: {
        title: 'Original Title',
        author: 'Channel Name',
        channelId: 'UC123',
        thumbnail: {
          thumbnails: [{ url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg' }]
        },
        lengthSeconds: '300',
        shortDescription: 'Original description text'
      }
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await api.getVideoDetails('dQw4w9WgXcQ');
    expect(result).toEqual({
      title: 'Original Title',
      author: 'Channel Name',
      channelId: 'UC123',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      lengthSeconds: '300',
      shortDescription: 'Original description text'
    });
  });

  it('strips query params from thumbnail URL', async () => {
    const mockResponse = {
      videoDetails: {
        title: 'Title',
        author: 'Author',
        channelId: 'UC123',
        thumbnail: {
          thumbnails: [{ url: 'https://i.ytimg.com/vi/abc123/maxresdefault.jpg?sqp=xyz' }]
        },
        lengthSeconds: '60'
      }
    };

    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const result = await api.getVideoDetails('abc123');
    expect(result.thumbnailUrl).not.toContain('?');
  });
});
