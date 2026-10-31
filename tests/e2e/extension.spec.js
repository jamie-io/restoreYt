import { expect, test } from '@playwright/test';
import { FEED_FIXTURE, FEED_TITLES, WATCH_FIXTURE, fakeYouTube, launchWithExtension } from './helpers.js';

test.describe.configure({ mode: 'serial' });

let browser;

test.beforeAll(async () => {
  browser = await launchWithExtension();
  await fakeYouTube(browser.context, { default: FEED_FIXTURE, '/watch': WATCH_FIXTURE }, FEED_TITLES);
});

test.afterAll(async () => {
  await browser?.close();
});

async function youtubeTab() {
  const page = await browser.context.newPage();
  await page.goto('https://www.youtube.com/results?search_query=mrbeast');
  const tabId = await browser.worker.evaluate(async () => (await chrome.tabs.query({ url: '*://www.youtube.com/*' }))[0]?.id);
  return { page, tabId };
}

test('enables the thumbnail redirect rules', async () => {
  const rulesets = await browser.worker.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets());
  expect(rulesets).toEqual(['thumbnails']);
});

test('restores titles on a YouTube page and keeps links working', async () => {
  const { page } = await youtubeTab();
  await expect(page.locator('yt-lockup-metadata-view-model h3 span')).toHaveText('Beat LeBron, Win $100,000');
  await expect(page.locator('ytd-video-renderer yt-formatted-string').first()).toHaveText('$1 vs $500,000 Date!');
  await expect(page.locator('ytd-video-renderer #video-title').first()).toHaveAttribute('title', '$1 vs $500,000 Date!');
  await expect(page.locator('yt-lockup-metadata-view-model h3 a')).toHaveAttribute('href', '/watch?v=_c2e1NcI3Sc');
  await expect(page.locator('ytd-video-renderer yt-formatted-string').nth(1)).toHaveText('Me at the zoo');
  await page.close();
});

test('popup reports what changed on the tab', async () => {
  const { page, tabId } = await youtubeTab();
  await expect(page.locator('yt-lockup-metadata-view-model h3 span')).toHaveText('Beat LeBron, Win $100,000');
  const popup = await browser.context.newPage();
  await popup.goto(`chrome-extension://${browser.extensionId}/src/popup/popup.html?tab=${tabId}`);
  await expect(popup.locator('#status')).toHaveText('Showing originals on this tab.');
  await expect(popup.locator('#summary')).toContainText('Restored 2 titles and 2 thumbnails.');
  await expect(popup.locator('.entry .original').first()).toBeVisible();
  await expect(popup.locator('.entry s.replaced')).toHaveCount(2);
  await expect(popup.locator('#toggles input[role="switch"]')).toHaveCount(6);
  await popup.close();
  await page.close();
});

test('switching titles off puts YouTube’s text back, and on again restores', async () => {
  const { page, tabId } = await youtubeTab();
  const title = page.locator('yt-lockup-metadata-view-model h3 span');
  await expect(title).toHaveText('Beat LeBron, Win $100,000');
  const popup = await browser.context.newPage();
  await popup.goto(`chrome-extension://${browser.extensionId}/src/popup/popup.html?tab=${tabId}`);
  const titlesSwitch = popup.locator('input[data-key="titles"]');
  await expect(titlesSwitch).toBeChecked();
  await titlesSwitch.click();
  await expect(title).toHaveText('Besiege Haaland und gewinne 100.000 $');
  await titlesSwitch.click();
  await expect(title).toHaveText('Beat LeBron, Win $100,000');
  const stored = await browser.worker.evaluate(() => chrome.storage.sync.get('titles'));
  expect(stored.titles).toBe(true);
  await popup.close();
  await page.close();
});

test('master switch pauses everything', async () => {
  const { page, tabId } = await youtubeTab();
  const popup = await browser.context.newPage();
  await popup.goto(`chrome-extension://${browser.extensionId}/src/popup/popup.html?tab=${tabId}`);
  await popup.locator('#enabled').click();
  await expect(popup.locator('#status')).toHaveText('Paused. YouTube shows its own versions.');
  await expect(popup.locator('body')).toHaveClass(/is-paused/);
  await expect.poll(() => browser.worker.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets())).toEqual([]);
  await popup.locator('#enabled').click();
  await expect(popup.locator('#status')).toHaveText('Showing originals on this tab.');
  await expect.poll(() => browser.worker.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets())).toEqual(['thumbnails']);
  await popup.close();
  await page.close();
});

