import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DeslopifyCache', () => {
  let cache;
  let storage;

  beforeEach(() => {
    storage = {};
    global.sessionStorage = {
      getItem: vi.fn(key => storage[key] || null),
      setItem: vi.fn((key, value) => { storage[key] = value; }),
      removeItem: vi.fn(key => { delete storage[key]; }),
      key: vi.fn(index => Object.keys(storage)[index] || null),
      get length() { return Object.keys(storage).length; }
    };

    delete require.cache[require.resolve('../../src/lib/cache.js')];
    cache = require('../../src/lib/cache.js');
  });

  it('stores and retrieves values', () => {
    cache.set('test', { foo: 'bar' });
    expect(cache.get('test')).toEqual({ foo: 'bar' });
  });

  it('returns undefined for missing keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('deletes values', () => {
    cache.set('test', 'value');
    cache.delete('test');
    expect(cache.get('test')).toBeUndefined();
  });

  it('clears all values', () => {
    cache.set('test1', 'value1');
    cache.set('test2', 'value2');
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('tracks size', () => {
    cache.set('test1', 'value1');
    cache.set('test2', 'value2');
    expect(cache.size()).toBe(2);
  });

  it('tracks bytes', () => {
    cache.set('test', 'value');
    expect(cache.bytes()).toBeGreaterThan(0);
  });
});
