import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));

it('exposes reproducible extension packaging command', () => {
  expect(packageJson.scripts.package).toBe('npm run build && node scripts/package.mjs');
});
