/**
 * ScamShield AI - Popup Controller
 */

import { analyzeUrlSafety, analyzeScamMessage, analyzeShoppingSignals } from '../lib/heuristics.js';
import { generateWebsiteExplanation, generateMessageExplanation } from '../lib/simple-explainer.js';
import {
  getSettings,
  saveSettings,
  getScanHistory,
  addScanHistoryItem,
  clearScanHistory,
  addToWhitelist
} from '../lib/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await initSettings();
  await loadCurrentSiteCheck();
  initLinkInspector();
  initMessageAnalyzer();
  initShoppingTab();
  await renderHistory();
});

// 1. Navigation Tabs
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetId)?.classList.add('active');
    });
  });
}

// 2. Settings & Main Protection Toggle
async function initSettings() {
  const settings = await getSettings();
  const toggleProtection = document.getElementById('toggle-protection');
  const toggleLabel = document.getElementById('toggle-label');
  const settingLinkInspect = document.getElementById('setting-link-inspect');
  const settingShoppingAlerts = document.getElementById('setting-shopping-alerts');
  const settingBackendApi = document.getElementById('setting-backend-api');
  const backendUrlGroup = document.getElementById('backend-url-group');
  const backendUrlInput = document.getElementById('setting-backend-url');

  toggleProtection.checked = settings.protectionActive;
  toggleLabel.textContent = settings.protectionActive ? 'Active' : 'Paused';
  toggleLabel.style.color = settings.protectionActive ? '#38bdf8' : '#94a3b8';

  settingLinkInspect.checked = settings.linkInspectionEnabled;
  settingShoppingAlerts.checked = settings.shoppingAlertsEnabled;
  settingBackendApi.checked = settings.backendApiEnabled;
  backendUrlInput.value = settings.backendApiUrl || '';

  if (settings.backendApiEnabled) {
    backendUrlGroup.classList.remove('hidden');
  }

  toggleProtection.addEventListener('change', async () => {
    settings.protectionActive = toggleProtection.checked;
    toggleLabel.textContent = settings.protectionActive ? 'Active' : 'Paused';
    toggleLabel.style.color = settings.protectionActive ? '#38bdf8' : '#94a3b8';
    await saveSettings(settings);
  });

  settingLinkInspect.addEventListener('change', async () => {
    settings.linkInspectionEnabled = settingLinkInspect.checked;
    await saveSettings(settings);
  });

  settingShoppingAlerts.addEventListener('change', async () => {
    settings.shoppingAlertsEnabled = settingShoppingAlerts.checked;
    await saveSettings(settings);
  });

  settingBackendApi.addEventListener('change', async () => {
    settings.backendApiEnabled = settingBackendApi.checked;
    if (settingBackendApi.checked) {
      backendUrlGroup.classList.remove('hidden');
    } else {
      backendUrlGroup.classList.add('hidden');
    }
    await saveSettings(settings);
  });

  document.getElementById('btn-save-backend')?.addEventListener('click', async () => {
    settings.backendApiUrl = backendUrlInput.value.trim();
    await saveSettings(settings);
    alert('Backend API settings updated.');
  });

  document.getElementById('btn-clear-history')?.addEventListener('click', async () => {
    await clearScanHistory();
    await renderHistory();
  });
}

// 3. Tab 1: Current Website Safety Checker
let currentTabDomain = '';

