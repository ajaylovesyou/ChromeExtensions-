/**
 * Bitwarden Password Manager - Cryptographic Utilities
 * Zero-Knowledge Client-Side Encryption via WebCrypto API
 * - PBKDF2 Key Derivation (SHA-256, 100,000 rounds)
 * - AES-GCM 256-bit Symmetric Encryption with random IV
 * - SHA-256 / HMAC Hashing for verification
 */

const BitCrypto = (function() {
  'use strict';

  const PBKDF2_ITERATIONS = 100000;
  const AES_KEY_LENGTH = 256;
  const IV_LENGTH = 12; // 96-bit standard for AES-GCM
  const SALT_LENGTH = 32;

  // Convert string to Uint8Array
  function stringToBuffer(str) {
    return new TextEncoder().encode(str);
  }

  // Convert Uint8Array to string
  function bufferToString(buf) {
    return new TextDecoder().decode(buf);
  }

  // Convert Uint8Array to Base64
  function bufferToBase64(buf) {
    let binary = '';
    const bytes = new Uint8Array(buf);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert Base64 to Uint8Array
  function base64ToBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Convert buffer to Hex string
  function bufferToHex(buf) {
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Generate cryptographically secure random bytes
  function getRandomBytes(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  // Generate a random UUID v4
  function generateUUID() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
      (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
  }

  // Generate Salt (base64)
  function generateSalt() {
    return bufferToBase64(getRandomBytes(SALT_LENGTH));
  }

  /**
   * Derive an AES-GCM 256-bit CryptoKey from master password and salt using PBKDF2
   */
  async function deriveMasterKey(password, saltB64) {
    const saltBuffer = base64ToBuffer(saltB64);
    const passwordBuffer = stringToBuffer(password);

    // Import the raw password as a key for PBKDF2
    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveKey', 'deriveBits']
    );

    // Derive the AES-GCM 256 encryption key
    const aesKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: AES_KEY_LENGTH },
      true, // extractable to support Quick PIN encryption
      ['encrypt', 'decrypt']
    );

    return aesKey;
  }

  /**
   * Compute a password verification hash (stretching hash)
   * This is stored to verify the master password without decrypting data.
   */
  async function hashMasterPassword(password, saltB64) {
    const saltBuffer = base64ToBuffer(saltB64);
    const passwordBuffer = stringToBuffer(password);

    const baseKey = await crypto.subtle.importKey(
      'raw',
      passwordBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: saltBuffer,
        iterations: PBKDF2_ITERATIONS / 2,
        hash: 'SHA-256'
      },
      baseKey,
      256
    );

    return bufferToBase64(derivedBits);
  }

  /**
   * Encrypt an object or string with AES-GCM 256
   * Returns: { iv: 'base64', data: 'base64' }
   */
  async function encrypt(plaintextOrObj, cryptoKey) {
    const jsonStr = typeof plaintextOrObj === 'string'
      ? plaintextOrObj
      : JSON.stringify(plaintextOrObj);

    const iv = getRandomBytes(IV_LENGTH);
    const dataBuffer = stringToBuffer(jsonStr);

    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      dataBuffer
    );

    return {
      iv: bufferToBase64(iv),
      data: bufferToBase64(ciphertext)
    };
  }

  /**
   * Decrypt ciphertext bundle using AES-GCM 256 key
   * Returns: parsed object or raw string
   */
  async function decrypt(encryptedBundle, cryptoKey) {
    if (!encryptedBundle || !encryptedBundle.iv || !encryptedBundle.data) {
      throw new Error('Invalid encrypted bundle');
    }

    const iv = base64ToBuffer(encryptedBundle.iv);
    const ciphertext = base64ToBuffer(encryptedBundle.data);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      ciphertext
    );

    const decryptedStr = bufferToString(decryptedBuffer);
    try {
      return JSON.parse(decryptedStr);
    } catch {
      return decryptedStr;
    }
  }

  /**
   * Fast SHA-256 hash of a string, returned as Hex
   */
  async function sha256Hex(str) {
    const buf = stringToBuffer(str);
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return bufferToHex(digest);
  }

  /**
   * Calculate password entropy in bits
   */
  function calculateEntropy(password) {
    if (!password) return 0;
    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;
    if (poolSize === 0) return 0;

    return Math.round(password.length * Math.log2(poolSize));
  }

  /**
   * Estimate human readable crack time based on entropy
   */
  function estimateCrackTime(entropy) {
    if (entropy < 28) return 'Instantly';
    if (entropy < 36) return 'Few seconds';
    if (entropy < 48) return 'Few hours';
    if (entropy < 60) return 'Few months';
    if (entropy < 72) return 'Several years';
    if (entropy < 90) return 'Centuries';
    return 'Trillions of years';
  }

  /**
   * Password strength rating (0-4)
   */
  function ratePasswordStrength(password) {
    if (!password) return { score: 0, label: 'Empty', color: '#94a3b8', entropy: 0, crackTime: 'None' };
    const entropy = calculateEntropy(password);
    const crackTime = estimateCrackTime(entropy);

    let score = 0;
    if (entropy >= 28) score = 1;
    if (entropy >= 45) score = 2;
    if (entropy >= 65) score = 3;
    if (entropy >= 85) score = 4;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];

    return {
      score,
      label: labels[score],
      color: colors[score],
      entropy,
      crackTime
    };
  }

  return {
    generateUUID,
    getRandomBytes,
    generateSalt,
    deriveMasterKey,
    hashMasterPassword,
    encrypt,
    decrypt,
    sha256Hex,
    calculateEntropy,
    estimateCrackTime,
    ratePasswordStrength,
    bufferToBase64,
    base64ToBuffer,
    stringToBuffer,
    bufferToString,
    bufferToHex
  };
})();

// Export for module systems, service worker, and window global
if (typeof globalThis !== 'undefined') {
  globalThis.BitCrypto = BitCrypto;
}
if (typeof window !== 'undefined') {
  window.BitCrypto = BitCrypto;
}
if (typeof self !== 'undefined') {
  self.BitCrypto = BitCrypto;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitCrypto;
}
