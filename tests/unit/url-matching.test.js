import { describe, expect, it } from 'vitest';
import { extractVideoId } from '../../src/platform/api.ts';

describe('extractVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', 'dQw4w9WgXcQ'],
    ['https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', 'dQw4w9WgXcQ'],
  ])('extracts %s', (url, expected) => {
    expect(extractVideoId(url)).toBe(expected);
  });

  it('rejects unrelated and empty URLs', () => {
    expect(extractVideoId('https://example.com')).toBeNull();
    expect(extractVideoId('')).toBeNull();
  });
});
