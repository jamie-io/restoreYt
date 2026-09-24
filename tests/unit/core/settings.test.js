import * as core from '../../../src/core/index.ts';

const api = name => {
  expect(core[name], `${name} export`).toBeTypeOf('function');
  return core[name];
};

describe('settings schema', () => {
  it('provides current defaults and independent whitelist arrays', () => {
    const createDefaultSettings = api('createDefaultSettings');
    const first = createDefaultSettings();
    const second = createDefaultSettings();

    expect(first).toEqual({
      enabled: true,
      untranslateTitle: true,
      untranslateThumbnail: true,
      untranslateDescription: true,
      untranslateChapters: false,
      untranslateAudio: true,
      untranslateChannelBranding: true,
      whitelistChannels: [],
    });
    first.whitelistChannels.push('UC123');
    expect(second.whitelistChannels).toEqual([]);
  });

  it('normalizes invalid values from storage to schema defaults', () => {
    const normalizeSettings = api('normalizeSettings');

    expect(normalizeSettings({
      enabled: 'yes',
      untranslateTitle: false,
      whitelistChannels: ['UC123', 4, ''],
      unknownSetting: true,
    })).toEqual({
      enabled: true,
      untranslateTitle: false,
      untranslateThumbnail: true,
      untranslateDescription: true,
      untranslateChapters: false,
      untranslateAudio: true,
      untranslateChannelBranding: true,
      whitelistChannels: ['UC123'],
    });
  });
});
