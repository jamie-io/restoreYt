import { cp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const packageName = 'restoreyt';
const outputDir = join(root, '.dist');
const stagingDir = join(outputDir, packageName);
const zipPath = join(outputDir, `${packageName}.zip`);

await rm(outputDir, { recursive: true, force: true });
await mkdir(stagingDir, { recursive: true });
await cp(join(root, 'manifest.json'), join(stagingDir, 'manifest.json'));
await cp(join(root, 'build'), join(stagingDir, 'build'), { recursive: true });
await cp(join(root, 'icons'), join(stagingDir, 'icons'), { recursive: true });
await cp(join(root, 'src/popup'), join(stagingDir, 'src/popup'), { recursive: true });
await cp(join(root, 'src/options'), join(stagingDir, 'src/options'), { recursive: true });

execFileSync('zip', ['-qr', zipPath, packageName], { cwd: outputDir, stdio: 'inherit' });
process.stdout.write(`Packaged ${zipPath}\n`);
