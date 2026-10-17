/**
 * AdBlock Pro - Background Service Worker
 * Manages Declarative Net Request rules, statistics, whitelist rules, and badge indicators.
 */

// Fallback in-memory map for tab stats
const memoryTabStats = new Map();

// Helper to access session storage with memory fallback
function getTabBlockedCount(tabId, callback) {
  if (!tabId || tabId < 0) {
    callback(0);
    return;
  }
  if (chrome.storage && chrome.storage.session) {
    const key = `tab_stats_${tabId}`;
    chrome.storage.session.get([key], (res) => {
      if (chrome.runtime.lastError || !res) {
        callback(memoryTabStats.get(tabId) || 0);
      } else {
        callback(res[key] !== undefined ? res[key] : (memoryTabStats.get(tabId) || 0));
      }
    });
  } else {
    callback(memoryTabStats.get(tabId) || 0);
  }
}

function setTabBlockedCount(tabId, count) {
  if (!tabId || tabId < 0) return;
  memoryTabStats.set(tabId, count);
  if (chrome.storage && chrome.storage.session) {
    const key = `tab_stats_${tabId}`;
    chrome.storage.session.set({ [key]: count }, () => {
      if (chrome.runtime.lastError) {
        // Ignore session storage errors
      }
    });
  }
}

function clearTabBlockedCount(tabId) {
  if (!tabId || tabId < 0) return;
  memoryTabStats.delete(tabId);
  if (chrome.storage && chrome.storage.session) {
    chrome.storage.session.remove(`tab_stats_${tabId}`, () => {
      if (chrome.runtime.lastError) {
        // Ignore session storage errors
      }
    });
  }
}

// Synchronize ruleset and dynamic whitelist rules
function syncRulesetState() {
  chrome.storage.local.get(['adblock_enabled', 'whitelisted_domains', 'total_blocked_all_time'], (res) => {
    const isEnabled = res.adblock_enabled !== false;
    const whitelist = Array.isArray(res.whitelisted_domains) ? res.whitelisted_domains : [];

    // Ensure initial storage defaults
    const updates = {};
    if (res.adblock_enabled === undefined) updates.adblock_enabled = true;
    if (!res.whitelisted_domains) updates.whitelisted_domains = [];
    if (res.total_blocked_all_time === undefined) updates.total_blocked_all_time = 0;
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }

    // Safely enable/disable static ruleset
    if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.getEnabledRulesets) {
      chrome.declarativeNetRequest.getEnabledRulesets((enabledRulesets) => {
        const rulesetActive = enabledRulesets && enabledRulesets.includes('ruleset_1');
        if (isEnabled && !rulesetActive) {
          chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['ruleset_1'] });
        } else if (!isEnabled && rulesetActive) {
          chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] });
        }
      });
    }

    // Synchronize dynamic DNR whitelist rules
    syncWhitelistRules(whitelist);
  });
}

// Initialize extension defaults on install and browser startup
chrome.runtime.onInstalled.addListener(() => {
  syncRulesetState();
  if (chrome.action && chrome.action.setBadgeBackgroundColor) {
    chrome.action.setBadgeBackgroundColor({ color: '#4f46e5' }, () => {
      if (chrome.runtime.lastError) {}
    });
  }
});

chrome.runtime.onStartup.addListener(() => {
  syncRulesetState();
});

// Update badge for a specific tab safely
function updateBadge(tabId, count) {
  if (!tabId || tabId < 0 || !chrome.action) return;

  chrome.storage.local.get(['adblock_enabled'], (res) => {
    if (res.adblock_enabled === false) {
      chrome.action.setBadgeText({ text: 'OFF', tabId }, () => {
        if (chrome.runtime.lastError) {}
      });
      chrome.action.setBadgeBackgroundColor({ color: '#94a3b8', tabId }, () => {
        if (chrome.runtime.lastError) {}
      });
      return;
    }

    if (count > 0) {
      const text = count > 999 ? `${Math.floor(count / 1000)}k` : count.toString();
      chrome.action.setBadgeText({ text, tabId }, () => {
        if (chrome.runtime.lastError) {}
      });
      chrome.action.setBadgeBackgroundColor({ color: '#4f46e5', tabId }, () => {
        if (chrome.runtime.lastError) {}
      });
    } else {
      chrome.action.setBadgeText({ text: '', tabId }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  });
}

// Listen to declarativeNetRequest blocked events (developer / unpacked extensions)
if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    // Only count actual blocked rules from the blocking ruleset, not allow rules
    if (info.rule && info.rule.rulesetId === 'ruleset_1') {
      const tabId = info.request.tabId;
      if (tabId && tabId > 0) {
        getTabBlockedCount(tabId, (current) => {
          const updated = current + 1;
          setTabBlockedCount(tabId, updated);
          updateBadge(tabId, updated);
        });
        incrementTotalBlocked(1);
      }
    }
  });
}

// Increment all-time blocked counter
function incrementTotalBlocked(amount = 1) {
  chrome.storage.local.get(['total_blocked_all_time'], (res) => {
    const current = (res.total_blocked_all_time || 0) + amount;
    chrome.storage.local.set({ total_blocked_all_time: current });
  });
}

// Reset tab stats on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    setTabBlockedCount(tabId, 0);
    updateBadge(tabId, 0);
  }
});

// Clean up tab stats when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabBlockedCount(tabId);
});

