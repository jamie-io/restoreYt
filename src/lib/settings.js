const DeslopifySettings = (() => {
  const DEFAULTS = {
    enabled: true,
    untranslateTitle: true,
    untranslateThumbnail: true,
    untranslateDescription: true,
    untranslateChapters: true,
    untranslateAudio: true,
    untranslateChannelBranding: true,
    whitelistChannels: []
  };

  function getBrowserApi() {
    return typeof browser !== 'undefined' ? browser : chrome;
  }

  async function get() {
    const api = getBrowserApi();
    if (api?.storage?.sync?.get) {
      return new Promise(resolve => {
        api.storage.sync.get(DEFAULTS, resolve);
      });
    }
    return { ...DEFAULTS };
  }

  async function set(settings) {
    const api = getBrowserApi();
    if (api?.storage?.sync?.set) {
      return new Promise(resolve => {
        api.storage.sync.set(settings, resolve);
      });
    }
  }

  async function getOne(key) {
    const settings = await get();
    return settings[key];
  }

  async function setOne(key, value) {
    return set({ [key]: value });
  }

  function isWhitelisted(settings, channelId) {
    if (!settings.whitelistChannels || !channelId) return false;
    return settings.whitelistChannels.includes(channelId);
  }

  async function addWhitelistChannel(channelId) {
    const settings = await get();
    if (!settings.whitelistChannels.includes(channelId)) {
      settings.whitelistChannels.push(channelId);
      await set({ whitelistChannels: settings.whitelistChannels });
    }
  }

  async function removeWhitelistChannel(channelId) {
    const settings = await get();
    settings.whitelistChannels = settings.whitelistChannels.filter(id => id !== channelId);
    await set({ whitelistChannels: settings.whitelistChannels });
  }

  if (typeof window !== 'undefined') {
    window.DeslopifySettings = { get, set, getOne, setOne, isWhitelisted, addWhitelistChannel, removeWhitelistChannel, DEFAULTS };
  }

  return { get, set, getOne, setOne, isWhitelisted, addWhitelistChannel, removeWhitelistChannel, DEFAULTS };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = DeslopifySettings;
}