async function loadCurrentSiteCheck() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith('http')) {
    document.getElementById('site-domain').textContent = 'System or Local Page';
    document.getElementById('site-protocol').textContent = 'No web page loaded';
    document.getElementById('site-risk-badge').textContent = 'LOCAL';
    document.getElementById('site-risk-badge').className = 'risk-badge-pill badge-gray';
    document.getElementById('site-summary').textContent = 'ScamShield is active. Open any website to view live protection details.';
    return;
  }

  const analysis = analyzeUrlSafety(tab.url);
  const explanation = generateWebsiteExplanation(analysis);
  currentTabDomain = analysis.hostname;

  // Render UI
  const domainEl = document.getElementById('site-domain');
  const protocolEl = document.getElementById('site-protocol');
  const badgeEl = document.getElementById('site-risk-badge');
  const scoreFillEl = document.getElementById('site-score-fill');
  const scoreValEl = document.getElementById('site-score-value');
  const summaryEl = document.getElementById('site-summary');
  const reasonsList = document.getElementById('site-reasons-list');
  const stepsList = document.getElementById('site-steps-list');

  domainEl.textContent = analysis.hostname;
  protocolEl.textContent = `${analysis.protocol.toUpperCase()} • ${analysis.isVerifiedBrand ? 'Official Brand' : 'Standard Web'}`;
  badgeEl.textContent = explanation.badgeText;
  badgeEl.className = `risk-badge-pill ${explanation.badgeClass}`;

  // Trust score: 100 - riskScore
  const trustScore = 100 - analysis.riskScore;
  scoreValEl.textContent = `${trustScore}/100`;
  scoreFillEl.style.width = `${trustScore}%`;

  if (trustScore >= 75) {
    scoreFillEl.style.backgroundColor = '#10b981'; // Green
  } else if (trustScore >= 45) {
    scoreFillEl.style.backgroundColor = '#f59e0b'; // Yellow
  } else {
    scoreFillEl.style.backgroundColor = '#ef4444'; // Red
  }

  summaryEl.textContent = explanation.summary;

  // Reasons
  reasonsList.innerHTML = (explanation.reasons || [])
    .map(r => `<li>${r}</li>`)
    .join('');

  // Steps
  stepsList.innerHTML = (explanation.nextSteps || [])
    .map(s => `<li>${s}</li>`)
    .join('');

  // Record history
  await addScanHistoryItem({
    type: 'SITE_SCAN',
    target: analysis.hostname,
    verdict: analysis.verdict,
    riskScore: analysis.riskScore,
    summary: explanation.summary
  });

  // Whitelist button
  document.getElementById('btn-whitelist-site')?.addEventListener('click', async () => {
    if (currentTabDomain) {
      await addToWhitelist(currentTabDomain);
      alert(`"${currentTabDomain}" has been added to your Trusted Domains.`);
      await loadCurrentSiteCheck();
    }
  });

  document.getElementById('btn-rescan-site')?.addEventListener('click', async () => {
    await loadCurrentSiteCheck();
  });
}

// 4. Tab 2: Check Link (URL Inspector)
function initLinkInspector() {
  const inputUrl = document.getElementById('input-inspect-url');
  const btnInspect = document.getElementById('btn-inspect-url');
  const resultCard = document.getElementById('link-result-card');

  async function performInspection(url) {
    if (!url) return;
    const analysis = analyzeUrlSafety(url);
    const explanation = generateWebsiteExplanation(analysis);

    resultCard.classList.remove('hidden');
    document.getElementById('link-result-domain').textContent = analysis.domain || analysis.hostname || url;
    const badge = document.getElementById('link-result-badge');
    badge.textContent = explanation.badgeText;
    badge.className = `risk-badge-pill ${explanation.badgeClass}`;

    document.getElementById('link-result-summary').textContent = explanation.summary;

    document.getElementById('link-result-reasons').innerHTML = (explanation.reasons || [])
      .map(r => `<li>${r}</li>`)
      .join('');

    document.getElementById('link-result-steps').innerHTML = (explanation.nextSteps || [])
      .map(s => `<li>${s}</li>`)
      .join('');

    await addScanHistoryItem({
      type: 'LINK_INSPECT',
      target: url,
      verdict: analysis.verdict,
      riskScore: analysis.riskScore,
      summary: explanation.summary
    });

    await renderHistory();
  }

  btnInspect.addEventListener('click', () => {
    performInspection(inputUrl.value.trim());
  });

  inputUrl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performInspection(inputUrl.value.trim());
  });

  // Sample chips
  document.querySelectorAll('#tab-link .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sample = chip.getAttribute('data-sample-url');
      inputUrl.value = sample;
      performInspection(sample);
    });
  });
}

