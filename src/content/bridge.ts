import {
  BRIDGE_TO_CONTENT,
  BRIDGE_TO_PAGE,
  decodeBridge,
  encodeBridge,
  type ContentToPage,
  type PageToContent,
} from '../shared/messages.js';

export interface BridgeLookupResult {
  title: string | null;
  status: 'ok' | 'missing' | 'error';
}

type Handler = (message: PageToContent) => void;

/** Isolated-world end of the CustomEvent channel to the page-world script. */
export class PageBridge {
  private readonly handlers = new Set<Handler>();
  private readonly pending = new Map<number, (result: BridgeLookupResult) => void>();
  private nextRequestId = 1;
  private pageReady = false;

  constructor(private readonly doc: Document) {
    doc.addEventListener(BRIDGE_TO_CONTENT, event => this.receive((event as CustomEvent<unknown>).detail));
  }

  get ready(): boolean {
    return this.pageReady;
  }

  on(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  send(message: ContentToPage): void {
    this.doc.dispatchEvent(new CustomEvent(BRIDGE_TO_PAGE, { detail: encodeBridge(message) }));
  }

  /** Ask the page world for a title through YouTube's player endpoint. */
  lookup(videoId: string, timeoutMs = 9000): Promise<BridgeLookupResult> {
    if (!this.pageReady) return Promise.resolve({ title: null, status: 'error' });
    const requestId = this.nextRequestId;
    this.nextRequestId += 1;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        resolve({ title: null, status: 'error' });
      }, timeoutMs);
      this.pending.set(requestId, result => {
        clearTimeout(timer);
        resolve(result);
      });
      this.send({ type: 'lookup', requestId, videoId });
    });
  }

  private receive(detail: unknown): void {
    const message = decodeBridge<PageToContent>(detail);
    if (!message) return;
    if (message.type === 'hello') this.pageReady = true;
    if (message.type === 'lookup-result') {
      const resolve = this.pending.get(message.requestId);
      if (resolve) {
        this.pending.delete(message.requestId);
        resolve({ title: typeof message.title === 'string' ? message.title : null, status: message.status });
      }
      return;
    }
    for (const handler of this.handlers) {
      try {
        handler(message);
      } catch {
        // A failing handler must not stop the others.
      }
    }
  }
}
