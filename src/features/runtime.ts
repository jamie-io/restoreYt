import { createFeatureCircuitBreaker } from '../core/circuit-breaker.js';
import { createDiagnosticsBuffer, type DiagnosticsBuffer } from '../core/diagnostics.js';
import { createNavigationEpoch } from '../core/navigation-epoch.js';
import { createRequestQueue } from '../core/request-queue.js';
import type { Settings } from '../core/settings.js';
import type { InnerTubeClient } from '../platform/api.js';
import { getSelectors } from '../platform/selectors.js';
import { buildThumbnailCandidates } from '../platform/thumbnails.js';

export interface AudioTrack {
  [key: string]: unknown;
}

export interface FeatureRuntimeOptions {
  document: Document;
  window: Window;
  api: InnerTubeClient;
  settings: Settings;
  diagnostics?: DiagnosticsBuffer;
}

export interface FeatureRuntime {
  start(): void;
  stop(): void;
  process(): Promise<void>;
}

export function shouldReplaceText(current: string | null | undefined, original: string | null | undefined): boolean {
  return Boolean(original?.trim() && current?.trim() !== original.trim());
}

export function findOriginalAudioTrack(tracks: unknown): { index: number; track: AudioTrack } | null {
  if (!Array.isArray(tracks)) return null;
  for (const [index, candidate] of tracks.entries()) {
    if (!candidate || typeof candidate !== 'object') continue;
    const track = candidate as AudioTrack;
    if (typeof track.isAutoDubbed === 'boolean' && track.isAutoDubbed === false) return { index, track };
  }
  return null;
}

export function buildFeaturePlan(settings: Partial<Settings>): string[] {
  if (settings.enabled === false) return [];
  return [
    settings.untranslateTitle !== false ? 'title' : null,
    settings.untranslateThumbnail !== false ? 'thumbnail' : null,
    settings.untranslateDescription !== false ? 'description' : null,
    settings.untranslateAudio !== false ? 'audio' : null,
    settings.untranslateChannelBranding !== false ? 'channelBranding' : null,
  ].filter((feature): feature is string => feature !== null);
}

function uniqueElements(document: Document, selectors: string[]): Element[] {
  const seen = new Set<Element>();
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach(element => seen.add(element));
  }
  return [...seen];
}

function isVisible(element: Element): boolean {
  try {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  } catch {
    return true;
  }
}

function videoIdForElement(element: Element, api: InnerTubeClient, window: Window): string | null {
  const link = element.closest('a[href]');
  if (link instanceof HTMLAnchorElement) return api.extractVideoId(link.href);
  const container = element.closest('ytd-video-renderer, ytd-rich-item-renderer, ytd-compact-video-renderer, ytd-grid-video-renderer, yt-lockup-view-model');
  const containerLink = container?.querySelector('a[href*="/watch"], a[href*="/shorts/"]');
  if (containerLink instanceof HTMLAnchorElement) return api.extractVideoId(containerLink.href);
  return api.extractVideoId(window.location.href);
}

function replaceText(element: Element, text: string): void {
  element.textContent = text;
}

function isWhitelisted(settings: Settings, channelId: string | null): boolean {
  return Boolean(channelId && settings.whitelistChannels.includes(channelId));
}

