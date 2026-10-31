/**
 * WebExtension API handle. Firefox exposes `browser`, Chromium exposes `chrome`;
 * both return promises from the MV3 APIs used here.
 */
import { DEFAULT_SETTINGS, normalizeSettings, SETTING_KEYS, type Settings } from './settings.js';

export const ext: typeof chrome = ((globalThis as { browser?: typeof chrome }).browser ?? globalThis.chrome);

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await ext.storage.sync.get({ ...DEFAULT_SETTINGS });
    return normalizeSettings(stored);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const clean: Partial<Settings> = {};
  for (const key of SETTING_KEYS) {
    const value = patch[key];
    if (typeof value === 'boolean') clean[key] = value;
  }
  await ext.storage.sync.set(clean);
}

/** Subscribe to settings changes from any context. Returns an unsubscribe function. */
export function watchSettings(listener: (settings: Settings) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'sync') return;
    if (!SETTING_KEYS.some(key => key in changes)) return;
    void loadSettings().then(listener);
  };
  ext.storage.onChanged.addListener(handler);
  return () => ext.storage.onChanged.removeListener(handler);
}
