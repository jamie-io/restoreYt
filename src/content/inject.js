(async function () {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;

  const settings = await new Promise(resolve => {
    api.storage.sync.get({
      enabled: true,
      untranslateTitle: true,
      untranslateThumbnail: true,
      untranslateDescription: true,
      untranslateChapters: true,
      untranslateAudio: true,
      untranslateChannelBranding: true,
      whitelistChannels: []
    }, resolve);
  });

  if (!settings.enabled) return;

  function injectScript(file) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = api.runtime.getURL(file);
    (document.head || document.documentElement).appendChild(script);
    return new Promise(resolve => {
      script.onload = resolve;
      script.onerror = resolve;
    });
  }

  await injectScript('src/lib/cache.js');
  await injectScript('src/lib/settings.js');
  await injectScript('src/lib/api.js');
  await injectScript('src/lib/dom.js');

  if (settings.untranslateTitle) {
    await injectScript('src/content/title.js');
  }
  if (settings.untranslateThumbnail) {
    await injectScript('src/content/thumbnail.js');
  }
  if (settings.untranslateDescription || settings.untranslateChapters) {
    await injectScript('src/content/description.js');
  }
  if (settings.untranslateAudio) {
    await injectScript('src/content/audio.js');
  }
  if (settings.untranslateChannelBranding) {
    await injectScript('src/content/channel.js');
  }
})();
