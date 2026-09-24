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

  it('rejects HTTP failures, leaves them uncached, and keeps other video requests isolated', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({}, false))
      .mockResolvedValueOnce(response({ videoDetails: { videoId: 'abcdefghijk', title: 'Other' } }))
      .mockResolvedValueOnce(response({ videoDetails: { videoId: 'dQw4w9WgXcQ', title: 'Recovered' } }));
    const client = createInnerTubeClient({ config, fetchImpl });

    await expect(client.getVideoDetails('dQw4w9WgXcQ')).rejects.toThrow(/HTTP/);
    await expect(client.getVideoDetails('abcdefghijk')).resolves.toMatchObject({ title: 'Other' });
    await expect(client.getVideoDetails('dQw4w9WgXcQ')).resolves.toMatchObject({ title: 'Recovered' });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).videoId).toBe('dQw4w9WgXcQ');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).videoId).toBe('abcdefghijk');
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['network', () => Promise.reject(new Error('Network down')), /Network down/],
    ['JSON decoding', () => Promise.resolve({ ok: true, json: async () => { throw new Error('Bad JSON'); } }), /Bad JSON/],
    ['player shape', () => Promise.resolve(response({ playabilityStatus: { status: 'OK' } })), /shape/],
  ])('rejects %s failures and retries without caching', async (_name, failedResponse, expectedError) => {
    const fetchImpl = vi.fn()
      .mockImplementationOnce(failedResponse)
      .mockResolvedValueOnce(response({ videoDetails: { videoId: 'dQw4w9WgXcQ', title: 'Recovered' } }));
    const client = createInnerTubeClient({ config, fetchImpl });

    await expect(client.getVideoDetails('dQw4w9WgXcQ')).rejects.toThrow(expectedError);
    await expect(client.getVideoDetails('dQw4w9WgXcQ')).resolves.toMatchObject({ title: 'Recovered' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects invalid channel response shape and retries without caching', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response({ header: {} }))
      .mockResolvedValueOnce(response({
        header: { c4TabbedHeaderRenderer: { title: 'Channel' } },
        metadata: { channelMetadataRenderer: { description: 'Description' } },
      }));
    const client = createInnerTubeClient({ config, fetchImpl });

    await expect(client.getChannelDetails('UC123')).rejects.toThrow(/shape/);
    await expect(client.getChannelDetails('UC123')).resolves.toEqual({ title: 'Channel', description: 'Description' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent failures, then permits retry', async () => {
    let rejectFirst;
    const firstResponse = new Promise((_resolve, reject) => { rejectFirst = reject; });
    const fetchImpl = vi.fn()
      .mockImplementationOnce(() => firstResponse)
      .mockResolvedValueOnce(response({ videoDetails: { videoId: 'dQw4w9WgXcQ', title: 'Recovered' } }));
    const client = createInnerTubeClient({ config, fetchImpl });

    const first = client.getVideoDetails('dQw4w9WgXcQ');
    const duplicate = client.getVideoDetails('dQw4w9WgXcQ');
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    rejectFirst(new Error('Network down'));

    await expect(first).rejects.toThrow('Network down');
    await expect(duplicate).rejects.toThrow('Network down');
    await expect(client.getVideoDetails('dQw4w9WgXcQ')).resolves.toMatchObject({ title: 'Recovered' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
