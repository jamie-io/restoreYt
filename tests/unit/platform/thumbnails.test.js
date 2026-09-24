import * as platform from '../../../src/platform/index.ts';

const api = name => {
  expect(platform[name], `${name} export`).toBeTypeOf('function');
  return platform[name];
};

describe('thumbnail URL builders', () => {
  it('builds URLs only for valid YouTube video IDs', () => {
    const buildThumbnailUrl = api('buildThumbnailUrl');
    expect(buildThumbnailUrl('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg');
    expect(buildThumbnailUrl('../bad')).toBeNull();
  });

  it('returns ordered quality fallbacks for a valid video', () => {
    const buildThumbnailCandidates = api('buildThumbnailCandidates');
    expect(buildThumbnailCandidates('dQw4w9WgXcQ')).toEqual([
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
    ]);
  });
});
