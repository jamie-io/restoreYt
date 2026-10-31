// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import {
  buildDescription,
  parseTimestamp,
  tokenizeDescription,
  trimUrl,
  truncateDescription,
} from '../../src/content/description-format';

describe('tokenizeDescription', () => {
  it('finds links, timestamps, hashtags and handles', () => {
    const tokens = tokenizeDescription('Intro 0:00\nBuild 12:34 (see https://example.com/a_b?x=1).\n#shorts by @MrBeast');
    expect(tokens.filter(token => token.type !== 'text')).toEqual([
      { type: 'time', text: '0:00', seconds: 0 },
      { type: 'time', text: '12:34', seconds: 754 },
      { type: 'url', text: 'https://example.com/a_b?x=1', href: 'https://example.com/a_b?x=1' },
      { type: 'hashtag', text: '#shorts', tag: 'shorts' },
      { type: 'mention', text: '@MrBeast', handle: 'MrBeast' },
    ]);
  });

  it('keeps every character of the original text', () => {
    const text = 'A (https://example.com/x). B: 1:02:03, mail me@example.com #1 #tag! @a';
    const rebuilt = tokenizeDescription(text).map(token => token.text).join('');
    expect(rebuilt).toBe(text);
  });

  it('does not treat emails, numbers or clock ranges as handles or tags', () => {
    const tokens = tokenizeDescription('mail me@example.com or call #1 at 10:30-11:45:99');
    expect(tokens.some(token => token.type === 'mention' || token.type === 'hashtag')).toBe(false);
  });

  it('parses timestamps strictly', () => {
    expect(parseTimestamp('1:02:03')).toBe(3723);
    expect(parseTimestamp('9:59')).toBe(599);
    expect(parseTimestamp('9:60')).toBeNull();
    expect(parseTimestamp('1:60:00')).toBeNull();
  });

  it('trims sentence punctuation and unbalanced brackets from URLs', () => {
    expect(trimUrl('https://example.com/a).')).toBe('https://example.com/a');
    expect(trimUrl('https://en.wikipedia.org/wiki/Foo_(bar)')).toBe('https://en.wikipedia.org/wiki/Foo_(bar)');
    expect(trimUrl('https://example.com/a!?')).toBe('https://example.com/a');
  });
});

describe('truncateDescription', () => {
  it('cuts on a word boundary', () => {
    expect(truncateDescription('one two three four five', 16)).toBe('one two three');
    expect(truncateDescription('short', 50)).toBe('short');
  });

  it('cuts inside a very long word instead of dropping most of the text', () => {
    expect(truncateDescription('a https://example.com/very/long/path', 20)).toBe('a https://example.co');
  });
});

describe('buildDescription', () => {
  it('builds safe links and seeks on timestamps', () => {
    const onSeek = vi.fn();
    const node = buildDescription(document, 'Go 1:05 https://example.com/x #tag @handle\njavascript:alert(1)', { videoId: 'plN7JMbadRg', onSeek });
    const links = [...node.querySelectorAll('a')];
    expect(links.map(link => link.getAttribute('href'))).toEqual([
      '/watch?v=plN7JMbadRg&t=65s',
      'https://example.com/x',
      '/hashtag/tag',
      '/@handle',
    ]);
    expect(links[1]?.getAttribute('rel')).toBe('noopener noreferrer nofollow');
    expect(node.textContent).toContain('javascript:alert(1)');
    expect(node.innerHTML).not.toContain('<script');
    links[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onSeek).toHaveBeenCalledWith(65);
  });

  it('never parses creator text as HTML', () => {
    const node = buildDescription(document, '<img src=x onerror=alert(1)> <b>bold</b>', { videoId: 'plN7JMbadRg', onSeek: () => undefined });
    expect(node.querySelector('img, b')).toBeNull();
    expect(node.textContent).toBe('<img src=x onerror=alert(1)> <b>bold</b>');
  });
});
