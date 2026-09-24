import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDiagnosticsBuffer } from '../../src/core/diagnostics.ts';
import {
  buildFeaturePlan,
  createFeatureRuntime,
  findOriginalAudioTrack,
  shouldReplaceText,
} from '../../src/features/runtime.ts';

const videoA = 'aaaaaaaaaaa';
const videoB = 'bbbbbbbbbbb';
const videoC = 'ccccccccccc';

class FakeImage {
  attributes = new Map([['src', '']]);
  listeners = new Map();

  get src() { return this.attributes.get('src') ?? ''; }
  set src(value) { this.attributes.set('src', value); }
  get currentSrc() { return this.src; }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  removeEventListener(name, listener) {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter(item => item !== listener));
  }
  closest() { return null; }
  getBoundingClientRect() { return { width: 160, height: 90 }; }
}

function createRuntimeHarness({ image, title, href = 'https://www.youtube.com/' } = {}) {
  const handlers = new Map();
  const document = {
    body: {},
    contains: () => true,
    querySelector: vi.fn(() => null),
    querySelectorAll(selector) {
      if (selector.startsWith('img[')) return image ? [image] : [];
      if (
        selector.startsWith('#channel-header')
        || selector.startsWith('#page-header')
        || selector.startsWith('h1.')
      ) return title ? [title] : [];
      return [];
    },
  };
  const window = {
    location: { href, pathname: new URL(href).pathname },
    addEventListener(name, listener) { handlers.set(name, listener); },
    removeEventListener(name) { handlers.delete(name); },
    navigate(nextHref) {
      this.location.href = nextHref;
      this.location.pathname = new URL(nextHref).pathname;
      handlers.get('yt-navigate-finish')?.();
    },
  };
  return { document, window };
}

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

afterEach(() => vi.unstubAllGlobals());

