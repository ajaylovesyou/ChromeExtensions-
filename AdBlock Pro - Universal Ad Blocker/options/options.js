/**
 * AdBlock Pro - Options Page Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const newDomainInput = document.getElementById('newDomainInput');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const whitelistUl = document.getElementById('whitelistUl');
  const emptyNotice = document.getElementById('emptyWhitelistNotice');
  const totalBlockedVal = document.getElementById('totalBlockedAllTime');
  const resetStatsBtn = document.getElementById('resetStatsBtn');

  const shieldCosmetic = document.getElementById('shieldCosmetic');
  const shieldVideo = document.getElementById('shieldVideo');
  const shieldAntiAdblock = document.getElementById('shieldAntiAdblock');

  // Load saved configuration
  loadSettings();

  function loadSettings() {
    chrome.storage.local.get(
      [
        'whitelisted_domains',
        'total_blocked_all_time',
        'shield_cosmetic',
        'shield_video',
        'shield_anti_adblock'
      ],
      (res) => {
        if (chrome.runtime.lastError || !res) return;

        renderWhitelist(res.whitelisted_domains || []);
        totalBlockedVal.textContent = (res.total_blocked_all_time || 0).toLocaleString();

        shieldCosmetic.checked = res.shield_cosmetic !== false;
        shieldVideo.checked = res.shield_video !== false;
        shieldAntiAdblock.checked = res.shield_anti_adblock !== false;
      }
    );
  }

  function renderWhitelist(list) {
    whitelistUl.innerHTML = '';
    const cleanList = Array.isArray(list) ? list.filter(Boolean) : [];

    if (cleanList.length === 0) {
      emptyNotice.style.display = 'block';
      return;
    }

    emptyNotice.style.display = 'none';
    cleanList.sort().forEach((domain) => {
      const li = document.createElement('li');
      li.className = 'domain-item';
      li.innerHTML = `
        <span>${escapeHtml(domain)}</span>
        <button class="remove-btn" data-domain="${escapeHtml(domain)}">Remove</button>
      `;
      whitelistUl.appendChild(li);
    });

    // Attach remove listeners with currentTarget
    document.querySelectorAll('.remove-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const domainToRemove = e.currentTarget.getAttribute('data-domain');
        if (domainToRemove) {
          removeDomain(domainToRemove);
        }
      });
    });
  }

  function cleanDomainInput(raw) {
    let str = (raw || '').trim().toLowerCase();
    try {
      if (str.includes('://')) {
        str = new URL(str).hostname;
      } else if (str.includes('/')) {
        str = str.split('/')[0];
      }
    } catch (e) {}
    return str.replace(/^www\./, '').replace(/[^a-z0-9.-]/g, '');
  }

  function addDomain() {
    const raw = newDomainInput.value;
    const domain = cleanDomainInput(raw);
    if (!domain || !domain.includes('.')) {
      alert('Please enter a valid website domain (e.g. example.com)');
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: 'TOGGLE_WHITELIST_HOST',
        host: domain,
        action: 'add'
      },
      () => {
        newDomainInput.value = '';
        loadSettings();
      }
    );
  }

  function removeDomain(domain) {
    chrome.runtime.sendMessage(
      {
        type: 'TOGGLE_WHITELIST_HOST',
        host: domain,
        action: 'remove'
      },
      () => {
        loadSettings();
      }
    );
  }

  addDomainBtn.addEventListener('click', addDomain);
  newDomainInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addDomain();
  });

  // Reset Stats
  resetStatsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset your all-time blocked statistics?')) {
      chrome.storage.local.set({ total_blocked_all_time: 0 }, () => {
        totalBlockedVal.textContent = '0';
      });
    }
  });

  // Shield toggles saved to chrome.storage.local
  shieldCosmetic.addEventListener('change', () => {
    chrome.storage.local.set({ shield_cosmetic: shieldCosmetic.checked });
  });

  shieldVideo.addEventListener('change', () => {
    chrome.storage.local.set({ shield_video: shieldVideo.checked });
  });

  shieldAntiAdblock.addEventListener('change', () => {
    chrome.storage.local.set({ shield_anti_adblock: shieldAntiAdblock.checked });
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
