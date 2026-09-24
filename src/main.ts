import { normalizeSettings, type Settings } from './core/settings.js';
import { createDiagnosticsBuffer } from './core/diagnostics.js';
import { createLruCache } from './core/cache.js';
import { createInnerTubeClient } from './platform/api.js';
import { discoverRuntimeConfig } from './platform/config.js';
import { createFeatureRuntime, type FeatureRuntime } from './features/runtime.js';

export function readSettingsDataBlock(doc: Document): Settings {
  const block = doc.getElementById('restoreyt-settings');
  if (!block) return normalizeSettings({});
  try {
    return normalizeSettings(JSON.parse(block.textContent || '{}'));
  } catch {
    return normalizeSettings({});
  }
}

export function startMainWorld(doc: Document, win: Window = window): { settings: Settings; runtime: FeatureRuntime | null } {
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
  doc.dispatchEvent(new CustomEvent('restoreyt:main-ready'));
  return { settings, runtime };
}

if (typeof document !== 'undefined') {
  document.addEventListener('restoreyt:settings-ready', () => { startMainWorld(document); }, { once: true });
}