export function createFeatureRuntime(options: FeatureRuntimeOptions): FeatureRuntime {
  const { document, window, api, settings } = options;
  const diagnostics = options.diagnostics ?? createDiagnosticsBuffer({ capacity: 100 });
  const breaker = createFeatureCircuitBreaker({ failureThreshold: 3 });
  const epoch = createNavigationEpoch();
  const thumbnailQueue = createRequestQueue({ concurrency: 4 });
  const processedTitles = new WeakMap<Element, string>();
  const processedDescriptions = new WeakMap<Element, string>();
  const processedThumbnails = new WeakSet<HTMLImageElement>();
  const processedAudioPlayers = new WeakSet<Element>();
  let observer: MutationObserver | null = null;
  let started = false;

  const runFeature = async (feature: string, operation: () => Promise<void>): Promise<void> => {
    try {
      await breaker.run(feature, operation);
    } catch (error) {
      diagnostics.record({ feature, level: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  const processTitles = async (): Promise<void> => {
    await Promise.all(uniqueElements(document, getSelectors('titleElements')).filter(isVisible).map(async element => {
      const videoId = videoIdForElement(element, api, window);
      if (!videoId) return;
      const startEpoch = epoch.value;
      const details = await api.getVideoDetails(videoId);
      if (startEpoch !== epoch.value || !details || isWhitelisted(settings, details.channelId)) return;
      if (!shouldReplaceText(element.textContent, details.title)) return;
      if (processedTitles.get(element) === details.title) return;
      replaceText(element, details.title);
      processedTitles.set(element, details.title);
    }));
  };

  const processDescriptions = async (): Promise<void> => {
    const containers = uniqueElements(document, getSelectors('descriptionText')).filter(isVisible);
    const videoId = api.extractVideoId(window.location.href);
    if (!videoId) return;
    const startEpoch = epoch.value;
    const details = await api.getVideoDetails(videoId);
    const originalDescription = details?.shortDescription;
    if (startEpoch !== epoch.value || !originalDescription) return;
    containers.forEach(container => {
      if (!shouldReplaceText(container.textContent, originalDescription) || processedDescriptions.get(container) === originalDescription) return;
      replaceText(container, originalDescription);
      processedDescriptions.set(container, originalDescription);
    });
  };

  const restoreThumbnail = async (image: HTMLImageElement, videoId: string): Promise<void> => {
    if (processedThumbnails.has(image) || isWhitelisted(settings, (await api.getVideoDetails(videoId))?.channelId ?? null)) return;
    const originalSrc = image.getAttribute('src');
    const originalDataSrc = image.getAttribute('data-src');
    const current = originalSrc || originalDataSrc || '';
    if (!current || !/(hq720|hqdefault|sddefault|mqdefault)/i.test(current)) return;
    const candidates = buildThumbnailCandidates(videoId);
    if (candidates.length === 0) return;
    const firstCandidate = candidates[0];
    if (!firstCandidate) return;
    processedThumbnails.add(image);
    let candidateIndex = 0;
    const restore = (): void => {
      if (originalSrc === null) image.removeAttribute('src');
      else image.setAttribute('src', originalSrc);
      if (originalDataSrc === null) image.removeAttribute('data-src');
      else image.setAttribute('data-src', originalDataSrc);
    };
    const onError = (): void => {
      candidateIndex += 1;
      const nextCandidate = candidates[candidateIndex];
      if (nextCandidate) image.src = nextCandidate;
      else restore();
    };
    image.addEventListener('error', onError, { once: false });
    image.src = firstCandidate;
  };

  const processThumbnails = async (): Promise<void> => {
    const images = Array.from(document.querySelectorAll('img[src*="ytimg.com"], img[data-src*="ytimg.com"]'))
      .filter((element): element is HTMLImageElement => element instanceof HTMLImageElement && isVisible(element));
    await Promise.all(images.map(image => {
      const src = image.currentSrc || image.src || image.getAttribute('data-src') || '';
      const videoId = api.extractVideoId(src);
      return videoId ? thumbnailQueue.run(() => restoreThumbnail(image, videoId), epoch.signal) : Promise.resolve();
    }));
  };

  const processAudio = async (): Promise<void> => {
    const players = uniqueElements(document, getSelectors('player'));
    for (const player of players) {
      if (processedAudioPlayers.has(player)) continue;
      const tracks = (player as Element & { getAvailableAudioTracks?: () => unknown }).getAvailableAudioTracks?.();
      const original = findOriginalAudioTrack(tracks);
      if (!original) continue;
      const setAudioTrack = (player as Element & { setAudioTrack?: (index: number) => void }).setAudioTrack;
      if (typeof setAudioTrack !== 'function') continue;
      setAudioTrack.call(player, original.index);
      processedAudioPlayers.add(player);
    }
  };

  const processChannelBranding = async (): Promise<void> => {
    const title = uniqueElements(document, getSelectors('channelTitle'))[0];
    const link = document.querySelector('a[href*="/channel/"]');
    if (!title || !(link instanceof HTMLAnchorElement)) return;
    const match = link.href.match(/\/channel\/([^/?#]+)/);
    if (!match) return;
    const details = await api.getChannelDetails(match[1]);
    if (details?.title && shouldReplaceText(title.textContent, details.title)) replaceText(title, details.title);
  };

  const process = async (): Promise<void> => {
    if (!settings.enabled) return;
    const plan = buildFeaturePlan(settings);
    await Promise.all(plan.map(feature => {
      if (feature === 'title') return runFeature(feature, processTitles);
      if (feature === 'thumbnail') return runFeature(feature, processThumbnails);
      if (feature === 'description') return runFeature(feature, processDescriptions);
      if (feature === 'audio') return runFeature(feature, processAudio);
      return runFeature(feature, processChannelBranding);
    }));
  };

  const onNavigation = (): void => {
    epoch.advance();
    void process();
  };

  return {
    start() {
      if (started) return;
      started = true;
      observer = new MutationObserver(() => { void process(); });
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('yt-navigate-finish', onNavigation);
      window.addEventListener('yt-page-data-updated', onNavigation);
      void process();
    },
    stop() {
      observer?.disconnect();
      observer = null;
      window.removeEventListener('yt-navigate-finish', onNavigation);
      window.removeEventListener('yt-page-data-updated', onNavigation);
      started = false;
    },
    process,
  };
}
