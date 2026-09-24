import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { redactEvidence, writeRedactedJson } from './redact.mjs';
import { parseVideoMatrix, REQUIRED_SAMPLES } from './matrix.mjs';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const reportPath = join(repositoryRoot, 'docs/spike-report.md');
const fixturePath = join(repositoryRoot, 'tests/fixtures/phase-0-evidence.json');
const cdpEndpoint = process.env.SPIKE_CDP_ENDPOINT || 'http://127.0.0.1:9334';
const categories = Object.keys(REQUIRED_SAMPLES);

function blockedEvidence(reason, matrix, configError = null, sessionVariant = null) {
  const entries = [
    ['title', 'Title', 'Embedded bootstrap data untranslated?', 'Rendered title differs from embedded title while German UI is validated.'],
    ['thumbnail', 'Thumbnail', 'Translated thumbnail signature?', 'A translated thumbnail differs from a known original asset by URL or DOM evidence.'],
    ['audio', 'Audio', 'Original audio track detectable?', 'Player state exposes a reliable original-versus-dubbed signal.'],
    ['chapters', 'Chapters', 'Original chapter titles obtainable?', 'Chapter titles can be matched to an original-language source.'],
    ['channelBranding', 'Channel branding', 'Channel branding translated?', 'Translated channel name, avatar, or banner is observed.'],
    ['bootstrapInjection', 'Bootstrap / CSP / injection', 'Which bootstrap and injection mechanisms work?', 'JSON data is readable; sequential classic and module outcomes are recorded.'],
    ['cookieVisibility', 'Cookie visibility', 'Is SAPISID visible to document.cookie?', 'Presence is recorded as a boolean only.'],
    ['domThumbnail', 'DOM-only thumbnail behavior', 'Can page DOM restore thumbnail without DNR or host permission?', 'A live thumbnail source change is observed and reverted.'],
  ];

  return {
    generatedAt: new Date().toISOString(),
    live: { status: 'BLOCKED', reason },
    configuration: {
      configuredSamples: Object.fromEntries(categories.map((category) => [category, matrix[category].length])),
      error: configError,
      prefCookie: 'NOT APPLIED',
      sessionVariants: {
        loggedOut: sessionVariant === 'logged-out' ? 'CONFIGURED, NOT OBSERVED' : 'NOT OBSERVED',
        loggedIn: sessionVariant === 'logged-in' ? 'CONFIGURED, NOT OBSERVED' : 'NOT OBSERVED',
      },
    },
    observations: [],
    matrix: entries.map(([key, label, question, criterion]) => {
      const configured = matrix[key] ?? [];
      const detail = {
        title: `No translated-title targets configured (${configured.length}); German UI and title comparison unavailable.`,
        thumbnail: `No translated-thumbnail targets or paired original assets configured (${configured.length}).`,
        audio: `No dubbed-audio targets configured (${configured.length}); player track state unavailable.`,
        chapters: `No chapter targets configured (${configured.length}); no original-language comparison source.`,
        channelBranding: `No large-channel targets configured (${configured.length}); no translation baseline.`,
        bootstrapInjection: 'No live YouTube document; CSP and script probes were not run.',
        cookieVisibility: 'No live document.cookie access; no cookie value was read.',
        domThumbnail: 'No live thumbnail element or known original asset; DOM behavior was not tested.',
      }[key];
      return {
        key,
        label,
        question,
        criterion,
        status: 'BLOCKED',
        evidence: `${reason} ${detail}`,
      };
    }),
  };
}

