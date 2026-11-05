/**
 * Bitwarden Password Manager - RFC 6238 TOTP Authenticator Engine
 * Generates live 2FA verification codes with 30s countdown and auto-sync.
 */

const BitTOTP = (function() {
  'use strict';

  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  /**
   * Decode Base32 string into Uint8Array
   */
  function base32Decode(base32Str) {
    if (!base32Str) return new Uint8Array(0);
    // Sanitize: uppercase, remove spaces, dashes, equals
    const cleanStr = base32Str.toUpperCase().replace(/[\s\-_=]/g, '');
    let bits = 0;
    let value = 0;
    const output = [];

    for (let i = 0; i < cleanStr.length; i++) {
      const char = cleanStr[i];
      const val = BASE32_ALPHABET.indexOf(char);
      if (val === -1) {
        continue; // ignore invalid characters
      }

      value = (value << 5) | val;
      bits += 5;

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return new Uint8Array(output);
  }

  /**
   * Parse otpauth://totp URI or clean raw base32 secret
   */
  function parseSecret(input) {
    if (!input) return null;
    const trimmed = input.trim();
    if (trimmed.startsWith('otpauth://')) {
      try {
        const url = new URL(trimmed);
        const secret = url.searchParams.get('secret');
        const digits = parseInt(url.searchParams.get('digits') || '6', 10);
        const period = parseInt(url.searchParams.get('period') || '30', 10);
        const algorithm = url.searchParams.get('algorithm') || 'SHA-1';
        return { secret, digits, period, algorithm };
      } catch {
        return { secret: trimmed, digits: 6, period: 30, algorithm: 'SHA-1' };
      }
    }
    return { secret: trimmed, digits: 6, period: 30, algorithm: 'SHA-1' };
  }

  /**
   * Generate 6-digit TOTP code for a given secret
   */
  async function generateTOTP(secretInput, forTimeMs = Date.now()) {
    const config = parseSecret(secretInput);
    if (!config || !config.secret) return null;

    const keyBytes = base32Decode(config.secret);
    if (keyBytes.length === 0) return null;

    const epochSeconds = Math.floor(forTimeMs / 1000);
    const counter = Math.floor(epochSeconds / config.period);

    // Convert counter to 8-byte big-endian buffer
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(4, counter, false); // low 32 bits
    counterView.setUint32(0, 0, false);       // high 32 bits

    // Import key for HMAC-SHA1
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'HMAC', hash: { name: 'SHA-1' } },
      false,
      ['sign']
    );

    // Calculate HMAC
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer);
    const hmacResult = new Uint8Array(signature);

    // Dynamic truncation (RFC 4226)
    const offset = hmacResult[hmacResult.length - 1] & 0x0f;
    const binary =
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff);

    const modulus = Math.pow(10, config.digits);
    const code = (binary % modulus).toString().padStart(config.digits, '0');

    return {
      code,
      formatted: code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code,
      period: config.period,
      secondsRemaining: config.period - (epochSeconds % config.period)
    };
  }

  /**
   * Get current seconds remaining in 30-second window
   */
  function getSecondsRemaining(period = 30) {
    const epochSeconds = Math.floor(Date.now() / 1000);
    return period - (epochSeconds % period);
  }

  return {
    generateTOTP,
    getSecondsRemaining,
    parseSecret,
    base32Decode
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.BitTOTP = BitTOTP;
}
if (typeof window !== 'undefined') {
  window.BitTOTP = BitTOTP;
}
if (typeof self !== 'undefined') {
  self.BitTOTP = BitTOTP;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitTOTP;
}
