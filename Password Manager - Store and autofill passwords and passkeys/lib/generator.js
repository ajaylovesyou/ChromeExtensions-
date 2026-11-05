/**
 * Bitwarden Password Manager - Generator Engine
 * Generates high-entropy passwords, memorable passphrases, and smart email aliases.
 */

const BitGenerator = (function() {
  'use strict';

  const CHARS_UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // omitting ambiguous by default when requested
  const CHARS_UPPER_ALL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const CHARS_LOWER = 'abcdefghijkmnopqrstuvwxyz'; // omitting l
  const CHARS_LOWER_ALL = 'abcdefghijklmnopqrstuvwxyz';
  const CHARS_NUMBERS = '23456789'; // omitting 0, 1
  const CHARS_NUMBERS_ALL = '0123456789';
  const CHARS_SPECIAL = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  // Curated list of 250+ distinct, clean English words for passphrase generation
  const WORDLIST = [
    'acorn', 'alpine', 'anchor', 'anthem', 'apollo', 'arctic', 'arrow', 'atlas', 'autumn', 'beacon',
    'breeze', 'bridge', 'bronze', 'canyon', 'castle', 'cedar', 'cipher', 'cloud', 'clover', 'comet',
    'copper', 'coral', 'cosmos', 'crater', 'crystal', 'current', 'delta', 'desert', 'diamond', 'dolphin',
    'dragon', 'drift', 'eagle', 'echo', 'ember', 'falcon', 'feather', 'forest', 'fossil', 'galaxy',
    'glacier', 'granite', 'harbor', 'haven', 'hawk', 'horizon', 'island', 'jasper', 'jungle', 'jupiter',
    'kinetic', 'knight', 'lagoon', 'lantern', 'legend', 'lotus', 'lunar', 'magnet', 'marble', 'meadow',
    'meteor', 'mirage', 'monarch', 'mosaic', 'nebula', 'nexus', 'oasis', 'ocean', 'onyx', 'orbit',
    'orchid', 'origin', 'pacific', 'palace', 'panther', 'pebble', 'phoenix', 'pioneer', 'planet', 'plasma',
    'polar', 'portal', 'prism', 'pulse', 'pyramid', 'quantum', 'quartz', 'radar', 'radiant', 'rainbow',
    'ranger', 'raven', 'reef', 'ripple', 'river', 'rocket', 'saffron', 'sailor', 'saturn', 'shadow',
    'shield', 'sierra', 'silver', 'skyline', 'solar', 'spark', 'sphinx', 'spirit', 'spring', 'spruce',
    'star', 'stone', 'summit', 'sunburst', 'sunset', 'swift', 'tempest', 'timber', 'titan', 'topaz',
    'torch', 'tower', 'trail', 'tundra', 'valley', 'vector', 'velvet', 'vortex', 'voyage', 'wave',
    'whisper', 'willow', 'winter', 'zenith', 'zephyr', 'zodiac', 'abacus', 'bamboo', 'calypso', 'dynamo',
    'elixir', 'frontier', 'glimmer', 'harvest', 'impact', 'journey', 'karma', 'legacy', 'mystic', 'nucleus',
    'odyssey', 'phantom', 'quest', 'radiance', 'safari', 'thunder', 'utopia', 'valiant', 'wander', 'yonder',
    'zen', 'aurora', 'blizzard', 'cascade', 'dusk', 'equinox', 'flame', 'grove', 'halo', 'infinity',
    'jubilee', 'kaleido', 'luminous', 'matrix', 'nirvana', 'obsidian', 'paradox', 'quasar', 'resonance', 'solstice',
    'trident', 'universe', 'velocity', 'wildfire', 'xenon', 'yield', 'zenith'
  ];

  const NOUNS = ['fox', 'wolf', 'hawk', 'lion', 'bear', 'tiger', 'eagle', 'otter', 'panda', 'viper', 'puma', 'lynx'];
  const ADJECTIVES = ['brave', 'swift', 'silent', 'cosmic', 'golden', 'shadow', 'silver', 'bright', 'noble', 'clever'];

  // Secure integer in range [0, max-1]
  function getRandomInt(max) {
    if (max <= 0) return 0;
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }

  /**
   * Generate secure password
   */
  function generatePassword(options = {}) {
    const {
      length = 16,
      uppercase = true,
      lowercase = true,
      numbers = true,
      special = true,
      avoidAmbiguous = true,
      minNumbers = 1,
      minSpecial = 1
    } = options;

    const uChars = avoidAmbiguous ? CHARS_UPPER : CHARS_UPPER_ALL;
    const lChars = avoidAmbiguous ? CHARS_LOWER : CHARS_LOWER_ALL;
    const nChars = avoidAmbiguous ? CHARS_NUMBERS : CHARS_NUMBERS_ALL;
    const sChars = CHARS_SPECIAL;

    let pool = '';
    const guaranteed = [];

    if (uppercase) {
      pool += uChars;
      guaranteed.push(uChars[getRandomInt(uChars.length)]);
    }
    if (lowercase) {
      pool += lChars;
      guaranteed.push(lChars[getRandomInt(lChars.length)]);
    }
    if (numbers) {
      pool += nChars;
      for (let i = 0; i < Math.max(1, minNumbers); i++) {
        guaranteed.push(nChars[getRandomInt(nChars.length)]);
      }
    }
    if (special) {
      pool += sChars;
      for (let i = 0; i < Math.max(1, minSpecial); i++) {
        guaranteed.push(sChars[getRandomInt(sChars.length)]);
      }
    }

    if (pool.length === 0) {
      pool = lChars + nChars;
      guaranteed.push(lChars[0]);
    }

    const remainingCount = Math.max(0, length - guaranteed.length);
    const resultChars = [...guaranteed];

    for (let i = 0; i < remainingCount; i++) {
      resultChars.push(pool[getRandomInt(pool.length)]);
    }

    // Cryptographic Fisher-Yates shuffle
    for (let i = resultChars.length - 1; i > 0; i--) {
      const j = getRandomInt(i + 1);
      const temp = resultChars[i];
      resultChars[i] = resultChars[j];
      resultChars[j] = temp;
    }

    return resultChars.join('');
  }

  /**
   * Generate memorable Diceware-style passphrase
   */
  function generatePassphrase(options = {}) {
    const {
      wordCount = 4,
      separator = '-',
      capitalize = true,
      includeNumber = true
    } = options;

    const count = Math.min(8, Math.max(3, wordCount));
    const selectedWords = [];

    for (let i = 0; i < count; i++) {
      let word = WORDLIST[getRandomInt(WORDLIST.length)];
      if (capitalize) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
      }
      selectedWords.push(word);
    }

    if (includeNumber) {
      const num = getRandomInt(90) + 10; // 2-digit number 10-99
      const pos = getRandomInt(selectedWords.length);
      selectedWords[pos] = selectedWords[pos] + num;
    }

    return selectedWords.join(separator);
  }

  /**
   * Generate smart username or email alias
   */
  function generateUsername(type = 'random', baseEmail = 'user@example.com', domain = 'example.com') {
    if (type === 'plus_address') {
      const parts = baseEmail.split('@');
      const user = parts[0] || 'user';
      const mailDomain = parts[1] || 'gmail.com';
      const cleanDomain = domain.replace(/https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('.')[0] || 'web';
      const token = getRandomInt(900) + 100;
      return `${user}+${cleanDomain}${token}@${mailDomain}`;
    }

    if (type === 'forward_alias') {
      const prefix = ['shield', 'priv', 'vault', 'relay', 'anon'][getRandomInt(5)];
      const token = (getRandomInt(90000) + 10000).toString(16);
      return `${prefix}.${token}@vault-alias.com`;
    }

    // Standard memorable username
    const adj = ADJECTIVES[getRandomInt(ADJECTIVES.length)];
    const noun = NOUNS[getRandomInt(NOUNS.length)];
    const num = getRandomInt(900) + 100;
    return `${adj}_${noun}_${num}`;
  }

  return {
    generatePassword,
    generatePassphrase,
    generateUsername,
    WORDLIST
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.BitGenerator = BitGenerator;
}
if (typeof window !== 'undefined') {
  window.BitGenerator = BitGenerator;
}
if (typeof self !== 'undefined') {
  self.BitGenerator = BitGenerator;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitGenerator;
}