// 5. Tab 3: Message Analyzer
function initMessageAnalyzer() {
  const textInput = document.getElementById('input-message-text');
  const btnAnalyze = document.getElementById('btn-analyze-message');
  const btnClear = document.getElementById('btn-clear-message');
  const resultCard = document.getElementById('message-result-card');

  async function performMessageAnalysis(text) {
    if (!text) return;
    const analysis = analyzeScamMessage(text);
    const explanation = generateMessageExplanation(analysis);

    resultCard.classList.remove('hidden');
    const badge = document.getElementById('message-result-badge');
    badge.textContent = explanation.badgeText;
    badge.className = `risk-badge-pill ${explanation.badgeClass}`;

    document.getElementById('message-result-title').textContent = explanation.title;
    document.getElementById('message-result-summary').textContent = explanation.summary;

    document.getElementById('message-result-triggers').innerHTML = (explanation.reasons || [])
      .map(t => `<li>${t}</li>`)
      .join('');

    document.getElementById('message-result-steps').innerHTML = (explanation.nextSteps || [])
      .map(s => `<li>${s}</li>`)
      .join('');

    await addScanHistoryItem({
      type: 'MESSAGE_SCAN',
      target: text.substring(0, 45) + '...',
      verdict: analysis.verdict,
      riskScore: analysis.riskScore,
      summary: explanation.summary
    });

    await renderHistory();
  }

  btnAnalyze.addEventListener('click', () => {
    performMessageAnalysis(textInput.value.trim());
  });

  btnClear.addEventListener('click', () => {
    textInput.value = '';
    resultCard.classList.add('hidden');
  });

  // Sample chips
  document.querySelectorAll('#tab-message .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const sample = chip.getAttribute('data-sample-msg');
      textInput.value = sample;
      performMessageAnalysis(sample);
    });
  });
}

// 6. Tab 4: Shopping Safety Investigator
async function initShoppingTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const statusIcon = document.getElementById('shop-status-icon');
  const statusTitle = document.getElementById('shop-status-title');
  const statusSub = document.getElementById('shop-status-sub');
  const alertsList = document.getElementById('shop-alerts-list');

  if (!tab?.id || !tab.url?.startsWith('http')) {
    statusTitle.textContent = 'No Storefront Detected';
    statusSub.textContent = 'Browse to any online store to see credibility audits.';
    return;
  }

  // Ask content script for page data
  chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_PAGE_DATA' }, (response) => {
    if (chrome.runtime.lastError || !response?.pageData) {
      statusTitle.textContent = 'Storefront Scanner Ready';
      statusSub.textContent = 'Looking for e-commerce checkouts and price structures.';
      return;
    }

    const pageData = response.pageData;
    const shoppingAnalysis = analyzeShoppingSignals(pageData);

    if (shoppingAnalysis.isShoppingSite) {
      if (shoppingAnalysis.shoppingRiskScore >= 50) {
        statusIcon.textContent = '🚨';
        statusTitle.textContent = 'High Shopping Risk Detected!';
        statusSub.textContent = 'This storefront has red flags common in deceptive online outlets.';
      } else if (shoppingAnalysis.shoppingRiskScore >= 20) {
        statusIcon.textContent = '⚠️';
        statusTitle.textContent = 'Exercise Caution While Shopping';
        statusSub.textContent = 'Some aggressive urgency or discount signals were flagged.';
      } else {
        statusIcon.textContent = '✅';
        statusTitle.textContent = 'Standard Storefront Found';
        statusSub.textContent = 'No obvious fake urgency timers or impossible discount patterns found.';
      }

      if (shoppingAnalysis.alerts.length > 0) {
        alertsList.innerHTML = shoppingAnalysis.alerts
          .map(a => `<li><strong>[${a.severity}]</strong> ${a.message}</li>`)
          .join('');
      } else {
        alertsList.innerHTML = '<li>✓ No deceptive countdown timers detected.</li><li>✓ No extreme 90% liquidation claims detected.</li>';
      }
    } else {
      statusTitle.textContent = 'Not an E-Commerce Page';
      statusSub.textContent = 'This page does not appear to be an active shopping storefront.';
      alertsList.innerHTML = '<li>Open an online store to run active fraud checks.</li>';
    }
  });
}

// 7. Render History List
async function renderHistory() {
  const history = await getScanHistory();
  const container = document.getElementById('history-container');

  if (!history || history.length === 0) {
    container.innerHTML = '<div class="empty-state">No recent scans recorded yet.</div>';
    return;
  }

  container.innerHTML = history.slice(0, 10).map(item => {
    let badgeClass = 'badge-green';
    if (item.verdict === 'DANGER' || item.verdict === 'HIGH_SCAM_RISK') badgeClass = 'badge-red';
    else if (item.verdict === 'CAUTION' || item.verdict === 'SUSPICIOUS') badgeClass = 'badge-yellow';

    const date = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `
      <div class="history-item">
        <div>
          <strong>${escapeHtml(item.target || item.type)}</strong>
          <div style="color: #64748b; font-size: 10px;">${date} • ${item.type}</div>
        </div>
        <span class="risk-badge-pill ${badgeClass}" style="font-size: 9px; padding: 2px 6px;">${item.verdict}</span>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}
