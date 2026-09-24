import { chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let context;
let extensionId;
let userDataDir;

export async function closeAndRemoveProfile(contextToClose, profileDirectory) {
  let closeError;
  let closeFailed = false;
  try {
    await contextToClose?.close();
  } catch (error) {
    closeError = error;
    closeFailed = true;
  }

  if (profileDirectory) {
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }

  return closeFailed ? { closeError } : undefined;
}

export async function setupExtension() {
  userDataDir = await mkdtemp(join(tmpdir(), 'restoreyt-e2e-'));
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${process.cwd()}`,
        `--load-extension=${process.cwd()}`,
      ],
    });

    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    extensionId = new URL(worker.url()).host;
    return { context, page: await context.newPage(), extensionId, userDataDir };
  } catch (error) {
    let closeFailure;
    try {
      closeFailure = await closeAndRemoveProfile(context, userDataDir);
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Extension setup and profile cleanup failed');
    }
    context = undefined;
    extensionId = undefined;
    userDataDir = undefined;
    if (closeFailure) {
      throw new AggregateError([error, closeFailure.closeError], 'Extension setup and profile cleanup failed');
    }
    throw error;
  }
}

export async function teardownExtension() {
  const closeFailure = await closeAndRemoveProfile(context, userDataDir);
  context = undefined;
  extensionId = undefined;
  userDataDir = undefined;
  if (closeFailure) throw closeFailure.closeError;
}

export async function loadMockWatchPage(page, videoId = 'dQw4w9WgXcQ') {
  await page.route('**/youtubei/v1/player**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      videoDetails: {
        videoId,
        title: 'Original title',
        author: 'Original channel',
        channelId: 'UC123456789',
        shortDescription: 'Original description',
      },
    }),
  }));
  await page.route(`https://www.youtube.com/watch?v=${videoId}`, route => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><html lang="de"><head><script>
      window.ytcfg = { get(key) { return ({ INNERTUBE_API_KEY: 'test-key', INNERTUBE_CONTEXT_CLIENT_NAME: 'WEB', INNERTUBE_CLIENT_VERSION: 'test-version' })[key]; } };
    </script></head><body>
      <h1 class="title"><yt-formatted-string>Übersetzter Titel</yt-formatted-string></h1>
      <div id="description"><yt-attributed-string>Übersetzte Beschreibung</yt-attributed-string></div>
    </body></html>`,
  }));
  await page.goto(`https://www.youtube.com/watch?v=${videoId}`, { waitUntil: 'domcontentloaded' });
}

export function getExtensionId() {
  return extensionId;
}