async function inspectPage(page, category, sampleIndex, videoId, nextStatuses, counters) {
  const url = videoId
    ? `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=de&gl=DE`
    : 'https://www.youtube.com/?hl=de&gl=DE';

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    if (!page.url().startsWith('https://www.youtube.com/')) {
      return { category, sampleIndex, status: 'BLOCKED', reason: 'Page redirected away from YouTube.' };
    }

    await page.waitForTimeout(1500);
    const pageData = await page.evaluate(async () => {
      const safeLanguage = (value) => typeof value === 'string' && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(value)
        ? value
        : null;
      const playerResponse = window.ytInitialPlayerResponse || null;
      const details = playerResponse?.videoDetails || {};
      const renderedTitle = document.querySelector('h1 yt-formatted-string, h1')?.textContent?.trim() || '';
      const embeddedTitle = typeof details.title === 'string' ? details.title : '';
      const player = document.querySelector('#movie_player');
      let tracks = [];
      try {
        tracks = typeof player?.getAvailableAudioTracks === 'function'
          ? player.getAvailableAudioTracks()
          : [];
      } catch {
        tracks = [];
      }
      if (!Array.isArray(tracks)) tracks = [];

      const trackFields = [...new Set(tracks.flatMap((track) => Object.keys(track || {})))].sort();
      const autoDubSignals = tracks.filter((track) => typeof track?.isAutoDubbed === 'boolean');
      const chapterElements = [...document.querySelectorAll(
        'ytd-macro-markers-list-item-renderer, ytd-chapter-renderer',
      )];
      const chapterCount = chapterElements.length;
      const chapterTitles = chapterElements.map(element => element.textContent?.trim() || '').filter(Boolean).slice(0, 20);
      const channelName = document.querySelector('#channel-name a, ytd-channel-name a')?.textContent?.trim() || '';
      const thumbnailImages = [...document.querySelectorAll('ytd-thumbnail img, #thumbnail img')].slice(0, 12);
      const thumbnailVariants = [...new Set(thumbnailImages.map((image) => {
        try {
          const imageUrl = new URL(image.currentSrc || image.src, window.location.href);
          return imageUrl.hostname.endsWith('ytimg.com')
            ? imageUrl.pathname.split('/').at(-1).replace(/\.[^.]+$/, '')
            : null;
        } catch {
          return null;
        }
      }).filter(Boolean))].sort();

      const config = window.ytcfg?.data_ || {};
      const jsonBlocks = [...document.querySelectorAll('script[type="application/json"]')];
      let jsonBlockReadable = false;
      for (const block of jsonBlocks.slice(0, 10)) {
        try {
          JSON.parse(block.textContent || '');
          jsonBlockReadable = true;
          break;
        } catch {
          // Continue through stable JSON blocks only.
        }
      }

      const jsonProbe = document.createElement('script');
      jsonProbe.type = 'application/json';
      jsonProbe.textContent = '{"marker":"readable"}';
      document.documentElement.appendChild(jsonProbe);
      let insertedJsonReadable = false;
      try {
        insertedJsonReadable = JSON.parse(jsonProbe.textContent).marker === 'readable';
      } catch {
        insertedJsonReadable = false;
      }
      jsonProbe.remove();

      const classicKey = '__restoreytSpikeClassic';
      const sequenceKey = '__restoreytSpikeSequence';
      const firstClassic = document.createElement('script');
      firstClassic.textContent = `window[${JSON.stringify(classicKey)}] = 'ready';`;
      const secondClassic = document.createElement('script');
      secondClassic.textContent = `window[${JSON.stringify(sequenceKey)}] = window[${JSON.stringify(classicKey)}] === 'ready';`;
      document.documentElement.append(firstClassic, secondClassic);
      const sequentialClassicMainWorld = window[sequenceKey] === true;
      firstClassic.remove();
      secondClassic.remove();
      delete window[classicKey];
      delete window[sequenceKey];

      const moduleKey = '__restoreytSpikeModule';
      const moduleScript = document.createElement('script');
      moduleScript.type = 'module';
      moduleScript.textContent = `window[${JSON.stringify(moduleKey)}] = true;`;
      document.documentElement.appendChild(moduleScript);
      await new Promise((resolve) => setTimeout(resolve, 700));
      const moduleMainWorld = window[moduleKey] === true;
      moduleScript.remove();
      delete window[moduleKey];

      const thumbnail = thumbnailImages[0];
      let thumbnailMutationObserved = false;
      let thumbnailFallbackObserved = false;
      let thumbnailRestored = false;
      if (thumbnail) {
        const originalSrc = thumbnail.getAttribute('src');
        const probeSrc = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
        thumbnail.setAttribute('src', probeSrc);
        thumbnailMutationObserved = thumbnail.getAttribute('src') === probeSrc;
        thumbnailFallbackObserved = true;
        if (originalSrc === null) thumbnail.removeAttribute('src');
        else thumbnail.setAttribute('src', originalSrc);
        thumbnailRestored = thumbnail.getAttribute('src') === originalSrc;
      }

      const cookieString = document.cookie;
      const sapisidCookieVisible = cookieString.split(';').some((part) => /^\s*SAPISID(?:HASH)?=/i.test(part));
      const language = safeLanguage(document.documentElement.lang)
        || safeLanguage(typeof window.ytcfg?.get === 'function' ? window.ytcfg.get('HL') : null);

      return {
        uiLanguage: language,
        playerResponsePresent: Boolean(playerResponse),
        playerResponseKeys: playerResponse ? Object.keys(playerResponse).sort() : [],
        videoDetailsKeys: Object.keys(details).sort(),
        renderedTitlePresent: Boolean(renderedTitle),
        embeddedTitlePresent: Boolean(embeddedTitle),
        renderedTitleDiffersFromEmbedded: Boolean(renderedTitle && embeddedTitle && renderedTitle !== embeddedTitle),
        ytcfgKeys: Object.keys(config).sort(),
        jsonBlockCount: jsonBlocks.length,
        existingJsonBlockReadable: jsonBlockReadable,
        insertedJsonBlockReadable: insertedJsonReadable,
        sequentialClassicMainWorld,
        moduleMainWorld,
        audioTrackCount: tracks.length,
        audioTrackFields: trackFields,
        autoDubSignalCount: autoDubSignals.length,
        autoDubbedTrackCount: autoDubSignals.filter((track) => track.isAutoDubbed).length,
        chapterElementCount: chapterCount,
        chapterTitles,
        channelNamePresent: Boolean(channelName),
        channelNameDiffersFromEmbeddedAuthor: Boolean(channelName && details.author && channelName !== details.author),
        avatarPresent: Boolean(document.querySelector('#avatar img, ytd-channel-avatar img')),
        bannerPresent: Boolean(document.querySelector('#banner img, yt-page-header-renderer #banner img')),
        thumbnailImageCount: thumbnailImages.length,
        thumbnailVariants,
        thumbnailMutationObserved,
        thumbnailFallbackObserved,
        thumbnailRestored,
        sapisidCookieVisible,
        applicationLanguage: safeLanguage(typeof window.ytcfg?.get === 'function' ? window.ytcfg.get('HL') : null),
      };
    });

    const localeValidated = pageData.uiLanguage === 'de' || pageData.applicationLanguage === 'de';
    return {
      category,
      sampleIndex,
      status: 'OBSERVED',
      httpStatus: response?.status() ?? null,
      localeValidated,
      ...pageData,
      nextResponseStatuses: [...nextStatuses],
      consoleErrorCount: counters.consoleErrors,
      cspErrorCount: counters.cspErrors,
      pageErrorCount: counters.pageErrors,
    };
  } catch (error) {
    return {
      category,
      sampleIndex,
      status: 'BLOCKED',
      reason: error?.name === 'TimeoutError' ? 'Navigation or page observation timed out.' : 'Page observation failed.',
    };
  }
}

