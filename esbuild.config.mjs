import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, context } from 'esbuild';

/** Script bundles, one IIFE per extension context. */
export const SCRIPT_ENTRIES = Object.freeze({
  background: 'src/background.ts',
  content: 'src/content/index.ts',
  page: 'src/page/index.ts',
  popup: 'src/popup/popup.ts',
  options: 'src/options/options.ts',
});

/** Stylesheets. `content` is injected into YouTube; the others style extension pages. */
export const STYLE_ENTRIES = Object.freeze({
  content: 'src/content/content.css',
  popup: 'src/popup/popup.css',
  options: 'src/options/options.css',
});

export function createBuildOptions(entryPoints, options = {}) {
  if (!entryPoints || typeof entryPoints !== 'object' || Array.isArray(entryPoints)) {
    throw new TypeError('Entry points must be a named object of file paths');
  }
  const entries = Object.entries(entryPoints);
  if (entries.length === 0) throw new TypeError('At least one named entry point is required');
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
    target: ['chrome121', 'firefox128'],
    outdir: options.outdir ?? 'build',
    entryNames: options.entryNames ?? '[name]',
    legalComments: 'none',
    logLevel: options.logLevel ?? 'warning',
  };
}

export async function buildAll({ watch = false, minify = false } = {}) {
  const configs = [
    createBuildOptions(SCRIPT_ENTRIES, { minify }),
    // Fonts are served from the extension root (`/fonts/...`), not bundled.
    createBuildOptions(STYLE_ENTRIES, { minify, loader: { '.css': 'css' }, external: ['/fonts/*'] }),
  ];
  if (!watch) return Promise.all(configs.map(config => build(config)));
  const contexts = await Promise.all(configs.map(config => context(config)));
  await Promise.all(contexts.map(ctx => ctx.watch()));
  return contexts;
}

const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === thisFile) {
  await buildAll({ watch: process.argv.includes('--watch'), minify: process.argv.includes('--minify') });
}
