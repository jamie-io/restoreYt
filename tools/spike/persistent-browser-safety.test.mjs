import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const runScript = new URL('./run.mjs', import.meta.url);

test('live probe connects once and never closes or launches persistent browser', async () => {
  const source = await readFile(runScript, 'utf8');

  const closeCall = source.match(/\b(?:browser|context|page)\s*(?:\?\.|\.)\s*close\s*\(/)?.[0];
  const launchCall = source.match(/\bchromium\s*(?:\?\.|\.)\s*launch\s*\(/)?.[0];
  assert.equal(closeCall, undefined, `forbidden browser cleanup call: ${closeCall}`);
  assert.equal(launchCall, undefined, `forbidden browser launch call: ${launchCall}`);
  assert.equal([...source.matchAll(/\bchromium\s*\.\s*connectOverCDP\s*\(/g)].length, 1);
});
