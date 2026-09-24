import { createDefaultSettings, normalizeSettings } from '../core/settings.js';

const api = globalThis.browser ?? globalThis.chrome;
const status = document.getElementById('status');

function showStatus(message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.dataset.state = isError ? 'error' : 'ok';
}

async function readSettings() {
  const defaults = createDefaultSettings();
  const storage = api?.storage?.local;
  if (!storage?.get) return defaults;
  const result = storage.get(defaults);
  const values = result && typeof result.then === 'function'
    ? await result
    : await new Promise(resolve => storage.get(defaults, resolve));
  return normalizeSettings(values);
}

async function saveSetting(key, value) {
  try {
    const result = api?.storage?.local?.set?.({ [key]: value });
    if (result && typeof result.then === 'function') await result;
    showStatus('Saved');
  } catch {
    showStatus('Could not save settings. Check extension storage quota.', true);
  }
}

async function initialize() {
  const settings = await readSettings();
  document.querySelectorAll('#toggles input[type="checkbox"]').forEach(toggle => {
    toggle.checked = settings[toggle.id];
    if (toggle.disabled) return;
    toggle.addEventListener('change', () => {
      settings[toggle.id] = toggle.checked;
      void saveSetting(toggle.id, toggle.checked);
    });
  });

  document.getElementById('openOptions').addEventListener('click', event => {
    event.preventDefault();
    api?.runtime?.openOptionsPage?.();
  });
}

void initialize();