describe('feature runtime decisions', () => {
  it('writes only when original text is non-empty and differs', () => {
    expect(shouldReplaceText('Translated title', 'Original title')).toBe(true);
    expect(shouldReplaceText('Original title', 'Original title')).toBe(false);
    expect(shouldReplaceText('Translated title', '')).toBe(false);
  });

  it('selects audio only when player exposes explicit auto-dub signals', () => {
    expect(findOriginalAudioTrack([
      { languageCode: 'de', isAutoDubbed: true },
      { languageCode: 'en', isAutoDubbed: false },
    ])).toEqual({ index: 1, track: { languageCode: 'en', isAutoDubbed: false } });
    expect(findOriginalAudioTrack([{ languageCode: 'en' }])).toBeNull();
  });

  it('requires explicit opt-in for evidence-blocked audio and channel features', () => {
    const settings = {
      enabled: true,
      untranslateTitle: true,
      untranslateThumbnail: true,
      untranslateDescription: true,
      untranslateChapters: false,
      untranslateAudio: true,
      untranslateChannelBranding: true,
      whitelistChannels: [],
    };

    expect(buildFeaturePlan(settings)).toEqual(['title', 'thumbnail', 'description']);
    expect(buildFeaturePlan(settings, { audio: true, channelBranding: true }))
      .toEqual(['title', 'thumbnail', 'description', 'audio', 'channelBranding']);
    expect(buildFeaturePlan({ enabled: false })).toEqual([]);
  });

  it('ignores stale thumbnail work after navigation and permits same image to process its next video', async () => {
    vi.stubGlobal('HTMLImageElement', FakeImage);
    vi.stubGlobal('HTMLAnchorElement', class FakeAnchor {});
    vi.stubGlobal('getComputedStyle', () => ({ display: 'block', visibility: 'visible', opacity: '1' }));
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });

    const first = deferred();
    const second = deferred();
    const third = deferred();
    const details = new Map([[videoA, first], [videoB, second], [videoC, third]]);
    const api = {
      extractVideoId(url) { return new URL(url).pathname.split('/')[2] || null; },
      getVideoDetails: vi.fn(videoId => details.get(videoId).promise),
      getChannelDetails: vi.fn(),
    };
    const image = new FakeImage();
    image.src = `https://i.ytimg.com/vi/${videoA}/hqdefault.jpg`;
    const { document, window } = createRuntimeHarness({ image, href: `https://www.youtube.com/watch?v=${videoA}` });
    const settings = {
      enabled: true,
      untranslateTitle: false,
      untranslateThumbnail: true,
      untranslateDescription: false,
      untranslateChapters: false,
      untranslateAudio: false,
      untranslateChannelBranding: false,
      whitelistChannels: [],
    };
    const runtime = createFeatureRuntime({ document, window, api, settings });
    runtime.start();
    await vi.waitFor(() => expect(api.getVideoDetails).toHaveBeenCalledWith(videoA));

    image.src = `https://i.ytimg.com/vi/${videoB}/hqdefault.jpg`;
    window.navigate(`https://www.youtube.com/watch?v=${videoB}`);
    await vi.waitFor(() => expect(api.getVideoDetails).toHaveBeenCalledWith(videoB));
    second.resolve({ channelId: null });
    await vi.waitFor(() => expect(image.src).toContain(`/vi/${videoB}/`));
    first.resolve({ channelId: null });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(image.src).toContain(`/vi/${videoB}/`);

    image.src = `https://i.ytimg.com/vi/${videoC}/hqdefault.jpg`;
    const thirdProcessing = runtime.process();
    await vi.waitFor(() => expect(api.getVideoDetails).toHaveBeenCalledWith(videoC));
    third.resolve({ channelId: null });
    await vi.waitFor(() => expect(image.src).toContain(`/vi/${videoC}/`));
    await thirdProcessing;
    runtime.stop();
  });

  it('uses current channel route and drops branding response from prior navigation', async () => {
    vi.stubGlobal('HTMLAnchorElement', class FakeAnchor {});
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });

    const first = deferred();
    const second = deferred();
    const title = { textContent: 'Translated title' };
    const api = {
      extractVideoId() { return null; },
      getVideoDetails: vi.fn(),
      getChannelDetails: vi.fn(channelId => channelId === 'UCfirst' ? first.promise : second.promise),
    };
    const { document, window } = createRuntimeHarness({
      title,
      href: 'https://www.youtube.com/channel/UCfirst',
    });
    const settings = {
      enabled: true,
      untranslateTitle: false,
      untranslateThumbnail: false,
      untranslateDescription: false,
      untranslateChapters: false,
      untranslateAudio: false,
      untranslateChannelBranding: true,
      whitelistChannels: [],
    };
    const diagnostics = createDiagnosticsBuffer();
    const runtime = createFeatureRuntime({
      document,
      window,
      api,
      settings,
      diagnostics,
      evidenceOptIn: { channelBranding: true },
    });
    runtime.start();
    await vi.waitFor(() => expect(api.getChannelDetails).toHaveBeenCalledWith('UCfirst'));

    window.navigate('https://www.youtube.com/channel/UCnext');
    await vi.waitFor(() => expect(api.getChannelDetails).toHaveBeenCalledWith('UCnext'));
    second.resolve({ title: 'Current channel' });
    await vi.waitFor(() => expect(title.textContent).toBe('Current channel'));
    first.resolve({ title: 'Previous channel' });
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(api.getChannelDetails).toHaveBeenCalledTimes(2);
    expect(title.textContent).toBe('Current channel');
    runtime.stop();
  });

  it('resolves vanity channel branding only from channel header link', async () => {
    const FakeAnchor = class {};
    vi.stubGlobal('HTMLAnchorElement', FakeAnchor);
    const link = Object.assign(new FakeAnchor(), { href: 'https://www.youtube.com/channel/UCcurrent' });
    const header = { querySelector: vi.fn(() => link) };
    const title = {
      textContent: 'Translated title',
      closest: selector => selector === '#page-header' ? header : null,
    };
    const api = {
      extractVideoId: () => null,
      getVideoDetails: vi.fn(),
      getChannelDetails: vi.fn().mockResolvedValue({ title: 'Current channel' }),
    };
    const { document, window } = createRuntimeHarness({ title, href: 'https://www.youtube.com/@current' });
    const runtime = createFeatureRuntime({
      document,
      window,
      api,
      settings: {
        enabled: true,
        untranslateTitle: false,
        untranslateThumbnail: false,
        untranslateDescription: false,
        untranslateChapters: false,
        untranslateAudio: false,
        untranslateChannelBranding: true,
        whitelistChannels: [],
      },
      evidenceOptIn: { channelBranding: true },
    });

    await runtime.process();

    expect(header.querySelector).toHaveBeenCalledWith('a[href*="/channel/"]');
    expect(api.getChannelDetails).toHaveBeenCalledWith('UCcurrent');
    expect(title.textContent).toBe('Current channel');
  });

  it('ignores unrelated channel links when current route has no channel identity', async () => {
    const FakeAnchor = class {};
    vi.stubGlobal('HTMLAnchorElement', FakeAnchor);
    vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });

    const title = { textContent: 'Translated title', closest: () => null };
    const api = { extractVideoId: () => null, getVideoDetails: vi.fn(), getChannelDetails: vi.fn() };
    const { document, window } = createRuntimeHarness({ title, href: 'https://www.youtube.com/watch?v=video' });
    document.querySelector.mockReturnValue(Object.assign(new FakeAnchor(), {
      href: 'https://www.youtube.com/channel/UCunrelated',
    }));
    const runtime = createFeatureRuntime({
      document,
      window,
      api,
      settings: {
        enabled: true,
        untranslateTitle: false,
        untranslateThumbnail: false,
        untranslateDescription: false,
        untranslateChapters: false,
        untranslateAudio: false,
        untranslateChannelBranding: true,
        whitelistChannels: [],
      },
      evidenceOptIn: { channelBranding: true },
    });

    await runtime.process();

    expect(api.getChannelDetails).not.toHaveBeenCalled();
    expect(document.querySelector).not.toHaveBeenCalled();
  });

  it('counts request failures in thumbnail feature breaker and opens after threshold', async () => {
    vi.stubGlobal('HTMLImageElement', FakeImage);
    vi.stubGlobal('HTMLAnchorElement', class FakeAnchor {});

    const image = new FakeImage();
    image.src = `https://i.ytimg.com/vi/${videoA}/hqdefault.jpg`;
    const { document, window } = createRuntimeHarness({ image, href: `https://www.youtube.com/watch?v=${videoA}` });
    const api = {
      extractVideoId(url) { return new URL(url).pathname.split('/')[2] || null; },
      getVideoDetails: vi.fn().mockRejectedValue(new Error('HTTP request failed')),
      getChannelDetails: vi.fn(),
    };
    const diagnostics = createDiagnosticsBuffer();
    const runtime = createFeatureRuntime({
      document,
      window,
      api,
      settings: {
        enabled: true,
        untranslateTitle: false,
        untranslateThumbnail: true,
        untranslateDescription: false,
        untranslateChapters: false,
        untranslateAudio: false,
        untranslateChannelBranding: false,
        whitelistChannels: [],
      },
      diagnostics,
    });

    await runtime.process();
    await runtime.process();
    await runtime.process();
    await runtime.process();

    expect(api.getVideoDetails).toHaveBeenCalledTimes(3);
    expect(diagnostics.snapshot().filter(entry => entry.feature === 'thumbnail')).toHaveLength(4);
    expect(diagnostics.snapshot().at(-1).message).toContain('circuit is open');
  });
});
