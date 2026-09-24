import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { REQUIRED_SAMPLES } from './matrix.mjs';
import {
  collectLive,
  inferSessionVariant,
  inspectPage,
  mergeSessionVariants,
  parseSpikePref,
  summarize,
  writeReport,
} from './run.mjs';

const emptyMatrix = Object.fromEntries(Object.keys(REQUIRED_SAMPLES).map(category => [category, []]));

function titleSample({ uiLanguage = 'de', differs = true, titlePresent = true } = {}) {
  return {
    category: 'title',
    status: 'OBSERVED',
    uiLanguage,
    localeValidated: uiLanguage === 'de',
    renderedTitlePresent: titlePresent,
    embeddedTitlePresent: titlePresent,
    renderedTitleDiffersFromEmbedded: differs,
  };
}

function pageData(overrides = {}) {
  return {
    uiLanguage: 'de',
    applicationLanguage: 'de',
    accountMenuVisible: false,
    signInControlVisible: true,
    playerResponsePresent: false,
    playerResponseKeys: [],
    videoDetailsKeys: [],
    renderedTitlePresent: false,
    embeddedTitlePresent: false,
    renderedTitleDiffersFromEmbedded: false,
    ytcfgKeys: [],
    jsonBlockCount: 0,
    existingJsonBlockReadable: false,
    insertedJsonBlockReadable: true,
    sequentialClassicMainWorld: true,
    moduleMainWorld: false,
    audioTrackCount: 0,
    audioTrackFields: [],
    autoDubSignalCount: 0,
    autoDubbedTrackCount: 0,
    chapterElementCount: 0,
    chapterTitleCount: 0,
    channelNamePresent: false,
    channelNameDiffersFromEmbeddedAuthor: false,
    avatarPresent: false,
    bannerPresent: false,
    thumbnailImageCount: 0,
    thumbnailVariants: [],
    thumbnailMutationObserved: false,
    thumbnailRestored: false,
    thumbnailFallbackStatus: 'UNTESTED',
    sapisidCookieVisible: false,
    ...overrides,
  };
}

function fakePage(data = pageData()) {
  let currentUrl = 'https://www.youtube.com/';
  return {
    url: () => currentUrl,
    goto: async url => {
      currentUrl = url;
      return { status: () => 200 };
    },
    waitForTimeout: async () => {},
    evaluate: async () => data,
    on: () => {},
  };
}

function fakeBrowser(page) {
  const context = {
    pages: () => [page],
    addCookies: async () => {},
  };
  return { contexts: () => [context] };
}

test('title passes only after all five samples have validated German UI and title pairs', () => {
  const fourValid = [titleSample(), titleSample(), titleSample(), titleSample(), {
    category: 'title',
    status: 'BLOCKED',
    uiLanguage: 'de',
  }];

  const rows = summarize(emptyMatrix, fourValid);

  assert.equal(rows.find(row => row.key === 'title').status, 'BLOCKED');
});

test('all five validated title comparisons can produce a title result', () => {
  const rows = summarize(emptyMatrix, Array.from({ length: 5 }, () => titleSample()));

  assert.equal(rows.find(row => row.key === 'title').status, 'PASS');
});

test('title status fails when any validated sample does not differ', () => {
  const observations = [
    titleSample(),
    titleSample(),
    titleSample(),
    titleSample(),
    titleSample({ differs: false }),
  ];

  const rows = summarize(emptyMatrix, observations);

  assert.equal(rows.find(row => row.key === 'title').status, 'FAIL');
});

test('PREF application does not validate rendered UI language', async () => {
  const result = await inspectPage(fakePage(pageData({ uiLanguage: 'en', applicationLanguage: 'de' })), 'title', 1, 'abcdefghijk', [], {
    consoleErrors: 0,
    cspErrors: 0,
    pageErrors: 0,
  });

  assert.equal(result.uiLanguage, 'en');
  assert.equal(result.applicationLanguage, 'de');
  assert.equal(result.localeValidated, false);
});

test('PREF validator accepts cookie pairs and rejects malformed or injectable values', () => {
  assert.deepEqual(parseSpikePref('f6=400&hl=de'), {
    value: 'f6=400&hl=de',
    language: 'de',
    error: null,
  });
  assert.match(parseSpikePref('hl=de; Path=/').error, /SPIKE_PREF/);
  assert.match(parseSpikePref('hl=%Q0').error, /SPIKE_PREF/);
  assert.match(parseSpikePref('hl=de&hl=en').error, /duplicate/i);
});

