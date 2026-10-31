#!/usr/bin/env node
/**
 * Live check against real YouTube. Not part of CI: YouTube changes, rate-limits
 * and A/B-tests, so this is a maintainer tool.
 *
 *   npm run build && node tests/live/live-check.mjs [--headed] [--keep]
 *
 * Loads the unpacked extension in a fresh Chromium profile with a German UI
 * (where YouTube translates English videos), visits search, watch, channel and
 * Shorts pages and reports what is still translated.
 */

import { chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const headed = process.argv.includes('--headed');
const keep = process.argv.includes('--keep');
const WATCH_ID = process.env.LIVE_WATCH_ID ?? 'plN7JMbadRg';
const SEARCH = process.env.LIVE_SEARCH ?? 'mrbeast';
const CHANNEL = process.env.LIVE_CHANNEL ?? '@MrBeast';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';

const failures = [];
const check = (ok, label, detail = '') => {
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}\n`);
  if (!ok) failures.push(label);
};

const oembedCache = new Map();
async function oembedTitle(videoId) {
  if (oembedCache.has(videoId)) return oembedCache.get(videoId);
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  const response = await fetch(url);
  const title = response.ok ? (await response.json()).title : null;
  oembedCache.set(videoId, title);
  return title;
}

const profile = await mkdtemp(join(tmpdir(), 'restoreyt-live-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: !headed,
  locale: 'de-DE',
  userAgent: UA,
  viewport: { width: 1400, height: 1000 },
  args: [`--disable-extensions-except=${root}`, `--load-extension=${root}`],
});
await context.addCookies([
  // Reject-all consent choice and German interface; no account involved.
  { name: 'SOCS', value: 'CAI', domain: '.youtube.com', path: '/', secure: true },
  { name: 'PREF', value: 'hl=de&gl=DE', domain: '.youtube.com', path: '/', secure: true },
]);

const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
const extensionId = new URL(worker.url()).host;
const page = context.pages()[0] ?? await context.newPage();
const pageErrors = [];
page.on('console', message => {
  if (message.type() === 'error' && /restoreyt/i.test(message.text())) pageErrors.push(message.text());
});
page.on('pageerror', error => {
  if (/restoreyt|build\/(content|page)\.js/.test(String(error.stack))) pageErrors.push(String(error));
});

const helper = await context.newPage();
await helper.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
async function report() {
  return helper.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: '*://www.youtube.com/*' });
    if (!tab?.id) return null;
    return chrome.tabs.sendMessage(tab.id, { type: 'restoreyt:get-report' }, { frameId: 0 });
  });
}

async function go(url, settle = 5000) {
  await page.bringToFront();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(settle);
}

async function visibleTitles(selector) {
  return page.evaluate(sel => [...document.querySelectorAll(sel)].map(host => {
    const lockup = host.closest('yt-lockup-view-model');
    const contentId = lockup?.querySelector('[class*="content-id-"]')?.className.match(/content-id-([A-Za-z0-9_-]+)/)?.[1];
    const href = host.querySelector('a[href]')?.getAttribute('href') ?? host.closest('a[href]')?.getAttribute('href') ?? host.getAttribute('href');
    const id = contentId ?? href?.match(/(?:v=|shorts\/)([A-Za-z0-9_-]{11})/)?.[1];
    const rect = host.getBoundingClientRect();
    return { id, text: host.textContent.trim(), visible: rect.top < innerHeight + 600 && rect.bottom > -600 && rect.width > 0 };
  }).filter(item => item.id && item.id.length === 11 && item.visible), selector);
}

async function waitForAds(maxMs = 60000) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const state = await page.evaluate(() => {
      const player = document.getElementById('movie_player');
      const skip = document.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button');
      if (skip instanceof HTMLElement) skip.click();
      return Boolean(player?.classList.contains('ad-showing'));
    });
    if (!state) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

/** A bare localized URL 404s at YouTube; with the redirect rule it loads the original. */
async function thumbnailRedirectWorks(videoId) {
  return page.evaluate(id => new Promise(resolveProbe => {
    const image = new Image();
    image.onload = () => resolveProbe({ ok: true, width: image.naturalWidth });
    image.onerror = () => resolveProbe({ ok: false, width: 0 });
    image.src = `https://i.ytimg.com/vi_lc/${id}/hqdefault_de.jpg?probe=${Date.now()}`;
  }), videoId);
}

async function compareTitles(label, selector, { optional = false } = {}) {
  // Give lookups time to land.
  await page.waitForTimeout(2500);
  const titles = await visibleTitles(selector);
  if (optional && titles.length === 0) {
    process.stdout.write(`SKIP  ${label}: none on page\n`);
    return;
  }
  let restored = 0;
  const wrong = [];
  for (const item of titles.slice(0, 24)) {
    const original = await oembedTitle(item.id);
    if (!original) continue;
    if (original.replace(/\s+/g, ' ').trim() === item.text.replace(/\s+/g, ' ').trim()) restored += 1;
    else wrong.push(`${item.id}: "${item.text}" ≠ "${original}"`);
  }
  check(titles.length > 0 && wrong.length === 0, `${label}: ${restored}/${restored + wrong.length} titles original`, wrong.slice(0, 4).join(' | '));
}

