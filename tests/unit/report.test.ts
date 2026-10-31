import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageReporter, pageKey, pageTypeFor } from '../../src/content/report';
import type { PageReport } from '../../src/shared/messages';
import { describeStats, joinList, summarize } from '../../src/ui/summary';

describe('page identity', () => {
  it.each([
    ['https://www.youtube.com/', 'home'],
    ['https://www.youtube.com/watch?v=plN7JMbadRg', 'watch'],
    ['https://www.youtube.com/shorts/41UzbuW6wJs', 'shorts'],
    ['https://www.youtube.com/results?search_query=x', 'search'],
    ['https://www.youtube.com/feed/subscriptions', 'subscriptions'],
    ['https://www.youtube.com/@MrBeast/videos', 'channel'],
    ['https://www.youtube.com/playlist?list=PL1', 'playlist'],
    ['https://www.youtube.com/embed/plN7JMbadRg', 'embed'],
    ['https://www.youtube.com/feed/history', 'other'],
  ])('%s is %s', (url, type) => {
    expect(pageTypeFor(url)).toBe(type);
  });

  it('changes key between videos but not for timestamp changes', () => {
    expect(pageKey('https://www.youtube.com/watch?v=a&t=10')).toBe(pageKey('https://www.youtube.com/watch?v=a&t=99'));
    expect(pageKey('https://www.youtube.com/watch?v=a')).not.toBe(pageKey('https://www.youtube.com/watch?v=b'));
    expect(pageKey('https://www.youtube.com/results?search_query=a')).not.toBe(pageKey('https://www.youtube.com/results?search_query=b'));
  });
});

describe('PageReporter', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts each video once and reports totals to the badge and lifetime sinks', async () => {
    const badge = vi.fn();
    const lifetime = vi.fn();
    const reporter = new PageReporter('https://www.youtube.com/', { badge, lifetime }, () => 42);
    reporter.title('a', 'Original A', 'Übersetzt A');
    reporter.title('a', 'Original A', 'Übersetzt A');
    reporter.title('b', 'Original B', 'Übersetzt B');
    reporter.thumbnails(new Set(['a', 'c']));
    reporter.thumbnails(new Set(['a', 'c']));
    reporter.audio({ videoId: 'a', from: 'Deutsch', to: 'English (original)' });
    await vi.advanceTimersByTimeAsync(5000);
    const snapshot = reporter.snapshot();
    expect(snapshot.counts).toMatchObject({ titles: 2, thumbnails: 2, audio: 1 });
    expect(snapshot.recent[0]).toEqual({ kind: 'audio', videoId: 'a', original: 'English (original)', replaced: 'Deutsch', at: 42 });
    expect(badge).toHaveBeenLastCalledWith(5);
    expect(lifetime).toHaveBeenCalledWith({ titles: 2, thumbnails: 2, audio: 1 });
  });

  it('starts over on a new page', async () => {
    const reporter = new PageReporter('https://www.youtube.com/', { badge: vi.fn(), lifetime: vi.fn() });
    reporter.title('a', 'A', 'Ä');
    reporter.reset('https://www.youtube.com/watch?v=plN7JMbadRg');
    expect(reporter.snapshot()).toMatchObject({ pageType: 'watch', counts: { titles: 0 }, recent: [] });
    reporter.title('a', 'A', 'Ä');
    expect(reporter.snapshot().counts.titles).toBe(1);
  });
});

describe('summaries', () => {
  const base: PageReport = {
    url: 'https://www.youtube.com/watch?v=plN7JMbadRg',
    pageType: 'watch',
    counts: { titles: 0, thumbnails: 0, descriptions: 0, audio: 0, captions: 0, aiHidden: 0 },
    recent: [],
    lookups: { pending: 0, failed: 0, blocked: false },
  };

  it('writes plain sentences', () => {
    expect(summarize(base)).toEqual(['Nothing on this page needed restoring.']);
    expect(summarize({ ...base, counts: { ...base.counts, titles: 12, thumbnails: 1, descriptions: 1, audio: 1, captions: 1, aiHidden: 1 } })).toEqual([
      'Restored 12 titles, 1 thumbnail and the description.',
      'Switched to the original audio track.',
      'Turned off subtitles YouTube switched on by itself.',
      'Hid the AI summary.',
    ]);
    expect(summarize({ ...base, lookups: { pending: 3, failed: 1, blocked: false } })).toContain('Checking 3 more titles…');
    expect(summarize({ ...base, lookups: { pending: 3, failed: 0, blocked: true } })).toContain('YouTube is limiting title lookups; restoreyt retries shortly.');
  });

  it('joins lists the English way', () => {
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });

  it('describes lifetime statistics', () => {
    expect(describeStats(undefined)).toBe('Nothing restored yet. Open YouTube and the count starts here.');
    expect(describeStats({ titles: 1204, thumbnails: 380, audio: 1, captions: 2, since: Date.UTC(2026, 9, 31) }))
      .toBe('Since 31 October 2026, restoreyt has restored 1,204 titles, 380 thumbnails and 1 audio track, and switched off 2 sets of subtitles YouTube turned on.');
  });
});
