import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  isVideoId,
  matchSwappedThumbnail,
  normalizeText,
  sameText,
  textContainment,
  videoIdFromContentClass,
  videoIdFromUrl,
} from '../../src/shared/youtube';

describe('videoIdFromUrl', () => {
  it.each([
    ['/watch?v=plN7JMbadRg', 'plN7JMbadRg'],
    ['/watch?v=plN7JMbadRg&list=PL123&index=2', 'plN7JMbadRg'],
    ['https://www.youtube.com/watch?v=_c2e1NcI3Sc&pp=ygUHbXJiZWFzdA%3D%3D', '_c2e1NcI3Sc'],
    ['/shorts/41UzbuW6wJs', '41UzbuW6wJs'],
    ['https://www.youtube-nocookie.com/embed/41UzbuW6wJs?autoplay=1', '41UzbuW6wJs'],
    ['https://youtu.be/plN7JMbadRg', 'plN7JMbadRg'],
    ['https://www.youtube.com/live/plN7JMbadRg', 'plN7JMbadRg'],
    ['https://i.ytimg.com/vi/_c2e1NcI3Sc/hq720_custom_3.jpg?sqp=x', '_c2e1NcI3Sc'],
    ['https://i.ytimg.com/vi_lc/plN7JMbadRg/hq720_de.jpg', 'plN7JMbadRg'],
  ])('%s', (href, id) => {
    expect(videoIdFromUrl(href)).toBe(id);
  });

  it.each([null, '', '/', '/@MrBeast', '/playlist?list=PL1234567890', '/watch?v=tooShort', 'https://example.com/watch?v=plN7JMbadRg', 'javascript:alert(1)'])(
    'rejects %s',
    href => {
      expect(videoIdFromUrl(href)).toBeNull();
    },
  );
});

describe('ids', () => {
  it('validates the 11-character video id format', () => {
    expect(isVideoId('plN7JMbadRg')).toBe(true);
    expect(isVideoId('PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb')).toBe(false);
    expect(isVideoId(42)).toBe(false);
  });

  it('reads lockup content ids and ignores playlists', () => {
    expect(videoIdFromContentClass('ytLockupViewModelHost content-id-_c2e1NcI3Sc ytLockupViewModelVertical')).toBe('_c2e1NcI3Sc');
    expect(videoIdFromContentClass('ytLockupViewModelHost content-id-PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb')).toBeNull();
    expect(videoIdFromContentClass(null)).toBeNull();
  });
});

describe('matchSwappedThumbnail', () => {
  it('maps a localized thumbnail to the original in the same size tier', () => {
    expect(matchSwappedThumbnail('https://i.ytimg.com/vi_lc/plN7JMbadRg/hq720_de.jpg?sqp=-oaymwE&rs=AOn4')).toEqual({
      videoId: 'plN7JMbadRg',
      kind: 'localized',
      original: 'https://i.ytimg.com/vi/plN7JMbadRg/hq720.jpg',
    });
    expect(matchSwappedThumbnail('https://i.ytimg.com/vi_lc/plN7JMbadRg/maxresdefault_pt-BR.jpg')?.original)
      .toBe('https://i.ytimg.com/vi/plN7JMbadRg/maxresdefault.jpg');
  });

  it('keeps the live suffix of a localized live thumbnail', () => {
    expect(matchSwappedThumbnail('https://i.ytimg.com/vi_lc/plN7JMbadRg/hqdefault_live_de.jpg')?.original)
      .toBe('https://i.ytimg.com/vi/plN7JMbadRg/hqdefault_live.jpg');
  });

  it('maps test-and-compare variants to the main thumbnail', () => {
    expect(matchSwappedThumbnail('https://i.ytimg.com/vi/_c2e1NcI3Sc/hq720_custom_3.jpg?sqp=abc')).toEqual({
      videoId: '_c2e1NcI3Sc',
      kind: 'variant',
      original: 'https://i.ytimg.com/vi/_c2e1NcI3Sc/hq720.jpg',
    });
    expect(matchSwappedThumbnail('https://i.ytimg.com/vi_webp/_c2e1NcI3Sc/maxresdefault_custom_1.webp')?.original)
      .toBe('https://i.ytimg.com/vi_webp/_c2e1NcI3Sc/maxresdefault.webp');
  });

  it.each([
    'https://i.ytimg.com/vi/_c2e1NcI3Sc/hq720.jpg?sqp=abc',
    'https://i.ytimg.com/vi/_c2e1NcI3Sc/hqdefault_live.jpg',
    'https://i.ytimg.com/vi/41UzbuW6wJs/sardefault.jpg',
    'https://yt3.ggpht.com/avatar.jpg',
    null,
  ])('leaves %s alone', src => {
    expect(matchSwappedThumbnail(src)).toBeNull();
  });
});

