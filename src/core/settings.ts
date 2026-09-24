const settingsSchema = {
  enabled: { type: 'boolean', defaultValue: true },
  untranslateTitle: { type: 'boolean', defaultValue: true },
  untranslateThumbnail: { type: 'boolean', defaultValue: true },
  untranslateDescription: { type: 'boolean', defaultValue: true },
  untranslateChapters: { type: 'boolean', defaultValue: false },
  untranslateAudio: { type: 'boolean', defaultValue: true },
  untranslateChannelBranding: { type: 'boolean', defaultValue: true },
  whitelistChannels: { type: 'string-array', defaultValue: [] as readonly string[] },
} as const;

type Schema = typeof settingsSchema;
export type Settings = {
  [Key in keyof Schema]: Schema[Key] extends { type: 'boolean' } ? boolean : string[];
};

export const SETTINGS_SCHEMA = settingsSchema;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createDefaultSettings(): Settings {
  return Object.fromEntries(Object.entries(settingsSchema).map(([key, definition]) => [
    key,
    definition.type === 'string-array' ? [...definition.defaultValue] : definition.defaultValue,
  ])) as Settings;
}

export function normalizeSettings(value: unknown): Settings {
  const input = isRecord(value) ? value : {};
  const normalized = createDefaultSettings();

  for (const [key, definition] of Object.entries(settingsSchema)) {
    const candidate = input[key];
    if (definition.type === 'boolean' && typeof candidate === 'boolean') {
      (normalized as Record<string, unknown>)[key] = candidate;
    } else if (definition.type === 'string-array' && Array.isArray(candidate)) {
      (normalized as Record<string, unknown>)[key] = candidate.filter(
        (item): item is string => typeof item === 'string' && item.length > 0,
      );
    }
  }

  return normalized;
}
