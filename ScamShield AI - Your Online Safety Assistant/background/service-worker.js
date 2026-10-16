/**
 * ScamShield AI - Background Service Worker (Manifest V3)
 */

import { analyzeUrlSafety, analyzeScamMessage, analyzeLinkMismatch } from '../lib/heuristics.js';
import { generateWebsiteExplanation, generateMessageExplanation } from '../lib/simple-explainer.js';
import { getSettings, addScanHistoryItem, getWhitelist } from '../lib/storage.js';

// Setup Context Menus on Install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'scamshield_scan_link',
    title: '🛡️ Scan link with ScamShield AI',
    contexts: ['link']
  });

  chrome.contextMenus.create({
    id: 'scamshield_scan_text',
    title: '🔍 Check text for scam red flags',
    contexts: ['selection']
  });

  console.log('ScamShield AI successfully installed & initialized.');
});

// Context Menu Click Handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'scamshield_scan_link' && info.linkUrl) {
    const analysis = analyzeUrlSafety(info.linkUrl);
    const explanation = generateWebsiteExplanation(analysis);

    // Record in history
    await addScanHistoryItem({
      type: 'LINK_SCAN',
      target: info.linkUrl,
      verdict: analysis.verdict,
      riskScore: analysis.riskScore,
      summary: explanation.summary
    });

    // Notify content script in the current tab to display a floating safety card
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'SHOW_SAFETY_CARD',
        data: {
          title: 'Link Safety Check',
          url: info.linkUrl,
          analysis,
          explanation
        }
      }).catch(() => {
        // Tab might be restricted (e.g., chrome://)
      });
    }
  } else if (info.menuItemId === 'scamshield_scan_text' && info.selectionText) {
    const analysis = analyzeScamMessage(info.selectionText);
    const explanation = generateMessageExplanation(analysis);

    await addScanHistoryItem({
      type: 'TEXT_SCAN',
      target: info.selectionText.substring(0, 60) + '...',
      verdict: analysis.verdict,
      riskScore: analysis.riskScore,
      summary: explanation.summary
    });

    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'SHOW_SAFETY_CARD',
        data: {
          title: 'Scam Message Analysis',
          text: info.selectionText,
          analysis,
          explanation
        }
      }).catch(() => {});
    }
  }
});

// Update Badge on Tab Change
async function updateTabBadge(tabId, url) {
  if (!url || !url.startsWith('http')) {
    chrome.action.setBadgeText({ tabId, text: '' });
    return;
  }

  const settings = await getSettings();
  if (!settings.protectionActive) {
    chrome.action.setBadgeText({ tabId, text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#6b7280' });
    return;
  }

  const whitelist = await getWhitelist();
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (whitelist.includes(hostname)) {
      chrome.action.setBadgeText({ tabId, text: 'OK' });
      chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' });
      return;
    }
  } catch (e) {}

  const analysis = analyzeUrlSafety(url);
  if (analysis.verdict === 'DANGER') {
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#ef4444' });
  } else if (analysis.verdict === 'CAUTION') {
    chrome.action.setBadgeText({ tabId, text: '▲' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#f59e0b' });
  } else {
    chrome.action.setBadgeText({ tabId, text: '✓' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#10b981' });
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateTabBadge(tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
  if (tab?.url) {
    updateTabBadge(activeInfo.tabId, tab.url);
  }
});

// Message Bus for Content Script and Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ANALYZE_URL') {
    const analysis = analyzeUrlSafety(request.url);
    const explanation = generateWebsiteExplanation(analysis);
    sendResponse({ analysis, explanation });
    return true;
  }

  if (request.action === 'ANALYZE_MESSAGE') {
    const analysis = analyzeScamMessage(request.text);
    const explanation = generateMessageExplanation(analysis);
    sendResponse({ analysis, explanation });
    return true;
  }

  if (request.action === 'CHECK_LINK_MISMATCH') {
    const mismatch = analyzeLinkMismatch(request.text, request.href);
    sendResponse({ mismatch });
    return true;
  }
});
