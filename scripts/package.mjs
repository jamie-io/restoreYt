import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromeManifest, firefoxManifest } from './manifests.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const outputDir = join(root, '.dist');

// Everything the manifest references, nothing else.
const entries = [
  'LICENSE',
  'build',
  'rules',
  'fonts',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
  'src/popup/popup.html',
  'src/options/options.html',
];

const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const targets = { chrome: chromeManifest(manifest), firefox: firefoxManifest(manifest) };

await rm(outputDir, { recursive: true, force: true });
for (const [browser, browserManifest] of Object.entries(targets)) {
  const stagingDir = join(outputDir, browser);
  await mkdir(stagingDir, { recursive: true });
  for (const entry of entries) await cp(join(root, entry), join(stagingDir, entry), { recursive: true });
  await writeFile(join(stagingDir, 'manifest.json'), `${JSON.stringify(browserManifest, null, 2)}\n`);
  // manifest.json must sit at the archive root for both stores.
  const zipPath = join(outputDir, `restoreyt-${browser}.zip`);
  execFileSync('zip', ['-qr', zipPath, '.'], { cwd: stagingDir, stdio: 'inherit' });
  process.stdout.write(`Packaged ${zipPath} (unpacked: .dist/${browser}/)\n`);
}
