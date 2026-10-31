// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPageContext } from '../../src/content/surfaces';
import { TitleEngine } from '../../src/content/title-engine';
import type { TitleService } from '../../src/content/title-service';

/** Minimal markup mirroring YouTube's desktop DOM (captured October 2026). */
const FIXTURE = `
<ytd-rich-item-renderer id="lockup">
  <yt-lockup-view-model>
    <div class="ytLockupViewModelHost content-id-_c2e1NcI3Sc">
      <a href="/watch?v=_c2e1NcI3Sc" class="ytLockupViewModelContentImage"><img src="https://i.ytimg.com/vi_lc/_c2e1NcI3Sc/hq720_de.jpg?sqp=x"></a>
      <yt-lockup-metadata-view-model>
        <h3 class="ytLockupMetadataViewModelHeadingReset" title="Besiege Haaland und gewinne 100.000 $" aria-label="Besiege Haaland und gewinne 100.000 $">
          <a href="/watch?v=_c2e1NcI3Sc" class="ytLockupMetadataViewModelTitle" aria-label="Besiege Haaland und gewinne 100.000 $ 22 Minuten"><span class="ytAttributedStringHost">Besiege Haaland und gewinne 100.000 $</span></a>
        </h3>
      </yt-lockup-metadata-view-model>
    </div>
  </yt-lockup-view-model>
</ytd-rich-item-renderer>
<ytd-rich-item-renderer id="playlist">
  <yt-lockup-view-model>
    <div class="ytLockupViewModelHost content-id-PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb">
      <yt-lockup-metadata-view-model>
        <h3><a href="/watch?v=plN7JMbadRg&amp;list=PLbpi6ZahtOH6Blw3RGYpWkSByi_T7Rygb"><span>Meine Lieblingsvideos</span></a></h3>
      </yt-lockup-metadata-view-model>
    </div>
  </yt-lockup-view-model>
</ytd-rich-item-renderer>
<ytd-video-renderer id="search">
  <a id="thumbnail" href="/watch?v=hTSaweR8qMI"></a>
  <a id="video-title" title="1$ vs. 500.000$ Date" aria-label="1$ vs. 500.000$ Date 17 Minuten" href="/watch?v=hTSaweR8qMI">
    <yt-formatted-string aria-label="1$ vs. 500.000$ Date 17 Minuten">1$ vs. 500.000$ Date</yt-formatted-string>
  </a>
</ytd-video-renderer>
<ytm-shorts-lockup-view-model id="short">
  <a href="/shorts/41UzbuW6wJs"></a>
  <h3><a href="/shorts/41UzbuW6wJs" title="Kann ein Roboter meine Hausarbeit erledigen?"><span>Kann ein Roboter meine Hausarbeit erledigen?</span></a></h3>
</ytm-shorts-lockup-view-model>
<ytd-watch-flexy video-id="plN7JMbadRg">
  <ytd-watch-metadata>
    <div id="title"><h1><yt-formatted-string title="Iss alles in einem Supermarkt auf">Iss alles in einem Supermarkt auf</yt-formatted-string></h1></div>
  </ytd-watch-metadata>
</ytd-watch-flexy>`;

const ORIGINALS: Record<string, string> = {
  _c2e1NcI3Sc: 'Beat LeBron, Win $100,000',
  hTSaweR8qMI: '$1 vs $500,000 Date!',
  '41UzbuW6wJs': 'Can A Robot Do My Chores?',
  plN7JMbadRg: 'Eat Everything In A Grocery Store, Win $1,000,000',
};

class StubTitles {
  known = new Map<string, string | null>();
  requested: string[] = [];
  peek(videoId: string): string | null | undefined {
    return this.known.has(videoId) ? this.known.get(videoId) : undefined;
  }
  request(videoId: string): void {
    this.requested.push(videoId);
  }
}

function setUrl(url: string): void {
  (window as unknown as { happyDOM: { setURL(value: string): void } }).happyDOM.setURL(url);
}