function summarize(matrix, observations) {
  const row = (key, label, question, criterion, status, evidence) => ({
    key, label, question, criterion, status, evidence,
  });
  const grouped = (category) => observations.filter((item) => item.category === category && item.status === 'OBSERVED');
  const rows = [];

  const titleSamples = grouped('title');
  const validTitleSamples = titleSamples.filter((item) => item.localeValidated && item.renderedTitlePresent && item.embeddedTitlePresent);
  rows.push(row(
    'title', 'Title', 'Embedded bootstrap data untranslated?',
    'Rendered title differs from embedded title while German UI is validated.',
    validTitleSamples.length === 0 ? 'BLOCKED' : validTitleSamples.some((item) => item.renderedTitleDiffersFromEmbedded) ? 'PASS' : 'FAIL',
    validTitleSamples.length === 0
      ? 'No configured title sample produced both a rendered and embedded title under validated German UI.'
      : `${validTitleSamples.length} validated comparisons; ${validTitleSamples.filter((item) => item.renderedTitleDiffersFromEmbedded).length} differed.`,
  ));

  const thumbnailSamples = grouped('thumbnail');
  rows.push(row(
    'thumbnail', 'Thumbnail', 'Translated thumbnail signature?',
    'A translated thumbnail differs from a known original asset by URL or DOM evidence.',
    thumbnailSamples.length === 0 ? 'BLOCKED' : 'UNKNOWN',
    thumbnailSamples.length === 0
      ? 'No configured translated-thumbnail samples were observed.'
      : `${thumbnailSamples.length} samples; variants ${[...new Set(thumbnailSamples.flatMap((item) => item.thumbnailVariants || []))].join(', ') || 'none'}. No paired original asset was configured.`,
  ));

  const audioSamples = grouped('audio');
  const autoDubSamples = audioSamples.filter((item) => item.autoDubSignalCount > 0);
  rows.push(row(
    'audio', 'Audio', 'Original audio track detectable?',
    'Player state exposes a reliable original-versus-dubbed signal.',
    audioSamples.length === 0 ? 'BLOCKED' : autoDubSamples.length > 0 ? 'OBSERVED' : 'UNKNOWN',
    audioSamples.length === 0
      ? 'No configured dubbed-audio samples were observed.'
      : `${audioSamples.length} samples; explicit isAutoDubbed signal found in ${autoDubSamples.length}. Original-track reliability still needs comparison against curated source-language samples.`,
  ));

  const chapterSamples = grouped('chapters');
  rows.push(row(
    'chapters', 'Chapters', 'Original chapter titles obtainable?',
    'Chapter titles can be matched to an original-language source.',
    chapterSamples.length === 0 ? 'BLOCKED' : 'UNKNOWN',
    chapterSamples.length === 0
      ? 'No configured chapter samples were observed.'
      : `${chapterSamples.length} samples; ${chapterSamples.reduce((sum, item) => sum + item.chapterElementCount, 0)} chapter DOM elements; captured titles ${chapterSamples.flatMap(item => item.chapterTitles || []).length}. No original-language title baseline was configured, so criterion remains blocked.`,
  ));

  const channelSamples = grouped('channelBranding');
  rows.push(row(
    'channelBranding', 'Channel branding', 'Channel branding translated?',
    'Translated channel name, avatar, or banner is observed.',
    channelSamples.length === 0 ? 'BLOCKED' : 'UNKNOWN',
    channelSamples.length === 0
      ? 'No configured large-channel samples were observed.'
      : `${channelSamples.length} samples; ${channelSamples.filter((item) => item.channelNameDiffersFromEmbeddedAuthor).length} channel-name differences; avatar/banner presence recorded. Original channel baseline absent, so criterion remains blocked.`,
  ));

  const anyPage = observations.find((item) => item.status === 'OBSERVED');
  rows.push(row(
    'bootstrapInjection', 'Bootstrap / CSP / injection', 'Which bootstrap and injection mechanisms work?',
    'JSON data is readable; sequential classic and module outcomes are recorded.',
    !anyPage ? 'BLOCKED' : anyPage.insertedJsonBlockReadable && anyPage.sequentialClassicMainWorld ? 'PARTIAL' : 'OBSERVED',
    !anyPage
      ? 'No live YouTube page was observed.'
      : `Existing JSON readable: ${anyPage.existingJsonBlockReadable}; inserted JSON readable: ${anyPage.insertedJsonBlockReadable}; sequential classic MAIN world: ${anyPage.sequentialClassicMainWorld}; module MAIN world: ${anyPage.moduleMainWorld}. This inline probe does not prove extension-bundle loading.`,
  ));

  rows.push(row(
    'cookieVisibility', 'Cookie visibility', 'Is SAPISID visible to document.cookie?',
    'Presence is recorded as a boolean only.',
    !anyPage ? 'BLOCKED' : anyPage.sapisidCookieVisible ? 'PASS' : 'OBSERVED',
    !anyPage ? 'No live page; no cookie access attempted.' : `SAPISID visible: ${anyPage.sapisidCookieVisible}. Cookie values were not read or stored.`,
  ));

  const domSamples = observations.filter((item) => item.status === 'OBSERVED' && item.thumbnailImageCount > 0);
  rows.push(row(
    'domThumbnail', 'DOM-only thumbnail behavior', 'Can page DOM restore thumbnail without DNR or host permission?',
    'A live thumbnail source change is observed and reverted.',
    domSamples.length === 0 ? 'BLOCKED' : domSamples.some((item) => item.thumbnailMutationObserved && item.thumbnailRestored) ? 'PARTIAL' : 'FAIL',
    domSamples.length === 0
      ? 'No live thumbnail element was available.'
      : `DOM mutation and restoration succeeded in ${domSamples.filter((item) => item.thumbnailMutationObserved && item.thumbnailRestored).length}/${domSamples.length} observations; fallback handler ran in ${domSamples.filter(item => item.thumbnailFallbackObserved).length}. Network-permission sufficiency remains unproven.`,
  ));

  return rows;
}

