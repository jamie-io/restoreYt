import { createFeatureCircuitBreaker, type FeatureState } from './core/circuit-breaker.js';
import { createDiagnosticsBuffer } from './core/diagnostics.js';
import { createDefaultSettings, normalizeSettings, type Settings } from './core/settings.js';

export interface BrowserApi {
  runtime?: {
    onMessage?: { addListener: (listener: (message: unknown, sender: unknown) => unknown) => void };
    getManifest?: () => { version?: string };
  };
  storage?: {
    local?: {
      get?: (defaults: Record<string, unknown>, callback?: (values: Record<string, unknown>) => void) => Promise<Record<string, unknown>> | void;
      set?: (values: Record<string, unknown>, callback?: () => void) => Promise<void> | void;
    };
    onChanged?: { addListener: (listener: (changes: Record<string, unknown>, areaName: string) => void) => void };
  };
  tabs?: {
    query?: (queryInfo: Record<string, unknown>) => Promise<Array<{ id?: number }>>;
    sendMessage?: (tabId: number, message: unknown) => Promise<unknown> | void;
  };
  action?: {
    setBadgeText?: (details: { text: string }) => Promise<void> | void;
    setBadgeBackgroundColor?: (details: { color: string }) => Promise<void> | void;
  };
}

export interface BackgroundController {
  start(): void;
  handleMessage(message: unknown, sender?: unknown): Promise<Record<string, unknown>>;
  setFeatureState(feature: string, status: 'active' | 'disabled' | 'error'): Promise<void>;
  getFeatureState(feature: string): FeatureState;
}

interface BackgroundOptions {
  now?: () => number;
}

const FEATURE_STATE_KEY = 'restoreyt:feature-states';

function resolveBrowserApi(): BrowserApi | undefined {
  const root = globalThis as typeof globalThis & { browser?: BrowserApi; chrome?: BrowserApi };
  return root.browser ?? root.chrome;
}

function messageType(message: unknown): string | null {
  if (!message || typeof message !== 'object') return null;
  const type = (message as { type?: unknown }).type;
  return typeof type === 'string' ? type : null;
}

function asSettings(value: Record<string, unknown>): Settings {
  return normalizeSettings(value);
}

export function createBackgroundController(
  api: BrowserApi | undefined = resolveBrowserApi(),
  options: BackgroundOptions = {},
): BackgroundController {
  const now = options.now ?? Date.now;
  const diagnostics = createDiagnosticsBuffer({ capacity: 200, now });
  const breaker = createFeatureCircuitBreaker({ failureThreshold: 3 });
  const startedFeatures = new Map<string, 'active' | 'disabled' | 'error'>();
  let started = false;

  const record = (feature: string, level: 'info' | 'warning' | 'error', message: string): void => {
    diagnostics.record({ feature, level, message });
  };

  const setBadgeState = async (status: 'active' | 'disabled' | 'error'): Promise<void> => {
    const text = status === 'active' ? '' : status === 'error' ? '!' : '–';
    const color = status === 'error' ? '#d93025' : status === 'disabled' ? '#5f6368' : '#188038';
    await api?.action?.setBadgeText?.({ text });
    await api?.action?.setBadgeBackgroundColor?.({ color });
  };

  const persistFeatureStates = async (): Promise<void> => {
    const values = Object.fromEntries(startedFeatures.entries());
    await api?.storage?.local?.set?.({ [FEATURE_STATE_KEY]: values });
  };

  const fanOutSettings = async (changes: Record<string, unknown>): Promise<void> => {
    const tabs = await api?.tabs?.query?.({}) ?? [];
    await Promise.allSettled(
      tabs.filter((tab): tab is { id: number } => typeof tab.id === 'number')
        .map(tab => api?.tabs?.sendMessage?.(tab.id, { type: 'restoreyt:settings-changed', changes })),
    );
  };

  const readStoredSettings = async (): Promise<Record<string, unknown>> => {
    const defaults = createDefaultSettings() as unknown as Record<string, unknown>;
    const storage = api?.storage?.local;
    if (!storage?.get) return defaults;
    const result = storage.get(defaults);
    return result && typeof result.then === 'function'
      ? result
      : new Promise(resolve => storage.get?.(defaults, resolve));
  };

  const handleMessage = async (message: unknown): Promise<Record<string, unknown>> => {
    switch (messageType(message)) {
      case 'restoreyt:get-settings': {
        const stored = await readStoredSettings();
        return asSettings(stored) as unknown as Record<string, unknown>;
      }
      case 'restoreyt:get-diagnostics':
        return {
          version: api?.runtime?.getManifest?.()?.version ?? 'unknown',
          generatedAt: now(),
          entries: diagnostics.snapshot(),
          features: Object.fromEntries(startedFeatures.entries()),
        };
      case 'restoreyt:self-test':
        return { ok: true, featureCount: startedFeatures.size };
      default:
        return { ok: false, error: 'Unknown message' };
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      api?.runtime?.onMessage?.addListener(message => handleMessage(message));
      api?.storage?.onChanged?.addListener((changes, areaName) => {
        if (areaName === 'local') void fanOutSettings(changes);
      });
      record('background', 'info', 'Background runtime ready');
    },
    handleMessage,
    async setFeatureState(feature, status) {
      startedFeatures.set(feature, status);
      if (status === 'error') {
        record(feature, 'error', 'Feature reported an error');
        await setBadgeState('error');
      } else if (status === 'disabled') {
        record(feature, 'warning', 'Feature disabled');
        await setBadgeState('disabled');
      } else {
        await setBadgeState('active');
      }
      await persistFeatureStates();
    },
    getFeatureState(feature) {
      const status = startedFeatures.get(feature);
      if (status === 'disabled') return { failures: 0, consecutiveFailures: 0, disabled: true, lastFailure: null };
      if (status === 'error') return breaker.getState(feature);
      return { failures: 0, consecutiveFailures: 0, disabled: false, lastFailure: null };
    },
  };
}

if (typeof globalThis !== 'undefined' && resolveBrowserApi()?.runtime) {
  createBackgroundController().start();
}