describe('TitleEngine', () => {
  let titles: StubTitles;
  let reporter: { title: ReturnType<typeof vi.fn> };
  let engine: TitleEngine;

  beforeEach(() => {
    setUrl('https://www.youtube.com/watch?v=plN7JMbadRg');
    document.body.innerHTML = FIXTURE;
    // Without IntersectionObserver the engine requests lookups immediately.
    vi.stubGlobal('IntersectionObserver', undefined);
    titles = new StubTitles();
    reporter = { title: vi.fn() };
    engine = new TitleEngine(document, titles as unknown as TitleService, reporter, createPageContext(document));
  });

  it('requests lookups for unknown titles, but not for playlists', () => {
    engine.scan();
    expect(titles.requested.sort()).toEqual(['41UzbuW6wJs', '_c2e1NcI3Sc', 'hTSaweR8qMI', 'plN7JMbadRg'].sort());
  });

  it('writes originals into the text node and keeps links intact', () => {
    for (const [id, title] of Object.entries(ORIGINALS)) titles.known.set(id, title);
    const link = document.querySelector('#lockup h3 a');
    engine.scan();
    const h3 = document.querySelector('#lockup h3');
    expect(h3?.querySelector('a')).toBe(link);
    expect(link?.textContent).toBe('Beat LeBron, Win $100,000');
    expect(h3?.getAttribute('title')).toBe('Beat LeBron, Win $100,000');
    expect(link?.getAttribute('aria-label')).toBe('Beat LeBron, Win $100,000 22 Minuten');
    expect(document.querySelector('#search yt-formatted-string')?.textContent).toBe('$1 vs $500,000 Date!');
    expect(document.querySelector('#search #video-title')?.getAttribute('title')).toBe('$1 vs $500,000 Date!');
    expect(document.querySelector('#short h3 span')?.textContent).toBe('Can A Robot Do My Chores?');
    expect(document.querySelector('ytd-watch-metadata h1')?.textContent).toBe('Eat Everything In A Grocery Store, Win $1,000,000');
    expect(document.querySelector('#playlist h3')?.textContent).toBe('Meine Lieblingsvideos');
    expect(reporter.title).toHaveBeenCalledTimes(4);
    expect(reporter.title).toHaveBeenCalledWith('_c2e1NcI3Sc', 'Beat LeBron, Win $100,000', 'Besiege Haaland und gewinne 100.000 $');
  });

  it('is idempotent across scans', () => {
    for (const [id, title] of Object.entries(ORIGINALS)) titles.known.set(id, title);
    engine.scan();
    engine.scan();
    expect(reporter.title).toHaveBeenCalledTimes(4);
  });

  it('leaves the watch title alone while the URL points at another video', () => {
    setUrl('https://www.youtube.com/watch?v=hTSaweR8qMI');
    titles.known.set('plN7JMbadRg', ORIGINALS.plN7JMbadRg ?? '');
    engine.scan();
    expect(document.querySelector('ytd-watch-metadata h1')?.textContent).toBe('Iss alles in einem Supermarkt auf');
  });

  it('re-applies when YouTube re-renders the text and follows recycled elements', () => {
    titles.known.set('_c2e1NcI3Sc', ORIGINALS._c2e1NcI3Sc ?? '');
    titles.known.set('hTSaweR8qMI', ORIGINALS.hTSaweR8qMI ?? '');
    engine.scan();
    const span = document.querySelector('#lockup h3 span');
    if (!span) throw new Error('fixture');
    span.textContent = 'Besiege Haaland und gewinne 100.000 $';
    engine.scan();
    expect(span.textContent).toBe('Beat LeBron, Win $100,000');

    // YouTube reuses the element for another video.
    document.querySelector('#lockup .ytLockupViewModelHost')?.setAttribute('class', 'ytLockupViewModelHost content-id-hTSaweR8qMI');
    span.textContent = '1$ vs. 500.000$ Date';
    engine.scan();
    expect(span.textContent).toBe('$1 vs $500,000 Date!');
  });

  it('does nothing when the shown title already is the original', () => {
    titles.known.set('41UzbuW6wJs', 'Kann ein Roboter meine Hausarbeit erledigen?');
    engine.scan();
    expect(reporter.title).not.toHaveBeenCalled();
  });

  it('puts YouTube’s text back when switched off', () => {
    for (const [id, title] of Object.entries(ORIGINALS)) titles.known.set(id, title);
    engine.scan();
    engine.revertAll();
    expect(document.querySelector('#lockup h3 span')?.textContent).toBe('Besiege Haaland und gewinne 100.000 $');
    expect(document.querySelector('#lockup h3')?.getAttribute('title')).toBe('Besiege Haaland und gewinne 100.000 $');
    expect(document.querySelector('#search yt-formatted-string')?.textContent).toBe('1$ vs. 500.000$ Date');
  });

  it('skips videos YouTube has no original for', () => {
    titles.known.set('_c2e1NcI3Sc', null);
    engine.scan();
    expect(document.querySelector('#lockup h3 span')?.textContent).toBe('Besiege Haaland und gewinne 100.000 $');
    expect(titles.requested).not.toContain('_c2e1NcI3Sc');
  });
});

