import * as core from '../../../src/core/index.ts';

const api = name => {
  expect(core[name], `${name} export`).toBeTypeOf('function');
  return core[name];
};

describe('feature circuit breaker', () => {
  it('opens after consecutive failures and isolates other features', async () => {
    const createFeatureCircuitBreaker = api('createFeatureCircuitBreaker');
    const breaker = createFeatureCircuitBreaker({ failureThreshold: 2 });
    let attempts = 0;
    const fail = () => breaker.run('titles', async () => {
      attempts += 1;
      throw new Error('network failure');
    });

    await expect(fail()).rejects.toThrow('network failure');
    await expect(fail()).rejects.toThrow('network failure');
    await expect(fail()).rejects.toMatchObject({ name: 'CircuitOpenError' });
    expect(attempts).toBe(2);
    expect(breaker.getState('titles')).toMatchObject({ failures: 2, consecutiveFailures: 2, disabled: true });
    await expect(breaker.run('audio', async () => 'ok')).resolves.toBe('ok');
  });

  it('resets consecutive failures after successful feature work', async () => {
    const createFeatureCircuitBreaker = api('createFeatureCircuitBreaker');
    const breaker = createFeatureCircuitBreaker({ failureThreshold: 2 });

    await expect(breaker.run('description', async () => { throw new Error('first'); })).rejects.toThrow('first');
    await expect(breaker.run('description', async () => 'recovered')).resolves.toBe('recovered');

    expect(breaker.getState('description')).toMatchObject({ failures: 1, consecutiveFailures: 0, disabled: false });
  });
});
