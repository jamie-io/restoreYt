import { TITLE_KEY_PREFIX } from '../content/title-store.js';
import { LIFETIME_KEY, type LifetimeStats } from '../content/report.js';
import { ext, loadSettings, saveSettings, watchSettings } from '../shared/ext.js';
import { DEFAULT_SETTINGS, type SettingKey, type Settings } from '../shared/settings.js';
import { byId, h, switchControl } from '../ui/dom.js';
import { FEATURES } from '../ui/features.js';
import { describeStats, plural } from '../ui/summary.js';

let settings: Settings = { ...DEFAULT_SETTINGS };
const inputs = new Map<SettingKey, HTMLInputElement>();
const master = byId<HTMLInputElement>('enabled');

function featureRow(key: SettingKey, name: string, detail: string): HTMLLIElement {
  const control = switchControl(key);
  control.input.addEventListener('change', () => void saveSettings({ [key]: control.input.checked }));
  inputs.set(key, control.input);
  return h('li', {},
    h('label', { className: 'feature' },
      h('span', {},
        h('span', { className: 'feature-name', text: name }),
        h('span', { className: 'feature-detail', text: detail })),
      control.root));
}

function sync(): void {
  master.checked = settings.enabled;
  byId('master-label').textContent = settings.enabled ? 'Restoring originals on YouTube' : 'Paused: YouTube shows its own versions';
  for (const [key, input] of inputs) input.checked = settings[key];
  document.body.classList.toggle('is-paused', !settings.enabled);
}

async function cachedTitleKeys(): Promise<string[]> {
  const all = await ext.storage.local.get(null);
  return Object.keys(all).filter(key => key.startsWith(TITLE_KEY_PREFIX));
}

async function renderData(): Promise<void> {
  const [keys, stored] = await Promise.all([cachedTitleKeys(), ext.storage.local.get(LIFETIME_KEY)]);
  byId('cache-status').textContent = keys.length ? `${plural(keys.length, 'title')} cached right now.` : 'No titles cached right now.';
  byId('stats').textContent = describeStats(stored[LIFETIME_KEY] as Partial<LifetimeStats> | undefined);
}

function confirmTwice(button: HTMLButtonElement, prompt: string, action: () => Promise<void>): void {
  const label = button.textContent ?? '';
  let timer: ReturnType<typeof setTimeout> | null = null;
  button.addEventListener('click', () => {
    if (timer === null) {
      button.textContent = prompt;
      button.classList.add('is-confirming');
      timer = setTimeout(() => {
        timer = null;
        button.textContent = label;
        button.classList.remove('is-confirming');
      }, 4000);
      return;
    }
    clearTimeout(timer);
    timer = null;
    button.textContent = label;
    button.classList.remove('is-confirming');
    void action();
  });
}

async function init(): Promise<void> {
  byId('features').append(...FEATURES.map(feature => featureRow(feature.key, feature.label, feature.detail)));
  byId('toolbar').append(featureRow('badge', 'Count on the toolbar icon', 'Show how many things restoreyt changed on the current YouTube tab.'));
  byId('version').textContent = `restoreyt ${ext.runtime.getManifest().version}`;
  master.addEventListener('change', () => void saveSettings({ enabled: master.checked }));

  const feedback = byId('data-feedback');
  byId<HTMLButtonElement>('clear-cache').addEventListener('click', () => {
    void cachedTitleKeys().then(async keys => {
      await ext.storage.local.remove(keys);
      feedback.textContent = keys.length ? `Cleared ${plural(keys.length, 'cached title')}.` : 'The cache was already empty.';
      await renderData();
    });
  });
  confirmTwice(byId<HTMLButtonElement>('reset-stats'), 'Click again to reset', async () => {
    await ext.storage.local.remove(LIFETIME_KEY);
    feedback.textContent = 'Statistics reset.';
    await renderData();
  });

  settings = await loadSettings();
  sync();
  watchSettings(next => {
    settings = next;
    sync();
  });
  await renderData();
  // The title cache is written while YouTube is open; refresh at most every 2 s.
  let pending: ReturnType<typeof setTimeout> | null = null;
  ext.storage.onChanged.addListener((_changes, area) => {
    if (area !== 'local' || pending !== null) return;
    pending = setTimeout(() => {
      pending = null;
      void renderData();
    }, 2000);
  });
}

void init();
