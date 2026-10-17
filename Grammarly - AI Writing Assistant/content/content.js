/**
 * Grammarly - AI Writing Assistant
 * In-Page Content Script (Floating Assistant, Real-time Analysis, Safe Injection)
 */

(function () {
  'use strict';

  // State
  let activeElement = null;
  let floatingBadge = null;
  let assistantCard = null;
  let selectionPopover = null;
  let debounceTimer = null;
  let lastAnalysis = null;
  let userSettings = {
    enableExtension: true,
    showFloatingWidget: true,
    enableGrammar: true,
    enableSpelling: true,
    enableClarity: true,
    enableTone: true,
    disabledDomains: []
  };

  // Load settings
  async function initSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      const stored = await chrome.storage.sync.get([
        'enableExtension',
        'showFloatingWidget',
        'enableGrammar',
        'enableSpelling',
        'enableClarity',
        'enableTone',
        'disabledDomains'
      ]);
      userSettings = { ...userSettings, ...stored };
    }
    if (typeof SpellChecker !== 'undefined' && SpellChecker.loadPersonalDictionary) {
      await SpellChecker.loadPersonalDictionary();
    }
  }

  // Check if current domain is disabled
  function isCurrentDomainDisabled() {
    if (!userSettings.enableExtension) return true;
    const currentHost = window.location.hostname;
    return (userSettings.disabledDomains || []).some(domain => domain && currentHost.includes(domain));
  }

  // Check if element is an editable target
  function isEditable(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.getAttribute('type') || 'text').toLowerCase();
      return ['text', 'search', 'email'].includes(type);
    }
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      return true;
    }
    return false;
  }

  // Extract text from active element
  function getElementText(el) {
    if (!el) return '';
    if (el.isContentEditable) {
      return el.innerText || el.textContent || '';
    }
    return el.value || '';
  }

  // Set text safely back into element with framework event dispatch
  function setElementText(el, newText) {
    if (!el) return;
    if (el.isContentEditable) {
      el.focus();
      // Use execCommand for undo history support if possible
      if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        document.execCommand('selectAll', false, null);
        document.execCommand('insertText', false, newText);
      } else {
        el.innerText = newText;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // For textarea / input (supports React / Angular state setters)
      const proto = Object.getPrototypeOf(el);
      const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (nativeSetter) {
        nativeSetter.call(el, newText);
      } else {
        el.value = newText;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Position floating badge at bottom-right of editable element
  function positionBadge(el) {
    if (!floatingBadge || !el) return;
    const rect = el.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Anchor at bottom right inside or adjacent to field
    const top = scrollY + rect.bottom - 42;
    const left = scrollX + rect.right - 42;

    floatingBadge.style.top = `${Math.max(10, top)}px`;
    floatingBadge.style.left = `${Math.max(10, left)}px`;
    floatingBadge.style.display = 'flex';
  }

  // Create floating badge DOM
  function createFloatingBadge() {
    if (floatingBadge) return;

    floatingBadge = document.createElement('div');
    floatingBadge.id = 'grammarly-ai-floating-badge';
    floatingBadge.style.display = 'none';
    floatingBadge.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.88-11.71L10 14.17l-1.88-1.88a.996.996 0 1 0-1.41 1.41l2.59 2.59c.39.39 1.02.39 1.41 0L17.3 9.7a.996.996 0 0 0 0-1.41c-.39-.39-1.03-.39-1.42 0z"/>
      </svg>
      <div id="grammarly-ai-badge-count">✓</div>
    `;

    floatingBadge.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleAssistantCard();
    });

    document.body.appendChild(floatingBadge);
  }

  // Update badge UI with analysis results
  function updateBadgeUI(analysis) {
    if (!floatingBadge) return;
    const countEl = floatingBadge.querySelector('#grammarly-ai-badge-count');
    const issuesCount = analysis.issues.length;

    if (issuesCount === 0) {
      countEl.textContent = '✓';
      countEl.className = 'success';
    } else {
      countEl.textContent = issuesCount > 9 ? '9+' : issuesCount.toString();
      countEl.className = '';
    }

    // Send update to background for tab badge
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'UPDATE_BADGE',
          count: issuesCount
        }, () => {
          if (chrome.runtime.lastError) {
            // Silently suppress if background worker is asleep or inactive
          }
        });
      }
    } catch (e) {
      // Ignored
    }
  }

  // Trigger analysis for active element
  async function triggerAnalysis(el) {
    if (!el || isCurrentDomainDisabled() || !userSettings.showFloatingWidget) {
      hideFloatingBadge();
      return;
    }

    const text = getElementText(el);
    if (!text || text.trim().length < 2) {
      hideFloatingBadge();
      return;
    }

    positionBadge(el);

    if (typeof AIService !== 'undefined') {
      const analysis = await AIService.analyzeText(text, userSettings);
      lastAnalysis = analysis;
      updateBadgeUI(analysis);
      if (assistantCard && assistantCard.style.display !== 'none') {
        renderAssistantCardContent();
      }
    }
  }

  // Toggle Assistant Popover Card
  function toggleAssistantCard() {
    if (!assistantCard) {
      createAssistantCard();
    }
    if (assistantCard.style.display === 'none' || !assistantCard.style.display) {
      renderAssistantCardContent();
      positionAssistantCard();
      assistantCard.style.display = 'block';
    } else {
      assistantCard.style.display = 'none';
    }
  }

  // Create Assistant Card DOM
  function createAssistantCard() {
    assistantCard = document.createElement('div');
    assistantCard.id = 'grammarly-ai-assistant-card';
    assistantCard.style.display = 'none';
    document.body.appendChild(assistantCard);
  }

  // Position Assistant Card near badge
  function positionAssistantCard() {
    if (!assistantCard || !floatingBadge) return;
    const badgeRect = floatingBadge.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    let top = scrollY + badgeRect.bottom + 8;
    let left = scrollX + badgeRect.right - 360;

    // Boundary check
    if (left < 16) left = 16;
    if (top + 400 > scrollY + window.innerHeight) {
      top = scrollY + badgeRect.top - 380;
    }

    assistantCard.style.top = `${Math.max(10, top)}px`;
    assistantCard.style.left = `${left}px`;
  }

  // Render Assistant Card Contents
  function renderAssistantCardContent() {
    if (!assistantCard || !lastAnalysis) return;

    const issues = lastAnalysis.issues || [];
    const score = lastAnalysis.overallScore || 100;
    const toneSummary = lastAnalysis.tone?.primary || 'Neutral';

    let issuesHtml = '';
    if (issues.length === 0) {
      issuesHtml = `
        <div class="grammarly-all-clear">
          <div class="grammarly-all-clear-icon">✨</div>
          <div class="grammarly-all-clear-title">Great Writing!</div>
          <div class="grammarly-all-clear-desc">No grammar, spelling, or clarity issues found.</div>
        </div>
      `;
    } else {
      issuesHtml = issues.map((issue, idx) => {
        const original = issue.text;
        const replacement = issue.replacement === '' ? '(remove)' : (issue.replacement || 'Revise');
        const catClass = issue.category;

        return `
          <div class="grammarly-issue-card ${catClass}" data-issue-index="${idx}">
            <div class="grammarly-issue-top">
              <span class="grammarly-category-tag ${catClass}">${issue.type || issue.category}</span>
            </div>
            <div class="grammarly-change-preview">
              <span class="grammarly-original-text">${escapeHtml(original)}</span>
              <span>→</span>
              <span class="grammarly-replacement-text">${escapeHtml(replacement)}</span>
            </div>
            <div class="grammarly-issue-desc">${escapeHtml(issue.explanation || '')}</div>
            <div class="grammarly-actions-row">
              ${issue.replacement !== null ? `<button class="grammarly-accept-btn" data-action="accept-fix" data-index="${idx}">Accept Fix</button>` : ''}
              <button class="grammarly-ignore-btn" data-action="ignore-fix" data-index="${idx}">Ignore</button>
              ${issue.category === 'spelling' ? `<button class="grammarly-ignore-btn" data-action="add-dict" data-word="${escapeHtml(original)}">+ Dictionary</button>` : ''}
            </div>
          </div>
        `;
      }).join('');
    }

    assistantCard.innerHTML = `
      <div class="grammarly-card-header">
        <div class="grammarly-brand">
          <svg viewBox="0 0 24 24" fill="#059669">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z"/>
          </svg>
          Grammarly Assistant
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="grammarly-score-pill">Score: ${score}/100</span>
          <button class="grammarly-close-btn" id="grammarly-card-close">✕</button>
        </div>
      </div>

      <div class="grammarly-quick-tools">
        ${issues.length > 0 ? `<button class="grammarly-tool-btn primary" data-action="fix-all">✨ Fix All (${issues.length})</button>` : ''}
        <button class="grammarly-tool-btn" data-action="tone-shift" data-tone="professional">💼 Professional</button>
        <button class="grammarly-tool-btn" data-action="tone-shift" data-tone="friendly">🤝 Friendly</button>
        <button class="grammarly-tool-btn" data-action="tone-shift" data-tone="concise">✂️ Concise</button>
      </div>

      <div class="grammarly-stats-bar">
        <span>Tone: <strong>${escapeHtml(toneSummary)}</strong></span>
        <span>Words: <strong>${lastAnalysis.stats?.wordCount || 0}</strong></span>
        <span>Readability: <strong>${lastAnalysis.readability?.label?.label || 'Good'}</strong></span>
      </div>

      <div class="grammarly-issues-body">
        ${issuesHtml}
      </div>
    `;

    attachCardEventListeners();
  }

  // Card Event Listeners
  function attachCardEventListeners() {
    if (!assistantCard) return;

    // Close button
    const closeBtn = assistantCard.querySelector('#grammarly-card-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        assistantCard.style.display = 'none';
      };
    }

    // Fix All Button
    const fixAllBtn = assistantCard.querySelector('[data-action="fix-all"]');
    if (fixAllBtn) {
      fixAllBtn.onclick = () => {
        if (!activeElement || !lastAnalysis) return;
        const currentText = getElementText(activeElement);
        const fixed = AIService.fixAll(currentText, lastAnalysis.issues);
        setElementText(activeElement, fixed);
        triggerAnalysis(activeElement);
      };
    }

    // Tone shift buttons
    const toneButtons = assistantCard.querySelectorAll('[data-action="tone-shift"]');
    toneButtons.forEach(btn => {
      btn.onclick = async () => {
        const tone = btn.getAttribute('data-tone');
        if (!activeElement) return;
        const currentText = getElementText(activeElement);
        const transformed = await AIService.transformText(currentText, `tone_${tone}`);
        setElementText(activeElement, transformed);
        triggerAnalysis(activeElement);
      };
    });

    // Accept single fix buttons
    const acceptButtons = assistantCard.querySelectorAll('[data-action="accept-fix"]');
    acceptButtons.forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        const issue = lastAnalysis.issues[idx];
        if (!activeElement || !issue) return;
        const currentText = getElementText(activeElement);
        const updated = AIService.applyFix(currentText, issue);
        setElementText(activeElement, updated);
        triggerAnalysis(activeElement);
      };
    });

    // Ignore fix buttons
    const ignoreButtons = assistantCard.querySelectorAll('[data-action="ignore-fix"]');
    ignoreButtons.forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.getAttribute('data-index'), 10);
        lastAnalysis.issues.splice(idx, 1);
        updateBadgeUI(lastAnalysis);
        renderAssistantCardContent();
      };
    });

    // Add to dictionary
    const dictButtons = assistantCard.querySelectorAll('[data-action="add-dict"]');
    dictButtons.forEach(btn => {
      btn.onclick = async () => {
        const word = btn.getAttribute('data-word');
        if (typeof SpellChecker !== 'undefined') {
          await SpellChecker.addToDictionary(word);
        }
        triggerAnalysis(activeElement);
      };
    });
  }

  function hideFloatingBadge() {
    if (floatingBadge) {
      floatingBadge.style.display = 'none';
    }
    if (assistantCard) {
      assistantCard.style.display = 'none';
    }
  }

  // Handle right-click context menu transformation request
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'EXECUTE_SELECTION_TRANSFORMATION') {
      const selected = msg.selectedText;
      const mode = msg.mode;
      if (selected && typeof AIService !== 'undefined') {
        AIService.transformText(selected, mode).then(result => {
          showSelectionPopover(result);
          sendResponse({ success: true, result });
        }).catch(err => {
          console.warn('Transformation error:', err);
          sendResponse({ success: false, error: err.message });
        });
        return true; // Keep message channel open for async response
      }
    }
  });

  // Display floating selection popover for context menu rewrites
  function showSelectionPopover(transformedText) {
    if (!selectionPopover) {
      selectionPopover = document.createElement('div');
      selectionPopover.id = 'grammarly-ai-selection-popover';
      (document.body || document.documentElement).appendChild(selectionPopover);
    }

    const sel = window.getSelection();
    let top = 100;
    let left = 100;

    if (sel && sel.rangeCount > 0) {
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      top = scrollY + rect.bottom + 8;
      left = scrollX + rect.left;
    }

    selectionPopover.style.top = `${top}px`;
    selectionPopover.style.left = `${left}px`;
    selectionPopover.style.display = 'block';

    selectionPopover.innerHTML = `
      <div class="grammarly-popover-title">
        <span>✨ AI Assistant Result</span>
        <button class="grammarly-close-btn" id="grammarly-popover-close">✕</button>
      </div>
      <div class="grammarly-popover-result">${escapeHtml(transformedText)}</div>
      <div class="grammarly-popover-actions">
        <button class="grammarly-accept-btn" id="grammarly-copy-popover">Copy</button>
        ${activeElement ? `<button class="grammarly-accept-btn" id="grammarly-replace-popover">Replace</button>` : ''}
      </div>
    `;

    document.getElementById('grammarly-popover-close').onclick = () => {
      selectionPopover.style.display = 'none';
    };

    document.getElementById('grammarly-copy-popover').onclick = async () => {
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(transformedText);
          copied = true;
        }
      } catch (e) {
        // Fallback
      }
      if (!copied) {
        try {
          const temp = document.createElement('textarea');
          temp.value = transformedText;
          document.body.appendChild(temp);
          temp.select();
          document.execCommand('copy');
          document.body.removeChild(temp);
          copied = true;
        } catch (err) {}
      }
      const btn = document.getElementById('grammarly-copy-popover');
      if (btn) {
        btn.textContent = 'Copied!';
        setTimeout(() => { if (selectionPopover) selectionPopover.style.display = 'none'; }, 800);
      }
    };

    const replaceBtn = document.getElementById('grammarly-replace-popover');
    if (replaceBtn && activeElement) {
      replaceBtn.onclick = () => {
        setElementText(activeElement, transformedText);
        selectionPopover.style.display = 'none';
        triggerAnalysis(activeElement);
      };
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Attach global event listeners
  function initListeners() {
    createFloatingBadge();

    // Focus listener (capture)
    document.addEventListener('focusin', (e) => {
      if (isEditable(e.target)) {
        activeElement = e.target;
        triggerAnalysis(activeElement);
      }
    }, true);

    // Input typing listener with debounce
    document.addEventListener('input', (e) => {
      if (isEditable(e.target)) {
        activeElement = e.target;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          triggerAnalysis(activeElement);
        }, 450);
      }
    }, true);

    // Reposition on window scroll or resize
    window.addEventListener('scroll', () => {
      if (activeElement && floatingBadge && floatingBadge.style.display !== 'none') {
        positionBadge(activeElement);
      }
    }, { passive: true });

    window.addEventListener('resize', () => {
      if (activeElement && floatingBadge && floatingBadge.style.display !== 'none') {
        positionBadge(activeElement);
      }
    }, { passive: true });

    // Close assistant card when clicking outside
    document.addEventListener('mousedown', (e) => {
      if (assistantCard && assistantCard.style.display !== 'none') {
        if (!assistantCard.contains(e.target) && !floatingBadge.contains(e.target)) {
          assistantCard.style.display = 'none';
        }
      }
    });
  }

  // Initialize
  initSettings().then(() => {
    initListeners();

    // Listen for storage changes dynamically
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync') {
          for (const [key, change] of Object.entries(changes)) {
            userSettings[key] = change.newValue;
          }
          if (changes.customDictionary && typeof SpellChecker !== 'undefined' && SpellChecker.loadPersonalDictionary) {
            SpellChecker.loadPersonalDictionary();
          }
          if (activeElement) {
            triggerAnalysis(activeElement);
          }
        }
      });
    }

    console.log('Grammarly - AI Writing Assistant active on page.');
  });

})();
