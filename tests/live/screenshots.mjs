#!/usr/bin/env node
/**
 * Renders the popup (against a YouTube tab) and the settings page in light and
 * dark mode. Output: docs/store/*.png unless --out is given.
 *
 *   npm run build && node tests/live/screenshots.mjs [--fixture] [--out dir]
 *
 * --fixture serves a local fake YouTube watch page with invented videos instead
 * of live YouTube (used for the images committed to the repository).
 */

import { chromium } from '@playwright/test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_TITLES, DEMO_WATCH_FIXTURE, fakeYouTube } from '../e2e/helpers.js';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const fixture = process.argv.includes('--fixture');
const outIndex = process.argv.indexOf('--out');
const out = resolve(outIndex > -1 ? process.argv[outIndex + 1] : join(root, 'docs/store'));
await mkdir(out, { recursive: true });

const profile = await mkdtemp(join(tmpdir(), 'restoreyt-shots-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  locale: 'de-DE',
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
});
await context.addCookies([
  { name: 'SOCS', value: 'CAI', domain: '.youtube.com', path: '/', secure: true },
  { name: 'PREF', value: 'hl=de&gl=DE', domain: '.youtube.com', path: '/', secure: true },
]);
if (fixture) await fakeYouTube(context, { default: DEMO_WATCH_FIXTURE }, DEMO_TITLES);
const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
const extensionId = new URL(worker.url()).host;

const youtube = context.pages()[0] ?? await context.newPage();
const target = fixture ? 'https://www.youtube.com/watch?v=demoVideo01' : process.env.SHOT_URL ?? 'https://www.youtube.com/results?search_query=mrbeast';
await youtube.goto(target, { waitUntil: 'domcontentloaded' });
await youtube.waitForTimeout(fixture ? 4000 : 9000);
const tabId = await worker.evaluate(async () => (await chrome.tabs.query({ url: '*://www.youtube.com/*' }))[0]?.id);

for (const scheme of ['light', 'dark']) {
  const popup = await context.newPage();
  await popup.emulateMedia({ colorScheme: scheme });
  await popup.setViewportSize({ width: 372, height: 600 });
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html?tab=${tabId}`);
  await popup.waitForTimeout(1500);
  const height = await popup.evaluate(() => document.documentElement.scrollHeight);
  await popup.setViewportSize({ width: 372, height: Math.min(height, 900) });
  await popup.screenshot({ path: join(out, `popup-${scheme}.png`) });
  await popup.close();

  const options = await context.newPage();
  await options.emulateMedia({ colorScheme: scheme });
  await options.setViewportSize({ width: 1100, height: 900 });
  await options.goto(`chrome-extension://${extensionId}/src/options/options.html`);
  await options.waitForTimeout(800);
  await options.screenshot({ path: join(out, `options-${scheme}.png`), fullPage: true });
  await options.close();
}

await context.close();
await rm(profile, { recursive: true, force: true });
process.stdout.write(`Screenshots written to ${out}\n`);
