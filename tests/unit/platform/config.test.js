import * as platform from '../../../src/platform/index.ts';

const api = name => {
  expect(platform[name], `${name} export`).toBeTypeOf('function');
  return platform[name];
};

describe('runtime YouTube config', () => {
  it('discovers runtime client fields and builds client context', () => {
    const discoverRuntimeConfig = api('discoverRuntimeConfig');
    const buildClientConfig = api('buildClientConfig');
    const runtime = discoverRuntimeConfig({
      INNERTUBE_API_KEY: 'runtime-key',
      INNERTUBE_CONTEXT: {
        client: { clientName: 'WEB', clientVersion: '2.20260901.01.00', visitorData: 'visitor' },
      },
    });

    expect(runtime).toEqual({
      apiKey: 'runtime-key',
      clientName: 'WEB',
      clientVersion: '2.20260901.01.00',
      visitorData: 'visitor',
    });
    expect(buildClientConfig(runtime)).toEqual({
      apiKey: 'runtime-key',
      context: {
        client: { clientName: 'WEB', clientVersion: '2.20260901.01.00', visitorData: 'visitor' },
      },
    });
  });

  it('reads ytcfg getter and rejects incomplete runtime config', () => {
    const discoverRuntimeConfig = api('discoverRuntimeConfig');
    const values = {
      INNERTUBE_API_KEY: 'runtime-key',
      INNERTUBE_CLIENT_VERSION: 'runtime-version',
      INNERTUBE_CONTEXT_CLIENT_NAME: 'WEB',
    };
    const config = discoverRuntimeConfig({ get: key => values[key] });

    expect(config).toEqual({
      apiKey: 'runtime-key',
      clientName: 'WEB',
      clientVersion: 'runtime-version',
      visitorData: undefined,
    });
    expect(discoverRuntimeConfig({ INNERTUBE_API_KEY: 'only-key' })).toBeNull();
  });
});
