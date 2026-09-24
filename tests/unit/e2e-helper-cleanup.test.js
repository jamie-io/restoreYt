import { access, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('E2E profile cleanup', () => {
  it('removes profile even when Chromium context close fails', async () => {
    const { closeAndRemoveProfile } = await import('../e2e/helpers.js');
    expect(closeAndRemoveProfile).toBeTypeOf('function');

    const profileDir = await mkdtemp(join(tmpdir(), 'restoreyt-cleanup-test-'));
    const closeError = new Error('context close failed');
    try {
      await writeFile(join(profileDir, 'profile-data'), 'temporary');

      await expect(closeAndRemoveProfile({ close: async () => { throw closeError; } }, profileDir))
        .resolves.toEqual({ closeError });
      await expect(access(profileDir)).rejects.toMatchObject({ code: 'ENOENT' });
      await expect(closeAndRemoveProfile(undefined, profileDir)).resolves.toBeUndefined();
    } finally {
      await rm(profileDir, { recursive: true, force: true });
    }
  });
});
