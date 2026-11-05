/**
 * DarkShift Pro - Background Service Worker
 * Coordinates global state, badge status, keyboard shortcuts, and scheduled alarms.
 */

const DEFAULT_CONFIG = {
  darkshift_enabled: true,
  engine: 'smart-invert', // 'smart-invert', 'dynamic-dark', 'oled-dark'
  brightness: 100,
  contrast: 95,
  sepia: 0,
  grayscale: 0,
  font_boost: true,
  list_mode: 'blacklist',
  excluded_domains: [
    'youtube.com',
    'netflix.com',
    'twitch.tv'
  ],
  whitelisted_domains: [],
  schedule_enabled: false,
  schedule_mode: 'system', // 'system' or 'time'
  schedule_start: '20:00',
  schedule_end: '07:00',
  custom_css_rules: {}
};

/**
 * Seed initial configuration on install or update
 */
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.local.get(null, (existing) => {
    const toSave = {};
    for (const [key, val] of Object.entries(DEFAULT_CONFIG)) {
      if (existing[key] === undefined) {
        toSave[key] = val;
      }
    }
    if (Object.keys(toSave).length > 0) {
      chrome.storage.local.set(toSave);
    }
  });

  // Set up context menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'darkshift-toggle-site',
      title: 'Toggle DarkShift on this site',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'darkshift-open-settings',
      title: 'DarkShift Settings...',
      contexts: ['action']
    });
  });

  // Setup schedule alarm
  chrome.alarms.create('darkshift-schedule-check', { periodInMinutes: 1 });

  updateAllBadges();
});

/**
 * Handle Context Menu clicks
 */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'darkshift-toggle-site' && tab && tab.url) {
    toggleSiteForTab(tab);
  } else if (info.menuItemId === 'darkshift-open-settings') {
    chrome.runtime.openOptionsPage();
  }
});

/**
 * Keyboard shortcuts
 */
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-current-site') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        toggleSiteForTab(tabs[0]);
      }
    });
  } else if (command === 'toggle-global') {
    chrome.storage.local.get(['darkshift_enabled'], (res) => {
      const nextState = !(res.darkshift_enabled !== false);
      chrome.storage.local.set({ darkshift_enabled: nextState }, () => {
        updateAllBadges();
      });
    });
  }
});

/**
 * Toggle active domain exclusion
 */
function toggleSiteForTab(tab) {
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) return;

  try {
    const url = new URL(tab.url);
    const domain = url.hostname.toLowerCase();
    if (!domain) return;

    chrome.storage.local.get(['excluded_domains', 'list_mode', 'whitelisted_domains'], (res) => {
      const listMode = res.list_mode || 'blacklist';

      if (listMode === 'blacklist') {
        const list = Array.isArray(res.excluded_domains) ? [...res.excluded_domains] : [];
        const index = list.indexOf(domain);
        if (index > -1) {
          list.splice(index, 1);
        } else {
          list.push(domain);
        }
        chrome.storage.local.set({ excluded_domains: list }, () => {
          updateTabBadge(tab.id, tab.url);
        });
      } else {
        const list = Array.isArray(res.whitelisted_domains) ? [...res.whitelisted_domains] : [];
        const index = list.indexOf(domain);
        if (index > -1) {
          list.splice(index, 1);
        } else {
          list.push(domain);
        }
        chrome.storage.local.set({ whitelisted_domains: list }, () => {
          updateTabBadge(tab.id, tab.url);
        });
      }
    });
  } catch (err) {
    console.error('Failed to parse URL for domain toggle:', err);
  }
}

/**
 * Update badge text and colors for a tab
 */
function updateTabBadge(tabId, url) {
  if (!tabId || !url || url.startsWith('chrome://') || url.startsWith('chrome-extension://')) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  chrome.storage.local.get(['darkshift_enabled', 'excluded_domains', 'list_mode', 'whitelisted_domains'], (res) => {
    const isGlobal = res.darkshift_enabled !== false;

    if (!isGlobal) {
      chrome.action.setBadgeText({ tabId, text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#64748b' }); // Muted slate
      return;
    }

    try {
      const hostname = new URL(url).hostname.toLowerCase();
      const listMode = res.list_mode || 'blacklist';
      const excluded = Array.isArray(res.excluded_domains) ? res.excluded_domains : [];
      const whitelisted = Array.isArray(res.whitelisted_domains) ? res.whitelisted_domains : [];

      let isDomainActive = true;
      if (listMode === 'blacklist') {
        isDomainActive = !excluded.some(d => hostname === d || hostname.endsWith('.' + d));
      } else {
        isDomainActive = whitelisted.some(d => hostname === d || hostname.endsWith('.' + d));
      }

      if (isDomainActive) {
        chrome.action.setBadgeText({ tabId, text: 'ON' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' }); // Emerald Green
      } else {
        chrome.action.setBadgeText({ tabId, text: 'SKIP' });
        chrome.action.setBadgeBackgroundColor({ tabId, color: '#94a3b8' }); // Gray
      }
    } catch {
      chrome.action.setBadgeText({ tabId, text: '' });
    }
  });
}

function updateAllBadges() {
  chrome.tabs.query({}, (tabs) => {
    if (tabs) {
      tabs.forEach(tab => {
        if (tab.id && tab.url) {
          updateTabBadge(tab.id, tab.url);
        }
      });
    }
  });
}

// Track tab navigation & activation to update badges
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateTabBadge(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (!chrome.runtime.lastError && tab && tab.url) {
      updateTabBadge(tab.id, tab.url);
    }
  });
});

// Alarm periodic check
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'darkshift-schedule-check') {
    updateAllBadges();
  }
});
