import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const repositoryRoot = new URL('../../', import.meta.url);

function redact(value) {
  const source = `
    import { readFileSync } from 'node:fs';
    import { redactEvidence } from './tools/spike/redact.mjs';
    process.stdout.write(JSON.stringify(redactEvidence(JSON.parse(readFileSync(0, 'utf8')))));
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    input: JSON.stringify(value),
  });

  assert.equal(result.status, 0, result.stderr || 'redaction command failed');
  return JSON.parse(result.stdout);
}

test('redacts sensitive fields and preserves safe presence metadata', () => {
  const result = redact({
    cookie: 'synthetic-cookie-value',
    token: 'synthetic-token-value',
    visitorData: 'synthetic-visitor-value',
    accountId: 'synthetic-account-value',
    sapisidCookieVisible: true,
    nested: [{ authorization: 'synthetic-auth-value' }],
  });

  assert.deepEqual(result, {
    cookie: '[REDACTED]',
    token: '[REDACTED]',
    visitorData: '[REDACTED]',
    accountId: '[REDACTED]',
    sapisidCookieVisible: true,
    nested: [{ authorization: '[REDACTED]' }],
  });
});

test('preserves non-sensitive PREF application status without exposing its value', () => {
  const result = redact({
    prefCookie: 'NOT APPLIED',
    appliedPrefCookie: 'APPLIED, VALUE WITHHELD',
    rawPrefCookie: 'f6=400&hl=de',
  });

  assert.deepEqual(result, {
    prefCookie: 'NOT APPLIED',
    appliedPrefCookie: 'APPLIED, VALUE WITHHELD',
    rawPrefCookie: '[REDACTED]',
  });
});

test('removes URL queries and redacts YouTube video identifiers', () => {
  const result = redact({
    pageUrl: 'https://www.youtube.com/watch?v=synthetic-video-id&token=synthetic-token',
    thumbnailUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg?x=synthetic',
    legacyThumbnailUrl: 'https://i.ytimg.com/vi_lc/abcdefghijk/hqdefault.jpg',
    videoId: 'abcdefghijk',
  });

  assert.deepEqual(result, {
    pageUrl: 'https://www.youtube.com/watch',
    thumbnailUrl: 'https://i.ytimg.com/vi/[REDACTED]/hqdefault.jpg',
    legacyThumbnailUrl: 'https://i.ytimg.com/vi_lc/[REDACTED]/hqdefault.jpg',
    videoId: '[REDACTED]',
  });
});

test('redacts credentials embedded in text and private URL path segments', () => {
  const result = redact({
    diagnostic: 'Bearer synthetic-auth-value; SAPISID=synthetic-cookie-value',
    accountUrl: 'https://example.test/accounts/synthetic-account/token/synthetic-token',
  });

  assert.deepEqual(result, {
    diagnostic: 'Bearer [REDACTED]; SAPISID=[REDACTED]',
    accountUrl: 'https://example.test/accounts/[REDACTED]/token/[REDACTED]',
  });
});

test('redacts channel identifiers in fields, assignments, and channel paths', () => {
  const result = redact({
    channelId: 'UCAbcdefghijklmnopqrstuv',
    diagnostic: 'channelId=UCAbcdefghijklmnopqrstuv at /channel/UCAbcdefghijklmnopqrstuv',
    channelUrl: 'https://www.youtube.com/channel/UCAbcdefghijklmnopqrstuv/videos',
  });

  assert.deepEqual(result, {
    channelId: '[REDACTED]',
    diagnostic: 'channelId=[REDACTED] at /channel/[REDACTED]',
    channelUrl: 'https://www.youtube.com/channel/[REDACTED]/videos',
  });
});
