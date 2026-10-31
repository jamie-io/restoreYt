import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM build script without type declarations
import { chromeManifest, firefoxManifest } from '../../scripts/manifests.mjs';
import { DEFAULT_SETTINGS, FEATURE_KEYS, isActive, normalizeSettings } from '../../src/shared/settings';

const root = new URL('../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const manifest = JSON.parse(read('manifest.json'));
const pkg = JSON.parse(read('package.json'));

describe('manifest', () => {
  it('is MV3 with the version from package.json', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe(pkg.version);
  });

  it('asks only for what it uses', () => {
    expect(manifest.permissions).toEqual(['storage', 'declarativeNetRequest']);
    expect(manifest.host_permissions).toEqual(['*://www.youtube.com/*', '*://www.youtube-nocookie.com/*', '*://i.ytimg.com/*']);
  });

  it('runs on every YouTube page so SPA navigation is covered', () => {
    const top = manifest.content_scripts.filter((entry: { all_frames?: boolean }) => !entry.all_frames);
    for (const entry of top) expect(entry.matches).toEqual(['*://www.youtube.com/*']);
    const worlds = top.map((entry: { world?: string; js: string[] }) => [entry.js[0], entry.world ?? 'ISOLATED']);
    expect(worlds).toEqual([['build/page.js', 'MAIN'], ['build/content.js', 'ISOLATED']]);
    for (const entry of manifest.content_scripts) expect(entry.run_at).toBe('document_start');
  });

  it('limits frame injection to embeds', () => {
    const framed = manifest.content_scripts.filter((entry: { all_frames?: boolean }) => entry.all_frames);
    for (const entry of framed) expect(entry.matches).toEqual(['*://www.youtube.com/embed/*', '*://www.youtube-nocookie.com/embed/*']);
  });

  it('points at files that exist', () => {
    const files = [
      manifest.declarative_net_request.rule_resources[0].path,
      manifest.action.default_popup,
      manifest.options_ui.page,
      ...Object.values(manifest.icons as Record<string, string>),
      'fonts/iAWriterQuattroS-Regular.ttf',
      'fonts/iAWriterQuattroS-Bold.ttf',
      'fonts/OFL.txt',
    ];
    for (const file of files) expect(existsSync(new URL(file, root)), file).toBe(true);
  });

  it('is a clean Chromium manifest: service worker only, no Firefox keys', () => {
    // Chrome reports "'background.scripts' requires manifest version of 2 or lower."
    expect(manifest.minimum_chrome_version).toBe('121');
    expect(manifest.background).toEqual({ service_worker: 'build/background.js' });
    expect(manifest.browser_specific_settings).toBeUndefined();
    expect(chromeManifest(manifest)).toEqual(manifest);
  });

  it('derives the Firefox manifest: event page and gecko settings for 128+', () => {
    const firefox = firefoxManifest(manifest);
    expect(firefox.background).toEqual({ scripts: ['build/background.js'] });
    expect(firefox.browser_specific_settings).toEqual({ gecko: { id: 'restoreyt@example.invalid', strict_min_version: '128.0' } });
    expect(firefox.minimum_chrome_version).toBeUndefined();
    expect(firefox.content_scripts).toEqual(manifest.content_scripts);
    expect(manifest.background).toEqual({ service_worker: 'build/background.js' });
  });
});

describe('settings', () => {
  it('fills defaults and ignores junk', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ titles: false, audio: 'no', extra: true })).toEqual({ ...DEFAULT_SETTINGS, titles: false });
  });

  it('turns every feature off with the master switch', () => {
    const paused = { ...DEFAULT_SETTINGS, enabled: false };
    for (const feature of FEATURE_KEYS) expect(isActive(paused, feature)).toBe(false);
    expect(isActive(DEFAULT_SETTINGS, 'titles')).toBe(true);
  });
});
