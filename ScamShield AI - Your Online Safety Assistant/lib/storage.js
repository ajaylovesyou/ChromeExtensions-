/**
 * ScamShield AI - Chrome Storage & State Management
 * Provides clean helpers for saving preferences, whitelist, blacklist, and scan history.
 */

const STORAGE_KEYS = {
  SETTINGS: 'scamshield_settings',
  HISTORY: 'scamshield_history',
  WHITELIST: 'scamshield_whitelist',
  BLACKLIST: 'scamshield_blacklist'
};

const DEFAULT_SETTINGS = {
  protectionActive: true,
  linkInspectionEnabled: true,
  shoppingAlertsEnabled: true,
  backendApiEnabled: false,
  backendApiUrl: 'http://localhost/scamshield-backend/index.php'
};

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.SETTINGS], (result) => {
      resolve({ ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) });
    });
  });
}

export async function saveSettings(newSettings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: newSettings }, () => {
      resolve(newSettings);
    });
  });
}

export async function getScanHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.HISTORY], (result) => {
      resolve(result[STORAGE_KEYS.HISTORY] || []);
    });
  });
}

export async function addScanHistoryItem(item) {
  const history = await getScanHistory();
  const newItem = {
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 5),
    timestamp: new Date().toISOString(),
    ...item
  };

  // Keep latest 50 items
  const updatedHistory = [newItem, ...history].slice(0, 50);

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.HISTORY]: updatedHistory }, () => {
      resolve(updatedHistory);
    });
  });
}

export async function clearScanHistory() {
  return new Promise((resolve) => {
    chrome.storage.local.remove([STORAGE_KEYS.HISTORY], () => {
      resolve([]);
    });
  });
}

export async function getWhitelist() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEYS.WHITELIST], (result) => {
      resolve(result[STORAGE_KEYS.WHITELIST] || []);
    });
  });
}

export async function addToWhitelist(domain) {
  const cleanDomain = domain.toLowerCase().trim();
  const list = await getWhitelist();
  if (!list.includes(cleanDomain)) {
    list.push(cleanDomain);
    await new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list }, resolve);
    });
  }
  return list;
}

export async function removeFromWhitelist(domain) {
  const cleanDomain = domain.toLowerCase().trim();
  let list = await getWhitelist();
  list = list.filter(d => d !== cleanDomain);
  await new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEYS.WHITELIST]: list }, resolve);
  });
  return list;
}
