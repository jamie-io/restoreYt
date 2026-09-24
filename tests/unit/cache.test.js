import { describe, expect, it } from 'vitest';
import { createLruCache } from '../../src/core/cache.ts';

describe('in-memory LRU cache', () => {
  it('stores, retrieves, deletes, and clears values', () => {
    const cache = createLruCache({ capacity: 2 });
    cache.set('one', { value: 1 });
    cache.set('two', { value: 2 });
    expect(cache.get('one')).toEqual({ value: 1 });
    expect(cache.delete('one')).toBe(true);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('expires negative results faster than positive results', () => {
    let now = 0;
    const cache = createLruCache({ ttlMs: 100, negativeTtlMs: 10, now: () => now });
    cache.set('hit', 'value');
    cache.set('miss', null);
    now = 11;
    expect(cache.get('miss')).toBeUndefined();
    expect(cache.get('hit')).toBe('value');
  });
});