describe('player surfaces', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined);
  });

  it('restores a miniplayer YouTube restored on a fresh page without a watch page', () => {
    (window as unknown as { happyDOM: { setURL(value: string): void } }).happyDOM.setURL('https://www.youtube.com/');
    document.body.innerHTML = `
      <ytd-miniplayer class="ytdMiniplayerComponentHost">
        <ytd-miniplayer-info-bar><div class="ytdMiniplayerInfoBarContent">
          <h1 class="ytdMiniplayerInfoBarTitle"><span>Iss alles in einem Supermarkt auf</span></h1>
          <div class="ytdMiniplayerInfoBarSubtitle"><h1><span>Weiter ansehen</span></h1></div>
        </div></ytd-miniplayer-info-bar>
      </ytd-miniplayer>`;
    const titles = new StubTitles();
    titles.known.set('plN7JMbadRg', 'Eat Everything');
    const engine = new TitleEngine(document, titles as unknown as TitleService, { title: vi.fn() }, createPageContext(document, () => 'plN7JMbadRg'));
    engine.scan();
    expect(document.querySelector('.ytdMiniplayerInfoBarTitle')?.textContent).toBe('Eat Everything');
    expect(document.querySelector('.ytdMiniplayerInfoBarSubtitle')?.textContent).toBe('Weiter ansehen');
  });

  it('restores end-screen cards by their own link', () => {
    document.body.innerHTML = `
      <div id="movie_player">
        <div class="ytp-ce-element"><a class="ytp-ce-covering-overlay" href="https://www.youtube.com/watch?v=gTKS8SAwUzE"></a>
          <div class="ytp-ce-video-title">Wir haben an den extremsten Orten überlebt</div></div>
        <div class="ytp-ce-element"><a class="ytp-ce-covering-overlay" href="https://www.youtube.com/watch?v=hTSaweR8qMI"></a>
          <div class="ytp-ce-video-title">1$ vs. 500.000$ Date</div></div>
      </div>`;
    const titles = new StubTitles();
    titles.known.set('gTKS8SAwUzE', 'I Survived The Most Extreme Places On Earth');
    titles.known.set('hTSaweR8qMI', '$1 vs $500,000 Date!');
    const engine = new TitleEngine(document, titles as unknown as TitleService, { title: vi.fn() }, createPageContext(document));
    engine.scan();
    expect([...document.querySelectorAll('.ytp-ce-video-title')].map(element => element.textContent))
      .toEqual(['I Survived The Most Extreme Places On Earth', '$1 vs $500,000 Date!']);
  });
});
