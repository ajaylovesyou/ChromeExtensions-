/**
 * ScamShield AI - Simple Safety Explanations Generator
 * FEATURE 5: Converts security diagnostics into clear, human-friendly guidance.
 */

export function generateWebsiteExplanation(analysis) {
  if (!analysis || !analysis.isValid) {
    return {
      title: 'Unable to check website',
      badgeClass: 'badge-gray',
      summary: 'Please enter a valid web address.',
      reasons: ['The URL entered does not follow normal web address formats.'],
      nextSteps: ['Check for typos in the address and try again.']
    };
  }

  const { verdict, riskScore, isVerifiedBrand, verifiedBrandName, flags, domain } = analysis;

  // 1. Verified Genuine Brand
  if (isVerifiedBrand && riskScore < 20) {
    return {
      title: `Official & Trusted Website`,
      badgeText: 'VERIFIED SAFE',
      badgeClass: 'badge-green',
      summary: `You are on the genuine official website for ${verifiedBrandName}.`,
      reasons: [
        `This domain (${domain}) matches the official recognized records for ${verifiedBrandName}.`,
        'The website uses modern encrypted security to keep your connection private.'
      ],
      nextSteps: [
        'You can browse, log in, or shop here normally.',
        'Always check that your browser shows the secure padlock icon.'
      ]
    };
  }

  // 2. High Risk / Dangerous Site
  if (verdict === 'DANGER' || riskScore >= 60) {
    const reasons = [];
    const nextSteps = [
      '⛔ DO NOT enter passwords, phone numbers, or credit card information.',
      '❌ Close this tab or browser window immediately.',
      '🔍 If you received this link via email or text, report and delete the message.'
    ];

    for (const flag of flags) {
      if (flag.code === 'BRAND_IMPERSONATION') {
        reasons.push(`This website is pretending to be "${flag.impersonatedBrand}". It is NOT the real company.`);
        nextSteps.push(`To visit the real ${flag.impersonatedBrand}, open a brand new tab and type their official name directly.`);
      } else if (flag.code === 'RAW_IP_ADDRESS') {
        reasons.push('This site is using an anonymous set of numbers (an IP address) instead of a registered company domain name.');
      } else if (flag.code === 'DECEPTIVE_USERINFO') {
        reasons.push('The link uses sneaky symbols (@ sign) to make you think you are visiting one website, while taking you somewhere else.');
      } else if (flag.code === 'PUNYCODE_HOMOGLYPH') {
        reasons.push('The web address uses foreign or lookalike alphabet letters to trick your eyes into seeing a familiar name.');
      } else if (flag.code === 'HIGH_RISK_TLD') {
        reasons.push(`The domain ends in a suspicious extension (.${domain.split('.').pop()}) frequently used by cyber criminals because it is cheap and anonymous.`);
      } else if (flag.code === 'SENSITIVE_PHISHING_PATH') {
        reasons.push('The page asks for urgent account verification, unlocking, or refund claims on an unverified domain.');
      }
    }

    if (reasons.length === 0) {
      reasons.push('Multiple suspicious indicators were triggered that resemble known scam or phishing campaigns.');
    }

    return {
      title: 'Danger: Probable Scam or Phishing Site',
      badgeText: 'HIGH RISK',
      badgeClass: 'badge-red',
      summary: 'Our safety engine detected serious warning signs. This page is very likely trying to steal your account or money.',
      reasons,
      nextSteps
    };
  }

  // 3. Medium Risk / Caution Site
  if (verdict === 'CAUTION' || riskScore >= 25) {
    const reasons = flags.map(f => f.message);
    if (reasons.length === 0) {
      reasons.push('This site has characteristics uncommon for established, trusted businesses.');
    }

    return {
      title: 'Caution: Unverified or Suspicious Website',
      badgeText: 'PROCEED WITH CAUTION',
      badgeClass: 'badge-yellow',
      summary: 'This website is not on any trusted list and has minor red flags. Double-check before sharing sensitive info.',
      reasons,
      nextSteps: [
        '⚠️ Never pay using wire transfers, gift cards, or crypto.',
        '🔒 Check if the website has legitimate contact information (real phone number, physical address).',
        '💡 Search for user reviews on independent websites like Trustpilot or Google before buying.'
      ]
    };
  }

  // 4. Low Risk / Normal Site
  return {
    title: 'Standard Website (No Major Red Flags)',
    badgeText: 'NO THREATS FOUND',
    badgeClass: 'badge-green',
    summary: 'No known phishing patterns or deceptive domain tricks were detected for this address.',
    reasons: [
      'The web address appears standard without deceptive lookalike characters or high-risk extensions.',
      'No known malicious keywords or redirect traps were found.'
    ],
    nextSteps: [
      'Always practice safe browsing habits.',
      'Check that the connection is secure (HTTPS) before entering private credentials.'
    ]
  };
}

export function generateMessageExplanation(analysis) {
  if (!analysis || !analysis.isValid) {
    return {
      title: 'Enter message to analyze',
      badgeClass: 'badge-gray',
      summary: 'Paste any suspicious email, text message, or chat to get a safety breakdown.',
      reasons: [],
      nextSteps: []
    };
  }

  const { verdict, riskScore, triggers, foundLinks } = analysis;

  if (verdict === 'HIGH_SCAM_RISK' || riskScore >= 60) {
    const reasons = triggers.map(t => t.text);
    if (foundLinks && foundLinks.length > 0) {
      reasons.push(`Contains ${foundLinks.length} embedded web link(s) leading to unverified or suspicious destinations.`);
    }

    return {
      title: 'High Scam Probability',
      badgeText: 'SCAM DETECTED',
      badgeClass: 'badge-red',
      summary: 'This message matches classic fraudulent tactics designed to induce panic, greed, or urgency.',
      reasons: reasons.length ? reasons : ['Multiple high-risk scam triggers were detected.'],
      nextSteps: [
        '🚫 Do NOT reply to this message.',
        '🛑 Do NOT click any links or call any phone numbers listed inside the message.',
        '📵 Block the sender on your phone or email client.',
        '🏦 If it claimed to be your bank, open your banking app directly or call the number on the back of your physical card.'
      ]
    };
  }

  if (verdict === 'SUSPICIOUS' || riskScore >= 25) {
    return {
      title: 'Potentially Suspicious Message',
      badgeText: 'SUSPICIOUS',
      badgeClass: 'badge-yellow',
      summary: 'This message uses patterns that scam artists commonly rely on, such as artificial urgency or vague requests.',
      reasons: triggers.map(t => t.text),
      nextSteps: [
        '⚠️ Contact the person or company through a known, trusted method to verify their identity.',
        '❌ Never share verification codes (OTPs) or two-factor codes with anyone—even if they claim to work for the company.'
      ]
    };
  }

  return {
    title: 'Low Risk Detected',
    badgeText: 'LIKELY SAFE',
    badgeClass: 'badge-green',
    summary: 'No obvious urgency triggers, credential requests, or known scam templates were found.',
    reasons: ['The message does not ask for money, secret codes, or urgent payments.'],
    nextSteps: [
      'Stay alert: scammers sometimes build trust through multiple messages before asking for money.'
    ]
  };
}
