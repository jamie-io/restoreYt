/** Keeps the browser tab title in the creator's wording on watch and Shorts pages. */

import { sameText } from '../shared/youtube.js';
import type { PageContext } from './surfaces.js';

interface Known {
  original: string;
  replaced: Set<string>;
}

const MAX_KNOWN = 64;

export class DocumentTitle {
  private readonly known = new Map<string, Known>();
  private lastSwap: { from: string; to: string } | null = null;

  constructor(private readonly doc: Document, private readonly page: PageContext) {}

  remember(videoId: string, original: string, replaced: string | null): void {
    if (!replaced || sameText(replaced, original)) return;
    const entry = this.known.get(videoId) ?? { original, replaced: new Set<string>() };
    entry.original = original;
    entry.replaced.add(replaced);
    this.known.delete(videoId);
    this.known.set(videoId, entry);
    if (this.known.size > MAX_KNOWN) {
      const oldest = this.known.keys().next().value;
      if (oldest !== undefined) this.known.delete(oldest);
    }
  }

  apply(): void {
    const path = this.doc.location?.pathname ?? '';
    const videoId = path === '/watch' ? this.page.watchVideoId() : this.page.shortsVideoId();
    if (!videoId) return;
    const entry = this.known.get(videoId);
    if (!entry) return;
    const title = this.doc.title;
    if (title.includes(entry.original)) return;
    for (const replaced of entry.replaced) {
      if (title.includes(replaced)) {
        this.doc.title = title.replace(replaced, entry.original);
        this.lastSwap = { from: replaced, to: entry.original };
        return;
      }
    }
  }

  revert(): void {
    const swap = this.lastSwap;
    if (swap && this.doc.title.includes(swap.to)) this.doc.title = this.doc.title.replace(swap.to, swap.from);
    this.lastSwap = null;
  }
}
