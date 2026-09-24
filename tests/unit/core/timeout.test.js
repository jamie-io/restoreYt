import * as core from '../../../src/core/index.ts';

const api = name => {
  expect(core[name], `${name} export`).toBeTypeOf('function');
  return core[name];
};

describe('timeout helper', () => {
  it('returns completed work before timeout', async () => {
    const withTimeout = api('withTimeout');
    await expect(withTimeout(async () => 'ready', { timeoutMs: 100 })).resolves.toBe('ready');
  });

  it('aborts timed out work and rejects with TimeoutError', async () => {
    const withTimeout = api('withTimeout');
    let operationSignal;
    const operation = withTimeout(signal => {
      operationSignal = signal;
      return new Promise(() => {});
    }, { timeoutMs: 5 });

    await expect(operation).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(operationSignal.aborted).toBe(true);
  });

  it('aborts operation when caller signal aborts', async () => {
    const withTimeout = api('withTimeout');
    const controller = new AbortController();
    let operationSignal;
    let markStarted;
    const started = new Promise(resolve => { markStarted = resolve; });
    const operation = withTimeout(signal => {
      operationSignal = signal;
      markStarted();
      return new Promise(() => {});
    }, { timeoutMs: 100, signal: controller.signal });
    await started;
    controller.abort();

    await expect(operation).rejects.toMatchObject({ name: 'AbortError' });
    expect(operationSignal.aborted).toBe(true);
  });

  it('does not start work if caller aborts before dispatch', async () => {
    const withTimeout = api('withTimeout');
    const controller = new AbortController();
    let called = false;
    const operation = withTimeout(() => {
      called = true;
      return 'unexpected';
    }, { timeoutMs: 100, signal: controller.signal });
    controller.abort();

    await expect(operation).rejects.toMatchObject({ name: 'AbortError' });
    expect(called).toBe(false);
  });
});