describe('redirect rules mirror the thumbnail matcher', () => {
  const rules = JSON.parse(readFileSync(new URL('../../rules/thumbnails.json', import.meta.url), 'utf8')) as Array<{
    condition: { regexFilter: string; resourceTypes: string[]; initiatorDomains: string[] };
    action: { redirect: { regexSubstitution: string } };
  }>;

  function redirect(url: string): string | null {
    for (const rule of rules) {
      const regex = new RegExp(rule.condition.regexFilter);
      if (regex.test(url)) {
        return url.replace(regex, rule.action.redirect.regexSubstitution.replace(/\\(\d)/g, '$$$1'));
      }
    }
    return null;
  }

  it.each([
    'https://i.ytimg.com/vi_lc/plN7JMbadRg/hq720_de.jpg?sqp=-oaymwE&rs=AOn4',
    'https://i.ytimg.com/vi_lc/plN7JMbadRg/hqdefault_live_de.jpg',
    'https://i.ytimg.com/vi_lc/plN7JMbadRg/maxresdefault_zh-Hans.jpg',
    'https://i.ytimg.com/vi/_c2e1NcI3Sc/hq720_custom_3.jpg?sqp=abc&rs=def',
    'https://i.ytimg.com/vi_webp/_c2e1NcI3Sc/maxresdefault_custom_1.webp',
    'https://i.ytimg.com/vi/_c2e1NcI3Sc/hq720.jpg',
    'https://i.ytimg.com/vi/_c2e1NcI3Sc/hqdefault_live.jpg',
  ])('%s', url => {
    expect(redirect(url)).toBe(matchSwappedThumbnail(url)?.original ?? null);
  });

  it('only touches images requested by YouTube pages', () => {
    for (const rule of rules) {
      expect(rule.condition.resourceTypes).toEqual(['image']);
      expect(rule.condition.initiatorDomains).toEqual(['youtube.com', 'youtube-nocookie.com']);
      // Chrome rejects regexes that compile above 2 KB; bounded repeats like {11} blow that up.
      expect(rule.condition.regexFilter).not.toMatch(/\{\d+(,\d*)?\}/);
    }
  });
});

describe('text helpers', () => {
  it('normalizes whitespace and unicode', () => {
    expect(normalizeText('  Beat LeBron,\n Win  $100,000 ')).toBe('Beat LeBron, Win $100,000');
    expect(sameText('Café', 'Café')).toBe(true);
  });

  it('separates translations from reformatted originals', () => {
    const original = 'I trapped 4 strangers in an entire supermarket and the only way out is eating everything inside. The guys wore trackers to measure their health.';
    const german = 'Ich habe vier Fremde in einen Supermarkt gesperrt und der einzige Weg raus ist, alles aufzuessen, was es dort gibt.';
    const truncated = 'I trapped 4 strangers in an entire supermarket and the only way out is eating everyth';
    expect(textContainment(german, original)).toBeLessThan(0.3);
    expect(textContainment(truncated, original)).toBeGreaterThan(0.85);
  });
});
