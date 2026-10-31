import { describe, expect, it } from 'vitest';
import { classifyTrack, decodeTrackTags, findOriginalTrack, trackLabel } from '../../src/page/audio';

// Track ids captured from YouTube's player (format 251, Opus audio).
const ORIGINAL_EN = '251;ChEKBWFjb250EghvcmlnaW5hbAoKCgRsYW5nEgJlbg';
const DUBBED_DE = '251;Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICZGU';
const DUBBED_AR = '251;Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICYXI';
const DUBBED_ZH_HANT = '251;Cg8KBWFjb250EgZkdWJiZWQKDwoEbGFuZxIHemgtSGFudA';

/** Shape of `getAvailableAudioTracks()` entries; the info property name is minified. */
function track(id: string, info: { name: string; id: string; isDefault: boolean; isAutoDubbed: boolean }): Record<string, unknown> {
  return { id, Pb: info, xtags: '', D: false, captionTracks: [] };
}

describe('decodeTrackTags', () => {
  it('reads acont and lang from the protobuf in the track id', () => {
    expect(Object.fromEntries(decodeTrackTags(ORIGINAL_EN))).toEqual({ acont: 'original', lang: 'en' });
    expect(Object.fromEntries(decodeTrackTags(DUBBED_DE))).toEqual({ acont: 'dubbed', lang: 'de' });
    expect(decodeTrackTags(DUBBED_ZH_HANT).get('lang')).toBe('zh-Hant');
  });

  it('returns no tags for malformed ids', () => {
    expect(decodeTrackTags('251').size).toBe(0);
    expect(decodeTrackTags('251;!!!').size).toBe(0);
    expect(decodeTrackTags(undefined).size).toBe(0);
  });
});

describe('original track selection', () => {
  const tracks = [
    track(DUBBED_AR, { name: 'Arabisch', id: 'ar.3', isDefault: false, isAutoDubbed: false }),
    // YouTube marks the viewer-language dub as default: never trust isDefault.
    track(DUBBED_DE, { name: 'Deutsch', id: 'de.3', isDefault: true, isAutoDubbed: false }),
    track(ORIGINAL_EN, { name: 'Englisch (Original)', id: 'en.4', isDefault: false, isAutoDubbed: false }),
  ];

  it('picks the track tagged acont=original, not the default or the first non-auto-dub', () => {
    expect(findOriginalTrack(tracks)).toBe(tracks[2]);
  });

  it('classifies tracks', () => {
    expect(classifyTrack(tracks[1])).toEqual({ original: false, lang: 'de', name: 'Deutsch', autoDubbed: false });
    expect(classifyTrack(tracks[2]).original).toBe(true);
    expect(trackLabel(tracks[2])).toBe('Englisch (Original)');
  });

  it('falls back to the format suffix when tags are missing', () => {
    const untagged = [
      { id: '251;', Pb: { name: 'A', id: 'de.3', isDefault: true, isAutoDubbed: true } },
      { id: '251;', Pb: { name: 'B', id: 'en.4', isDefault: false, isAutoDubbed: false } },
    ];
    expect(findOriginalTrack(untagged)).toBe(untagged[1]);
  });

  it('returns null when nothing is identifiable', () => {
    expect(findOriginalTrack([{ id: 'x' }])).toBeNull();
    expect(findOriginalTrack('nope')).toBeNull();
    expect(classifyTrack(null)).toEqual({ original: null, lang: null, name: null, autoDubbed: null });
  });
});
