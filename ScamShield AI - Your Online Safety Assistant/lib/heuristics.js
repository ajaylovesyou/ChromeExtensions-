/**
 * ScamShield AI - Core Heuristics & Detection Engine
 * Pure JavaScript, zero external dependencies, ultra-fast client-side execution.
 */

// Major recognized brands frequently targeted by phishing campaigns
export const RECOGNIZED_BRANDS = [
  { name: 'Google', domains: ['google.com', 'accounts.google.com', 'gmail.com'] },
  { name: 'Apple', domains: ['apple.com', 'icloud.com', 'appleid.apple.com'] },
  { name: 'Microsoft', domains: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'login.microsoftonline.com'] },
  { name: 'Amazon', domains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.in', 'amazon.ca', 'amazon.co.jp'] },
  { name: 'PayPal', domains: ['paypal.com', 'paypal.me'] },
  { name: 'Netflix', domains: ['netflix.com'] },
  { name: 'Facebook / Meta', domains: ['facebook.com', 'fb.com', 'meta.com', 'instagram.com', 'whatsapp.com'] },
  { name: 'Twitter / X', domains: ['x.com', 'twitter.com'] },
  { name: 'Chase Bank', domains: ['chase.com'] },
  { name: 'Bank of America', domains: ['bankofamerica.com'] },
  { name: 'Wells Fargo', domains: ['wellsfargo.com'] },
  { name: 'Citibank', domains: ['citi.com', 'citibank.com'] },
  { name: 'USPS', domains: ['usps.com'] },
  { name: 'FedEx', domains: ['fedex.com'] },
  { name: 'UPS', domains: ['ups.com'] },
  { name: 'DHL', domains: ['dhl.com'] },
  { name: 'eBay', domains: ['ebay.com'] },
  { name: 'Walmart', domains: ['walmart.com'] },
  { name: 'Steam', domains: ['store.steampowered.com', 'steamcommunity.com', 'steampowered.com'] },
  { name: 'Discord', domains: ['discord.com', 'discord.gg'] },
  { name: 'Coinbase', domains: ['coinbase.com'] },
  { name: 'Binance', domains: ['binance.com'] },
  { name: 'MetaMask', domains: ['metamask.io'] },
  { name: 'Stripe', domains: ['stripe.com'] }
];

// High-abuse TLDs often seen in automated phishing / disposable scam domains
export const HIGH_RISK_TLDS = new Set([
  'xyz', 'top', 'work', 'click', 'loan', 'cf', 'gq', 'ml', 'tk', 'buzz',
  'racing', 'cam', 'country', 'surf', 'fit', 'rest', 'icu', 'monster',
  'stream', 'gdn', 'download', 'bid', 'win', 'vip'
]);

// Common URL shorteners where true destination is obscured
export const KNOWN_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'cutt.ly', 'ow.ly', 'rebrand.ly',
  'buff.ly', 'shorturl.at', 'rb.gy', 'v.gd', 'bc.vc'
]);

// Sensitive keywords commonly abused in phishing paths or subdomains
export const SENSITIVE_KEYWORDS = [
  'verify', 'verification', 'update-billing', 'secure-login', 'account-alert',
  'suspended', 'unlock-account', 'confirm-identity', 'wallet-connect',
  'seed-phrase', 'security-checkpoint', 'claim-reward', 'refund-portal',
  'tax-refund', 'package-tracking-fee'
];

/**
 * Calculates Levenshtein Distance between two strings
 */
export function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Normalizes lookalike characters (homoglyphs / visual spoofing)
 */
export function normalizeVisualSpoofing(str) {
  return str
    .toLowerCase()
    .replace(/[0]/g, 'o')
    .replace(/[1l|!]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[4@]/g, 'a')
    .replace(/[5$]/g, 's')
    .replace(/[vv]/g, 'w')
    .replace(/[rn]/g, 'm');
}

