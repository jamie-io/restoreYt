import { createDefaultSettings, normalizeSettings } from '../core/settings.js';

const api = globalThis.browser ?? globalThis.chrome;
const defaults = createDefaultSettings();
const status = document.getElementById('status');

function showStatus(message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
}

function getStorage() {
  return api?.storage?.local;
}

async function readSettings() {
  const storage = getStorage();
  if (!storage?.get) return defaults;
  const result = storage.get(defaults);
  const values = result && typeof result.then === 'function'
    ? await result
    : await new Promise(resolve => storage.get(defaults, resolve));
  return normalizeSettings(values);
}

async function saveSettings(values) {
  try {
    const result = getStorage()?.set?.(values);
    if (result && typeof result.then === 'function') await result;
    showStatus('Saved');
  } catch {
    showStatus('Could not save settings. Check extension storage quota.', true);
  }
}

async function initialize() {
  const settings = await readSettings();
  const toggles = document.querySelectorAll('.toggle input[type="checkbox"]');
  toggles.forEach(toggle => {
    toggle.checked = settings[toggle.id];
    toggle.addEventListener('change', () => {
      settings[toggle.id] = toggle.checked;
      void saveSettings({ [toggle.id]: toggle.checked });
    });
  });

  const whitelistList = document.getElementById('whitelistList');
  const channelInput = document.getElementById('channelInput');
  const addChannelBtn = document.getElementById('addChannel');

  function renderWhitelist() {
    whitelistList.replaceChildren();
    settings.whitelistChannels.forEach(channelId => {
      const li = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = channelId;
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.dataset.channel = channelId;
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        settings.whitelistChannels = settings.whitelistChannels.filter(id => id !== channelId);
        void saveSettings({ whitelistChannels: settings.whitelistChannels });
        renderWhitelist();
      });
      li.append(label, remove);
      whitelistList.appendChild(li);
    });
  }

  function addChannel() {
    const channelId = channelInput.value.trim();
    if (!channelId || settings.whitelistChannels.includes(channelId)) return;
    settings.whitelistChannels = [...settings.whitelistChannels, channelId];
    void saveSettings({ whitelistChannels: settings.whitelistChannels });
    channelInput.value = '';
    renderWhitelist();
  }

  addChannelBtn.addEventListener('click', addChannel);
  channelInput.addEventListener('keypress', event => {
    if (event.key === 'Enter') addChannel();
  });

  renderWhitelist();
}

void initialize();
