import * as bootstrap from '../../src/content/bootstrap.ts';

describe('content bootstrap', () => {
  it('creates CSP-safe settings JSON without executable markup', () => {
    const element = bootstrap.createSettingsDataBlock({ enabled: true, whitelistChannels: ['UC123'] });

    expect(element).toEqual({
      id: 'restoreyt-settings',
      type: 'application/json',
      textContent: '{"enabled":true,"untranslateTitle":true,"untranslateThumbnail":true,"untranslateDescription":true,"untranslateChapters":false,"untranslateAudio":true,"untranslateChannelBranding":true,"whitelistChannels":["UC123"]}',
    });
    expect(element.textContent).not.toContain('<script');
  });

  it('escapes script terminators inside user-controlled settings', () => {
    const element = bootstrap.createSettingsDataBlock({ whitelistChannels: ['</script><script>'] });

    expect(element.textContent).not.toContain('</script>');
    expect(element.textContent).toContain('\\u003c/script\\u003e');
  });

  it('accepts only a successful classic bundle load', async () => {
    let loaded;
    await expect(bootstrap.injectClassicBundle({
      createScript: () => ({
        src: '',
        addEventListener(type, listener) {
          if (type === 'load') loaded = listener;
        },
      }),
      append: () => loaded(),
      getUrl: file => `chrome-extension://test/${file}`,
    }, 'build/main.js')).resolves.toMatchObject({ ok: true });
  });
});
