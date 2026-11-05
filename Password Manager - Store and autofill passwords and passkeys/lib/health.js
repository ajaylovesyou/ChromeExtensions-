/**
 * Bitwarden Password Manager - Vault Security Health & Breach Audit Engine
 * Analyzes stored credentials for weak passwords, re-use vulnerabilities, and missing 2FA.
 */

const BitHealth = (function() {
  'use strict';

  // Common breached / dictionary passwords list
  const KNOWN_BREACHED_PASSWORDS = new Set([
    'password', '123456', '12345678', '123456789', 'qwerty', '12345',
    '111111', '1234567', 'dragon', 'welcome', 'admin', 'ninja',
    'password1', 'football', 'master', 'monkey', 'sunshine', 'letmein',
    'princess', 'solo', 'iloveyou', 'starwars', 'superman', 'trustno1'
  ]);

  // Major services known to support 2FA
  const SERVICES_SUPPORTING_2FA = [
    { domain: 'google.com', name: 'Google' },
    { domain: 'github.com', name: 'GitHub' },
    { domain: 'amazon.com', name: 'Amazon' },
    { domain: 'microsoft.com', name: 'Microsoft' },
    { domain: 'apple.com', name: 'Apple' },
    { domain: 'twitter.com', name: 'X / Twitter' },
    { domain: 'x.com', name: 'X / Twitter' },
    { domain: 'facebook.com', name: 'Facebook' },
    { domain: 'paypal.com', name: 'PayPal' },
    { domain: 'dropbox.com', name: 'Dropbox' },
    { domain: 'coinbase.com', name: 'Coinbase' },
    { domain: 'binance.com', name: 'Binance' },
    { domain: 'reddit.com', name: 'Reddit' },
    { domain: 'linkedin.com', name: 'LinkedIn' },
    { domain: 'discord.com', name: 'Discord' }
  ];

  /**
   * Run full security audit on vault items
   */
  function auditVault(items = []) {
    const logins = items.filter(it => it.type === 'login' || !it.type);
    const passkeys = items.filter(it => it.type === 'passkey');
    const cards = items.filter(it => it.type === 'card');

    const totalLogins = logins.length;
    const weakPasswords = [];
    const reusedMap = {}; // password -> [items]
    const inactive2FA = [];
    const breachedPasswords = [];
    const stalePasswords = [];
    const sixMonthsAgo = Date.now() - (180 * 24 * 60 * 60 * 1000);

    logins.forEach(item => {
      const pwd = item.password || '';

      // 1. Check Breached / Common
      if (KNOWN_BREACHED_PASSWORDS.has(pwd.toLowerCase())) {
        breachedPasswords.push({
          item,
          reason: 'Commonly known compromised password'
        });
      }

      // 2. Check Weak
      const strength = BitCrypto.ratePasswordStrength(pwd);
      if (strength.score <= 1 || pwd.length < 10) {
        weakPasswords.push({
          item,
          strength,
          length: pwd.length,
          reason: pwd.length < 8 ? 'Critically short (< 8 chars)' : 'Low complexity / entropy'
        });
      }

      // 3. Track Reused
      if (pwd) {
        if (!reusedMap[pwd]) {
          reusedMap[pwd] = [];
        }
        reusedMap[pwd].push(item);
      }

      // 4. Check Inactive 2FA
      const uri = (item.uri || item.name || '').toLowerCase();
      const matchedService = SERVICES_SUPPORTING_2FA.find(s => uri.includes(s.domain));
      if (matchedService && !item.totpSecret) {
        inactive2FA.push({
          item,
          service: matchedService.name
        });
      }

      // 5. Check Stale
      const updatedDate = new Date(item.updatedAt || item.createdAt || 0).getTime();
      if (updatedDate > 0 && updatedDate < sixMonthsAgo) {
        const daysOld = Math.round((Date.now() - updatedDate) / (24 * 60 * 60 * 1000));
        stalePasswords.push({
          item,
          daysOld
        });
      }
    });

    // Reused groups with 2 or more items
    const reusedGroups = Object.entries(reusedMap)
      .filter(([pwd, list]) => list.length > 1)
      .map(([pwd, list]) => ({
        passwordMasked: '•'.repeat(Math.min(pwd.length, 8)),
        count: list.length,
        items: list
      }));

    // Calculate Vault Security Score (0 to 100)
    let score = 100;
    if (totalLogins === 0) {
      score = 100;
    } else {
      score -= (breachedPasswords.length * 20);
      score -= (weakPasswords.length * 10);
      score -= (reusedGroups.length * 15);
      score -= (inactive2FA.length * 5);
      score -= (stalePasswords.length * 2);

      // Passkey bonus
      if (passkeys.length > 0) {
        score += Math.min(10, passkeys.length * 2);
      }

      score = Math.max(10, Math.min(100, Math.round(score)));
    }

    let grade = 'A';
    let gradeColor = '#10b981';
    if (score < 50) { grade = 'F'; gradeColor = '#ef4444'; }
    else if (score < 65) { grade = 'D'; gradeColor = '#f97316'; }
    else if (score < 75) { grade = 'C'; gradeColor = '#eab308'; }
    else if (score < 90) { grade = 'B'; gradeColor = '#3b82f6'; }

    return {
      score,
      grade,
      gradeColor,
      totalLogins,
      passkeysCount: passkeys.length,
      cardsCount: cards.length,
      weakPasswords,
      reusedGroups,
      inactive2FA,
      breachedPasswords,
      stalePasswords,
      recommendations: generateRecommendations(score, weakPasswords, reusedGroups, inactive2FA, breachedPasswords)
    };
  }

  function generateRecommendations(score, weak, reused, inactive2FA, breached) {
    const list = [];
    if (breached.length > 0) {
      list.push(`Change ${breached.length} compromised passwords immediately.`);
    }
    if (reused.length > 0) {
      list.push(`Resolve ${reused.length} reused password groups to prevent credential stuffing.`);
    }
    if (weak.length > 0) {
      list.push(`Strengthen ${weak.length} weak passwords using the Password Generator.`);
    }
    if (inactive2FA.length > 0) {
      list.push(`Enable Two-Factor Authentication on ${inactive2FA.length} supported accounts.`);
    }
    if (list.length === 0) {
      list.push('Your vault security is excellent! Keep up the good practices.');
    }
    return list;
  }

  return {
    auditVault,
    KNOWN_BREACHED_PASSWORDS,
    SERVICES_SUPPORTING_2FA
  };
})();

if (typeof globalThis !== 'undefined') {
  globalThis.BitHealth = BitHealth;
}
if (typeof window !== 'undefined') {
  window.BitHealth = BitHealth;
}
if (typeof self !== 'undefined') {
  self.BitHealth = BitHealth;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BitHealth;
}
