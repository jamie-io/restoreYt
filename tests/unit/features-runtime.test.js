import { describe, expect, it } from 'vitest';
import {
  buildFeaturePlan,
  findOriginalAudioTrack,
  shouldReplaceText,
} from '../../src/features/runtime.ts';

describe('feature runtime decisions', () => {
  it('writes only when original text is non-empty and differs', () => {
    expect(shouldReplaceText('Translated title', 'Original title')).toBe(true);
    expect(shouldReplaceText('Original title', 'Original title')).toBe(false);
    expect(shouldReplaceText('Translated title', '')).toBe(false);
  });

  it('selects audio only when player exposes explicit auto-dub signals', () => {
    expect(findOriginalAudioTrack([
      { languageCode: 'de', isAutoDubbed: true },
      { languageCode: 'en', isAutoDubbed: false },
    ])).toEqual({ index: 1, track: { languageCode: 'en', isAutoDubbed: false } });
    expect(findOriginalAudioTrack([{ languageCode: 'en' }])).toBeNull();
  });

  it('builds feature plan from normalized settings and never enables chapters without toggle', () => {
    expect(buildFeaturePlan({
      enabled: true,
      untranslateTitle: true,
      untranslateThumbnail: true,
      untranslateDescription: true,
      untranslateChapters: false,
      untranslateAudio: true,
      untranslateChannelBranding: true,
      whitelistChannels: [],
    })).toEqual(['title', 'thumbnail', 'description', 'audio', 'channelBranding']);
    expect(buildFeaturePlan({ enabled: false })).toEqual([]);
  });
});
