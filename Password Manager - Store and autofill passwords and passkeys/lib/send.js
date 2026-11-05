/**
 * Bitwarden Password Manager - Bitwarden Send Engine
 * Secure, ephemeral end-to-end encrypted text sharing with access counts & auto-expiry.
 */

const BitSend = (function() {
  'use strict';

  /**
   * Create an encrypted Send item
   */
  async function createSend(options = {}) {
    const {
      name = 'Encrypted Send',
      text = '',
      password = null,
      expirationHours = 24, // 1, 24, 168 (7 days), 720 (30 days)
      maxAccessCount = 5,
      hideEmail = true
    } = options;

    if (!text) {
      throw new Error('Text content is required for Send');
    }

    // Generate random ephemeral key for this Send
    const rawKey = BitCrypto.getRandomBytes(32);
    const keyB64 = BitCrypto.bufferToBase64(rawKey);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const payload = {
      text,
      createdAt: new Date().toISOString()
    };

    const encrypted = await BitCrypto.encrypt(payload, cryptoKey);

    let passwordHash = null;
    let passwordSalt = null;
    if (password) {
      passwordSalt = BitCrypto.generateSalt();
      passwordHash = await BitCrypto.hashMasterPassword(password, passwordSalt);
    }

    const expiryTime = Date.now() + (expirationHours * 60 * 60 * 1000);
    const id = BitCrypto.generateUUID();

    const sendItem = {
      id,
      name,
      encryptedData: encrypted.data,
      iv: encrypted.iv,
      keyFragment: keyB64,
      hasPassword: !!password,
      passwordHash,
      passwordSalt,
      expirationHours,
      expiresAt: new Date(expiryTime).toISOString(),
      maxAccessCount,
      accessCount: 0,
      hideEmail,
      createdAt: new Date().toISOString()
    };

    return sendItem;
  }

  /**
   * Read / decrypt Send item
   */
  async function decryptSend(sendItem, userPassword = null) {
    if (!sendItem) throw new Error('Send item not found');

    // Check expiration
    if (new Date(sendItem.expiresAt).getTime() < Date.now()) {
      throw new Error('This Send has expired and is no longer accessible.');
    }

    // Check access count
    if (sendItem.maxAccessCount && sendItem.accessCount >= sendItem.maxAccessCount) {
      throw new Error('This Send has reached its maximum access limit.');
    }

    // Check password if required
    if (sendItem.hasPassword) {
      if (!userPassword) {
        throw new Error('Password required to decrypt this Send');
      }
      const testHash = await BitCrypto.hashMasterPassword(userPassword, sendItem.passwordSalt);
      if (testHash !== sendItem.passwordHash) {
        throw new Error('Incorrect Send password');
      }
    }

    const rawKey = BitCrypto.base64ToBuffer(sendItem.keyFragment);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      rawKey,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const decrypted = await BitCrypto.decrypt(
      { iv: sendItem.iv, data: sendItem.encryptedData },
      cryptoKey
    );

    // Increment access count
    sendItem.accessCount = (sendItem.accessCount || 0) + 1;

    return {
      text: decrypted.text || decrypted,
      createdAt: decrypted.createdAt,
      accessCount: sendItem.accessCount,
      maxAccessCount: sendItem.maxAccessCount
    };
  }

  return {
    createSend,
    decryptSend
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.BitSend = BitSend;
}
if (typeof window !== 'undefined') {
  window.BitSend = BitSend;
}
if (typeof self !== 'undefined') {
  self.BitSend = BitSend;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitSend;
}
