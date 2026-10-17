/**
 * AdBlock Pro - Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const versionBadge = document.getElementById('versionBadge');
  const globalPowerBtn = document.getElementById('globalPowerBtn');
  const statusLabel = document.getElementById('statusLabel');
  const statusSub = document.getElementById('statusSub');
  const currentSiteDomain = document.getElementById('currentSiteDomain');
  const siteStatusText = document.getElementById('siteStatusText');
  const siteToggle = document.getElementById('siteToggle');
  const pageBlockedCount = document.getElementById('pageBlockedCount');
  const allTimeBlockedCount = document.getElementById('allTimeBlockedCount');
  const reloadTabBtn = document.getElementById('reloadTabBtn');
  const openOptionsBtn = document.getElementById('openOptionsBtn');

  // Sync version badge with manifest
  if (versionBadge && chrome.runtime && chrome.runtime.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      if (manifest && manifest.version) {
        versionBadge.textContent = 'v' + manifest.version;
      }
    } catch (e) {}
  }

  let activeTab = null;
  let currentHost = '';
  let isGlobalEnabled = true;

  // 1. Get current active tab safely
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      activeTab = tabs[0];
      if (activeTab.url) {
        try {
          const url = new URL(activeTab.url);
          if (url.protocol.startsWith('http')) {
            currentHost = url.hostname.replace(/^www\./, '');
            currentSiteDomain.textContent = currentHost;
          } else {
            currentSiteDomain.textContent = 'Browser Internal Page';
            siteToggle.disabled = true;
          }
        } catch (e) {
          currentSiteDomain.textContent = 'Special Page';
          siteToggle.disabled = true;
        }
      } else {
        currentSiteDomain.textContent = 'Special Page';
        siteToggle.disabled = true;
      }
    }
  } catch (err) {
    currentSiteDomain.textContent = 'AdBlock Pro';
    siteToggle.disabled = true;
  }

  // 2. Fetch extension status and stats
  chrome.runtime.sendMessage(
    { type: 'GET_POPUP_DATA', tabId: activeTab ? activeTab.id : null },
    (res) => {
      if (chrome.runtime.lastError || !res) return;

      isGlobalEnabled = res.enabled !== false;
      updateGlobalUI(isGlobalEnabled);

      const whitelist = Array.isArray(res.whitelist) ? res.whitelist : [];
      const isWhitelisted = isHostInWhitelist(currentHost, whitelist);
      siteToggle.checked = !isWhitelisted;
      updateSiteStatusUI(!isWhitelisted);

      allTimeBlockedCount.textContent = formatNumber(res.totalAllTime || 0);
      pageBlockedCount.textContent = formatNumber(res.tabBlocked || 0);
    }
  );

  function isHostInWhitelist(host, list) {
    if (!host || !list || list.length === 0) return false;
    const h = host.toLowerCase().replace(/^www\./, '');
    return list.some((item) => {
      const clean = (item || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      return clean && (h === clean || h.endsWith('.' + clean));
    });
  }

  // 3. Toggle Global Protection
  globalPowerBtn.addEventListener('click', () => {
    isGlobalEnabled = !isGlobalEnabled;
    updateGlobalUI(isGlobalEnabled);

    chrome.runtime.sendMessage(
      {
        type: 'TOGGLE_GLOBAL',
        enabled: isGlobalEnabled
      },
      () => {
        if (chrome.runtime.lastError) {}
      }
    );
  });

  // 4. Toggle Per-Site Protection
  siteToggle.addEventListener('change', () => {
    if (!currentHost) return;

    const action = siteToggle.checked ? 'remove' : 'add';
    chrome.runtime.sendMessage(
      {
        type: 'TOGGLE_WHITELIST_HOST',
        host: currentHost,
        action: action
      },
      (res) => {
        if (chrome.runtime.lastError || !res) return;
        if (res.success) {
          updateSiteStatusUI(!res.isWhitelisted);
        }
      }
    );
  });

  // 5. Reload Tab
  reloadTabBtn.addEventListener('click', () => {
    if (activeTab && activeTab.id) {
      chrome.tabs.reload(activeTab.id);
      window.close();
    }
  });

  // 6. Open Options / Whitelist Page
  openOptionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  function updateGlobalUI(enabled) {
    if (enabled) {
      globalPowerBtn.classList.add('active');
      statusLabel.textContent = 'Protection is Active';
      statusLabel.style.color = '#f8fafc';
      statusSub.textContent = 'All ad networks & trackers blocked';
    } else {
      globalPowerBtn.classList.remove('active');
      statusLabel.textContent = 'Protection is Paused';
      statusLabel.style.color = '#94a3b8';
      statusSub.textContent = 'Ads and trackers are allowed';
    }
  }

  function updateSiteStatusUI(enabledForSite) {
    if (enabledForSite) {
      siteStatusText.textContent = 'Shield active on this site';
      siteStatusText.style.color = '#94a3b8';
    } else {
      siteStatusText.textContent = 'Whitelisted (Shield paused)';
      siteStatusText.style.color = '#f59e0b';
    }
  }

  function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    return num.toLocaleString();
  }
});
