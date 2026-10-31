/**
 * Safety net for player chrome YouTube keeps redesigning (miniplayer variants,
 * "continue watching" cards): inside mini-player containers, any text node that
 * reads exactly like the player's translated title becomes the creator's title.
 * Exact matching of a whole title keeps this from touching anything else.
 */

import type { VideoInfo } from '../shared/messages.js';
import { normalizeText, sameText } from '../shared/youtube.js';
import { writeText, type TitleReporter } from './title-engine.js';

const CONTAINERS = 'ytd-miniplayer, [class*="iniplayer"]';

export class PlayerTitleSweep {
  private video: VideoInfo | null = null;
  private readonly written = new Map<Element, string>();

  constructor(private readonly doc: Document, private readonly reporter: TitleReporter) {}

  setVideo(info: VideoInfo): void {
    if (info.surface === 'shorts') return;
    this.video = info;
  }

  apply(): void {
    const video = this.video;
    const translated = video?.displayedTitle;
    if (!video || !translated || sameText(translated, video.title)) return;
    const wanted = normalizeText(translated);
    for (const element of this.written.keys()) if (!element.isConnected) this.written.delete(element);
    const seen = new Set<Element>();
    for (const container of this.doc.querySelectorAll(CONTAINERS)) {
      for (const element of container.querySelectorAll('*')) {
        if (seen.has(element) || element.childElementCount > 0) continue;
        seen.add(element);
        if (normalizeText(element.textContent) !== wanted) continue;
        writeText(element, video.title);
        this.written.set(element, translated);
        this.reporter.title(video.videoId, video.title, translated);
      }
    }
  }

  revertAll(): void {
    for (const [element, translated] of this.written) {
      if (element.isConnected) writeText(element, translated);
    }
    this.written.clear();
  }
}
