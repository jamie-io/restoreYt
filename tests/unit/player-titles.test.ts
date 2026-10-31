// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { PlayerTitleSweep } from '../../src/content/player-titles';

describe('PlayerTitleSweep', () => {
  it('replaces the exact translated title inside mini-player containers only', () => {
    document.body.innerHTML = `
      <div class="ytdNewMiniplayerCard"><p>Iss alles in einem Supermarkt auf</p><p>Weiter ansehen</p></div>
      <p id="outside">Iss alles in einem Supermarkt auf</p>`;
    const reporter = { title: vi.fn() };
    const sweep = new PlayerTitleSweep(document, reporter);
    sweep.setVideo({ surface: 'watch', videoId: 'plN7JMbadRg', title: 'Eat Everything', description: null, displayedTitle: 'Iss alles in einem Supermarkt auf', author: null });
    sweep.apply();
    expect(document.querySelector('.ytdNewMiniplayerCard p')?.textContent).toBe('Eat Everything');
    expect(document.querySelectorAll('.ytdNewMiniplayerCard p')[1]?.textContent).toBe('Weiter ansehen');
    expect(document.getElementById('outside')?.textContent).toBe('Iss alles in einem Supermarkt auf');
    expect(reporter.title).toHaveBeenCalledWith('plN7JMbadRg', 'Eat Everything', 'Iss alles in einem Supermarkt auf');
    sweep.revertAll();
    expect(document.querySelector('.ytdNewMiniplayerCard p')?.textContent).toBe('Iss alles in einem Supermarkt auf');
  });
});
