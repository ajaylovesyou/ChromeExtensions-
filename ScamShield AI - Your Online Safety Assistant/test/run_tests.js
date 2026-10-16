/**
 * ScamShield AI - Automated Unit & Integration Test Suite
 * Validates that all detection engines, explainers, and test cases run without any errors.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeUrlSafety,
  analyzeScamMessage,
  analyzeLinkMismatch,
  analyzeShoppingSignals
} from '../lib/heuristics.js';
import {
  generateWebsiteExplanation,
  generateMessageExplanation
} from '../lib/simple-explainer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('🛡️  SCAMSHIELD AI - AUTOMATED TEST SUITE');
console.log('====================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// ----------------------------------------------------
// TEST 1: URL & Website Safety Checker
// ----------------------------------------------------
console.log('--- TEST GROUP 1: Website Safety Checker ---');

const testUrls = [
  { url: 'https://paypa1-security.top/verify', expected: 'DANGER', desc: 'PayPal Typosquatting' },
  { url: 'https://usps-redelivery.xyz/fee', expected: 'DANGER', desc: 'USPS Spoof on .xyz' },
  { url: 'http://185.220.101.5/login', expected: 'DANGER', desc: 'Raw IP Host with Insecure HTTP' },
  { url: 'https://www.apple.com', expected: 'SAFE', desc: 'Official Apple Domain' },
  { url: 'https://www.amazon.com/orders', expected: 'SAFE', desc: 'Official Amazon Domain' },
  { url: 'https://accounts.google.com/signin', expected: 'SAFE', desc: 'Official Google Domain' },
  { url: 'https://paypal.com.fake-portal.work', expected: 'DANGER', desc: 'Subdomain Deception' }
];

for (const t of testUrls) {
  const result = analyzeUrlSafety(t.url);
  assert(result.isValid, `URL parsed successfully: ${t.url}`);
  assert(
    result.verdict === t.expected || (t.expected === 'DANGER' && result.riskScore >= 60),
    `Correct verdict for ${t.desc} (Expected: ${t.expected}, Got: ${result.verdict}, Score: ${result.riskScore})`
  );

  const explanation = generateWebsiteExplanation(result);
  assert(explanation.badgeText !== undefined, `Generated badgeText for ${t.desc}`);
  assert(explanation.reasons.length > 0, `Generated reasons array for ${t.desc}`);
  assert(explanation.nextSteps.length > 0, `Generated nextSteps array for ${t.desc}`);
}

// ----------------------------------------------------
// TEST 2: Deceptive Link Mismatch Detector
// ----------------------------------------------------
console.log('\n--- TEST GROUP 2: Suspicious Link Detector ---');

const deceptiveLink = analyzeLinkMismatch('https://paypal.com/signin', 'http://attacker-phish.top/login');
assert(deceptiveLink !== null, 'Detected link text vs target URL mismatch');
assert(deceptiveLink?.isMismatch === true, 'Flagged mismatch correctly');
assert(deceptiveLink?.severity === 'CRITICAL', 'Assigned CRITICAL severity to deception');

const honestLink = analyzeLinkMismatch('https://www.paypal.com', 'https://www.paypal.com/myaccount');
assert(honestLink === null, 'Did not falsely flag genuine link on the same domain');

// ----------------------------------------------------
// TEST 3: Scam Message Analyzer
// ----------------------------------------------------
console.log('\n--- TEST GROUP 3: Scam Message Analyzer ---');

const testMessages = [
  {
    text: 'USPS: Your package could not be delivered due to unpaid customs fee of $1.85. Click here: https://usps-pay.xyz',
    expected: 'HIGH_SCAM_RISK',
    desc: 'Postal Parcel Smishing'
  },
  {
    text: 'CHASE ALERT: Did you authorize $945 at Apple Store? Reply with your 6-digit one time password to cancel immediately or your account will be suspended.',
    expected: 'HIGH_SCAM_RISK',
    desc: 'Bank Fraud OTP Harvesting'
  },
  {
    text: 'Geek Squad: Your subscription of $399 has been auto-renewed. Call 1-800-555-0199 for a refund.',
    expected: 'HIGH_SCAM_RISK',
    desc: 'Tech Support Invoice Scam'
  },
  {
    text: 'Hey Sarah, are we still meeting for lunch at 12:30 pm today at the cafe?',
    expected: 'LIKELY_SAFE',
    desc: 'Normal Friendly Conversation'
  }
];

for (const m of testMessages) {
  const result = analyzeScamMessage(m.text);
  assert(result.isValid, `Message parsed: ${m.desc}`);
  assert(
    result.verdict === m.expected,
    `Correct verdict for ${m.desc} (Expected: ${m.expected}, Got: ${result.verdict}, Score: ${result.riskScore})`
  );

  const explanation = generateMessageExplanation(result);
  assert(explanation.badgeText !== undefined, `Generated explanation badge for ${m.desc}`);
}

// ----------------------------------------------------
// TEST 4: Shopping Scam Signals
// ----------------------------------------------------
console.log('\n--- TEST GROUP 4: Shopping Scam Alerts ---');

const scamShopData = {
  url: 'https://discount-luxury-shoes.top',
  title: 'Luxury Shoes Clearance Blowout',
  bodyText: '95% off everything today only! Hurry only 1 left in stock! Western Union and Zelle only for checkout.',
  metaDescription: 'Crazy factory closeout sale'
};

const shopResult = analyzeShoppingSignals(scamShopData);
assert(shopResult.isShoppingSite === true, 'Identified page as shopping storefront');
assert(shopResult.shoppingRiskScore >= 50, `High shopping risk detected (Score: ${shopResult.shoppingRiskScore})`);
assert(shopResult.alerts.length >= 2, `Multiple shopping alerts flagged (${shopResult.alerts.length} flags)`);

// ----------------------------------------------------
// TEST SUMMARY
// ----------------------------------------------------
console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} PASSED`);
if (failedTests === 0) {
  console.log('🎉 ALL TESTS PASSED! ZERO ERRORS OR BUGS FOUND.');
} else {
  console.error(`⚠️ ${failedTests} TESTS FAILED!`);
  process.exit(1);
}
console.log('====================================================\n');
