// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DescriptionRestorer } from '../../src/content/description';
import { createPageContext } from '../../src/content/surfaces';
import type { VideoInfo } from '../../src/shared/messages';

const ORIGINAL = 'I trapped 4 strangers in an entire supermarket and the only way out is eating everything inside\n\nChapters:\n0:00 Intro\n3:15 Day one\nhttps://example.com/shop';
const GERMAN = 'Ich habe vier Fremde in einen Supermarkt gesperrt und der einzige Weg raus ist, alles aufzuessen, was es dort gibt.';

function markup(snippet: string, expanded = ''): string {
  return `
  <ytd-watch-flexy video-id="plN7JMbadRg">
    <ytd-watch-metadata>
      <div id="description">
        <ytd-text-inline-expander id="description-inline-expander">
          <div id="expanded"><yt-attributed-string>${expanded}</yt-attributed-string></div>
          <div id="snippet"><span id="snippet-text"><yt-attributed-string id="attributed-snippet-text"><span class="ytAttributedStringHost">${snippet}</span></yt-attributed-string></span></div>
        </ytd-text-inline-expander>
      </div>
    </ytd-watch-metadata>
  </ytd-watch-flexy>`;
}

function video(overrides: Partial<VideoInfo> = {}): VideoInfo {
  return { surface: 'watch', videoId: 'plN7JMbadRg', title: 'Eat Everything', description: ORIGINAL, displayedTitle: 'Iss alles', author: 'MrBeast', ...overrides };
}

describe('DescriptionRestorer', () => {
  let reporter: { description: ReturnType<typeof vi.fn> };
  let onSeek: ReturnType<typeof vi.fn>;
  let restorer: DescriptionRestorer;

  beforeEach(() => {
    (window as unknown as { happyDOM: { setURL(url: string): void } }).happyDOM.setURL('https://www.youtube.com/watch?v=plN7JMbadRg');
    reporter = { description: vi.fn() };
    onSeek = vi.fn();
    restorer = new DescriptionRestorer(document, reporter, createPageContext(document), onSeek);
  });

  it('replaces a translated snippet and the expanded text with the original', () => {
    document.body.innerHTML = markup(GERMAN, `${GERMAN} Kapitel: 0:00 Einleitung`);
    restorer.setVideo(video());
    restorer.apply();
    const snippet = document.querySelector('#attributed-snippet-text');
    const expanded = document.querySelector('#expanded yt-attributed-string');
    expect(snippet?.textContent?.startsWith('I trapped 4 strangers')).toBe(true);
    expect(expanded?.textContent).toBe(ORIGINAL);
    expect(expanded?.querySelector('a[data-seconds="195"]')?.textContent).toBe('3:15');
    expect(reporter.description).toHaveBeenCalledTimes(1);
    expanded?.querySelector<HTMLAnchorElement>('a[data-seconds="195"]')?.click();
    expect(onSeek).toHaveBeenCalledWith(195);
  });

  it('leaves untranslated descriptions with YouTube’s own rendering', () => {
    document.body.innerHTML = markup('I trapped 4 strangers in an entire supermarket and the only way out is eating every');
    restorer.setVideo(video());
    restorer.apply();
    expect(document.querySelector('.restoreyt-description')).toBeNull();
    expect(reporter.description).not.toHaveBeenCalled();
  });

  it('waits until the page shows the same video as the player', () => {
    document.body.innerHTML = markup(GERMAN).replace('plN7JMbadRg', 'hTSaweR8qMI');
    restorer.setVideo(video());
    restorer.apply();
    expect(document.querySelector('.restoreyt-description')).toBeNull();
  });

  it('re-applies after YouTube re-renders and reverts cleanly', () => {
    document.body.innerHTML = markup(GERMAN);
    restorer.setVideo(video());
    restorer.apply();
    const snippet = document.querySelector('#attributed-snippet-text');
    if (!snippet) throw new Error('fixture');
    snippet.innerHTML = `<span>${GERMAN}</span>`;
    restorer.apply();
    expect(snippet.querySelector('.restoreyt-description')).not.toBeNull();
    restorer.revertAll();
    expect(snippet.textContent).toBe(GERMAN);
  });
});
