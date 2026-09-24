import * as platform from '../../../src/platform/index.ts';

const api = name => {
  expect(platform[name], `${name} export`).toBeTypeOf('function');
  return platform[name];
};

describe('response shape guards', () => {
  it('accepts valid video details and rejects malformed responses', () => {
    const isVideoDetailsResponse = api('isVideoDetailsResponse');
    expect(isVideoDetailsResponse({
      videoDetails: { videoId: 'dQw4w9WgXcQ', title: 'Original title', author: 'Channel' },
    })).toBe(true);
    expect(isVideoDetailsResponse({ videoDetails: { videoId: '', title: 5 } })).toBe(false);
    expect(isVideoDetailsResponse(null)).toBe(false);
  });

  it('guards records without treating arrays or null as response objects', () => {
    const isRecord = api('isRecord');
    expect(isRecord({ response: true })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });
});