// Message listener from popup and content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  if (msg.type === 'ADS_BLOCKED_REPORT') {
    const count = typeof msg.count === 'number' && msg.count > 0 ? msg.count : 1;
    if (tabId) {
      getTabBlockedCount(tabId, (current) => {
        const updated = current + count;
        setTabBlockedCount(tabId, updated);
        updateBadge(tabId, updated);
      });
    }
    incrementTotalBlocked(count);
    sendResponse({ success: true });
    return false; // Synchronous response: do NOT return true
  }

  if (msg.type === 'GET_POPUP_DATA') {
    const activeTabId = msg.tabId;
    chrome.storage.local.get(['adblock_enabled', 'whitelisted_domains', 'total_blocked_all_time'], (res) => {
      getTabBlockedCount(activeTabId, (tabBlocked) => {
        sendResponse({
          enabled: res.adblock_enabled !== false,
          whitelist: Array.isArray(res.whitelisted_domains) ? res.whitelisted_domains : [],
          totalAllTime: res.total_blocked_all_time || 0,
          tabBlocked: tabBlocked || 0
        });
      });
    });
    return true; // Keep sendResponse open for async response
  }

  if (msg.type === 'TOGGLE_GLOBAL') {
    const newState = Boolean(msg.enabled);
    chrome.storage.local.set({ adblock_enabled: newState }, () => {
      // Safely toggle DNR static ruleset
      if (chrome.declarativeNetRequest && chrome.declarativeNetRequest.getEnabledRulesets) {
        chrome.declarativeNetRequest.getEnabledRulesets((enabled) => {
          const isRulesetEnabled = enabled && enabled.includes('ruleset_1');
          if (newState && !isRulesetEnabled) {
            chrome.declarativeNetRequest.updateEnabledRulesets({ enableRulesetIds: ['ruleset_1'] });
          } else if (!newState && isRulesetEnabled) {
            chrome.declarativeNetRequest.updateEnabledRulesets({ disableRulesetIds: ['ruleset_1'] });
          }
        });
      }

      // Update badge across open tabs
      chrome.tabs.query({}, (tabs) => {
        if (!tabs) return;
        tabs.forEach((tab) => {
          if (tab && tab.id) {
            getTabBlockedCount(tab.id, (count) => {
              updateBadge(tab.id, count);
            });
          }
        });
      });

      sendResponse({ success: true, enabled: newState });
    });
    return true;
  }

  if (msg.type === 'TOGGLE_WHITELIST_HOST') {
    const rawHost = (msg.host || '').trim().toLowerCase();
    if (!rawHost) {
      sendResponse({ success: false, error: 'Empty host' });
      return false;
    }

    const host = cleanDomain(rawHost);
    const action = msg.action || 'toggle'; // 'add', 'remove', 'toggle'

    chrome.storage.local.get(['whitelisted_domains'], (res) => {
      let list = Array.isArray(res.whitelisted_domains) ? [...res.whitelisted_domains] : [];
      const isAlreadyWhitelisted = list.includes(host);

      if (action === 'add') {
        if (!isAlreadyWhitelisted) list.push(host);
      } else if (action === 'remove') {
        list = list.filter((h) => h !== host);
      } else {
        // Toggle
        if (isAlreadyWhitelisted) {
          list = list.filter((h) => h !== host);
        } else {
          list.push(host);
        }
      }

      const finalIsWhitelisted = list.includes(host);

      chrome.storage.local.set({ whitelisted_domains: list }, () => {
        syncWhitelistRules(list);
        sendResponse({
          success: true,
          isWhitelisted: finalIsWhitelisted,
          whitelist: list
        });
      });
    });
    return true;
  }
});

// Helper to clean URL/domain strings
function cleanDomain(input) {
  let str = input.trim().toLowerCase();
  try {
    if (str.includes('://')) {
      str = new URL(str).hostname;
    } else if (str.includes('/')) {
      str = str.split('/')[0];
    }
  } catch (e) {}
  return str.replace(/^www\./, '');
}

// Synchronize all dynamic whitelist rules with DeclarativeNetRequest
function syncWhitelistRules(domainList) {
  if (!chrome.declarativeNetRequest || !chrome.declarativeNetRequest.getDynamicRules) {
    return;
  }

  chrome.declarativeNetRequest.getDynamicRules((existingRules) => {
    const removeRuleIds = (existingRules || []).map((r) => r.id);
    const addRules = [];

    const domains = Array.from(new Set(
      domainList.map(cleanDomain).filter(Boolean)
    ));

    domains.forEach((dom, index) => {
      const baseId = 10000 + (index * 3);
      const rootDomain = dom.replace(/^www\./, '');
      const domainVariants = Array.from(new Set([rootDomain, `www.${rootDomain}`]));

      // 1. allowAllRequests rule: allows all subsequent requests generated by this frame
      // resourceTypes can ONLY contain 'main_frame' and/or 'sub_frame' for allowAllRequests
      addRules.push({
        id: baseId,
        priority: 100,
        action: { type: 'allowAllRequests' },
        condition: {
          requestDomains: domainVariants,
          resourceTypes: ['main_frame', 'sub_frame']
        }
      });

      // 2. allow rule: explicitly allows all requests initiated by this domain
      addRules.push({
        id: baseId + 1,
        priority: 100,
        action: { type: 'allow' },
        condition: {
          initiatorDomains: domainVariants
        }
      });

      // 3. allow rule: explicitly allows direct requests to the domain
      addRules.push({
        id: baseId + 2,
        priority: 100,
        action: { type: 'allow' },
        condition: {
          requestDomains: domainVariants
        }
      });
    });

    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules
    }, () => {
      if (chrome.runtime.lastError) {
        console.warn('[AdBlock Pro] Error synchronizing dynamic rules:', chrome.runtime.lastError);
      }
    });
  });
}
