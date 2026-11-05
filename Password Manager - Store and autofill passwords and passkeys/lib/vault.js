/**
 * Bitwarden Password Manager - Vault Controller & State Engine
 * Manages zero-knowledge encrypted storage, auto-lock timeouts, item CRUD, and search indexing.
 */

const BitVault = (function() {
  'use strict';

  // In-memory state (cleared upon lock)
  let _masterKey = null;
  let _items = [];
  let _isLocked = true;
  let _isInitialized = false;
  let _passwordHint = '';
  let _lastActiveTimestamp = Date.now();

  async function exportMasterKeyB64() {
    if (!_masterKey) return null;
    try {
      const raw = await crypto.subtle.exportKey('raw', _masterKey);
      return BitCrypto.bufferToBase64(raw);
    } catch (e) {
      return null;
    }
  }

  async function importMasterKeyB64(rawKeyB64) {
    if (!rawKeyB64) return null;
    try {
      const rawBuf = BitCrypto.base64ToBuffer(rawKeyB64);
      return await crypto.subtle.importKey(
        'raw',
        rawBuf,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (e) {
      return null;
    }
  }

  const DEFAULT_FOLDERS = [
    { id: 'folder-personal', name: 'Personal' },
    { id: 'folder-work', name: 'Work' },
    { id: 'folder-finance', name: 'Finance' },
    { id: 'folder-social', name: 'Social' },
    { id: 'folder-shopping', name: 'Shopping' }
  ];

  const DEFAULT_SETTINGS = {
    vaultTimeout: 15, // minutes (0 = immediately, -1 = never)
    quickPinEnabled: false,
    theme: 'bitwarden-blue', // 'bitwarden-blue', 'dark', 'oled', 'light'
    autoFillOnPageLoad: true,
    showInlineBadges: true,
    clipboardClearSeconds: 30,
    askToSaveLogins: true
  };

  /**
   * Helper to interact with chrome.storage.local or localStorage fallback
   */
  const Storage = {
    get: function(keys) {
      return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(keys, resolve);
        } else {
          const res = {};
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach(k => {
            const val = localStorage.getItem(k);
            if (val !== null) {
              try { res[k] = JSON.parse(val); } catch { res[k] = val; }
            }
          });
          resolve(res);
        }
      });
    },
    set: function(items) {
      return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set(items, resolve);
        } else {
          Object.entries(items).forEach(([k, v]) => {
            localStorage.setItem(k, JSON.stringify(v));
          });
          resolve();
        }
      });
    },
    remove: function(keys) {
      return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.remove(keys, resolve);
        } else {
          const keyArray = Array.isArray(keys) ? keys : [keys];
          keyArray.forEach(k => localStorage.removeItem(k));
          resolve();
        }
      });
    }
  };

  /**
   * Initialize Vault from persistent storage
   */
  async function init() {
    const data = await Storage.get([
      'vault_initialized',
      'vault_salt',
      'vault_hash',
      'vault_hint',
      'vault_settings',
      'vault_folders',
      'vault_encrypted_data'
    ]);

    _isInitialized = !!data.vault_initialized;
    _passwordHint = data.vault_hint || '';

    // Check if session storage or background has an active unlock session
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const bgStatus = await new Promise(res => {
          chrome.runtime.sendMessage({ action: 'GET_VAULT_STATUS' }, res);
        });
        if (bgStatus && bgStatus.unlocked && bgStatus.items) {
          _items = bgStatus.items;
          _isLocked = false;
          if (bgStatus.rawKeyB64) {
            _masterKey = await importMasterKeyB64(bgStatus.rawKeyB64);
          }
          if (!_masterKey && chrome.storage && chrome.storage.session) {
            try {
              const sess = await chrome.storage.session.get('vault_session_key');
              if (sess && sess.vault_session_key) {
                _masterKey = await importMasterKeyB64(sess.vault_session_key);
              }
            } catch {}
          }
          return { initialized: _isInitialized, locked: false };
        }
      } catch {
        // background might not be ready yet
      }
    }

    // Direct check on chrome.storage.session
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      try {
        const sess = await chrome.storage.session.get('vault_session_key');
        if (sess && sess.vault_session_key) {
          _masterKey = await importMasterKeyB64(sess.vault_session_key);
          if (_masterKey && data.vault_encrypted_data) {
            const dec = await BitCrypto.decrypt(data.vault_encrypted_data, _masterKey);
            _items = Array.isArray(dec) ? dec : [];
            _isLocked = false;
            return { initialized: _isInitialized, locked: false };
          }
        }
      } catch {}
    }

    _isLocked = true;
    return { initialized: _isInitialized, locked: _isLocked };
  }

  /**
   * Setup a brand new Vault with Master Password
   */
  async function setupVault(masterPassword, hint = '') {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('Master password must be at least 8 characters long.');
    }

    const salt = BitCrypto.generateSalt();
    const masterKey = await BitCrypto.deriveMasterKey(masterPassword, salt);
    const passwordHash = await BitCrypto.hashMasterPassword(masterPassword, salt);

    // Initial demo vault seeder items
    const initialItems = await BitImporter.generateDemoVault();
    const encryptedBundle = await BitCrypto.encrypt(initialItems, masterKey);

    await Storage.set({
      vault_initialized: true,
      vault_salt: salt,
      vault_hash: passwordHash,
      vault_hint: hint,
      vault_encrypted_data: encryptedBundle,
      vault_settings: DEFAULT_SETTINGS,
      vault_folders: DEFAULT_FOLDERS,
      vault_sends: []
    });

    _masterKey = masterKey;
    _items = initialItems;
    _isLocked = false;
    _isInitialized = true;
    _passwordHint = hint;
    _lastActiveTimestamp = Date.now();

    // Broadcast unlock to background worker
    notifyBackgroundSync();

    return { success: true };
  }

  /**
   * Unlock Vault with Master Password
   */
  async function unlockVault(masterPassword) {
    const data = await Storage.get(['vault_salt', 'vault_hash', 'vault_encrypted_data']);
    if (!data.vault_salt || !data.vault_hash) {
      throw new Error('Vault is not yet initialized.');
    }

    // Verify Master Password Hash
    const testHash = await BitCrypto.hashMasterPassword(masterPassword, data.vault_salt);
    if (testHash !== data.vault_hash) {
      throw new Error('Incorrect Master Password.');
    }

    // Derive Master AES Key
    const masterKey = await BitCrypto.deriveMasterKey(masterPassword, data.vault_salt);

    // Decrypt Vault Items
    let decryptedItems = [];
    if (data.vault_encrypted_data) {
      try {
        decryptedItems = await BitCrypto.decrypt(data.vault_encrypted_data, masterKey);
      } catch (err) {
        console.error('Decryption failed:', err);
        throw new Error('Could not decrypt vault with provided key.');
      }
    }

    _masterKey = masterKey;
    _items = Array.isArray(decryptedItems) ? decryptedItems : [];
    _isLocked = false;
    _lastActiveTimestamp = Date.now();

    // Merge any pending items captured in background worker
    await syncPendingItems();

    notifyBackgroundSync();

    return { success: true, count: _items.length };
  }

  /**
   * Sync pending items captured by background into active encrypted storage
   */
  async function syncPendingItems() {
    if (_isLocked || !_masterKey) return;
    try {
      const pendingData = await Storage.get('vault_pending_items');
      if (pendingData.vault_pending_items && Array.isArray(pendingData.vault_pending_items) && pendingData.vault_pending_items.length > 0) {
        let changed = false;
        for (const pItem of pendingData.vault_pending_items) {
          if (!_items.some(it => it.id === pItem.id)) {
            _items.unshift(pItem);
            changed = true;
          }
        }
        if (changed) {
          await persistItems();
        }
        await Storage.remove('vault_pending_items');
      }
    } catch (e) {
      console.warn('Could not sync pending items:', e);
    }
  }

  /**
   * Unlock Vault with Quick PIN
   */
  async function unlockWithPin(pin) {
    const data = await Storage.get(['vault_pin_salt', 'vault_pin_hash', 'vault_encrypted_pin_key']);
    if (!data.vault_pin_salt || !data.vault_pin_hash || !data.vault_encrypted_pin_key) {
      throw new Error('Quick PIN is not configured.');
    }

    const testHash = await BitCrypto.hashMasterPassword(pin, data.vault_pin_salt);
    if (testHash !== data.vault_pin_hash) {
      throw new Error('Incorrect PIN.');
    }

    const pinKey = await BitCrypto.deriveMasterKey(pin, data.vault_pin_salt);
    const rawMasterKeyB64 = await BitCrypto.decrypt(data.vault_encrypted_pin_key, pinKey);
    const rawKeyBytes = BitCrypto.base64ToBuffer(rawMasterKeyB64);

    const masterKey = await crypto.subtle.importKey(
      'raw',
      rawKeyBytes,
      { name: 'AES-GCM' },
      true, // extractable
      ['encrypt', 'decrypt']
    );

    const vaultData = await Storage.get(['vault_encrypted_data']);
    const decryptedItems = await BitCrypto.decrypt(vaultData.vault_encrypted_data, masterKey);

    _masterKey = masterKey;
    _items = Array.isArray(decryptedItems) ? decryptedItems : [];
    _isLocked = false;
    _lastActiveTimestamp = Date.now();

    // Merge any pending items captured in background worker
    await syncPendingItems();

    notifyBackgroundSync();

    return { success: true, count: _items.length };
  }

  /**
   * Sync pending items captured by background into active encrypted storage
   */
  async function syncPendingItems() {
    if (_isLocked || !_masterKey) return;
    try {
      const pendingData = await Storage.get('vault_pending_items');
      if (pendingData.vault_pending_items && Array.isArray(pendingData.vault_pending_items) && pendingData.vault_pending_items.length > 0) {
        let changed = false;
        for (const pItem of pendingData.vault_pending_items) {
          if (!_items.some(it => it.id === pItem.id)) {
            _items.unshift(pItem);
            changed = true;
          }
        }
        if (changed) {
          await persistItems();
        }
        await Storage.remove('vault_pending_items');
      }
    } catch (e) {
      console.warn('Could not sync pending items:', e);
    }
  }

  /**
   * Set or remove Quick PIN
   */
  async function setQuickPin(pin) {
    if (!pin) {
      // Remove PIN
      await Storage.remove(['vault_pin_salt', 'vault_pin_hash', 'vault_encrypted_pin_key']);
      const settings = await getSettings();
      settings.quickPinEnabled = false;
      await saveSettings(settings);
      return { success: true, enabled: false };
    }

    if (!_masterKey) {
      throw new Error('Vault must be unlocked to set PIN');
    }

    const pinSalt = BitCrypto.generateSalt();
    const pinHash = await BitCrypto.hashMasterPassword(pin, pinSalt);
    const pinKey = await BitCrypto.deriveMasterKey(pin, pinSalt);

    // Export raw master key and encrypt it with the PIN key
    const rawMasterKey = await crypto.subtle.exportKey('raw', _masterKey);
    const rawKeyB64 = BitCrypto.bufferToBase64(rawMasterKey);
    const encryptedPinKey = await BitCrypto.encrypt(rawKeyB64, pinKey);

    await Storage.set({
      vault_pin_salt: pinSalt,
      vault_pin_hash: pinHash,
      vault_encrypted_pin_key: encryptedPinKey
    });

    const settings = await getSettings();
    settings.quickPinEnabled = true;
    await saveSettings(settings);

    return { success: true, enabled: true };
  }

  /**
   * Lock Vault immediately
   */
  function lockVault() {
    _masterKey = null;
    _items = [];
    _isLocked = true;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
      try { chrome.storage.session.remove('vault_session_key'); } catch {}
    }
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({ action: 'VAULT_LOCKED' }, () => {});
      } catch {}
    }
    return { locked: true };
  }

  /**
   * Save items back to encrypted storage
   */
  async function persistItems() {
    if (_isLocked) {
      throw new Error('Cannot persist items: Vault is locked.');
    }

    if (!_masterKey) {
      // 1. Recover from chrome.storage.session
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        try {
          const sess = await chrome.storage.session.get('vault_session_key');
          if (sess && sess.vault_session_key) {
            _masterKey = await importMasterKeyB64(sess.vault_session_key);
          }
        } catch {}
      }
    }

    if (!_masterKey && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      // 2. Recover from background worker
      try {
        const bgStatus = await new Promise(r => chrome.runtime.sendMessage({ action: 'GET_VAULT_STATUS' }, r));
        if (bgStatus && bgStatus.rawKeyB64) {
          _masterKey = await importMasterKeyB64(bgStatus.rawKeyB64);
        }
      } catch {}
    }

    if (_masterKey) {
      const encrypted = await BitCrypto.encrypt(_items, _masterKey);
      await Storage.set({ vault_encrypted_data: encrypted });
    }

    await notifyBackgroundSync();
  }

  /**
   * Add Item
   */
  async function addItem(itemData) {
    if (_isLocked) throw new Error('Vault is locked.');

    const newItem = {
      ...itemData,
      id: itemData.id || BitCrypto.generateUUID(),
      type: itemData.type || 'login',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    _items.unshift(newItem);
    await persistItems();
    return newItem;
  }

  /**
   * Update existing Item
   */
  async function updateItem(id, updatedFields) {
    if (_isLocked) throw new Error('Vault is locked.');

    const idx = _items.findIndex(it => it.id === id);
    if (idx === -1) throw new Error('Item not found');

    _items[idx] = {
      ..._items[idx],
      ...updatedFields,
      updatedAt: new Date().toISOString()
    };

    await persistItems();
    return _items[idx];
  }

  /**
   * Delete Item
   */
  async function deleteItem(id) {
    if (_isLocked) throw new Error('Vault is locked.');
    _items = _items.filter(it => String(it.id) !== String(id));
    await persistItems();
    return { success: true };
  }

  /**
   * Toggle Favorite
   */
  async function toggleFavorite(id) {
    if (_isLocked) throw new Error('Vault is locked.');
    const item = _items.find(it => it.id === id);
    if (item) {
      item.favorite = !item.favorite;
      item.updatedAt = new Date().toISOString();
      await persistItems();
      return item.favorite;
    }
    return false;
  }

  /**
   * Get all items (optionally filtered by type, search, folder)
   */
  function getItems(filter = {}) {
    if (_isLocked) return [];
    let list = [..._items];

    if (filter.type && filter.type !== 'all') {
      list = list.filter(it => it.type === filter.type);
    }

    if (filter.favorite) {
      list = list.filter(it => it.favorite);
    }

    if (filter.folderId) {
      list = list.filter(it => it.folderId === filter.folderId || it.folder === filter.folderId);
    }

    if (filter.query) {
      const q = filter.query.toLowerCase().trim();
      list = list.filter(it => {
        return (it.name && it.name.toLowerCase().includes(q)) ||
               (it.username && it.username.toLowerCase().includes(q)) ||
               (it.uri && it.uri.toLowerCase().includes(q)) ||
               (it.notes && it.notes.toLowerCase().includes(q)) ||
               (it.cardholderName && it.cardholderName.toLowerCase().includes(q)) ||
               (it.rpId && it.rpId.toLowerCase().includes(q));
      });
    }

    return list;
  }

  /**
   * Match logins and passkeys for a given URL / hostname
   */
  function getCredentialsForUrl(url) {
    if (_isLocked || !url) return { logins: [], passkeys: [], cards: [] };

    let domain = '';
    try {
      const parsed = new URL(url);
      domain = parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
      domain = url.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }

    const matchedLogins = _items.filter(it => {
      if (it.type !== 'login' && it.type) return false;
      if (!it.uri) return false;
      const itemUri = it.uri.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
      return itemUri.includes(domain) || domain.includes(itemUri);
    });

    const matchedPasskeys = _items.filter(it => {
      if (it.type !== 'passkey') return false;
      if (!it.rpId) return false;
      const rp = it.rpId.toLowerCase().replace(/^www\./, '');
      return domain.includes(rp) || rp.includes(domain);
    });

    const cards = _items.filter(it => it.type === 'card');

    return {
      domain,
      logins: matchedLogins,
      passkeys: matchedPasskeys,
      cards: cards
    };
  }

  /**
   * Settings management
   */
  async function getSettings() {
    const data = await Storage.get(['vault_settings']);
    return { ...DEFAULT_SETTINGS, ...(data.vault_settings || {}) };
  }

  async function saveSettings(newSettings) {
    const current = await getSettings();
    const updated = { ...current, ...newSettings };
    await Storage.set({ vault_settings: updated });
    return updated;
  }

  /**
   * Folders management
   */
  async function getFolders() {
    const data = await Storage.get(['vault_folders']);
    return data.vault_folders || DEFAULT_FOLDERS;
  }

  async function addFolder(name) {
    const folders = await getFolders();
    const newFolder = { id: `folder-${Date.now()}`, name };
    folders.push(newFolder);
    await Storage.set({ vault_folders: folders });
    return newFolder;
  }

  /**
   * Sends management
   */
  async function getSends() {
    const data = await Storage.get(['vault_sends']);
    return data.vault_sends || [];
  }

  async function saveSend(sendItem) {
    const sends = await getSends();
    sends.unshift(sendItem);
    await Storage.set({ vault_sends: sends });
    return sends;
  }

  async function deleteSend(id) {
    let sends = await getSends();
    sends = sends.filter(s => s.id !== id);
    await Storage.set({ vault_sends: sends });
    return sends;
  }

  /**
   * Notify background worker of state sync
   */
  async function notifyBackgroundSync() {
    _lastActiveTimestamp = Date.now();
    let rawKeyB64 = null;
    if (_masterKey) {
      rawKeyB64 = await exportMasterKeyB64();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.session) {
        try {
          await chrome.storage.session.set({ vault_session_key: rawKeyB64 });
        } catch {}
      }
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        chrome.runtime.sendMessage({
          action: 'VAULT_SYNCED',
          payload: {
            unlocked: !_isLocked,
            items: _items,
            rawKeyB64: rawKeyB64,
            lastActive: _lastActiveTimestamp
          }
        }, () => {});
      } catch {}
    }
  }

  function touchActivity() {
    _lastActiveTimestamp = Date.now();
  }

  return {
    init,
    setupVault,
    unlockVault,
    unlockWithPin,
    setQuickPin,
    lockVault,
    addItem,
    updateItem,
    deleteItem,
    toggleFavorite,
    getItems,
    getCredentialsForUrl,
    getSettings,
    saveSettings,
    getFolders,
    addFolder,
    getSends,
    saveSend,
    deleteSend,
    touchActivity,
    syncPendingItems,
    isLocked: () => _isLocked,
    isInitialized: () => _isInitialized,
    getPasswordHint: () => _passwordHint,
    setMemoryState: (items, unlocked = true, rawKeyB64 = null) => {
      _items = items || [];
      _isLocked = !unlocked;
      if (rawKeyB64 && !_masterKey) {
        importMasterKeyB64(rawKeyB64).then(k => { if (k) _masterKey = k; });
      }
    }
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.BitVault = BitVault;
}
if (typeof window !== 'undefined') {
  window.BitVault = BitVault;
}
if (typeof self !== 'undefined') {
  self.BitVault = BitVault;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitVault;
}
