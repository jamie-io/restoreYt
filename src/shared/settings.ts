/**
 * Settings schema shared by every extension surface. One source of truth for
 * keys, defaults and normalization.
 */

export interface Settings {
  /** Master switch. When false nothing on YouTube is touched. */
  enabled: boolean;
  /** Creator's original video titles instead of translated or A/B variants. */
  titles: boolean;
  /** Creator's original description text (links, timestamps, hashtags kept working). */
  descriptions: boolean;
  /** Original thumbnails instead of localized or test variants. */
  thumbnails: boolean;
  /** Original audio track instead of dubbed or AI-dubbed audio. */
  audio: boolean;
  /** Stop YouTube from switching subtitles on by itself. */
  captions: boolean;
  /** Hide AI-generated video summaries. */
  hideAi: boolean;
  /** Show a per-tab count on the toolbar icon. */
  badge: boolean;
}

export type SettingKey = keyof Settings;
export type FeatureKey = Exclude<SettingKey, 'enabled' | 'badge'>;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  enabled: true,
  titles: true,
  descriptions: true,
  thumbnails: true,
  audio: true,
  captions: true,
  hideAi: true,
  badge: true,
});

export const SETTING_KEYS = Object.freeze(Object.keys(DEFAULT_SETTINGS) as SettingKey[]);

export const FEATURE_KEYS: readonly FeatureKey[] = Object.freeze([
  'titles',
  'descriptions',
  'thumbnails',
  'audio',
  'captions',
  'hideAi',
]);

/** Keys written by earlier releases. Removed on install/update. */
export const LEGACY_KEYS: readonly string[] = Object.freeze([
  'untranslateTitle',
  'untranslateThumbnail',
  'untranslateDescription',
  'untranslateChapters',
  'untranslateAudio',
  'untranslateChannelBranding',
  'whitelistChannels',
  'restoreyt:feature-states',
]);

export function normalizeSettings(value: unknown): Settings {
  const input = value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const result = { ...DEFAULT_SETTINGS };
  for (const key of SETTING_KEYS) {
    const candidate = input[key];
    if (typeof candidate === 'boolean') result[key] = candidate;
  }
  return result;
}

export function isActive(settings: Settings, feature: FeatureKey): boolean {
  return settings.enabled && settings[feature];
}

export function settingsEqual(a: Settings, b: Settings): boolean {
  return SETTING_KEYS.every(key => a[key] === b[key]);
}
