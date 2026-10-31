/**
 * Restores the creator's description on the watch page. The original text comes
 * from the page's own player response (no network). It is only written when the
 * shown text is a translation, so untranslated descriptions keep YouTube's rich
 * rendering (video chips, shortened links).
 */

import type { VideoInfo } from '../shared/messages.js';
import { normalizeText, textContainment } from '../shared/youtube.js';
import { buildDescription, truncateDescription } from './description-format.js';
import type { PageContext } from './surfaces.js';

export interface DescriptionReporter {
  description(videoId: string, original: string, replaced: string): void;
}

/** Below this share of shared words the shown description is treated as a translation. */
export const TRANSLATION_THRESHOLD = 0.6;
const MAX_REWRITES_PER_TARGET = 25;
const OURS = ':scope > .restoreyt-description';

function excerpt(text: string): string {
  const line = text.split(/\r?\n/).map(part => part.trim()).find(Boolean) ?? '';
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

export class DescriptionRestorer {
  private video: VideoInfo | null = null;
  private readonly saved = new WeakMap<Element, Node[]>();
  private readonly rewrites = new Map<string, number>();
  private readonly reported = new Set<string>();

  constructor(
    private readonly doc: Document,
    private readonly reporter: DescriptionReporter,
    private readonly page: PageContext,
    private readonly onSeek: (seconds: number) => void,
  ) {}

  setVideo(info: VideoInfo): void {
    if (info.surface !== 'watch' || !info.description) return;
    if (this.video?.videoId !== info.videoId) this.rewrites.clear();
    this.video = info;
  }

  apply(): void {
    const video = this.video;
    const original = video?.description;
    if (!video || !original || this.page.watchVideoId() !== video.videoId) return;
    const expander = this.doc.querySelector('ytd-watch-metadata #description-inline-expander');
    if (!expander) return;
    const target = { ...video, description: original };
    const snippet = expander.querySelector('#attributed-snippet-text');
    const expanded = expander.querySelector('#expanded yt-attributed-string');
    if (snippet) this.fill(snippet, true, target);
    if (expanded) this.fill(expanded, false, target);
  }

  revertAll(): void {
    for (const target of this.doc.querySelectorAll('ytd-watch-metadata #description-inline-expander yt-attributed-string')) {
      const ours = target.querySelector(OURS);
      if (!ours) continue;
      const saved = this.saved.get(target);
      if (saved) target.replaceChildren(...saved);
      else ours.remove();
    }
    this.rewrites.clear();
  }

  private fill(target: Element, isSnippet: boolean, video: VideoInfo & { description: string }): void {
    const ours = target.querySelector(OURS);
    if (ours?.getAttribute('data-video-id') === video.videoId) return;
    const shown = target.textContent ?? '';
    if (!normalizeText(shown)) return;
    if (!ours && textContainment(shown, video.description) >= TRANSLATION_THRESHOLD) return;

    const key = `${video.videoId}:${isSnippet ? 'snippet' : 'full'}`;
    const count = (this.rewrites.get(key) ?? 0) + 1;
    if (count > MAX_REWRITES_PER_TARGET) return;
    this.rewrites.set(key, count);

    const text = isSnippet ? truncateDescription(video.description, Math.max(shown.length, 120)) : video.description;
    if (!ours) this.saved.set(target, [...target.childNodes]);
    const node = buildDescription(this.doc, text, { videoId: video.videoId, onSeek: this.onSeek });
    node.setAttribute('data-video-id', video.videoId);
    target.replaceChildren(node);

    if (!this.reported.has(video.videoId)) {
      this.reported.add(video.videoId);
      this.reporter.description(video.videoId, excerpt(video.description), excerpt(shown));
    }
  }
}
