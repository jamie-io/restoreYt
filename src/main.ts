import { normalizeSettings, type Settings } from './core/settings.js';
import { createDiagnosticsBuffer } from './core/diagnostics.js';
import { createLruCache } from './core/cache.js';
import { createInnerTubeClient } from './platform/api.js';
import { discoverRuntimeConfig } from './platform/config.js';
import { createFeatureRuntime, type FeatureRuntime } from './features/runtime.js';

export interface MainWorldController {
  settings: Settings;
  runtime: FeatureRuntime | null;
  updateSettings(value: unknown): Promise<void>;
}

export function readSettingsDataBlock(doc: Document): Settings {
  const block = doc.getElementById('restoreyt-settings');
  if (!block) return normalizeSettings({});
  try {
    return normalizeSettings(JSON.parse(block.textContent || '{}'));
  } catch {
    return normalizeSettings({});
  }
}

export function startMainWorld(doc: Document, win: Window = window): MainWorldController {
  const settings = readSettingsDataBlock(doc);
  const config = discoverRuntimeConfig((win as Window & { ytcfg?: unknown }).ytcfg);
  let runtime: FeatureRuntime | null = null;
  if (config) {
    const api = createInnerTubeClient({ config });
    runtime = createFeatureRuntime({
      document: doc,
      window: win,
      api,
      settings,
      diagnostics: createDiagnosticsBuffer({ capacity: 100 }),
    });
    runtime.start();
  }
  const updateSettings = async (value: unknown): Promise<void> => {
    Object.assign(settings, normalizeSettings(value));
    await runtime?.process();
  };
  doc.dispatchEvent(new CustomEvent('restoreyt:main-ready'));
  return { settings, runtime, updateSettings };
}

export function installMainWorld(doc: Document, win: Window = window): void {
  let controller: MainWorldController | null = null;
  doc.addEventListener('restoreyt:settings-ready', () => {
    if (controller?.runtime) {
      void controller.updateSettings(readSettingsDataBlock(doc)).catch(() => undefined);
    } else {
      controller = startMainWorld(doc, win);
    }
  });
}

if (typeof document !== 'undefined') installMainWorld(document);
