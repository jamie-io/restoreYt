import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BridgeLookupResult } from '../../src/content/bridge';
import { FRESH_MS, oembedUrl, TitleService, type TitleBridge } from '../../src/content/title-service';
import { TitleStore, type StorageAreaLike } from '../../src/content/title-store';

class MemoryArea implements StorageAreaLike {
  data: Record<string, unknown> = {};
  async get(keys: string[]): Promise<Record<string, unknown>> {
    return Object.fromEntries(keys.filter(key => key in this.data).map(key => [key, this.data[key]]));
  }
  async set(items: Record<string, unknown>): Promise<void> {
    Object.assign(this.data, items);
  }
}

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function bridge(result: BridgeLookupResult, ready = true): TitleBridge & { lookup: ReturnType<typeof vi.fn> } {
  return { ready, lookup: vi.fn(async () => result) };
}

const settle = async (): Promise<void> => {
  for (let index = 0; index < 10; index += 1) await vi.advanceTimersByTimeAsync(5);
};

describe('TitleService', () => {
  let now = 1_000_000;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 1_000_000;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(fetchImpl: (url: string) => Promise<Response>, pageBridge = bridge({ title: null, status: 'error' })) {
    const area = new MemoryArea();
    const store = new TitleStore(area, () => now, 10);
    const service = new TitleService(store, pageBridge, fetchImpl, () => now);
    const resolved: string[] = [];
    service.onResolved(id => resolved.push(id));
    return { area, store, service, resolved, pageBridge };
  }

  it('looks up the original through oEmbed without cookies and caches it', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => jsonResponse(200, { title: 'Beat LeBron, Win $100,000' }));
    const { service, resolved, area, store } = setup(fetchImpl);
    expect(service.peek('_c2e1NcI3Sc', 'Besiege Haaland und gewinne 100.000 $')).toBeUndefined();
    service.request('_c2e1NcI3Sc', 'Besiege Haaland und gewinne 100.000 $');
    await settle();
    expect(fetchImpl).toHaveBeenCalledWith(oembedUrl('_c2e1NcI3Sc'), expect.objectContaining({ credentials: 'omit' }));
    expect(resolved).toEqual(['_c2e1NcI3Sc']);
    expect(service.peek('_c2e1NcI3Sc', 'Besiege Haaland und gewinne 100.000 $')).toBe('Beat LeBron, Win $100,000');
    await store.flush();
    expect(area.data['t:_c2e1NcI3Sc']).toMatchObject({ o: 'Beat LeBron, Win $100,000', s: 'Besiege Haaland und gewinne 100.000 $' });
  });

  it('serves stored titles without a network request', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500));
    const { service, area } = setup(fetchImpl);
    area.data['t:plN7JMbadRg'] = { o: 'Eat Everything', s: 'Iss alles', at: now - 1000 };
    service.request('plN7JMbadRg', 'Iss alles');
    await settle();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(service.peek('plN7JMbadRg', 'Iss alles')).toBe('Eat Everything');
  });

  it('revalidates an old entry when YouTube now shows different text', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { title: 'Renamed By Creator' }));
    const { service, area } = setup(fetchImpl);
    area.data['t:plN7JMbadRg'] = { o: 'Old Title', s: 'Alter Titel', at: now - FRESH_MS - 1 };
    service.request('plN7JMbadRg', 'Alter Titel');
    await settle();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(service.peek('plN7JMbadRg', 'Alter Titel')).toBe('Old Title');
    expect(service.peek('plN7JMbadRg', 'Neuer Titel')).toBeUndefined();
    service.request('plN7JMbadRg', 'Neuer Titel');
    await settle();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(service.peek('plN7JMbadRg', 'Neuer Titel')).toBe('Renamed By Creator');
  });

  it('falls back to the page player endpoint when oEmbed refuses the video', async () => {
    const pageBridge = bridge({ title: 'Music Video (Official)', status: 'ok' });
    const { service } = setup(async () => jsonResponse(401), pageBridge);
    service.request('dQw4w9WgXcQ', 'Musikvideo');
    await settle();
    expect(pageBridge.lookup).toHaveBeenCalledWith('dQw4w9WgXcQ');
    expect(service.peek('dQw4w9WgXcQ', 'Musikvideo')).toBe('Music Video (Official)');
  });

  it('remembers videos without an original and does not refetch them', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404));
    const { service } = setup(fetchImpl, bridge({ title: null, status: 'missing' }));
    service.request('xxxxxxxxxxx', 'Privates Video');
    await settle();
    expect(service.peek('xxxxxxxxxxx', 'Privates Video')).toBeNull();
    service.request('xxxxxxxxxxx', 'Privates Video');
    await settle();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries after a network failure once the retry window passed', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('offline');
      return jsonResponse(200, { title: 'Back Online' });
    });
    const { service } = setup(fetchImpl);
    service.request('plN7JMbadRg', 'Übersetzt');
    await settle();
    expect(service.peek('plN7JMbadRg', 'Übersetzt')).toBeNull();
    expect(service.stats().failed).toBe(1);
    now += 3 * 60_000;
    expect(service.peek('plN7JMbadRg', 'Übersetzt')).toBeUndefined();
    service.request('plN7JMbadRg', 'Übersetzt');
    await settle();
    expect(service.peek('plN7JMbadRg', 'Übersetzt')).toBe('Back Online');
  });

  it('backs off on HTTP 429 and retries the same video later', async () => {
    const responses = [jsonResponse(429), jsonResponse(200, { title: 'Original' })];
    const fetchImpl = vi.fn(async () => responses.shift() ?? jsonResponse(500));
    const { service } = setup(fetchImpl);
    service.request('plN7JMbadRg', 'Übersetzt');
    await settle();
    expect(service.stats().blocked).toBe(true);
    expect(service.peek('plN7JMbadRg', 'Übersetzt')).toBeUndefined();
    now += 31_000;
    await vi.advanceTimersByTimeAsync(31_000);
    await settle();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(service.peek('plN7JMbadRg', 'Übersetzt')).toBe('Original');
    expect(service.stats().blocked).toBe(false);
  });

  it('caps concurrent network lookups', async () => {
    let active = 0;
    let peak = 0;
    const fetchImpl = vi.fn(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 20));
      active -= 1;
      return jsonResponse(200, { title: 'T' });
    });
    const { service } = setup(fetchImpl);
    for (let index = 0; index < 20; index += 1) service.request(`video${String(index).padStart(6, '0')}`, 'x');
    await vi.advanceTimersByTimeAsync(500);
    expect(fetchImpl).toHaveBeenCalledTimes(20);
    expect(peak).toBeLessThanOrEqual(6);
  });

  it('accepts originals seeded from the page without lookups', () => {
    const fetchImpl = vi.fn();
    const { service, resolved } = setup(fetchImpl as never);
    service.seed('plN7JMbadRg', 'Eat Everything In A Grocery Store, Win $1,000,000', 'Iss alles in einem Supermarkt auf');
    expect(resolved).toEqual(['plN7JMbadRg']);
    expect(service.peek('plN7JMbadRg', 'Iss alles in einem Supermarkt auf')).toBe('Eat Everything In A Grocery Store, Win $1,000,000');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
