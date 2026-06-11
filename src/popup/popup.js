(async function () {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;

  const settings = await new Promise(resolve => {
    api.storage.sync.get({
      enabled: true,
      untranslateTitle: true,
      untranslateThumbnail: true,
      untranslateDescription: true,
      untranslateChapters: false,
      untranslateAudio: true,
      untranslateChannelBranding: true
    }, resolve);
  });

  const toggles = document.querySelectorAll('#toggles input[type="checkbox"]');
  toggles.forEach(toggle => {
    toggle.checked = settings[toggle.id];
    toggle.addEventListener('change', () => {
      api.storage.sync.set({ [toggle.id]: toggle.checked });
    });
  });

  document.getElementById('openOptions').addEventListener('click', (e) => {
    e.preventDefault();
    api.runtime.openOptionsPage();
  });
})();
