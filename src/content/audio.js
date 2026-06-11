(async function () {
  'use strict';

  const dom = window.DeslopifyDOM;

  if (!dom) {
    console.warn('[Deslopify] audio.js: Missing dependencies');
    return;
  }

  let originalAudioTrack = null;

  function getPlayerElement() {
    const selectors = [
      'ytd-player .html5-video-player',
      '#movie_player',
      '#shorts-player',
      '#player-container-id'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) return el;
    }
    return null;
  }

  function getVideoElement() {
    return document.querySelector('video');
  }

  function selectOriginalAudioTrack() {
    const player = getPlayerElement();
    if (!player) return;

    const tracks = player.getAvailableAudioTracks?.();
    if (!tracks) return;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track && track.language && track.isTranslatable !== undefined && !track.isTranslatable) {
        const originalSetAudioTrack = player.setAudioTrack?.bind(player);
        if (originalSetAudioTrack) {
          originalSetAudioTrack(i);
          originalAudioTrack = track;
        }
        return;
      }
    }
  }

  function interceptAudioTracks() {
    const video = getVideoElement();
    if (!video) return;

    const originalAddEventListener = video.addEventListener.bind(video);

    video.addEventListener = function (type, listener, options) {
      if (type === 'audiotrackchange') {
        const wrappedListener = function (event) {
          if (originalAudioTrack && event.track) {
            if (event.track.language !== originalAudioTrack.language) {
              return;
            }
          }
          return listener.call(this, event);
        };
        return originalAddEventListener(type, wrappedListener, options);
      }
      return originalAddEventListener(type, listener, options);
    };
  }

  function monitorPlayerState() {
    const player = getPlayerElement();
    if (!player) return;

    const originalSetAudioTrack = player.setAudioTrack?.bind(player);
    if (originalSetAudioTrack) {
      player.setAudioTrack = function (index) {
        const tracks = player.getAvailableAudioTracks?.();
        if (tracks && index < tracks.length) {
          const track = tracks[index];
          if (track && !track.isTranslatable) {
            originalAudioTrack = track;
          }
        }
        return originalSetAudioTrack(index);
      };
    }
  }

  function processVideoPage() {
    const player = getPlayerElement();
    if (player) {
      selectOriginalAudioTrack();
    }
    interceptAudioTracks();
    monitorPlayerState();
  }

  function processVideoPage() {
    interceptAudioTracks();
    monitorPlayerState();
  }

  const debouncedProcess = dom.debounce(processVideoPage, 200);

  processVideoPage();
  window.addEventListener('yt-navigate-finish', debouncedProcess);
  window.addEventListener('yt-page-data-updated', debouncedProcess);
})();
