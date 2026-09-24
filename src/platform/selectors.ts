const selectors = {
  watchTitle: ['h1.ytd-watch-metadata yt-formatted-string', 'h1.title'],
  watchDescription: ['ytd-watch-metadata #description', '#description-inner'],
  player: ['#movie_player', 'ytd-player'],
  thumbnail: ['ytd-thumbnail img', 'yt-image img'],
  chapterList: ['ytd-engagement-panel-section-list-renderer', 'ytd-macro-markers-list-item-renderer'],
} as const;

export type SelectorName = keyof typeof selectors;

export function getSelectors(name: string): string[] {
  return name in selectors ? [...selectors[name as SelectorName]] : [];
}
