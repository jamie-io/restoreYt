import * as background from '../../src/background.ts';

function makeApi() {
  const listeners = {
    message: null,
    changed: null,
  };
  const state = new Map();
  const sent = [];
  return {
    listeners,
    sent,
    runtime: {
      onMessage: { addListener(listener) { listeners.message = listener; } },
      getManifest: () => ({ version: '0.1.0' }),
    },
    storage: {
      local: {
        get: async (defaults) => ({ ...defaults, ...Object.fromEntries(state) }),
        set: async (values) => { Object.entries(values).forEach(([key, value]) => state.set(key, value)); },
      },
      onChanged: { addListener(listener) { listeners.changed = listener; } },
    },
    tabs: {
      query: async () => [{ id: 7 }, { id: 8 }],
      sendMessage: async (tabId, message) => { sent.push({ tabId, message }); },
    },
    action: {
      setBadgeText: async (details) => { state.set('badgeText', details.text); },
      setBadgeBackgroundColor: async (details) => { state.set('badgeColor', details.color); },
    },
  };
}

describe('background controller', () => {
  it('registers listeners, answers diagnostics, and fans out storage changes', async () => {
    const api = makeApi();
    const controller = background.createBackgroundController(api, { now: () => 123 });

    controller.start();
    const response = await api.listeners.message({ type: 'restoreyt:get-diagnostics' }, { tab: { id: 7 } });

    expect(response.version).toBe('0.1.0');
    expect(response.generatedAt).toBe(123);

    api.listeners.changed({ enabled: { newValue: false } }, 'local');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.sent).toEqual([
      { tabId: 7, message: { type: 'restoreyt:settings-changed', changes: { enabled: { newValue: false } } } },
      { tabId: 8, message: { type: 'restoreyt:settings-changed', changes: { enabled: { newValue: false } } } },
    ]);
  });

  it('updates badge state without throwing when optional APIs are absent', async () => {
    const api = makeApi();
    delete api.action;
    const controller = background.createBackgroundController(api);

    await expect(controller.setFeatureState('titles', 'disabled')).resolves.toBeUndefined();
    expect(controller.getFeatureState('titles')).toMatchObject({ disabled: true });
  });
});
