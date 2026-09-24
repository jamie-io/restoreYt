import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runThumbnailDomProbe } from './dom-probe.mjs';

function fakeImage() {
  const attributes = new Map([['src', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg']]);
  return {
    getAttribute: name => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    get currentSrc() { return attributes.get('src') ?? ''; },
  };
}

test('thumbnail DOM probe mutates, executes fallback, and restores original source', () => {
  const image = fakeImage();
  const result = runThumbnailDomProbe(image);

  assert.equal(result.mutationObserved, true);
  assert.equal(result.fallbackObserved, true);
  assert.equal(result.restored, true);
  assert.equal(image.getAttribute('src'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
});
