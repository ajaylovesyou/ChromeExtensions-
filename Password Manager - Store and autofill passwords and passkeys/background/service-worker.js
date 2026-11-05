/**
 * Bitwarden Password Manager - Background Service Worker (Manifest V3)
 * Orchestrates session caching, alarms, context menus, badge counters, and secure cross-script messaging.
 */

// Import library scripts in service worker
importScripts(
  '../lib/crypto.js',
  '../lib/totp.js',
  '../lib/passkey.js',
  '../lib/generator.js',
  '../lib/health.js',
  '../lib/send.js',
  '../lib/importer.js',
  '../lib/vault.js'
);

// In-memory active session state
let sessionState = {
  unlocked: false,
  items: [],
  rawKeyB64: null,
  lastActive: Date.now(),
  vaultTimeoutMinutes: 15
};

/**
 * Update badge count on extension icon for the given tab
 */
async function updateTabBadge(tabId, url) {
  if (!tabId || !url || !sessionState.unlocked) {
    if (tabId) {
      try {
        await chrome.action.setBadgeText({ text: '', tabId });
      } catch {}
    }
    return;
  }

  try {
    const creds = BitVault.getCredentialsForUrl(url);
    const count = (creds.logins?.length || 0) + (creds.passkeys?.length || 0);

    if (count > 0) {
      await chrome.action.setBadgeText({ text: String(count), tabId });
      await chrome.action.setBadgeBackgroundColor({ color: '#175DDC', tabId });
    } else {
      await chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch (e) {
    // ignore inactive tab error
  }
}

/**
 * Initialize extension and context menus
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Bitwarden Password Manager extension installed.');

  // Create context menus
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'bw-root',
      title: 'Bitwarden Password Manager',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'bw-autofill',
      parentId: 'bw-root',
      title: 'Autofill Credentials (Ctrl+Shift+L)',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'bw-generate',
      parentId: 'bw-root',
      title: 'Generate & Copy Secure Password',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'bw-copy-totp',
      parentId: 'bw-root',
      title: 'Copy TOTP Verification Code',
      contexts: ['editable', 'page']
    });

    chrome.contextMenus.create({
      id: 'bw-open-vault',
      parentId: 'bw-root',
      title: 'Open Full Vault...',
      contexts: ['all']
    });
  });

  // Setup periodic alarm for auto-lock and clipboard clearing
  chrome.alarms.create('check-vault-timeout', { periodInMinutes: 1 });
});

/**
 * Handle Context Menu Clicks
 */
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  if (info.menuItemId === 'bw-open-vault') {
    chrome.runtime.openOptionsPage();
    return;
  }

  if (info.menuItemId === 'bw-generate') {
    const pwd = BitGenerator.generatePassword({ length: 16 });
    // Send to tab to fill current field
    chrome.tabs.sendMessage(tab.id, { action: 'FILL_PASSWORD_AT_CURSOR', password: pwd });
    return;
  }

  if (info.menuItemId === 'bw-autofill') {
    if (!sessionState.unlocked) {
      // Prompt user to unlock
      chrome.action.openPopup?.();
      return;
    }
    const creds = BitVault.getCredentialsForUrl(tab.url || '');
    if (creds.logins && creds.logins.length > 0) {
      const topLogin = creds.logins[0];
      chrome.tabs.sendMessage(tab.id, {
        action: 'DO_AUTOFILL',
        credential: topLogin
      });
    }
    return;
  }

  if (info.menuItemId === 'bw-copy-totp') {
    if (!sessionState.unlocked) return;
    const creds = BitVault.getCredentialsForUrl(tab.url || '');
    const loginWithTotp = creds.logins?.find(l => l.totpSecret);
    if (loginWithTotp && loginWithTotp.totpSecret) {
      const totp = await BitTOTP.generateTOTP(loginWithTotp.totpSecret);
      if (totp && totp.code) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'FILL_TOTP_CODE',
          code: totp.code
        });
      }
    }
  }
});

/**
 * Handle Keyboard Commands (Ctrl+Shift+L)
 */
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'autofill_active_tab') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    if (!sessionState.unlocked) {
      return;
    }

    const creds = BitVault.getCredentialsForUrl(tab.url || '');
    if (creds.logins && creds.logins.length > 0) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'DO_AUTOFILL',
        credential: creds.logins[0]
      });
    }
  }
});

/**
 * Tab change / update listeners for Badge Count
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      updateTabBadge(tab.id, tab.url);
    }
  } catch {}
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab && tab.url) {
    updateTabBadge(tabId, tab.url);
  }
});

/**
 * Alarms for auto-lock timeout check
 */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'check-vault-timeout') {
    if (sessionState.unlocked && sessionState.vaultTimeoutMinutes > 0) {
      const elapsedMinutes = (Date.now() - sessionState.lastActive) / (1000 * 60);
      if (elapsedMinutes >= sessionState.vaultTimeoutMinutes) {
        console.log('Vault auto-locked due to inactivity.');
        sessionState.unlocked = false;
        sessionState.items = [];
        sessionState.rawKeyB64 = null;
        BitVault.lockVault();
        chrome.action.setBadgeText({ text: '' });
      }
    }
  }
});

