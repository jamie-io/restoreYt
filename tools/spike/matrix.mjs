export const REQUIRED_SAMPLES = Object.freeze({
  title: 5,
  thumbnail: 2,
  audio: 2,
  chapters: 2,
  channelBranding: 2,
});

const CATEGORIES = Object.freeze(Object.keys(REQUIRED_SAMPLES));
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function parseVideoMatrix(raw, { allowEmpty = false } = {}) {
  if (!raw && allowEmpty) {
    return { matrix: Object.fromEntries(CATEGORIES.map(category => [category, []])), error: null };
  }
  if (!raw) {
    return {
      matrix: Object.fromEntries(CATEGORIES.map(category => [category, []])),
      error: `SPIKE_VIDEO_MATRIX must provide exact sample counts: ${Object.entries(REQUIRED_SAMPLES).map(([category, count]) => `${category}: ${count}`).join(', ')}.`,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const matrix = Object.fromEntries(CATEGORIES.map(category => {
      const values = parsed?.[category];
      const expected = REQUIRED_SAMPLES[category];
      if (!Array.isArray(values) || values.length !== expected || values.some(value => typeof value !== 'string' || !VIDEO_ID.test(value))) {
        throw new Error(`exact sample counts: ${category}: ${expected}`);
      }
      return [category, values];
    }));
    return { matrix, error: null };
  } catch (error) {
    return {
      matrix: Object.fromEntries(CATEGORIES.map(category => [category, []])),
      error: `SPIKE_VIDEO_MATRIX must provide exact sample counts: ${Object.entries(REQUIRED_SAMPLES).map(([category, count]) => `${category}: ${count}`).join(', ')}. ${error instanceof Error ? error.message : 'Invalid JSON.'}`,
    };
  }
}
