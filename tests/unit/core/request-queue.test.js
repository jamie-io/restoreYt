import * as core from '../../../src/core/index.ts';

const api = name => {
  expect(core[name], `${name} export`).toBeTypeOf('function');
  return core[name];
};

describe('request queue', () => {
  it('limits concurrent work to four by default', async () => {
    const createRequestQueue = api('createRequestQueue');
    const queue = createRequestQueue();
    let active = 0;
    let peak = 0;

    const results = await Promise.all(Array.from({ length: 9 }, (_, index) => queue.run(async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active -= 1;
      return index;
    })));

    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(peak).toBe(4);
  });

  it('does not start queued work after its signal aborts', async () => {
    const createRequestQueue = api('createRequestQueue');
    const queue = createRequestQueue({ concurrency: 1 });
    let releaseFirst;
    let secondStarted = false;
    const first = queue.run(() => new Promise(resolve => { releaseFirst = resolve; }));
    const controller = new AbortController();
    const second = queue.run(() => {
      secondStarted = true;
      return 'unexpected';
    }, controller.signal);
    controller.abort();

    await expect(second).rejects.toMatchObject({ name: 'AbortError' });
    releaseFirst('done');
    await expect(first).resolves.toBe('done');
    expect(secondStarted).toBe(false);
  });
});
