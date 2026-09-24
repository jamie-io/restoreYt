import { describe, expect, it, vi } from 'vitest';
import { createInnerTubeClient } from '../../src/platform/api.ts';

const config = {
  apiKey: 'runtime-key',
  clientName: 'WEB',
  clientVersion: '2.20260901.01.00',
  visitorData: undefined,
};

function response(body, ok = true) {
  return { ok, json: async () => body };
}

describe('InnerTube client video details', () => {
  it('returns null for empty IDs and failed requests', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('Network error'));
    const client = createInnerTubeClient({ config, fetchImpl });

    await expect(client.getVideoDetails('')).resolves.toBeNull();
    await expect(client.getVideoDetails(null)).resolves.toBeNull();
    await expect(client.getVideoDetails('dQw4w9WgXcQ')).resolves.toBeNull();
  });

  it('returns normalized typed video details and strips thumbnail query strings', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response({
      videoDetails: {
        videoId: 'dQw4w9WgXcQ',
        title: 'Original Title',
        author: 'Channel Name',
        channelId: 'UC123',
        thumbnail: { thumbnails: [{ url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg?sqp=xyz' }] },
        lengthSeconds: '300',
        shortDescription: 'Original description text',
      },
    }));
    const client = createInnerTubeClient({ config, fetchImpl });

    await expect(client.getVideoDetails('dQw4w9WgXcQ')).resolves.toEqual({
      videoId: 'dQw4w9WgXcQ',
      title: 'Original Title',
      author: 'Channel Name',
      channelId: 'UC123',
      thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      lengthSeconds: '300',
      shortDescription: 'Original description text',
    });
  });
});