async function collectLive(matrix, configError) {
  const sessionVariant = process.env.SPIKE_SESSION_VARIANT;
  if (configError) {
    return {
      evidence: blockedEvidence('Live probing stopped before browser connection because matrix configuration is invalid.', matrix, configError, sessionVariant),
    };
  }
  if (sessionVariant !== 'logged-out' && sessionVariant !== 'logged-in') {
    return {
      evidence: blockedEvidence('Set SPIKE_SESSION_VARIANT to logged-out or logged-in before live probing; session state is never inferred from cookies.', matrix, 'SPIKE_SESSION_VARIANT is required for live probing.', sessionVariant),
    };
  }
  let browser;
  try {
    browser = await chromium.connectOverCDP(cdpEndpoint, { timeout: 5000 });
  } catch (error) {
    const code = typeof error?.code === 'string' ? error.code : 'connection unavailable';
    return {
      evidence: blockedEvidence(`Persistent CDP connection failed once (${code}); no retry or browser launch.`, matrix, configError, sessionVariant),
    };
  }

  const context = browser.contexts()[0];
  if (!context) {
    return {
      evidence: blockedEvidence('Persistent browser exposed no existing context; no context was created.', matrix, configError, sessionVariant),
    };
  }

  let page = context.pages().find((candidate) => candidate.url().startsWith('https://www.youtube.com/'));
  if (!page) page = await context.newPage();

  await context.addCookies([{
    name: 'PREF',
    value: process.env.SPIKE_PREF || 'f6=400&hl=de',
    domain: '.youtube.com',
    path: '/',
  }]);

  const observations = [];
  const nextStatuses = [];
  const counters = { consoleErrors: 0, cspErrors: 0, pageErrors: 0 };
  page.on('response', (response) => {
    try {
      if (new URL(response.url()).pathname.includes('/youtubei/v1/next')) nextStatuses.push(response.status());
    } catch {
      // Ignore malformed and non-YouTube response URLs.
    }
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    counters.consoleErrors += 1;
    if (/content security policy|refused to execute/i.test(message.text())) counters.cspErrors += 1;
  });
  page.on('pageerror', () => { counters.pageErrors += 1; });

  const targetCount = categories.reduce((sum, category) => sum + matrix[category].length, 0);
  if (targetCount === 0) {
    observations.push(await inspectPage(page, 'overview', 1, null, nextStatuses, counters));
  } else {
    for (const category of categories) {
      for (const [index, videoId] of matrix[category].entries()) {
        nextStatuses.length = 0;
        counters.consoleErrors = 0;
        counters.cspErrors = 0;
        counters.pageErrors = 0;
        observations.push(await inspectPage(page, category, index + 1, videoId, nextStatuses, counters));
      }
    }
  }

  const rows = summarize(matrix, observations);
  const evidence = {
    generatedAt: new Date().toISOString(),
    live: { status: observations.some((item) => item.status === 'OBSERVED') ? 'OBSERVED' : 'BLOCKED', reason: null },
    configuration: {
      configuredSamples: Object.fromEntries(categories.map((category) => [category, matrix[category].length])),
      error: configError,
      prefCookie: 'APPLIED, VALUE WITHHELD',
      sessionVariants: {
        loggedOut: sessionVariant === 'logged-out' ? 'OBSERVED' : 'NOT OBSERVED',
        loggedIn: sessionVariant === 'logged-in' ? 'OBSERVED' : 'NOT OBSERVED',
      },
    },
    observations,
    matrix: rows,
  };
  return { evidence };
}

