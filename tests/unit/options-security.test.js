import { readFile } from 'node:fs/promises';

const optionsSource = await readFile(new URL('../../src/options/options.js', import.meta.url), 'utf8');
const popupSource = await readFile(new URL('../../src/popup/popup.js', import.meta.url), 'utf8');

describe('settings surfaces', () => {
  it('use local storage as single runtime settings channel', () => {
    expect(optionsSource).toContain('storage?.local');
    expect(popupSource).toContain('storage?.local');
    expect(optionsSource).not.toContain('storage.sync');
    expect(popupSource).not.toContain('storage.sync');
  });

  it('render channel IDs through textContent instead of HTML interpolation', () => {
    expect(optionsSource).not.toContain('innerHTML');
    expect(optionsSource).toContain('textContent');
  });
});
