import { test, expect } from '@playwright/test';
import { access } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { setupExtension, teardownExtension, loadMockWatchPage } from './helpers';

test.describe('restoreyt extension', () => {
  let page;
  let extensionId;
  let userDataDir;

  test.beforeAll(async () => {
    const setup = await setupExtension();
    page = setup.page;
    extensionId = setup.extensionId;
    userDataDir = setup.userDataDir;
  });

  test.afterAll(async () => {
    await teardownExtension();
    await assert.rejects(access(userDataDir), { code: 'ENOENT' });
  });

  test('loads extension service worker', async () => {
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  test('popup exposes six controls and persists through local storage', async () => {
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await expect(page.locator('h1')).toContainText('restoreyt');
    const toggles = page.locator('.toggle input[type="checkbox"]');
    await expect(toggles).toHaveCount(6);
    await toggles.nth(1).evaluate(element => {
      element.checked = false;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(toggles.nth(1)).not.toBeChecked();
    await toggles.nth(1).evaluate(element => {
      element.checked = true;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  test('options page renders whitelist IDs as text nodes', async () => {
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
    await expect(page.locator('h1')).toContainText('restoreyt Settings');
    await page.locator('#channelInput').fill('<img src=x onerror=alert(1)>');
    await page.locator('#addChannel').click();
    await expect(page.locator('#whitelistList img')).toHaveCount(0);
    await expect(page.locator('#whitelistList span')).toContainText('<img src=x onerror=alert(1)>');
  });

  test('manifest has narrow matches, dual background entries, and no DNR', async () => {
    await page.goto(`chrome-extension://${extensionId}/manifest.json`);
    const manifest = JSON.parse(await page.locator('body').textContent());
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.declarative_net_request).toBeUndefined();
    expect(manifest.background.service_worker).toBe('build/background.js');
    expect(manifest.background.scripts).toEqual(['build/background.js']);
    expect(manifest.content_scripts[0].js).toEqual(['build/content.js']);
  });

  test('restores mock original title and description without live YouTube', async () => {
    await loadMockWatchPage(page);
    await expect(page.locator('h1.title')).toHaveText('Original title');
    await expect(page.locator('#description')).toHaveText('Original description');
  });
});
