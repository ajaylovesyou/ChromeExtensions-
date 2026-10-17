/**
 * Grammarly - AI Writing Assistant
 * Background Service Worker (Manifest V3)
 */

// Initialize default settings and context menus on install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Grammarly AI Writing Assistant installed/updated:', details.reason);

  const defaultSettings = {
    enableExtension: true,
    enableGrammar: true,
    enableSpelling: true,
    enableClarity: true,
    enableTone: true,
    showFloatingWidget: true,
    customDictionary: ["Grammarly", "Google", "GitHub", "API", "AI", "OAuth", "DevOps", "JSON", "JavaScript", "TypeScript"],
    targetAudience: "general",
    targetTone: "professional",
    aiProvider: "offline",
    apiModel: "gpt-4o-mini",
    apiKey: "",
    disabledDomains: []
  };

  const stored = await chrome.storage.sync.get(Object.keys(defaultSettings));
  const toSet = {};
  for (const [k, v] of Object.entries(defaultSettings)) {
    if (stored[k] === undefined) {
      toSet[k] = v;
    }
  }

  if (Object.keys(toSet).length > 0) {
    await chrome.storage.sync.set(toSet);
  }

  // Set up context menus
  setupContextMenus();
});

// Ensure context menus exist on startup as well
chrome.runtime.onStartup.addListener(() => {
  setupContextMenus();
});

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      // Ignored
    }

    const items = [
      { id: 'grammarly_parent', title: 'Grammarly AI Assistant', contexts: ['selection'] },
      { parentId: 'grammarly_parent', id: 'grammarly_fix_all', title: '✨ Fix Grammar & Spelling', contexts: ['selection'] },
      { parentId: 'grammarly_parent', id: 'grammarly_professional', title: '💼 Rewrite as Professional', contexts: ['selection'] },
      { parentId: 'grammarly_parent', id: 'grammarly_friendly', title: '🤝 Rewrite as Friendly', contexts: ['selection'] },
      { parentId: 'grammarly_parent', id: 'grammarly_confident', title: '⚡ Rewrite as Confident', contexts: ['selection'] },
      { parentId: 'grammarly_parent', id: 'grammarly_concise', title: '✂️ Make Concise & Direct', contexts: ['selection'] },
      { parentId: 'grammarly_parent', id: 'grammarly_summarize', title: '📝 Summarize Selection', contexts: ['selection'] }
    ];

    items.forEach(item => {
      chrome.contextMenus.create(item, () => {
        if (chrome.runtime.lastError) {
          // Suppress duplicate id or registration errors
        }
      });
    });
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  const modeMap = {
    'grammarly_fix_all': 'fix_all',
    'grammarly_professional': 'tone_professional',
    'grammarly_friendly': 'tone_friendly',
    'grammarly_confident': 'tone_confident',
    'grammarly_concise': 'tone_concise',
    'grammarly_summarize': 'summarize'
  };

  const mode = modeMap[info.menuItemId];
  if (mode && info.selectionText) {
    try {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'EXECUTE_SELECTION_TRANSFORMATION',
        mode: mode,
        selectedText: info.selectionText
      });
    } catch (err) {
      console.warn('Could not communicate with tab:', err);
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'UPDATE_BADGE') {
    const tabId = sender.tab ? sender.tab.id : null;
    if (tabId) {
      const count = request.count || 0;
      if (count > 0) {
        chrome.action.setBadgeText({ text: count.toString(), tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#EF4444', tabId });
      } else {
        chrome.action.setBadgeText({ text: '✓', tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#10B981', tabId });
      }
    }
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }
});
