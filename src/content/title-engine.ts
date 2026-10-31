/**
 * Applies original titles to every title surface on the page.
 *
 * - Known originals (memory cache) are written synchronously during a scan, so
 *   cached titles never flash in translation.
 * - Unknown ones are looked up only when the element is near the viewport.
 * - Only the innermost text node changes; links, layout and YouTube's own
 *   elements stay intact. Element recycling is handled by re-resolving the
 *   video ID on every scan.
 */

import { normalizeText, sameText } from '../shared/youtube.js';
import { TITLE_SURFACES, type PageContext, type TitleSurface } from './surfaces.js';
import type { TitleService } from './title-service.js';

export interface TitleReporter {
  title(videoId: string, original: string, replaced: string): void;
}

interface HostState {
  videoId: string;
  /** Text YouTube displayed before we changed it. */
  displayed: string;
  /** Exact text we wrote. */
  written: string;
}

interface Pending {
  videoId: string;
  displayed: string;
}

const ATTRIBUTES = ['title', 'aria-label'] as const;

export function writeText(target: Element, text: string): void {
  const nodes = target.childNodes;
  if (nodes.length === 1 && nodes[0]?.nodeType === 3) {
    if (nodes[0].nodeValue !== text) nodes[0].nodeValue = text;
    return;
  }
  target.replaceChildren(target.ownerDocument.createTextNode(text));
}

function swapAttributes(elements: Element[], from: string, to: string): void {
  if (!from || from === to) return;
  for (const element of elements) {
    for (const attribute of ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (!value) continue;
      if (sameText(value, from)) element.setAttribute(attribute, to);
      else if (value.includes(from)) element.setAttribute(attribute, value.replace(from, to));
    }
  }
}

export class TitleEngine {
  private readonly states = new WeakMap<Element, HostState>();
  private readonly pending = new WeakMap<Element, Pending>();
  private readonly observer: IntersectionObserver | null;

  constructor(
    private readonly doc: Document,
    private readonly service: TitleService,
    private readonly reporter: TitleReporter,
    private readonly page: PageContext,
    private readonly surfaces: readonly TitleSurface[] = TITLE_SURFACES,
  ) {
    this.observer = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => this.onIntersect(entries), { rootMargin: '600px 0px 600px 0px' })
      : null;
  }

  scan(): void {
    for (const surface of this.surfaces) {
      const hosts = this.doc.querySelectorAll(surface.selector);
      for (const host of hosts) this.process(host, surface);
    }
  }

  /** Put YouTube's own text back (feature switched off). */
  revertAll(): void {
    for (const surface of this.surfaces) {
      for (const host of this.doc.querySelectorAll(surface.selector)) {
        const state = this.states.get(host);
        const target = surface.text(host);
        if (!state || !target) continue;
        if (target.textContent === state.written) {
          writeText(target, state.displayed);
          swapAttributes(surface.attributeHosts(host), state.written, state.displayed);
        }
        this.states.delete(host);
      }
    }
  }

  private process(host: Element, surface: TitleSurface): void {
    const target = surface.text(host);
    if (!target) return;
    const current = target.textContent ?? '';
    const state = this.states.get(host);
    if (state && current === state.written) {
      // Ours, unless the element was recycled for another video.
      const recycledId = surface.videoId(host, this.page);
      if (recycledId === state.videoId) return;
    }
    const displayed = normalizeText(current);
    if (!displayed) return;
    const videoId = surface.videoId(host, this.page);
    if (!videoId) return;

    const original = this.service.peek(videoId, displayed);
    if (original === undefined) {
      this.wait(host, videoId, displayed);
      return;
    }
    this.pending.delete(host);
    if (original === null) return;
    if (sameText(original, displayed)) {
      this.states.set(host, { videoId, displayed: current, written: current });
      return;
    }
    writeText(target, original);
    swapAttributes(surface.attributeHosts(host), displayed, original);
    this.states.set(host, { videoId, displayed: current, written: target.textContent ?? original });
    this.reporter.title(videoId, original, displayed);
  }

  private wait(host: Element, videoId: string, displayed: string): void {
    const previous = this.pending.get(host);
    if (previous && previous.videoId === videoId && previous.displayed === displayed) return;
    this.pending.set(host, { videoId, displayed });
    if (this.observer) {
      this.observer.unobserve(host);
      this.observer.observe(host);
    } else {
      this.service.request(videoId, displayed);
    }
  }

  private onIntersect(entries: IntersectionObserverEntry[]): void {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const host = entry.target;
      this.observer?.unobserve(host);
      const pending = this.pending.get(host);
      if (pending) this.service.request(pending.videoId, pending.displayed);
    }
  }
}