try {
  // Search results
  await go(`https://www.youtube.com/results?search_query=${encodeURIComponent(SEARCH)}`);
  if (page.url().includes('consent.')) throw new Error('Consent wall: SOCS cookie not accepted');
  await compareTitles('search (video renderers)', 'ytd-video-renderer #video-title');
  await compareTitles('search (lockups)', 'yt-lockup-metadata-view-model h3', { optional: true });
  await compareTitles('search (shorts)', 'ytm-shorts-lockup-view-model h3', { optional: true });
  const searchReport = await report();
  check(Boolean(searchReport) && searchReport.counts.titles > 0, 'search report counts titles', JSON.stringify(searchReport?.counts));

  // Channel page
  await go(`https://www.youtube.com/${CHANNEL}/videos`);
  await compareTitles('channel videos', 'yt-lockup-metadata-view-model h3');
  const probe = await thumbnailRedirectWorks(WATCH_ID);
  check(probe.ok && probe.width > 0, 'localized thumbnail redirects to original', `width ${probe.width}`);

  // Watch page
  let adsDone = false;
  for (let attempt = 0; attempt < 3 && !adsDone; attempt += 1) {
    await go(`https://www.youtube.com/watch?v=${WATCH_ID}`, 4000);
    adsDone = await waitForAds(45000);
    if (!adsDone) process.stdout.write(`NOTE  ad still showing, reloading (attempt ${attempt + 1})\n`);
  }
  await page.waitForTimeout(5000);
  const original = await oembedTitle(WATCH_ID);
  const watch = await page.evaluate(() => {
    const player = document.getElementById('movie_player');
    const decode = id => {
      try {
        const b = id.split(';')[1];
        return atob(b.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b.length + 3) % 4));
      } catch { return ''; }
    };
    let caption = null;
    try { caption = player.getOption('captions', 'track'); } catch { caption = null; }
    return {
      h1: document.querySelector('ytd-watch-metadata #title h1')?.textContent.trim(),
      docTitle: document.title,
      snippet: document.querySelector('#attributed-snippet-text')?.textContent.trim().slice(0, 160),
      restoredDescription: Boolean(document.querySelector('#description-inline-expander .restoreyt-description')),
      audio: decode(player?.getAudioTrack?.()?.id ?? ''),
      captionsOn: Boolean(caption && caption.languageCode),
      ad: Boolean(player?.classList.contains('ad-showing')),
    };
  });
  check(watch.h1 === original, 'watch h1 original', `${watch.h1}`);
  check(watch.docTitle.includes(original), 'tab title original', watch.docTitle);
  check(watch.restoredDescription, 'description restored', watch.snippet);
  check(/original/.test(watch.audio), 'original audio track', watch.ad ? 'ad was showing' : watch.audio.replace(/[^\x20-\x7e]+/g, '|'));
  check(!watch.captionsOn, 'auto subtitles off');
  const watchReport = await report();
  check(Boolean(watchReport) && watchReport.counts.audio === 1, 'watch report', JSON.stringify(watchReport?.counts));
  await compareTitles('related videos', '#related yt-lockup-metadata-view-model h3');

  // SPA navigation to another video
  const nextId = await page.evaluate(() => document.querySelector('#related yt-lockup-view-model a[href*="/watch?v="]')?.getAttribute('href')?.match(/v=([A-Za-z0-9_-]{11})/)?.[1]);
  if (nextId) {
    await page.click(`#related a[href*="${nextId}"]`);
    await page.waitForTimeout(8000);
    const spa = await page.evaluate(() => ({ h1: document.querySelector('ytd-watch-metadata #title h1')?.textContent.trim(), url: location.href }));
    const spaOriginal = await oembedTitle(nextId);
    check(spa.h1 === spaOriginal, 'SPA navigation keeps titles original', `${spa.h1} (${spa.url})`);
  }

  // Shorts
  const shortId = await page.evaluate(async () => {
    const response = await fetch('/@MrBeast/shorts');
    const html = await response.text();
    return html.match(/\/shorts\/([A-Za-z0-9_-]{11})/)?.[1] ?? null;
  });
  if (shortId) {
    await go(`https://www.youtube.com/shorts/${shortId}`, 7000);
    const shortOriginal = await oembedTitle(shortId);
    const overlay = await page.evaluate(() => document.querySelector('yt-shorts-video-title-view-model')?.textContent.trim());
    check(!overlay || overlay === shortOriginal, 'shorts overlay title original', `${overlay}`);
  }

  check(pageErrors.length === 0, 'no restoreyt errors on page', pageErrors.slice(0, 3).join(' | '));
} catch (error) {
  check(false, 'live run completed', String(error));
} finally {
  if (!keep) {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
}

process.stdout.write(`\n${failures.length === 0 ? 'All live checks passed.' : `${failures.length} live check(s) failed.`}\n`);
process.exitCode = failures.length === 0 ? 0 : 1;
