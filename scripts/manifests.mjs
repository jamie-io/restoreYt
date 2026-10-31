/**
 * manifest.json in the repository is the Chromium manifest (load it unpacked as
 * is). Firefox needs an event-page background and its own add-on settings, and
 * Chromium flags both keys, so the Firefox manifest is derived at package time.
 */

export const GECKO_ID = 'restoreyt@example.invalid';
/** MAIN-world content scripts need Firefox 128. */
export const FIREFOX_MIN_VERSION = '128.0';

export function chromeManifest(manifest) {
  return structuredClone(manifest);
}

export function firefoxManifest(manifest) {
  const firefox = structuredClone(manifest);
  const script = manifest.background?.service_worker;
  if (!script) throw new Error('manifest.json must declare background.service_worker');
  firefox.background = { scripts: [script] };
  delete firefox.minimum_chrome_version;
  firefox.browser_specific_settings = { gecko: { id: GECKO_ID, strict_min_version: FIREFOX_MIN_VERSION } };
  return firefox;
}
