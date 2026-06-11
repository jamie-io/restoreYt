/**
 * Settings management for Deslopify extension.
 * Handles Chrome storage sync and default settings.
 */
const DeslopifySettings = (() => {
  /**
   * Default settings for the extension
   * @type {Object}
   */
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

  /**
   * Get browser API (chrome or browser)
   * @returns {Object} Browser API object
   */
  function getBrowserApi() {
    return typeof browser !== 'undefined' ? browser : chrome;
  }

  /**
   * Get all settings from storage
   * @returns {Promise<Object>} Settings object
   */
  async function get() {
    const api = getBrowserApi();
    if (api?.storage?.sync?.get) {
      return new Promise(resolve => {
        api.storage.sync.get(DEFAULTS, resolve);
      });
    }
    return { ...DEFAULTS };
  }

  /**
   * Save settings to storage
   * @param {Object} settings - Settings to save
   */
  async function set(settings) {
    const api = getBrowserApi();
    if (api?.storage?.sync?.set) {
      return new Promise(resolve => {
        api.storage.sync.set(settings, resolve);
      });
    }
  }

  /**
   * Get a single setting value
   * @param {string} key - Setting key
   * @returns {Promise<unknown>} Setting value
   */
  async function getOne(key) {
    const settings = await get();
    return settings[key];
  }

  /**
   * Set a single setting value
   * @param {string} key - Setting key
   * @param {unknown} value - Setting value
   */
  async function setOne(key, value) {
    return set({ [key]: value });
  }

  /**
   * Check if a channel is in the whitelist
   * @param {Object} settings - Settings object
   * @param {string} channelId - Channel ID to check
   * @returns {boolean} True if channel is whitelisted
   */
  function isWhitelisted(settings, channelId) {
    if (!settings.whitelistChannels || !channelId) return false;
    return settings.whitelistChannels.includes(channelId);
  }

  /**
   * Add a channel to the whitelist
   * @param {string} channelId - Channel ID to add
   */
  async function addWhitelistChannel(channelId) {
    const settings = await get();
    if (!settings.whitelistChannels.includes(channelId)) {
      settings.whitelistChannels.push(channelId);
      await set({ whitelistChannels: settings.whitelistChannels });
    }
  }

  /**
   * Remove a channel from the whitelist
   * @param {string} channelId - Channel ID to remove
   */
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
