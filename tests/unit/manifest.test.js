import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(new URL('../../manifest.json', import.meta.url), 'utf8'));

describe('extension manifest', () => {
  it('uses runtime bundles and dual background keys without DNR', () => {
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.declarative_net_request).toBeUndefined();
    expect(manifest.background).toEqual({
      scripts: ['build/background.js'],
      service_worker: 'build/background.js',
      type: 'classic',
    });
    expect(manifest.content_scripts).toEqual([
      {
        matches: [
          '*://*.youtube.com/watch*',
          '*://*.youtube.com/results*',
          '*://*.youtube.com/shorts/*',
          '*://*.youtube-nocookie.com/embed/*',
        ],
        js: ['build/content.js'],
        run_at: 'document_start',
      },
      {
        matches: ['*://*.youtube.com/embed/*'],
        js: ['build/content.js'],
        run_at: 'document_start',
        all_frames: true,
      },
    ]);
    expect(manifest.web_accessible_resources).toEqual([
      { resources: ['build/main.js'], matches: ['*://*.youtube.com/*', '*://*.youtube-nocookie.com/*'] },
    ]);
  });
});
