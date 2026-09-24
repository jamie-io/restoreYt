import * as config from '../../../esbuild.config.mjs';

const api = name => {
  expect(config[name], `${name} export`).toBeTypeOf('function');
  return config[name];
};

describe('esbuild configuration', () => {
  it('declares stable runtime bundles for extension entrypoints', () => {
    expect(config.RUNTIME_ENTRIES).toEqual({
      background: 'src/background.ts',
      content: 'src/content/bootstrap.ts',
      main: 'src/main.ts',
      popup: 'src/popup/popup.js',
      options: 'src/options/options.js',
    });
  });

  it('prepares independent browser bundles for future extension entry points', () => {
    const createBuildOptions = api('createBuildOptions');
    const entryPoints = {
      mainWorld: 'src/main.ts',
      background: 'src/background.ts',
      popup: 'src/popup.ts',
      options: 'src/options.ts',
    };
    const options = createBuildOptions(entryPoints, { write: false });

    expect(options).toMatchObject({
      entryPoints,
      bundle: true,
      platform: 'browser',
      format: 'iife',
      target: ['chrome121', 'firefox115'],
      outdir: 'build',
      write: false,
    });
  });

  it('rejects empty or malformed entry maps before invoking esbuild', () => {
    const createBuildOptions = api('createBuildOptions');
    expect(() => createBuildOptions({})).toThrow(TypeError);
    expect(() => createBuildOptions({ 'bad/name': '' })).toThrow(TypeError);
  });

  it('preserves browser bundle invariants when caller supplies output options', () => {
    const createBuildOptions = api('createBuildOptions');
    const options = createBuildOptions({ popup: 'src/popup.ts' }, {
      write: false,
      entryPoints: { wrong: 'src/wrong.ts' },
      platform: 'node',
      format: 'esm',
      target: 'es2020',
    });

    expect(options).toMatchObject({
      entryPoints: { popup: 'src/popup.ts' },
      platform: 'browser',
      format: 'iife',
      target: ['chrome121', 'firefox115'],
      write: false,
    });
  });
});
