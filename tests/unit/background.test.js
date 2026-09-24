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

function requestMessage(api, message, sender) {
  let keepChannelOpen;
  const response = new Promise(resolve => {
    keepChannelOpen = api.listeners.message(message, sender, resolve);
  });
  return { keepChannelOpen, response };
}

describe('background controller', () => {
  it('registers listeners, answers diagnostics, and fans out storage changes', async () => {
    const api = makeApi();
    const controller = background.createBackgroundController(api, { now: () => 123 });

    controller.start();
    const request = requestMessage(api, { type: 'restoreyt:get-diagnostics' }, { tab: { id: 7 } });
    expect(request.keepChannelOpen).toBe(true);
    const response = await request.response;

    expect(response.version).toBe('0.1.0');
    expect(response.generatedAt).toBe(123);
    await expect(controller.handleMessage({ type: 'restoreyt:self-test' })).resolves.toEqual({
      ok: true,
      featureCount: 0,
    });

    api.listeners.changed({ enabled: { newValue: false } }, 'local');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(api.sent).toEqual([
      { tabId: 7, message: { type: 'restoreyt:settings-changed', changes: { enabled: { newValue: false } } } },
      { tabId: 8, message: { type: 'restoreyt:settings-changed', changes: { enabled: { newValue: false } } } },
    ]);
  });

  it('restores valid feature states and ignores malformed entries from local storage', async () => {
    const api = makeApi();
    await api.storage.local.set({
      'restoreyt:feature-states': {
        titles: 'disabled',
        thumbnails: 'active',
        audio: 'error',
        invalid: 'unknown',
        nested: { status: 'disabled' },
      },
    });
    const controller = background.createBackgroundController(api);

    controller.start();
    await new Promise(resolve => setTimeout(resolve, 0));
    const response = await controller.handleMessage({ type: 'restoreyt:get-diagnostics' });

    expect(response.features).toEqual({ titles: 'disabled', thumbnails: 'active', audio: 'error' });
  });

  it('waits for startup restore before answering messages or persisting early state updates', async () => {
    const api = makeApi();
    await api.storage.local.set({
      'restoreyt:feature-states': { titles: 'disabled', thumbnails: 'active' },
    });
    const getStored = api.storage.local.get;
    let releaseStorage;
    const storageBarrier = new Promise(resolve => { releaseStorage = resolve; });
    api.storage.local.get = async defaults => {
      await storageBarrier;
      return getStored(defaults);
    };
    const controller = background.createBackgroundController(api);

    controller.start();
    let messageSettled = false;
    let updateSettled = false;
    const request = requestMessage(api, { type: 'restoreyt:get-diagnostics' });
    expect(request.keepChannelOpen).toBe(true);
    const message = request.response.then(response => {
      messageSettled = true;
      return response;
    });
    const update = controller.setFeatureState('titles', 'active').then(() => { updateSettled = true; });

    await Promise.resolve();
    expect(messageSettled).toBe(false);
    expect(updateSettled).toBe(false);

    releaseStorage();
    const response = await message;
    await update;

    expect(response.features).toEqual({ titles: 'disabled', thumbnails: 'active' });
    const stored = await getStored({ 'restoreyt:feature-states': {} });
    expect(stored['restoreyt:feature-states']).toEqual({ titles: 'active', thumbnails: 'active' });
  });

  it('updates badge state without throwing when optional APIs are absent', async () => {
    const api = makeApi();
    delete api.action;
    const controller = background.createBackgroundController(api);

    await expect(controller.setFeatureState('titles', 'disabled')).resolves.toBeUndefined();
    expect(controller.getFeatureState('titles')).toMatchObject({ disabled: true });
  });
});
