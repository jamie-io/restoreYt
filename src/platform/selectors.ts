const selectors = {
  watchTitle: ['h1.ytd-watch-metadata yt-formatted-string', 'h1.title'],
  titleElements: [
    'h1.ytd-watch-metadata yt-formatted-string',
    'h1.title yt-formatted-string',
    'yt-shorts-video-title-view-model h2 span',
    'a.ytp-title-link',
    'yt-lockup-view-model h3',
    'ytd-video-renderer #video-title',
    'ytd-rich-item-renderer #video-title-link',
  ],
  descriptionText: [
    '#description-inline-expander #description-text',
    '#description yt-attributed-string',
    '#description .ytd-video-description-body-renderer',
    '#description span[slot="content"]',
  ],
  channelTitle: [
    '#channel-header ytd-channel-name yt-formatted-string',
    '#page-header ytd-channel-name yt-formatted-string',
    '#channel-header #channel-title',
  ],
  watchDescription: ['ytd-watch-metadata #description', '#description-inner'],
  player: ['#movie_player', 'ytd-player'],
  thumbnail: ['ytd-thumbnail img', 'yt-image img'],
  chapterList: ['ytd-engagement-panel-section-list-renderer', 'ytd-macro-markers-list-item-renderer'],
} as const;

export type SelectorName = keyof typeof selectors;

export function getSelectors(name: string): string[] {
  return name in selectors ? [...selectors[name as SelectorName]] : [];
}
