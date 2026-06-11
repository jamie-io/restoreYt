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

  function injectWhitelist(channels) {
    const script = document.createElement('script');
    script.textContent = `window.__DESLOPIFY_WHITELIST__ = ${JSON.stringify(channels)};`;
    (document.head || document.documentElement).appendChild(script);
  }

  await Promise.all([
    injectScript('src/lib/cache.js'),
    injectScript('src/lib/settings.js'),
    injectScript('src/lib/api.js'),
    injectScript('src/lib/dom.js')
  ]);

  injectWhitelist(settings.whitelistChannels);

  const features = [];
  if (settings.untranslateTitle) features.push(injectScript('src/content/title.js'));
  if (settings.untranslateThumbnail) features.push(injectScript('src/content/thumbnail.js'));
  if (settings.untranslateDescription || settings.untranslateChapters) features.push(injectScript('src/content/description.js'));
  if (settings.untranslateAudio) features.push(injectScript('src/content/audio.js'));
  if (settings.untranslateChannelBranding) features.push(injectScript('src/content/channel.js'));

  await Promise.all(features);
})();
