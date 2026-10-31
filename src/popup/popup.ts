import { ext, loadSettings, saveSettings, watchSettings } from '../shared/ext.js';
import { MESSAGE, type PageReport, type RestoreEntry } from '../shared/messages.js';
import { DEFAULT_SETTINGS, type FeatureKey, type Settings } from '../shared/settings.js';
import { byId, h, switchControl } from '../ui/dom.js';
import { FEATURES } from '../ui/features.js';
import { KIND_LABEL, summarize } from '../ui/summary.js';

const YOUTUBE_TAB = /^https:\/\/www\.youtube\.com\//;
const REQUIRED_ORIGINS = ['*://www.youtube.com/*', '*://i.ytimg.com/*'];
const COLLAPSED_ENTRIES = 3;

type TabState =
  | { kind: 'loading' }
  | { kind: 'other' }
  | { kind: 'missing'; tabId: number }
  | { kind: 'youtube'; tabId: number; report: PageReport };

let settings: Settings = { ...DEFAULT_SETTINGS };
let tab: TabState = { kind: 'loading' };
let hasAccess = true;
let expanded = false;

const master = byId<HTMLInputElement>('enabled');
const statusLine = byId('status');
const actions = byId('actions');
const reportSection = byId('report');
const summary = byId('summary');
const log = byId<HTMLOListElement>('log');
const more = byId<HTMLButtonElement>('more');
const toggles = byId<HTMLUListElement>('toggles');
const inputs = new Map<FeatureKey, HTMLInputElement>();

function renderToggles(): void {
  for (const feature of FEATURES) {
    const control = switchControl(feature.key);
    control.input.addEventListener('change', () => {
      void saveSettings({ [feature.key]: control.input.checked });
    });
    inputs.set(feature.key, control.input);
    // The hint is a tooltip here; the settings page explains each option in full.
    toggles.append(h('li', {},
      h('label', { className: 'toggle', attrs: { title: feature.hint } },
        h('span', { className: 'toggle-text' },
          h('span', { className: 'toggle-label', text: feature.label }),
          h('span', { className: 'sr-only', text: `. ${feature.hint}` })),
        control.root)));
  }
}

function syncControls(): void {
  master.checked = settings.enabled;
  for (const [key, input] of inputs) input.checked = settings[key];
  document.body.classList.toggle('is-paused', !settings.enabled);
}

function setActions(...buttons: HTMLButtonElement[]): void {
  actions.replaceChildren(...buttons);
  actions.hidden = buttons.length === 0;
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = h('button', { className: 'button', text: label, attrs: { type: 'button' } });
  button.addEventListener('click', onClick);
  return button;
}

function entryNode(entry: RestoreEntry): HTMLLIElement {
  const original = entry.kind === 'captions' ? 'Off' : entry.original;
  return h('li', { className: `entry entry--${entry.kind}`, attrs: { title: original } },
    entry.kind === 'title' ? null : h('span', { className: 'entry-kind', text: KIND_LABEL[entry.kind] }),
    h('span', { className: 'sr-only', text: 'YouTube showed: ' }),
    h('s', { className: 'replaced', text: entry.replaced }),
    h('span', { className: 'sr-only', text: '. Now showing: ' }),
    h('span', { className: 'original', text: original }));
}

const KIND_ORDER: Record<RestoreEntry['kind'], number> = { audio: 0, description: 1, captions: 2, title: 3 };

/** Audio, description and subtitle changes are rare and matter most: list them before titles. */
export function orderEntries(entries: readonly RestoreEntry[]): RestoreEntry[] {
  return [...entries].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

function renderReport(report: PageReport): void {
  summary.textContent = summarize(report).join(' ');
  const ordered = orderEntries(report.recent);
  const entries = expanded ? ordered : ordered.slice(0, COLLAPSED_ENTRIES);
  log.replaceChildren(...entries.map(entryNode));
  const hiddenCount = report.recent.length - COLLAPSED_ENTRIES;
  more.hidden = hiddenCount <= 0;
  more.textContent = expanded ? 'Show fewer' : `Show ${hiddenCount} more`;
}

function render(): void {
  syncControls();
  if (!hasAccess) {
    statusLine.textContent = 'restoreyt needs access to youtube.com to restore anything.';
    setActions(actionButton('Allow access', () => {
      void ext.permissions.request({ origins: REQUIRED_ORIGINS }).then(granted => {
        hasAccess = granted;
        render();
      });
    }));
    reportSection.hidden = true;
    return;
  }
  setActions();
  reportSection.hidden = true;
  switch (tab.kind) {
    case 'loading':
      statusLine.textContent = 'Checking this tab…';
      break;
    case 'other':
      statusLine.textContent = 'Open a YouTube page to see what restoreyt changes there.';
      break;
    case 'missing': {
      const tabId = tab.tabId;
      statusLine.textContent = 'restoreyt is not running in this tab yet.';
      setActions(actionButton('Reload tab', () => {
        void ext.tabs.reload(tabId);
        window.close();
      }));
      break;
    }
    case 'youtube':
      if (!settings.enabled) {
        statusLine.textContent = 'Paused. YouTube shows its own versions.';
        break;
      }
      statusLine.textContent = 'Showing originals on this tab.';
      reportSection.hidden = false;
      renderReport(tab.report);
      break;
  }
}

/** Tests open the popup as a page and point it at a tab with `?tab=<id>`. */
const pinnedTab = Number.parseInt(new URLSearchParams(location.search).get('tab') ?? '', 10);

async function refresh(): Promise<void> {
  let active: chrome.tabs.Tab | undefined;
  try {
    active = Number.isInteger(pinnedTab)
      ? await ext.tabs.get(pinnedTab)
      : (await ext.tabs.query({ active: true, currentWindow: true }))[0];
  } catch {
    active = undefined;
  }
  if (active?.id === undefined || !active.url || !YOUTUBE_TAB.test(active.url)) {
    tab = { kind: 'other' };
  } else {
    try {
      const report = await ext.tabs.sendMessage(active.id, { type: MESSAGE.getReport }, { frameId: 0 }) as PageReport | undefined;
      tab = report ? { kind: 'youtube', tabId: active.id, report } : { kind: 'missing', tabId: active.id };
    } catch {
      tab = { kind: 'missing', tabId: active.id };
    }
  }
  render();
}

async function init(): Promise<void> {
  renderToggles();
  byId('version').textContent = `v${ext.runtime.getManifest().version}`;
  byId('open-options').addEventListener('click', () => {
    void ext.runtime.openOptionsPage();
    window.close();
  });
  master.addEventListener('change', () => void saveSettings({ enabled: master.checked }));
  more.addEventListener('click', () => {
    expanded = !expanded;
    render();
  });

  settings = await loadSettings();
  try {
    hasAccess = await ext.permissions.contains({ origins: REQUIRED_ORIGINS });
  } catch {
    hasAccess = true;
  }
  render();
  watchSettings(next => {
    settings = next;
    render();
  });
  await refresh();
  window.setInterval(() => void refresh(), 1000);
}

void init();
