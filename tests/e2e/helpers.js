import { chromium } from '@playwright/test';

let browser;
let context;
let extensionId;

export async function setupExtension() {
  browser = await chromium.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${process.cwd()}`,
      `--load-extension=${process.cwd()}`
    ]
  });

  context = await browser.newContext();
  const page = await context.newPage();

  // Wait for extension to load
  await page.waitForTimeout(2000);

  // Get extension ID from service worker
  const serviceWorkers = context.serviceWorkers();
  if (serviceWorkers.length > 0) {
    const url = serviceWorkers[0].url();
    extensionId = url.split('/')[2];
  }

  return { browser, context, page, extensionId };
}

export async function teardownExtension() {
  if (context) await context.close();
  if (browser) await browser.close();
}

export async function waitForYouTubeLoad(page) {
  await page.goto('https://www.youtube.com', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
}

export async function getExtensionId() {
  return extensionId;
}
