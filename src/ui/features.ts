import type { FeatureKey } from '../shared/settings.js';

export interface FeatureCopy {
  key: FeatureKey;
  label: string;
  /** One line for the popup. */
  hint: string;
  /** What YouTube does and what restoreyt does about it, for the settings page. */
  detail: string;
}

export const FEATURES: readonly FeatureCopy[] = [
  {
    key: 'titles',
    label: 'Titles',
    hint: 'The creator’s title, not a translation.',
    detail: 'YouTube translates titles into your interface language and shows some viewers alternative test titles. restoreyt puts back the title the creator wrote: on the home feed, in search, on the watch page, in Shorts, playlists and the browser tab.',
  },
  {
    key: 'descriptions',
    label: 'Descriptions',
    hint: 'Original text, links and timestamps.',
    detail: 'Translated descriptions are replaced with the creator’s text. Links, timestamps, hashtags and @handles stay clickable. Descriptions YouTube did not translate are left as they are.',
  },
  {
    key: 'thumbnails',
    label: 'Thumbnails',
    hint: 'The original image, not a localized one.',
    detail: 'Some channels upload a separate thumbnail for each language, and YouTube tests alternative thumbnails on viewers. restoreyt loads the creator’s main thumbnail instead.',
  },
  {
    key: 'audio',
    label: 'Audio',
    hint: 'Original language instead of a dub.',
    detail: 'When a video has dubbed or AI-dubbed audio tracks, restoreyt switches to the original track as the video starts. If you pick another track yourself, it stays picked.',
  },
  {
    key: 'captions',
    label: 'Subtitles',
    hint: 'Never switched on without asking.',
    detail: 'YouTube turns on subtitles in your language when it decides you need them, often machine-translated. restoreyt switches them off when YouTube did it on its own. Subtitles you turn on stay on.',
  },
  {
    key: 'hideAi',
    label: 'AI summaries',
    hint: 'Hide AI-generated video summaries.',
    detail: 'Removes the AI-generated video summary YouTube places in the description area.',
  },
];