/**
 * Safely store pending items captured by background worker into storage
 */
async function storePendingItem(item) {
  sessionState.items.unshift(item);
  BitVault.setMemoryState(sessionState.items, true);

  return new Promise((resolve) => {
    chrome.storage.local.get(['vault_pending_items'], (res) => {
      const pending = res.vault_pending_items || [];
      pending.unshift(item);
      chrome.storage.local.set({ vault_pending_items: pending }, () => {
        // Broadcast to open popup or options page to re-persist
        chrome.runtime.sendMessage({ action: 'ITEM_ADDED_RELOAD', item }, () => {
          if (chrome.runtime.lastError) {
            // popup/options not open, totally fine
          }
        });
        resolve();
      });
    });
  });
}

/**
 * Message Dispatcher
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const action = message.action;

  // 1. Vault Sync from popup/options
  if (action === 'VAULT_SYNCED') {
    sessionState.unlocked = message.payload.unlocked;
    sessionState.items = message.payload.items || [];
    if (message.payload.rawKeyB64) {
      sessionState.rawKeyB64 = message.payload.rawKeyB64;
    }
    sessionState.lastActive = message.payload.lastActive || Date.now();
    BitVault.setMemoryState(sessionState.items, sessionState.unlocked, sessionState.rawKeyB64);

    // Update active tab badge
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) updateTabBadge(tabs[0].id, tabs[0].url);
    });

    sendResponse({ ok: true });
    return true;
  }

  // 2. Vault Locked
  if (action === 'VAULT_LOCKED') {
    sessionState.unlocked = false;
    sessionState.items = [];
    sessionState.rawKeyB64 = null;
    BitVault.lockVault();
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return true;
  }

  // 3. Get Vault Status for popup / content script
  if (action === 'GET_VAULT_STATUS') {
    sessionState.lastActive = Date.now();
    sendResponse({
      unlocked: sessionState.unlocked,
      items: sessionState.items,
      rawKeyB64: sessionState.rawKeyB64 || null,
      count: sessionState.items.length,
      lastActive: sessionState.lastActive
    });
    return true;
  }

  // 4. Request credentials for URL (called by content script on page load)
  if (action === 'GET_MATCHING_CREDENTIALS') {
    sessionState.lastActive = Date.now();
    const url = message.url || (sender.tab ? sender.tab.url : '');
    if (!sessionState.unlocked) {
      sendResponse({ unlocked: false, logins: [], passkeys: [], cards: [] });
      return true;
    }

    BitVault.setMemoryState(sessionState.items, true);
    const creds = BitVault.getCredentialsForUrl(url);
    sendResponse({
      unlocked: true,
      domain: creds.domain,
      logins: creds.logins,
      passkeys: creds.passkeys,
      cards: creds.cards
    });
    return true;
  }

  // 5. Save credential offered from in-page submission
  if (action === 'SAVE_CREDENTIAL_FROM_PAGE') {
    if (!sessionState.unlocked) {
      sendResponse({ success: false, reason: 'locked' });
      return true;
    }

    const { username, password, uri, domain } = message.payload;
    const name = domain ? domain.charAt(0).toUpperCase() + domain.slice(1) : 'New Login';

    const newItem = {
      id: BitCrypto.generateUUID(),
      type: 'login',
      name: name,
      uri: uri || `https://${domain}`,
      username: username,
      password: password,
      favorite: false,
      folder: 'Personal',
      notes: `Saved by Bitwarden inline detector on ${new Date().toLocaleDateString()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    storePendingItem(newItem).then(() => {
      sendResponse({ success: true, item: newItem });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  // 6. Generate Quick Password
  if (action === 'GENERATE_QUICK_PASSWORD') {
    const pwd = BitGenerator.generatePassword(message.options || { length: 16 });
    sendResponse({ password: pwd });
    return true;
  }

  // 7. Generate TOTP for specific secret
  if (action === 'GET_TOTP_CODE') {
    BitTOTP.generateTOTP(message.secret).then(totp => {
      sendResponse(totp);
    });
    return true;
  }

  // 8. Register Passkey from in-page WebAuthn request
  if (action === 'SAVE_PASSKEY_FROM_PAGE') {
    if (!sessionState.unlocked) {
      sendResponse({ success: false, reason: 'locked' });
      return true;
    }

    const { rpId, userName, userDisplayName } = message.payload;
    BitPasskey.generatePasskey(rpId, userName, userDisplayName).then(async (passkey) => {
      await storePendingItem(passkey);
      sendResponse({ success: true, passkey });
    }).catch(err => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});
