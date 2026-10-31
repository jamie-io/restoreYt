/**
 * Background (service worker in Chromium, event page in Firefox).
 * - Turns the thumbnail redirect ruleset on/off with the settings.
 * - Shows the per-tab restore count on the toolbar icon.
 * - Prunes old title-cache entries and keys from earlier releases.
 */

import { ext, loadSettings } from './shared/ext.js';
import { MESSAGE, type RuntimeMessage } from './shared/messages.js';
import { isActive, LEGACY_KEYS, SETTING_KEYS, type Settings } from './shared/settings.js';
import { isExpired, isStoredTitle, TITLE_KEY_PREFIX } from './content/title-store.js';
import { LIFETIME_KEY, type LifetimeStats } from './content/report.js';

const THUMBNAIL_RULESET = 'thumbnails';
const MAX_CACHED_TITLES = 20000;
const BADGE_COLOR = '#2b2a27';

async function syncRulesets(settings: Settings): Promise<void> {
  const want = isActive(settings, 'thumbnails');
  try {
    const enabled = await ext.declarativeNetRequest.getEnabledRulesets();
    if (enabled.includes(THUMBNAIL_RULESET) === want) return;
    await ext.declarativeNetRequest.updateEnabledRulesets(
      want ? { enableRulesetIds: [THUMBNAIL_RULESET] } : { disableRulesetIds: [THUMBNAIL_RULESET] },
    );
  } catch (error) {
    console.warn('[restoreyt] could not update thumbnail rules', error);
  }
}

export async function pruneTitleCache(now = Date.now()): Promise<number> {
  const all = await ext.storage.local.get(null);
  const titles: Array<[string, number]> = [];
  const remove: string[] = [];
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(TITLE_KEY_PREFIX)) continue;
    if (!isStoredTitle(value) || isExpired(value, now)) remove.push(key);
    else titles.push([key, value.at]);
  }
  if (titles.length > MAX_CACHED_TITLES) {
    titles.sort((a, b) => a[1] - b[1]);
    for (const [key] of titles.slice(0, titles.length - MAX_CACHED_TITLES)) remove.push(key);
  }
  if (remove.length > 0) await ext.storage.local.remove(remove);
  return remove.length;
}

async function removeLegacyKeys(): Promise<void> {
  await Promise.allSettled([
    ext.storage.local.remove([...LEGACY_KEYS]),
    ext.storage.sync.remove([...LEGACY_KEYS]),
  ]);
}

async function housekeeping(): Promise<void> {
  const settings = await loadSettings();
  await syncRulesets(settings);
  try {
    await pruneTitleCache();
  } catch {
    // storage unavailable; try again next start
  }
}

async function setBadge(tabId: number, count: number): Promise<void> {
  const settings = await loadSettings();
  const text = !settings.enabled ? '' : settings.badge && count > 0 ? (count > 999 ? '999+' : String(count)) : '';
  try {
    await ext.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR });
    if (typeof ext.action.setBadgeTextColor === 'function') await ext.action.setBadgeTextColor({ tabId, color: '#ffffff' });
    await ext.action.setBadgeText({ tabId, text });
  } catch {
    // Tab closed before the update landed.
  }
}

async function refreshDisabledState(settings: Settings): Promise<void> {
  try {
    await ext.action.setTitle({ title: settings.enabled ? 'restoreyt' : 'restoreyt (paused)' });
    if (!settings.enabled || !settings.badge) {
      const tabs = await ext.tabs.query({ url: ['*://www.youtube.com/*'] });
      await Promise.allSettled(tabs.map(tab => (tab.id === undefined ? undefined : ext.action.setBadgeText({ tabId: tab.id, text: '' }))));
    }
  } catch {
    // tabs permission-less query can fail on some builds; badge clears on next update anyway
  }
}

const COUNTERS = ['titles', 'descriptions', 'thumbnails', 'audio', 'captions'] as const;
let statsQueue: Promise<void> = Promise.resolve();

/** Add to lifetime counters. Updates are chained so concurrent tabs never lose counts. */
function addStats(delta: Partial<Record<(typeof COUNTERS)[number], number>>): Promise<void> {
  statsQueue = statsQueue.then(async () => {
    const stored = await ext.storage.local.get(LIFETIME_KEY);
    const current = (stored[LIFETIME_KEY] ?? {}) as Partial<LifetimeStats>;
    const next: LifetimeStats = { titles: 0, descriptions: 0, thumbnails: 0, audio: 0, captions: 0, since: current.since ?? Date.now() };
    for (const counter of COUNTERS) {
      const add = delta[counter];
      next[counter] = (current[counter] ?? 0) + (typeof add === 'number' && add > 0 && add < 100_000 ? Math.floor(add) : 0);
    }
    await ext.storage.local.set({ [LIFETIME_KEY]: next });
  }).catch(() => undefined);
  return statsQueue;
}

ext.runtime.onInstalled.addListener(() => {
  void removeLegacyKeys().then(housekeeping);
});

ext.runtime.onStartup.addListener(() => {
  void housekeeping();
});

ext.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync' || !SETTING_KEYS.some(key => key in changes)) return;
  void loadSettings().then(settings => {
    void syncRulesets(settings);
    void refreshDisabledState(settings);
  });
});

ext.runtime.onMessage.addListener((message: unknown, sender) => {
  const typed = message as RuntimeMessage | null;
  if (typed?.type === MESSAGE.badge && sender.tab?.id !== undefined && typeof typed.count === 'number') {
    void setBadge(sender.tab.id, typed.count);
  } else if (typed?.type === MESSAGE.stats && typed.delta && typeof typed.delta === 'object') {
    void addStats(typed.delta);
  }
  return undefined;
});