/**
 * Parses hostname into subdomain, main domain name, and TLD
 */
export function parseDomainParts(hostname) {
  const cleanHost = hostname.toLowerCase().replace(/^www\./, '');
  const parts = cleanHost.split('.');
  if (parts.length < 2) {
    return { subdomain: '', mainDomain: cleanHost, tld: '' };
  }
  
  // Handle two-part TLDs like .co.uk, .com.au, .co.in
  const twoPartTlds = ['co.uk', 'com.au', 'co.in', 'org.uk', 'net.au', 'gov.in', 'edu.au'];
  const lastTwo = parts.slice(-2).join('.');
  let tld, mainDomain, subdomain;

  if (twoPartTlds.includes(lastTwo) && parts.length > 2) {
    tld = lastTwo;
    mainDomain = parts[parts.length - 3];
    subdomain = parts.slice(0, -3).join('.');
  } else {
    tld = parts[parts.length - 1];
    mainDomain = parts[parts.length - 2];
    subdomain = parts.slice(0, -2).join('.');
  }

  return { subdomain, mainDomain, tld, fullHost: cleanHost };
}

/**
 * Checks for brand impersonation or typosquatting
 */
export function detectBrandImpersonation(hostname) {
  const { subdomain, mainDomain, tld } = parseDomainParts(hostname);
  const normalizedMain = normalizeVisualSpoofing(mainDomain);

  for (const brand of RECOGNIZED_BRANDS) {
    // If the hostname actually belongs to the verified brand domain, it's genuine!
    if (brand.domains.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return { isGenuine: true, brand: brand.name };
    }

    const brandKey = brand.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Subdomain trickery: e.g. "paypal.com.account-verify.net"
    if (subdomain.includes(brandKey)) {
      return {
        impersonating: true,
        brand: brand.name,
        technique: 'subdomain_deception',
        reason: `Subdomain claims to be "${brand.name}", but the actual website domain is "${mainDomain}.${tld}".`
      };
    }

    // 2. Hyphenated fake brand: e.g. "amazon-security-update.com" or "paypa1-security.com"
    const tokens = mainDomain.split(/[-_]/);
    const normalizedTokens = normalizedMain.split(/[-_]/);

    if (mainDomain.includes(brandKey) && mainDomain !== brandKey) {
      return {
        impersonating: true,
        brand: brand.name,
        technique: 'compound_spoofing',
        reason: `Contains brand name "${brand.name}" mixed with extra words in the domain ("${mainDomain}").`
      };
    }

    // Check if any sub-word or the whole main domain is a typo of the brand
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const normTok = normalizedTokens[i] || tok;
      const tokDist = levenshteinDistance(tok, brandKey);
      const normDist = levenshteinDistance(normTok, brandKey);

      if ((tokDist > 0 && tokDist <= 2 && brandKey.length > 4) || (normDist === 0 && tok !== brandKey)) {
        return {
          impersonating: true,
          brand: brand.name,
          technique: 'typosquatting',
          reason: `Word "${tok}" in the domain visually mimics brand "${brand.name}", but uses deceptive letter substitutions.`
        };
      }
    }

    // 3. Typo-squatting on whole domain: e.g. "paypa1.com", "arnazon.com"
    const distance = levenshteinDistance(mainDomain, brandKey);
    const normalizedDistance = levenshteinDistance(normalizedMain, brandKey);

    if ((distance > 0 && distance <= 2 && brandKey.length > 4) || (normalizedDistance === 0 && mainDomain !== brandKey)) {
      return {
        impersonating: true,
        brand: brand.name,
        technique: 'typosquatting',
        reason: `Visually resembles "${brand.name}" (${mainDomain}.${tld}), but uses deceptive letter substitutions.`
      };
    }
  }

  return null;
}

/**
 * FEATURE 1 & 2: Comprehensive URL & Website Safety Checker
 */
