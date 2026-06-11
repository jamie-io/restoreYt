import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DeslopifyAPI.extractVideoId', () => {
  let api;

  beforeEach(() => {
    global.window = { location: { origin: 'https://www.youtube.com' } };
    global.URL = URL;

    delete require.cache[require.resolve('../../src/lib/api.js')];
    api = require('../../src/lib/api.js');
  });

  it('extracts video ID from watch URL', () => {
    const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    expect(api.extractVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from shorts URL', () => {
    const url = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
    expect(api.extractVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from embed URL', () => {
    const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
    expect(api.extractVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from ytimg URL', () => {
    const url = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg';
    expect(api.extractVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('extracts video ID from img.youtube.com URL', () => {
    const url = 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg';
    expect(api.extractVideoId(url)).toBe('dQw4w9WgXcQ');
  });

  it('returns null for invalid URL', () => {
    expect(api.extractVideoId('https://example.com')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(api.extractVideoId('')).toBeNull();
  });
});
