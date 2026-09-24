import * as platform from '../../../src/platform/index.ts';

const api = name => {
  expect(platform[name], `${name} export`).toBeTypeOf('function');
  return platform[name];
};

it('provides ordered selector fallbacks without exposing mutable internal lists', () => {
  const getSelectors = api('getSelectors');
  const selectors = getSelectors('watchTitle');

  expect(selectors).toEqual(['h1.ytd-watch-metadata yt-formatted-string', 'h1.title']);
  selectors.reverse();
  expect(getSelectors('watchTitle')).toEqual(['h1.ytd-watch-metadata yt-formatted-string', 'h1.title']);
  expect(getSelectors('unknown')).toEqual([]);
});
