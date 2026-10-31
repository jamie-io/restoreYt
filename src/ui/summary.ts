/** Plain-language sentences describing a page report. Pure, so it is testable. */

import type { LifetimeStats } from '../content/report.js';
import type { PageReport, RestoreKind } from '../shared/messages.js';

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count.toLocaleString('en-GB')} ${count === 1 ? singular : pluralForm}`;
}

export function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export function summarize(report: PageReport): string[] {
  const { titles, thumbnails, descriptions, audio, captions, aiHidden } = report.counts;
  const sentences: string[] = [];
  const restored: string[] = [];
  if (titles > 0) restored.push(plural(titles, 'title'));
  if (thumbnails > 0) restored.push(plural(thumbnails, 'thumbnail'));
  if (descriptions > 0) restored.push(descriptions === 1 && report.pageType === 'watch' ? 'the description' : plural(descriptions, 'description'));
  if (restored.length > 0) sentences.push(`Restored ${joinList(restored)}.`);
  if (audio > 0) sentences.push(audio === 1 ? 'Switched to the original audio track.' : `Switched ${plural(audio, 'video')} to the original audio.`);
  if (captions > 0) sentences.push('Turned off subtitles YouTube switched on by itself.');
  if (aiHidden > 0) sentences.push('Hid the AI summary.');
  if (sentences.length === 0) sentences.push('Nothing on this page needed restoring.');
  if (report.lookups.blocked) sentences.push('YouTube is limiting title lookups; restoreyt retries shortly.');
  else if (report.lookups.pending > 0) sentences.push(`Checking ${plural(report.lookups.pending, 'more title')}…`);
  if (report.lookups.failed > 0) sentences.push(`${plural(report.lookups.failed, 'title')} could not be checked.`);
  return sentences;
}

export const KIND_LABEL: Record<RestoreKind, string> = {
  title: 'Title',
  description: 'Description',
  audio: 'Audio track',
  captions: 'Subtitles',
};

export function describeStats(stats: Partial<LifetimeStats> | undefined): string {
  if (!stats) return 'Nothing restored yet. Open YouTube and the count starts here.';
  const restored: string[] = [];
  if (stats.titles) restored.push(plural(stats.titles, 'title'));
  if (stats.thumbnails) restored.push(plural(stats.thumbnails, 'thumbnail'));
  if (stats.descriptions) restored.push(plural(stats.descriptions, 'description'));
  if (stats.audio) restored.push(plural(stats.audio, 'audio track'));
  const since = stats.since ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long' }).format(stats.since) : null;
  if (restored.length === 0 && !stats.captions) return 'Nothing restored yet. Open YouTube and the count starts here.';
  let sentence = `${since ? `Since ${since}, ` : ''}restoreyt has restored ${restored.length ? joinList(restored) : 'nothing yet'}`;
  if (stats.captions) sentence += `, and switched off ${plural(stats.captions, 'set')} of subtitles YouTube turned on`;
  return `${sentence}.`;
}
