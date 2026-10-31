/**
 * Turns a plain-text YouTube description into safe DOM: links, clickable
 * timestamps, hashtags and @handles. Never uses HTML parsing; every piece of
 * creator text ends up in a text node.
 */

export type DescriptionToken =
  | { type: 'text'; text: string }
  | { type: 'url'; text: string; href: string }
  | { type: 'time'; text: string; seconds: number }
  | { type: 'hashtag'; text: string; tag: string }
  | { type: 'mention'; text: string; handle: string };

const PATTERN = /(https?:\/\/[^\s<>"'`]+)|((?<![\w:.])(?:\d{1,2}:)?\d{1,2}:\d{2}(?![\w:]))|((?<![\p{L}\p{N}_#&/])#[\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)|((?<![\p{L}\p{N}_.@/])@[\p{L}\p{N}._-]{3,30})/gu;

export function parseTimestamp(text: string): number | null {
  const parts = text.split(':').map(part => Number.parseInt(part, 10));
  if (parts.some(part => !Number.isFinite(part))) return null;
  if (parts.length === 2) {
    const [minutes = 0, seconds = 0] = parts;
    return seconds < 60 ? minutes * 60 + seconds : null;
  }
  if (parts.length === 3) {
    const [hours = 0, minutes = 0, seconds = 0] = parts;
    return minutes < 60 && seconds < 60 ? hours * 3600 + minutes * 60 + seconds : null;
  }
  return null;
}

/** Drop trailing punctuation that belongs to the sentence, not the URL. */
export function trimUrl(raw: string): string {
  let url = raw;
  for (;;) {
    const before = url;
    url = url.replace(/[.,!?;:'"]+$/, '');
    for (const [open, close] of [['(', ')'], ['[', ']']] as const) {
      if (url.endsWith(close) && url.split(close).length > url.split(open).length) url = url.slice(0, -1);
    }
    if (url === before) return url;
  }
}

function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function tokenizeDescription(description: string): DescriptionToken[] {
  const tokens: DescriptionToken[] = [];
  const pushText = (text: string): void => {
    if (!text) return;
    const last = tokens.at(-1);
    if (last?.type === 'text') last.text += text;
    else tokens.push({ type: 'text', text });
  };
  let cursor = 0;
  for (const match of description.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    const [whole, url, time, hashtag, mention] = match;
    pushText(description.slice(cursor, start));
    cursor = start + whole.length;
    if (url) {
      const text = trimUrl(url);
      const href = safeHttpUrl(text);
      if (href) tokens.push({ type: 'url', text, href });
      else pushText(text);
      pushText(url.slice(text.length));
    } else if (time) {
      const seconds = parseTimestamp(time);
      if (seconds === null) pushText(time);
      else tokens.push({ type: 'time', text: time, seconds });
    } else if (hashtag) {
      tokens.push({ type: 'hashtag', text: hashtag, tag: hashtag.slice(1) });
    } else if (mention) {
      const handle = mention.replace(/[._-]+$/, '');
      tokens.push({ type: 'mention', text: handle, handle: handle.slice(1) });
      pushText(mention.slice(handle.length));
    } else {
      pushText(whole);
    }
  }
  pushText(description.slice(cursor));
  return tokens;
}

/** Cut to roughly `maxLength` characters on a word boundary. */
export function truncateDescription(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const boundary = cut.search(/\s\S*$/);
  return (boundary > maxLength * 0.6 ? cut.slice(0, boundary) : cut).trimEnd();
}

export interface DescriptionLinks {
  videoId: string;
  onSeek(seconds: number): void;
}

export function buildDescription(doc: Document, text: string, links: DescriptionLinks): HTMLElement {
  const root = doc.createElement('span');
  root.className = 'restoreyt-description';
  for (const token of tokenizeDescription(text)) {
    if (token.type === 'text') {
      root.append(doc.createTextNode(token.text));
      continue;
    }
    const anchor = doc.createElement('a');
    anchor.className = 'restoreyt-link';
    anchor.textContent = token.text;
    if (token.type === 'url') {
      anchor.href = token.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer nofollow';
    } else if (token.type === 'time') {
      anchor.href = `/watch?v=${encodeURIComponent(links.videoId)}&t=${token.seconds}s`;
      anchor.dataset.seconds = String(token.seconds);
      anchor.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        links.onSeek(token.seconds);
      });
    } else if (token.type === 'hashtag') {
      anchor.href = `/hashtag/${encodeURIComponent(token.tag.toLowerCase())}`;
    } else {
      anchor.href = `/@${encodeURIComponent(token.handle)}`;
    }
    if (token.type !== 'time') anchor.addEventListener('click', event => event.stopPropagation());
    root.append(anchor);
  }
  return root;
}
