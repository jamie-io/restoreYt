(async function () {
  'use strict';

  const api = typeof browser !== 'undefined' ? browser : chrome;

  const settings = await new Promise(resolve => {
    api.storage.sync.get({
      enabled: true,
      untranslateTitle: true,
      untranslateThumbnail: true,
      untranslateDescription: true,
      untranslateChapters: false,
      untranslateAudio: true,
      untranslateChannelBranding: true,
      whitelistChannels: []
    }, resolve);
  });

  const toggles = document.querySelectorAll('.toggle input[type="checkbox"]');
  toggles.forEach(toggle => {
    toggle.checked = settings[toggle.id];
    toggle.addEventListener('change', () => {
      api.storage.sync.set({ [toggle.id]: toggle.checked });
    });
  });

  const whitelistList = document.getElementById('whitelistList');
  const channelInput = document.getElementById('channelInput');
  const addChannelBtn = document.getElementById('addChannel');

  function renderWhitelist() {
    whitelistList.innerHTML = '';
    settings.whitelistChannels.forEach(channelId => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${channelId}</span>
        <button data-channel="${channelId}">Remove</button>
      `;
      whitelistList.appendChild(li);
    });

    whitelistList.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const channelId = btn.dataset.channel;
        settings.whitelistChannels = settings.whitelistChannels.filter(id => id !== channelId);
        api.storage.sync.set({ whitelistChannels: settings.whitelistChannels });
        renderWhitelist();
      });
    });
  }

  addChannelBtn.addEventListener('click', () => {
    const channelId = channelInput.value.trim();
    if (channelId && !settings.whitelistChannels.includes(channelId)) {
      settings.whitelistChannels.push(channelId);
      api.storage.sync.set({ whitelistChannels: settings.whitelistChannels });
      channelInput.value = '';
      renderWhitelist();
    }
  });

  channelInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addChannelBtn.click();
    }
  });

  renderWhitelist();
})();