export function analyzeUrlSafety(rawUrl) {
  const flags = [];
  let riskScore = 0; // 0 = Safe, 100 = Extremely Dangerous

  let parsed;
  try {
    // Allow checking URLs without explicit protocol by prefixing https://
    const urlToParse = /^https?:\/\//i.test(rawUrl) ? rawUrl : 'https://' + rawUrl;
    parsed = new URL(urlToParse);
  } catch (err) {
    return {
      isValid: false,
      error: 'Invalid URL format.',
      riskScore: 100,
      verdict: 'DANGER',
      flags: [{ code: 'INVALID_URL', severity: 'HIGH', message: 'The provided URL cannot be parsed.' }]
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const protocol = parsed.protocol.toLowerCase();
  const pathname = parsed.pathname.toLowerCase();
  const fullUrl = parsed.href;

  // 1. IP Address Host Check (Phishing frequently hosts on raw IPs)
  const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isIPv6 = hostname.startsWith('[') && hostname.endsWith(']');
  if (isIPv4 || isIPv6) {
    riskScore += 45;
    flags.push({
      code: 'RAW_IP_ADDRESS',
      severity: 'HIGH',
      message: 'Website uses a raw IP address instead of a recognized domain name. Common tactic used by scammers to bypass security filters.'
    });
  }

  // 2. Insecure Protocol Check (HTTP on sensitive portals)
  if (protocol === 'http:') {
    riskScore += 20;
    flags.push({
      code: 'INSECURE_HTTP',
      severity: 'MEDIUM',
      message: 'Connection is not encrypted (HTTP). Any data, passwords, or cards you type can be intercepted.'
    });
  }

  // 3. Userinfo / Credential phishing in URL: e.g. "https://google.com@evil-site.com"
  if (parsed.username || parsed.password) {
    riskScore += 60;
    flags.push({
      code: 'DECEPTIVE_USERINFO',
      severity: 'CRITICAL',
      message: 'Contains embedded credentials or deceptive @ sign to trick you into thinking you are visiting another website.'
    });
  }

  // 4. Punycode / Homoglyph attack check (e.g., xn--...)
  if (hostname.includes('xn--')) {
    riskScore += 40;
    flags.push({
      code: 'PUNYCODE_HOMOGLYPH',
      severity: 'HIGH',
      message: 'Uses internationalized special characters (Punycode). Often used to fake letters like Cyrillic "a" to mimic trusted sites.'
    });
  }

  // 5. High-Risk / Abused TLDs
  const { subdomain, mainDomain, tld } = parseDomainParts(hostname);
  if (HIGH_RISK_TLDS.has(tld)) {
    riskScore += 25;
    flags.push({
      code: 'HIGH_RISK_TLD',
      severity: 'MEDIUM',
      message: `Uses a top-level domain (.${tld}) frequently associated with cheap, disposable spam and phishing campaigns.`
    });
  }

  // 6. Excessive subdomains
  const subdomainCount = subdomain ? subdomain.split('.').length : 0;
  if (subdomainCount >= 3) {
    riskScore += 25;
    flags.push({
      code: 'EXCESSIVE_SUBDOMAINS',
      severity: 'MEDIUM',
      message: `Has unusually many nested subdomains (${subdomainCount}). Often used to disguise the real domain.`
    });
  }

  // 7. Brand Impersonation / Typosquatting
  const brandCheck = detectBrandImpersonation(hostname);
  if (brandCheck && brandCheck.impersonating) {
    riskScore += 65;
    flags.push({
      code: 'BRAND_IMPERSONATION',
      severity: 'CRITICAL',
      message: brandCheck.reason,
      impersonatedBrand: brandCheck.brand
    });
  }

  // 8. URL Shortener Flag
  if (KNOWN_SHORTENERS.has(hostname)) {
    riskScore += 15;
    flags.push({
      code: 'URL_SHORTENER',
      severity: 'LOW',
      message: 'This is a shortened URL. The actual destination website is hidden until clicked.'
    });
  }

  // 9. Sensitive keywords in path or query
  for (const kw of SENSITIVE_KEYWORDS) {
    if (pathname.includes(kw) || parsed.search.includes(kw)) {
      // If combined with high-risk TLD or non-verified brand, score higher
      const addedWeight = (riskScore > 20) ? 20 : 10;
      riskScore += addedWeight;
      flags.push({
        code: 'SENSITIVE_PHISHING_PATH',
        severity: 'MEDIUM',
        message: `URL path contains urgency/account manipulation keyword: "${kw}".`
      });
      break;
    }
  }

  // 10. Verified Known Trusted Brands check
  let isVerifiedBrand = false;
  let verifiedBrandName = null;
  if (brandCheck && brandCheck.isGenuine) {
    isVerifiedBrand = true;
    verifiedBrandName = brandCheck.brand;
    riskScore = Math.max(0, riskScore - 50); // Significant trust boost
  }

  // Final Risk Classification
  riskScore = Math.min(100, Math.max(0, riskScore));
  let verdict = 'SAFE';
  if (riskScore >= 60) {
    verdict = 'DANGER';
  } else if (riskScore >= 25) {
    verdict = 'CAUTION';
  }

  return {
    isValid: true,
    url: fullUrl,
    hostname,
    domain: `${mainDomain}.${tld}`,
    protocol,
    riskScore,
    verdict,
    isVerifiedBrand,
    verifiedBrandName,
    flags
  };
}

/**
 * FEATURE 2: Suspicious Link Detector (Checks link text vs href target)
 */
export function analyzeLinkMismatch(linkText, href) {
  if (!linkText || !href) return null;
  const cleanText = linkText.trim();

  // If text looks like a URL (e.g. "https://paypal.com" or "www.apple.com")
  const urlRegex = /(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/i;
  const match = cleanText.match(urlRegex);

  if (!match) return null;

  try {
    const displayedDomain = match[1].toLowerCase().replace(/^www\./, '');
    const targetUrl = new URL(href, 'https://dummy-base.com');
    const targetDomain = targetUrl.hostname.toLowerCase().replace(/^www\./, '');

    if (displayedDomain && targetDomain && displayedDomain !== targetDomain && !targetDomain.endsWith('.' + displayedDomain)) {
      return {
        isMismatch: true,
        severity: 'CRITICAL',
        displayedDomain,
        targetDomain,
        message: `Deceptive Link! The text claims to open "${displayedDomain}", but clicking it actually sends you to "${targetDomain}".`
      };
    }
  } catch (e) {
    // ignore parse error
  }

  return null;
}

/**
 * FEATURE 3: Shopping Scam & Fake Storefront Detector
 */
export function analyzeShoppingSignals(pageData) {
  const { url, title = '', bodyText = '', metaDescription = '' } = pageData;
  const content = (title + ' ' + bodyText + ' ' + metaDescription).toLowerCase();
  const alerts = [];
  let shoppingRisk = 0;

  // 1. Extreme discount red flags
  const extremeDiscountPatterns = [
    /(\b9[0-9]% off\b|\b8[5-9]% off\b)/i,
    /all items \$(?:1|2|5|9)\.99/i,
    /clearance blowout.*today only/i,
    /factory outlet liquidation/i,
    /warehouse closeout.*90%/i
  ];

  for (const pattern of extremeDiscountPatterns) {
    if (pattern.test(content)) {
      shoppingRisk += 30;
      alerts.push({
        type: 'EXTREME_DISCOUNT',
        severity: 'HIGH',
        message: 'Suspicious 85%+ discount claims found. Fraudulent storefronts advertise impossible prices to steal credit card details.'
      });
      break;
    }
  }

  // 2. High-Pressure Fake Urgency
  const urgencyPatterns = [
    /(?:hurry|only)\s+([1-3])\s+left in stock/i,
    /order within (?:[0-9]+)m (?:[0-9]+)s to get/i,
    /sale ends in (?:[0-9]+):[0-9]+/i,
    /demand is high.*reserve now/i
  ];

  for (const pattern of urgencyPatterns) {
    if (pattern.test(content)) {
      shoppingRisk += 20;
      alerts.push({
        type: 'FAKE_URGENCY',
        severity: 'MEDIUM',
        message: 'Aggressive countdown or artificial scarcity timer detected, designed to pressure shoppers into hasty checkout.'
      });
      break;
    }
  }

  // 3. Suspicious Alternative Payment Requirements
  const unsafePaymentKeywords = [
    'western union', 'moneygram', 'zelle only', 'cash app only',
    'bitcoin only', 'crypto only', 'apple gift card', 'amazon gift card payment'
  ];

  for (const kw of unsafePaymentKeywords) {
    if (content.includes(kw)) {
      shoppingRisk += 45;
      alerts.push({
        type: 'UNPROTECTED_PAYMENT',
        severity: 'CRITICAL',
        message: `Mentions untraceable payment method ("${kw}"). Legitimate online stores never demand non-refundable gift cards or wire transfers.`
      });
      break;
    }
  }

  // 4. Missing or Generic Support Contact
  const freeEmailProviders = ['@gmail.com', '@yahoo.com', '@hotmail.com', '@outlook.com'];
  const hasFreeEmailContact = freeEmailProviders.some(provider => content.includes(provider));
  if (hasFreeEmailContact && (content.includes('official store') || content.includes('support@') || content.includes('contact us'))) {
    shoppingRisk += 25;
    alerts.push({
      type: 'FREE_EMAIL_CONTACT',
      severity: 'MEDIUM',
      message: 'Official store uses a free personal email address (Gmail/Yahoo/Outlook) instead of a corporate domain for customer support.'
    });
  }

  shoppingRisk = Math.min(100, shoppingRisk);

  return {
    isShoppingSite: alerts.length > 0 || /cart|checkout|add to bag|buy now|free shipping/i.test(content),
    shoppingRiskScore: shoppingRisk,
    alerts
  };
}

/**
 * FEATURE 4: Scam Message & SMS / Email Analyzer
 */
export function analyzeScamMessage(text) {
  if (!text || text.trim().length < 5) {
    return {
      isValid: false,
      message: 'Please paste a message with at least 5 characters to analyze.'
    };
  }

  const raw = text.trim();
  const lower = raw.toLowerCase();
  const triggers = [];
  let score = 0;

  // 1. Panic & Artificial Urgency
  const urgencyKeywords = [
    { phrase: 'account will be suspended', weight: 35 },
    { phrase: 'suspended within 24 hours', weight: 40 },
    { phrase: 'arrest warrant', weight: 50 },
    { phrase: 'law enforcement', weight: 35 },
    { phrase: 'legal action', weight: 30 },
    { phrase: 'immediate action required', weight: 25 },
    { phrase: 'act now or face', weight: 35 },
    { phrase: 'unauthorized transaction of $', weight: 30 },
    { phrase: 'card has been blocked', weight: 30 },
    { phrase: 'security compromised', weight: 25 }
  ];

  for (const item of urgencyKeywords) {
    if (lower.includes(item.phrase)) {
      score += item.weight;
      triggers.push({
        category: 'URGENCY_PRESSURE',
        severity: 'HIGH',
        text: `Uses high-pressure scare tactic: "${item.phrase}".`
      });
      break;
    }
  }

  // 2. Delivery & Parcel Impersonation
  const deliveryKeywords = [
    'usps: your package', 'fedex delivery exception', 'dhl: parcel pending',
    'package could not be delivered', 'unpaid customs fee', 'reschedule delivery fee',
    'update your address to receive shipment', 'postal notification'
  ];

  for (const phrase of deliveryKeywords) {
    if (lower.includes(phrase)) {
      score += 40;
      triggers.push({
        category: 'DELIVERY_SCAM',
        severity: 'HIGH',
        text: 'Impersonates postal/shipping courier asking for small fee or address confirmation (classic "Smishing" package scam).'
      });
      break;
    }
  }

  // 3. Bank & Account Fraud Alerts
  const bankFraudKeywords = [
    'chase alert:', 'wells fargo notification:', 'bank of america security',
    'fraud detection team', 'did you authorize this charge', 'call this number immediately to cancel'
  ];

  for (const phrase of bankFraudKeywords) {
    if (lower.includes(phrase)) {
      score += 35;
      triggers.push({
        category: 'BANK_IMPERSONATION',
        severity: 'HIGH',
        text: 'Claims to be your bank warning of unauthorized charges. Banks never ask you to click links to verify your login.'
      });
      break;
    }
  }

  // 4. Tech Support / Antivirus Renewal Invoices
  const techSupportKeywords = [
    'geek squad', 'norton 360 renewal', 'mcafee auto-renewal',
    'invoice #', 'charged $399', 'charged $499', 'call customer support to refund'
  ];

  for (const phrase of techSupportKeywords) {
    if (lower.includes(phrase)) {
      const hasCallOrRefund = lower.includes('refund') || lower.includes('call') || lower.includes('cancel');
      score += hasCallOrRefund ? 65 : 45;
      triggers.push({
        category: 'REFUND_INVOICE_SCAM',
        severity: 'HIGH',
        text: 'Fake invoice or renewal notice (Geek Squad/Norton) urging you to contact a fake call-center to "cancel or refund" the charge.'
      });
      break;
    }
  }

  // 5. Lottery, Prizes, Job & Crypto Giveaways
  const prizeKeywords = [
    'you have won', 'selected as the winner', 'guaranteed returns',
    'crypto giveaway', 'double your bitcoin', 'work from home earn $500/day',
    'unclaimed lottery', 'inheritance funds'
  ];

  for (const phrase of prizeKeywords) {
    if (lower.includes(phrase)) {
      score += 40;
      triggers.push({
        category: 'PRIZE_OR_INVESTMENT_SCAM',
        severity: 'HIGH',
        text: 'Offers unexpected lottery winnings, work-from-home riches, or guaranteed crypto gains (Advance Fee Scam).'
      });
      break;
    }
  }

  // 6. Sensitive Data / OTP Harvesting
  const sensitiveRequests = [
    'send your 6-digit', 'one time passcode', 'send your otp',
    'verify your ssn', 'enter your pin', 'seed phrase'
  ];

  for (const phrase of sensitiveRequests) {
    if (lower.includes(phrase)) {
      score += 55;
      triggers.push({
        category: 'CREDENTIAL_HARVESTING',
        severity: 'CRITICAL',
        text: `Explicitly asks for secret credentials: "${phrase}". Never share OTPs or recovery phrases with anyone!`
      });
      break;
    }
  }

  // 7. Embedded Links in Message
  const urlMatches = raw.match(/https?:\/\/[^\s]+|[a-z0-9.-]+\.(?:com|xyz|top|ru|cc|to|link|click|info)[^\s]*/gi);
  const foundLinks = [];
  if (urlMatches) {
    for (const link of urlMatches) {
      const linkAnalysis = analyzeUrlSafety(link);
      foundLinks.push(linkAnalysis);
      if (linkAnalysis.riskScore >= 25) {
        score += 30;
      }
    }
  }

  score = Math.min(100, Math.max(0, score));

  let verdict = 'LIKELY_SAFE';
  if (score >= 60) {
    verdict = 'HIGH_SCAM_RISK';
  } else if (score >= 25) {
    verdict = 'SUSPICIOUS';
  }

  return {
    isValid: true,
    analyzedText: raw,
    riskScore: score,
    verdict,
    triggers,
    foundLinks
  };
}
