import { describe, expect, it, vi } from 'vitest';
import { createInnerTubeClient } from '../../../src/platform/api.ts';

const config = {
  apiKey: 'runtime-key',
  clientName: 'WEB',
  clientVersion: '2.20260901.01.00',
  visitorData: undefined,
};

function response(body, ok = true) {
  return { ok, json: async () => body };
}

describe('InnerTube client', () => {
  it('deduplicates per video ID and validates typed player responses', async () => {
    const fetchImpl = vi.fn(async (_url, options) => {
      const body = JSON.parse(options.body);
      return response({ videoDetails: { videoId: body.videoId, title: `Title ${body.videoId}` } });
    });
    const client = createInnerTubeClient({ config, fetchImpl });

    const [first, second] = await Promise.all([
      client.getVideoDetails('dQw4w9WgXcQ'),
      client.getVideoDetails('dQw4w9WgXcQ'),
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first.title).toBe('Title dQw4w9WgXcQ');
    expect(second).toEqual(first);
  });

  it('does not cache failed requests and keeps concurrent video requests isolated', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({}, false))
      .mockResolvedValueOnce(response({ videoDetails: { videoId: 'abcdefghijk', title: 'Other' } }));
    const client = createInnerTubeClient({ config, fetchImpl });

    await expect(client.getVideoDetails('dQw4w9WgXcQ')).resolves.toBeNull();
    await expect(client.getVideoDetails('abcdefghijk')).resolves.toMatchObject({ title: 'Other' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).videoId).toBe('dQw4w9WgXcQ');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).videoId).toBe('abcdefghijk');
  });
});
