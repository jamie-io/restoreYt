import * as core from '../../../src/core/index.ts';

const api = name => {
  expect(core[name], `${name} export`).toBeTypeOf('function');
  return core[name];
};

describe('LRU cache', () => {
  it('evicts least recently used entry when capacity is reached', () => {
    const createLruCache = api('createLruCache');
    const cache = createLruCache({ capacity: 2 });

    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    cache.set('c', 3);

    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(1);
    expect(cache.get('c')).toBe(3);
  });

  it('expires positive and negative entries using separate TTLs', () => {
    const createLruCache = api('createLruCache');
    let now = 10;
    const cache = createLruCache({
      ttlMs: 100,
      negativeTtlMs: 10,
      now: () => now,
    });

    cache.set('positive', 'hit');
    cache.set('negative', null);
    now += 11;
    expect(cache.get('negative')).toBeUndefined();
    expect(cache.get('positive')).toBe('hit');
    now += 90;
    expect(cache.get('positive')).toBeUndefined();
  });

  it('drops expired entries before evicting live entries', () => {
    const createLruCache = api('createLruCache');
    let now = 0;
    const cache = createLruCache({ capacity: 2, ttlMs: 100, negativeTtlMs: 5, now: () => now });
    cache.set('negative', null);
    cache.set('live', 'keep');
    expect(cache.get('negative')).toBeNull();
    now += 6;

    cache.set('new', 'value');

    expect(cache.get('live')).toBe('keep');
    expect(cache.get('new')).toBe('value');
  });

  it('requires positive finite positive and negative TTL values', () => {
    const createLruCache = api('createLruCache');

    expect(() => createLruCache({ ttlMs: 0 })).toThrow(RangeError);
    expect(() => createLruCache({ negativeTtlMs: 0 })).toThrow(RangeError);
    expect(() => createLruCache({ ttlMs: Number.POSITIVE_INFINITY })).toThrow(RangeError);
    expect(() => createLruCache({ negativeTtlMs: Number.NaN })).toThrow(RangeError);
  });
});
