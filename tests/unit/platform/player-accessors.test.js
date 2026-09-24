import * as platform from '../../../src/platform/index.ts';

const api = name => {
  expect(platform[name], `${name} export`).toBeTypeOf('function');
  return platform[name];
};

it('reads player, chapter, and audio values through guarded accessors', () => {
  const getPlayerResponse = api('getPlayerResponse');
  const getChapterMarkers = api('getChapterMarkers');
  const getAvailableAudioTracks = api('getAvailableAudioTracks');
  const getCurrentAudioTrack = api('getCurrentAudioTrack');
  const response = { videoDetails: { videoId: 'dQw4w9WgXcQ' } };
  const chapters = [{ title: 'Intro', startTimeMs: '0' }];
  const tracks = [{ id: 'original', languageCode: 'en' }];
  const selectedTrack = tracks[0];
  const player = {
    getPlayerResponse: () => response,
    getChapterMarkers: () => chapters,
    getAvailableAudioTracks: () => tracks,
    getCurrentAudioTrack: () => selectedTrack,
  };

  expect(getPlayerResponse(player)).toBe(response);
  expect(getChapterMarkers(player)).toBe(chapters);
  expect(getAvailableAudioTracks(player)).toBe(tracks);
  expect(getCurrentAudioTrack(player)).toBe(selectedTrack);
  expect(getAvailableAudioTracks(null)).toBeNull();
  expect(getPlayerResponse({ getPlayerResponse: () => { throw new Error('unavailable'); } })).toBeNull();
});
