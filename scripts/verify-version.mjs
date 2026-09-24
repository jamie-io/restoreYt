import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(await readFile(new URL('../manifest.json', import.meta.url), 'utf8'));

if (packageJson.version !== manifest.version) {
  throw new Error(`Version mismatch: package ${packageJson.version}, manifest ${manifest.version}`);
}

process.stdout.write(`Version ${packageJson.version} synchronized.\n`);
