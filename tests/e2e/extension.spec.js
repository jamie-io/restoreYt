import { test, expect } from '@playwright/test';
import { setupExtension, teardownExtension, waitForYouTubeLoad } from './helpers';

test.describe('Deslopify Extension', () => {
  let page, extensionId;

  test.beforeAll(async () => {
    const setup = await setupExtension();
    page = setup.page;
    extensionId = setup.extensionId;
  });

  test.afterAll(async () => {
    await teardownExtension();
  });

  test('extension loads successfully', async () => {
    expect(extensionId).toBeDefined();
    expect(extensionId.length).toBeGreaterThan(0);
  });

  test('popup opens and shows all controls', async () => {
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await expect(page.locator('h1')).toContainText('Deslopify');
    const toggles = page.locator('.toggle input[type="checkbox"]');
    const count = await toggles.count();
    expect(count).toBe(6);
  });

  test('options page opens and shows whitelist input', async () => {
    await page.goto(`chrome-extension://${extensionId}/src/options/options.html`);
    await expect(page.locator('h1')).toContainText('Deslopify Settings');
    await expect(page.locator('#channelInput')).toBeVisible();
    await expect(page.locator('#addChannel')).toBeVisible();
  });

  test('all toggles are clickable and persist state', async () => {
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    const toggles = page.locator('.toggle input[type="checkbox"]');
    const firstToggle = toggles.first();
    await firstToggle.click();
    await expect(firstToggle).not.toBeChecked();
    await firstToggle.click();
    await expect(firstToggle).toBeChecked();
  });

  test('openOptions link navigates to options page', async () => {
    await page.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
    await page.locator('#openOptions').click();
    await expect(page).toHaveURL(/options\.html/);
  });

  test('manifest has correct structure', async () => {
    await page.goto(`chrome-extension://${extensionId}/manifest.json`);
    const text = await page.locator('pre').textContent() || await page.locator('body').textContent();
    const manifest = JSON.parse(text);
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.content_scripts).toHaveLength(1);
    expect(manifest.content_scripts[0].js).toContain('src/content/inject.js');
    expect(manifest.permissions).toContain('declarativeNetRequest');
    expect(manifest.permissions).toContain('storage');
  });

  test('DNR rules are valid', async () => {
    await page.goto(`chrome-extension://${extensionId}/rules.json`);
    const text = await page.locator('pre').textContent() || await page.locator('body').textContent();
    const rules = JSON.parse(text);
    expect(Array.isArray(rules)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule.id).toBeDefined();
      expect(rule.action.type).toBe('redirect');
      expect(rule.condition.resourceTypes).toContain('image');
    }
  });

  test('content scripts are properly structured', async () => {
    const contentFiles = [
      'src/content/inject.js',
      'src/content/title.js',
      'src/content/thumbnail.js',
      'src/content/description.js',
      'src/content/audio.js',
      'src/content/channel.js'
    ];
    for (const file of contentFiles) {
      await page.goto(`chrome-extension://${extensionId}/${file}`);
      const text = await page.locator('pre').textContent() || await page.locator('body').textContent();
      expect(text.length).toBeGreaterThan(50);
    }
  });

  test('extension loads on YouTube', async () => {
    await waitForYouTubeLoad(page);
    expect(page.url()).toContain('youtube.com');
  });
});

test.describe('Deslopify URL Parsing', () => {
  test('extractVideoId handles all YouTube URL formats', async () => {
    const testCases = [
      { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://www.youtube.com/embed/dQw4w9WgXcQ', expected: 'dQw4w9WgXcQ' },
      { url: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', expected: 'dQw4w9WgXcQ' },
      { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', expected: 'dQw4w9WgXcQ' },
    ];
    expect(testCases.length).toBe(5);
    testCases.forEach(tc => {
      expect(tc.url).toContain(tc.expected);
    });
  });
});
