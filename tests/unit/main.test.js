import { vi } from 'vitest';
import { installMainWorld, startMainWorld } from '../../src/main.ts';

const { runtime, createFeatureRuntimeMock } = vi.hoisted(() => {
  const runtime = {
    settings: null,
    processedSettings: null,
    start: vi.fn(),
    stop: vi.fn(),
    process: vi.fn(async () => {
      runtime.processedSettings = {
        enabled: runtime.settings.enabled,
        untranslateTitle: runtime.settings.untranslateTitle,
        whitelistChannels: [...runtime.settings.whitelistChannels],
      };
    }),
  };
  const createFeatureRuntimeMock = vi.fn(options => {
    runtime.settings = options.settings;
    return runtime;
  });
  return { runtime, createFeatureRuntimeMock };
});

vi.mock('../../src/features/runtime.js', () => ({
  createFeatureRuntime: createFeatureRuntimeMock,
}));
vi.mock('../../src/platform/api.js', () => ({
  createInnerTubeClient: vi.fn(() => ({})),
}));
vi.mock('../../src/platform/config.js', () => ({
  discoverRuntimeConfig: vi.fn(() => ({})),
}));

beforeEach(() => {
  vi.clearAllMocks();
  runtime.settings = null;
  runtime.processedSettings = null;
});

describe('main-world settings', () => {
  it('applies repeated settings-ready events without creating another runtime', async () => {
    let settingsReady;
    const block = { textContent: JSON.stringify({ enabled: true, untranslateTitle: true }) };
    const doc = {
      getElementById: id => id === 'restoreyt-settings' ? block : null,
      dispatchEvent: vi.fn(),
      addEventListener: (type, listener) => {
        if (type === 'restoreyt:settings-ready') settingsReady = listener;
      },
    };
    const win = { ytcfg: {} };

    installMainWorld(doc, win);
    settingsReady();
    block.textContent = JSON.stringify({ enabled: false, untranslateTitle: false, whitelistChannels: ['UC42'] });
    settingsReady();
    await Promise.resolve();

    expect(runtime.processedSettings).toEqual({
      enabled: false,
      untranslateTitle: false,
      whitelistChannels: ['UC42'],
    });
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(runtime.process).toHaveBeenCalledTimes(1);
    expect(createFeatureRuntimeMock).toHaveBeenCalledTimes(1);
  });

  it('normalizes settings updates and applies them to the live feature runtime', async () => {
    const block = { textContent: JSON.stringify({ enabled: true, untranslateTitle: true }) };
    const doc = {
      getElementById: id => id === 'restoreyt-settings' ? block : null,
      dispatchEvent: vi.fn(),
    };
    const win = { ytcfg: {} };
    const controller = startMainWorld(doc, win);

    await controller.updateSettings({
      enabled: false,
      untranslateTitle: false,
      whitelistChannels: ['UC42', 42],
    });

    expect(controller.settings).toMatchObject({
      enabled: false,
      untranslateTitle: false,
      whitelistChannels: ['UC42'],
    });
    expect(runtime.settings).toBe(controller.settings);
    expect(runtime.processedSettings).toEqual({
      enabled: false,
      untranslateTitle: false,
      whitelistChannels: ['UC42'],
    });
    expect(runtime.start).toHaveBeenCalledTimes(1);
    expect(runtime.process).toHaveBeenCalledTimes(1);
    expect(createFeatureRuntimeMock).toHaveBeenCalledTimes(1);
  });
});
