import * as core from '../../../src/core/index.ts';

const api = name => {
  expect(core[name], `${name} export`).toBeTypeOf('function');
  return core[name];
};

it('aborts prior navigation work and exposes a fresh signal for the next epoch', () => {
  const createNavigationEpoch = api('createNavigationEpoch');
  const navigation = createNavigationEpoch();
  const previousSignal = navigation.signal;
  const previousEpoch = navigation.value;

  const nextEpoch = navigation.advance();

  expect(previousSignal.aborted).toBe(true);
  expect(navigation.signal).not.toBe(previousSignal);
  expect(navigation.signal.aborted).toBe(false);
  expect(nextEpoch).toBe(previousEpoch + 1);
});
