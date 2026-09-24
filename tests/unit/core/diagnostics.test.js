import * as core from '../../../src/core/index.ts';

const api = name => {
  expect(core[name], `${name} export`).toBeTypeOf('function');
  return core[name];
};

it('keeps newest diagnostics in timestamp order within configured capacity', () => {
  const createDiagnosticsBuffer = api('createDiagnosticsBuffer');
  let now = 100;
  const diagnostics = createDiagnosticsBuffer({ capacity: 2, now: () => now });
  diagnostics.record({ feature: 'titles', level: 'error', message: 'first' });
  now += 1;
  diagnostics.record({ feature: 'audio', level: 'warning', message: 'second' });
  now += 1;
  diagnostics.record({ feature: 'cache', level: 'info', message: 'third' });

  expect(diagnostics.snapshot()).toEqual([
    { feature: 'audio', level: 'warning', message: 'second', timestamp: 101 },
    { feature: 'cache', level: 'info', message: 'third', timestamp: 102 },
  ]);
});
