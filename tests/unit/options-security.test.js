import { readFile } from 'node:fs/promises';

const optionsSource = await readFile(new URL('../../src/options/options.js', import.meta.url), 'utf8');
const popupSource = await readFile(new URL('../../src/popup/popup.js', import.meta.url), 'utf8');

class FakeElement {
  constructor() {
    this.listeners = {};
    this.children = [];
    this.dataset = {};
    this.value = '';
    this.textContent = '';
  }

  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners[type] ?? []) listener({ target: this, ...event });
  }

  replaceChildren(...children) {
    this.children = children;
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
  }

  closest() {
    return null;
  }
}

async function loadOptions() {
  const elements = new Map(['status', 'whitelistList', 'channelInput', 'addChannel']
    .map(id => [id, new FakeElement()]));
  const saved = [];
  const storage = {
    get: async defaults => defaults,
    set: async values => saved.push(values),
  };

  vi.stubGlobal('browser', { storage: { local: storage } });
  vi.stubGlobal('document', {
    getElementById: id => elements.get(id),
    querySelectorAll: () => [],
    createElement: () => new FakeElement(),
  });
  vi.resetModules();
  await import('../../src/options/options.js');
  await new Promise(resolve => setTimeout(resolve, 0));
  return { elements, saved };
}

afterEach(() => vi.unstubAllGlobals());

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

  it('rejects @handles instead of storing values that cannot match channel IDs', async () => {
    const { elements, saved } = await loadOptions();
    const input = elements.get('channelInput');
    input.value = '@channelname';

    elements.get('addChannel').dispatch('click');
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(saved).toEqual([]);
    expect(input.value).toBe('@channelname');
    expect(elements.get('status').textContent).toMatch(/channel ID/i);
  });
});
