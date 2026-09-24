import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { collectLive } from './run.mjs';

const runScript = new URL('./run.mjs', import.meta.url);

test('live probe never closes or launches persistent browser', async () => {
  const source = await readFile(runScript, 'utf8');

  const closeCall = source.match(/\b(?:browser|context|page)\s*(?:\?\.|\.)\s*close\s*\(/)?.[0];
  const launchCall = source.match(/\bchromium\s*(?:\?\.|\.)\s*launch\s*\(/)?.[0];
  assert.equal(closeCall, undefined, `forbidden browser cleanup call: ${closeCall}`);
  assert.equal(launchCall, undefined, `forbidden browser launch call: ${launchCall}`);
});

test('live probe executes CDP connector at most once, including after connection failure', async () => {
  let connectionAttempts = 0;
  const matrix = {
    title: [],
    thumbnail: [],
    audio: [],
    chapters: [],
    channelBranding: [],
  };

  await collectLive(matrix, null, {
    sessionVariant: 'logged-out',
    connectOverCDP: async () => {
      connectionAttempts += 1;
      throw new Error('synthetic CDP failure');
    },
  });

  assert.equal(connectionAttempts, 1);
});
