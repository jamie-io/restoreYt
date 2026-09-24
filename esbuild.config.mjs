import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

export const FOUNDATION_ENTRIES = Object.freeze({
  core: 'src/core/index.ts',
  platform: 'src/platform/index.ts',
});

export const RUNTIME_ENTRIES = Object.freeze({
  background: 'src/background.ts',
  content: 'src/content/bootstrap.ts',
  main: 'src/main.ts',
  popup: 'src/popup/popup.js',
  options: 'src/options/options.js',
});

export function createBuildOptions(entryPoints, options = {}) {
  if (!entryPoints || typeof entryPoints !== 'object' || Array.isArray(entryPoints)) {
    throw new TypeError('Entry points must be a named object of file paths');
  }

  const entries = Object.entries(entryPoints);
  if (entries.length === 0) {
    throw new TypeError('At least one named entry point is required');
  }
  for (const [name, path] of entries) {
    if (!/^[A-Za-z0-9_-]+$/.test(name) || typeof path !== 'string' || path.length === 0) {
      throw new TypeError(`Invalid entry point: ${name}`);
    }
  }

  return {
    ...options,
    entryPoints: Object.fromEntries(entries),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: ['chrome121', 'firefox115'],
    outdir: options.outdir ?? 'build',
    entryNames: options.entryNames ?? '[name]',
  };
}

export async function buildBundles(entryPoints = FOUNDATION_ENTRIES, { watch = false, ...options } = {}) {
  const buildOptions = createBuildOptions(entryPoints, options);
  if (!watch) return build(buildOptions);

  const buildContext = await context(buildOptions);
  await buildContext.watch();
  return buildContext;
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  await buildBundles(RUNTIME_ENTRIES, { watch: process.argv.includes('--watch') });
}