test('watch page: title, tab title, description, audio and subtitles', async () => {
  const page = await browser.context.newPage();
  await page.goto('https://www.youtube.com/watch?v=demoVideo01');
  await expect(page.locator('ytd-watch-metadata h1 yt-formatted-string')).toHaveText('I Survived 100 Days in the Wild');
  await expect(page).toHaveTitle('I Survived 100 Days in the Wild - YouTube');
  await expect(page.locator('#attributed-snippet-text')).toContainText('I spent 100 days alone in the wild');
  await expect.poll(() => page.evaluate(() => window.__fakePlayer.audio())).toBe('en.4');
  await expect.poll(() => page.evaluate(() => window.__fakePlayer.captions())).toBeNull();

  await page.locator('#attributed-snippet-text a[data-seconds="750"]').click();
  await expect.poll(() => page.evaluate(() => window.__seekedTo)).toBe(750);

  // A track the viewer picks afterwards is left alone.
  await page.evaluate(() => window.__fakePlayer.pick('de'));
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => window.__fakePlayer.audio())).toBe('de.3');

  const tabId = await browser.worker.evaluate(async () => (await chrome.tabs.query({ url: '*://www.youtube.com/watch*' }))[0]?.id);
  const popup = await browser.context.newPage();
  await popup.goto(`chrome-extension://${browser.extensionId}/src/popup/popup.html?tab=${tabId}`);
  await expect(popup.locator('#summary')).toContainText('Switched to the original audio track.');
  await expect(popup.locator('#summary')).toContainText('Turned off subtitles YouTube switched on by itself.');
  await expect(popup.locator('.entry--audio .original')).toHaveText('English (original)');
  await expect(popup.locator('.entry--audio s')).toHaveText('Deutsch');
  await popup.close();
  await page.close();
});

test('popup explains itself outside YouTube', async () => {
  const other = await browser.context.newPage();
  await other.goto('about:blank');
  const tabId = await browser.worker.evaluate(async () => (await chrome.tabs.query({})).find(tab => tab.url === 'about:blank')?.id);
  const popup = await browser.context.newPage();
  await popup.goto(`chrome-extension://${browser.extensionId}/src/popup/popup.html?tab=${tabId}`);
  await expect(popup.locator('#status')).toHaveText('Open a YouTube page to see what restoreyt changes there.');
  await expect(popup.locator('#report')).toBeHidden();
  await popup.close();
  await other.close();
});

test('settings page explains every option and manages local data', async () => {
  const { page } = await youtubeTab();
  await expect(page.locator('yt-lockup-metadata-view-model h3 span')).toHaveText('Beat LeBron, Win $100,000');
  const options = await browser.context.newPage();
  await options.goto(`chrome-extension://${browser.extensionId}/src/options/options.html`);
  await expect(options.locator('h1')).toHaveText('restoreyt');
  await expect(options.locator('#features .feature')).toHaveCount(6);
  await expect(options.locator('#features')).toContainText('switches to the original track');
  // Lifetime counters are written in batches; closing or hiding the tab flushes them.
  await page.close();
  await expect(options.locator('#stats')).toContainText('restoreyt has restored', { timeout: 15000 });
  await expect(options.locator('#cache-status')).toContainText('cached right now');

  await options.locator('#clear-cache').click();
  await expect(options.locator('#data-feedback')).toContainText(/Cleared|already empty/);
  await expect(options.locator('#cache-status')).toHaveText('No titles cached right now.');

  await options.locator('#reset-stats').click();
  await expect(options.locator('#reset-stats')).toHaveText('Click again to reset');
  await options.locator('#reset-stats').click();
  await expect(options.locator('#stats')).toHaveText('Nothing restored yet. Open YouTube and the count starts here.');

  const badge = options.locator('input[data-key="badge"]');
  await badge.click();
  await expect.poll(() => browser.worker.evaluate(async () => (await chrome.storage.sync.get('badge')).badge)).toBe(false);
  await badge.click();
  await options.close();
});