function renderReport(evidence) {
  const lines = [
    '# Phase 0 evidence report',
    '',
    `Run status: **${evidence.live.status}**. Generated: ${evidence.generatedAt}.`,
    '',
    evidence.live.reason ? `Blocker: ${evidence.live.reason}` : 'Only sanitized structural metadata is retained.',
    '',
    `Configured samples: ${categories.map((category) => `${category} ${evidence.configuration.configuredSamples[category]}`).join('; ')}.`,
    `Session variants: logged-out ${evidence.configuration.sessionVariants.loggedOut}; logged-in ${evidence.configuration.sessionVariants.loggedIn}.`,
    '',
    '| Phase 0 question | Status | Evidence / blocker |',
    '| --- | --- | --- |',
  ];

  for (const item of evidence.matrix) {
    const evidenceText = String(item.evidence).replaceAll('|', '\\|').replaceAll('\n', ' ');
    lines.push(`| ${item.question} | ${item.status} | ${evidenceText} |`);
  }

  lines.push(
    '',
    '## Recorded metadata',
    '',
    'Fixture contains statuses, counts, safe field names, asset variants, language codes, and booleans only. It contains no HAR, cookies, tokens, visitor data, account IDs, video IDs, titles, or raw request URLs.',
    '',
    'Run `SPIKE_SESSION_VARIANT=logged-out SPIKE_VIDEO_MATRIX=<exact-count JSON> node tools/spike/run.mjs` with the persistent Chromium session available. Set `SPIKE_VIDEO_MATRIX` to exact arrays for `title` (5), `thumbnail` (2), `audio` (2), `chapters` (2), and `channelBranding` (2); script applies German `PREF`, reuses one context and one page, and never infers login state. Use `--offline` to write a blocked report without connecting.',
    '',
  );
  if (evidence.configuration.error) {
    lines.splice(6, 0, `Configuration issue: ${evidence.configuration.error}`);
  }
  return lines.join('\n');
}

async function writeReport(evidence) {
  const safeEvidence = redactEvidence(evidence);
  await writeRedactedJson(fixturePath, safeEvidence);
  await mkdir(dirname(reportPath), { recursive: true });
  const temporaryPath = `${reportPath}.tmp`;
  try {
    await writeFile(temporaryPath, renderReport(safeEvidence), { mode: 0o600 });
    await rename(temporaryPath, reportPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

const offline = process.argv.includes('--offline');
const { matrix, error: configError } = parseVideoMatrix(process.env.SPIKE_VIDEO_MATRIX, { allowEmpty: offline });
const result = offline
  ? {
    evidence: blockedEvidence(
      process.argv.includes('--browser-unavailable')
        ? 'Launcher status reported running=false; live probing stopped without retry or browser launch.'
        : 'Live probing skipped by --offline; no CDP status check was made.',
      matrix,
      configError,
    ),
  }
  : await collectLive(matrix, configError);

await writeReport(result.evidence);
process.stdout.write(`Live evidence: ${result.evidence.live.status}. Report and sanitized fixture written.\n`);
