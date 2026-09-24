import { createDefaultSettings, normalizeSettings, type Settings } from '../core/settings.js';

interface ScriptElement {
  type?: string;
  src?: string;
  addEventListener: (type: 'load' | 'error', listener: () => void, options?: { once?: boolean }) => void;
}

export interface BootstrapAdapter {
  createScript: () => ScriptElement;
  append: (script: ScriptElement) => void;
  getUrl: (file: string) => string;
}

export interface BundleResult {
  ok: boolean;
  error?: string;
}

export function createSettingsDataBlock(settings: unknown): {
  id: string;
  type: 'application/json';
  textContent: string;
} {
  const safeJson = JSON.stringify(normalizeSettings(settings))
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
  return {
    id: 'restoreyt-settings',
    type: 'application/json',
    textContent: safeJson,
  };
}

export function injectClassicBundle(adapter: BootstrapAdapter, file: string): Promise<BundleResult> {
  return new Promise(resolve => {
    const script = adapter.createScript();
    script.type = 'text/javascript';
    script.src = adapter.getUrl(file);
    script.addEventListener('load', () => resolve({ ok: true }), { once: true });
    script.addEventListener('error', () => resolve({ ok: false, error: `Failed to load ${file}` }), { once: true });
    adapter.append(script);
  });
}

function resolveApi(): {
  runtime?: {
    getURL?: (file: string) => string;
    sendMessage?: (message: unknown) => void;
    onMessage?: { addListener: (listener: (message: unknown) => void) => void };
  };
  storage?: { local?: { get?: (defaults: Record<string, unknown>, callback?: (values: Record<string, unknown>) => void) => Promise<Record<string, unknown>> | void } };
} | undefined {
  const root = globalThis as typeof globalThis & { browser?: ReturnType<typeof resolveApi>; chrome?: ReturnType<typeof resolveApi> };
  return root.browser ?? root.chrome;
}

async function readSettings(api: ReturnType<typeof resolveApi>): Promise<Settings> {
  const defaults = createDefaultSettings() as unknown as Record<string, unknown>;
  const storage = api?.storage?.local;
  if (!storage?.get) return normalizeSettings(defaults);
  const result = storage.get(defaults);
  const stored = result && typeof result.then === 'function'
    ? await result
    : await new Promise<Record<string, unknown>>(resolve => storage.get?.(defaults, resolve));
  return normalizeSettings(stored);
}

export async function startContentBootstrap(
  doc: Document,
  api: ReturnType<typeof resolveApi> = resolveApi(),
): Promise<BundleResult> {
  const settings = await readSettings(api);
  const dataBlock = createSettingsDataBlock(settings);
  const scriptData = doc.createElement('script');
  scriptData.id = dataBlock.id;
  scriptData.type = dataBlock.type;
  scriptData.textContent = dataBlock.textContent;
  (doc.head ?? doc.documentElement).appendChild(scriptData);
  api?.runtime?.onMessage?.addListener(message => {
    if (!message || typeof message !== 'object' || (message as { type?: unknown }).type !== 'restoreyt:settings-changed') return;
    void readSettings(api).then(nextSettings => {
      scriptData.textContent = createSettingsDataBlock(nextSettings).textContent;
      doc.dispatchEvent(new CustomEvent('restoreyt:settings-ready'));
    });
  });

  const result = await injectClassicBundle({
    createScript: () => doc.createElement('script'),
    append: script => (doc.head ?? doc.documentElement).appendChild(script as HTMLScriptElement),
    getUrl: file => api?.runtime?.getURL?.(file) ?? file,
  }, 'build/main.js');

  if (result.ok) {
    doc.dispatchEvent(new CustomEvent('restoreyt:settings-ready'));
  } else {
    api?.runtime?.sendMessage?.({ type: 'restoreyt:bootstrap-failed', error: result.error });
  }
  return result;
}

if (typeof document !== 'undefined') {
  void startContentBootstrap(document);
}
