import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REQUIRED_SAMPLES, parseVideoMatrix } from './matrix.mjs';

const video = 'dQw4w9WgXcQ';

function validMatrix() {
  return JSON.stringify(Object.fromEntries(
    Object.entries(REQUIRED_SAMPLES).map(([category, count]) => [
      category,
      Array.from({ length: count }, (_, index) => `${String(index + 1).padStart(11, '0')}`),
    ]),
  ));
}

test('accepts exact Phase 0 sample counts and valid video IDs', () => {
  const result = parseVideoMatrix(validMatrix());

  assert.equal(result.error, null);
  assert.deepEqual(Object.fromEntries(
    Object.entries(result.matrix).map(([category, values]) => [category, values.length]),
  ), REQUIRED_SAMPLES);
});

test('rejects undersized live matrices with actionable configuration error', () => {
  const result = parseVideoMatrix(JSON.stringify({ title: [video] }));

  assert.match(result.error, /exact sample counts/i);
  assert.match(result.error, /title: 5/);
});

test('rejects duplicate video IDs within a category', () => {
  const matrix = JSON.parse(validMatrix());
  matrix.title[1] = matrix.title[0];

  const result = parseVideoMatrix(JSON.stringify(matrix));

  assert.match(result.error, /duplicate/i);
  assert.match(result.error, /title/);
});

test('allows the same video ID in different categories', () => {
  const matrix = JSON.parse(validMatrix());
  matrix.thumbnail[0] = matrix.title[0];

  assert.equal(parseVideoMatrix(JSON.stringify(matrix)).error, null);
});

test('allows empty matrix only for offline blocked report generation', () => {
  assert.equal(parseVideoMatrix(undefined, { allowEmpty: true }).error, null);
  assert.match(parseVideoMatrix(undefined).error, /SPIKE_VIDEO_MATRIX/);
});