test('session state requires one visible sign-in or account control', () => {
  assert.equal(inferSessionVariant({ accountMenuVisible: true, signInControlVisible: false }), 'logged-in');
  assert.equal(inferSessionVariant({ accountMenuVisible: false, signInControlVisible: true }), 'logged-out');
  assert.equal(inferSessionVariant({ accountMenuVisible: true, signInControlVisible: true }), 'unknown');
  assert.equal(inferSessionVariant({ accountMenuVisible: false, signInControlVisible: false }), 'unknown');
});

test('reported session label mismatch is detected from visible page controls', async () => {
  let connections = 0;
  const page = fakePage(pageData({ accountMenuVisible: false, signInControlVisible: true }));
  const result = await collectLive(emptyMatrix, null, {
    sessionVariant: 'logged-in',
    connectOverCDP: async () => {
      connections += 1;
      return fakeBrowser(page);
    },
  });

  assert.equal(connections, 1);
  assert.equal(result.evidence.configuration.sessionVariantValidation, 'MISMATCHED');
  assert.equal(result.evidence.configuration.sessionVariants.loggedOut, 'OBSERVED');
  assert.equal(result.evidence.configuration.sessionVariants.loggedIn, 'NOT OBSERVED');
});

test('live collection invokes injected CDP connector at most once', async () => {
  let connections = 0;
  const page = fakePage();

  const result = await collectLive(emptyMatrix, null, {
    sessionVariant: 'logged-out',
    connectOverCDP: async () => {
      connections += 1;
      return fakeBrowser(page);
    },
  });

  assert.equal(connections, 1);
  assert.equal(result.evidence.configuration.sessionVariantValidation, 'MATCHED');
});

test('live collection does not connect when PREF format is invalid', async () => {
  let connections = 0;
  const result = await collectLive(emptyMatrix, null, {
    sessionVariant: 'logged-out',
    prefRaw: 'hl=de; Path=/',
    connectOverCDP: async () => {
      connections += 1;
      throw new Error('connector should not run');
    },
  });

  assert.equal(connections, 0);
  assert.match(result.evidence.configuration.error, /SPIKE_PREF/);
});

test('invalid session label blocks without recording its raw value', async () => {
  const rawLabel = 'private-session-label';
  let connections = 0;
  const result = await collectLive(emptyMatrix, null, {
    sessionVariant: rawLabel,
    connectOverCDP: async () => {
      connections += 1;
      throw new Error('connector should not run');
    },
  });

  assert.equal(connections, 0);
  assert.equal(result.evidence.configuration.sessionVariantRequested, null);
  assert.equal(JSON.stringify(result.evidence).includes(rawLabel), false);
});

test('chapter evidence stores count only and thumbnail fallback stays untested without error event', async () => {
  const privateTitle = 'Synthetic private chapter title';
  const result = await inspectPage(fakePage(pageData({
    chapterElementCount: 1,
    chapterTitles: [privateTitle],
    thumbnailImageCount: 1,
    thumbnailFallbackObserved: true,
  })), 'chapters', 1, 'abcdefghijk', [], {
    consoleErrors: 0,
    cspErrors: 0,
    pageErrors: 0,
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.chapterTitleCount, 1);
  assert.equal('chapterTitles' in result, false);
  assert.equal(serialized.includes(privateTitle), false);
  assert.equal(result.thumbnailFallbackStatus, 'UNTESTED');
  assert.equal('thumbnailFallbackObserved' in result, false);
});

test('writeReport preserves previously observed session variants', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'spike-report-test-'));
  const fixturePath = join(directory, 'fixture.json');
  const reportPath = join(directory, 'report.md');
  const evidence = {
    generatedAt: '2026-01-01T00:00:00.000Z',
    live: { status: 'BLOCKED', reason: 'offline' },
    configuration: {
      configuredSamples: Object.fromEntries(Object.keys(REQUIRED_SAMPLES).map(category => [category, 0])),
      error: null,
      prefCookie: 'NOT APPLIED',
      sessionVariantValidation: 'NOT CHECKED',
      sessionVariants: { loggedOut: 'NOT OBSERVED', loggedIn: 'OBSERVED' },
    },
    observations: [],
    matrix: [],
  };

  try {
    await writeFile(fixturePath, JSON.stringify({
      configuration: { sessionVariants: { loggedOut: 'OBSERVED', loggedIn: 'NOT OBSERVED' } },
    }));
    await writeReport(evidence, { fixturePath, reportPath });
    const persisted = JSON.parse(await readFile(fixturePath, 'utf8'));

    assert.deepEqual(persisted.configuration.sessionVariants, {
      loggedOut: 'OBSERVED',
      loggedIn: 'OBSERVED',
    });
    assert.deepEqual(mergeSessionVariants(
      { loggedOut: 'OBSERVED', loggedIn: 'NOT OBSERVED' },
      { loggedOut: 'NOT OBSERVED', loggedIn: 'OBSERVED' },
    ), persisted.configuration.sessionVariants);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
