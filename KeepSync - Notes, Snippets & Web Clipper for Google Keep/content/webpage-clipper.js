/**
 * KeepSync - In-page Web Clipper & Floating Selection Toolbar
 * Provides quick-clip floating badge and toast notifications on any webpage.
 */

(() => {
  if (window.__KEEPSYNC_CLIPPER_LOADED__) return;
  window.__KEEPSYNC_CLIPPER_LOADED__ = true;

  let floatingBadge = null;
  let activeSelectionText = '';
  let activeSelectionRange = null;
  let isExtensionEnabled = true;

  // Check initial settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get('settings', (res) => {
      if (res?.settings && res.settings.showFloatingClipBubble === false) {
        isExtensionEnabled = false;
      }
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.settings?.newValue) {
        isExtensionEnabled = changes.settings.newValue.showFloatingClipBubble !== false;
      }
    });
  }

  // -------------------------------------------------------------
  // Floating Action Badge Creation & Management
  // -------------------------------------------------------------

  function createFloatingBadge() {
    if (floatingBadge) return floatingBadge;

    const badge = document.createElement('div');
    badge.id = 'keepsync-floating-badge';
    badge.className = 'keepsync-bubble keepsync-hidden';
    badge.setAttribute('role', 'toolbar');
    badge.title = 'KeepSync Web Clipper';

    badge.innerHTML = `
      <button type="button" class="keepsync-badge-btn keepsync-btn-clip" title="Save as new snippet note">
        <svg class="keepsync-badge-icon" viewBox="0 0 24 24" width="14" height="14">
          <path fill="#f59e0b" d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/>
        </svg>
        <span>Clip</span>
      </button>
      <div class="keepsync-badge-divider"></div>
      <button type="button" class="keepsync-badge-btn keepsync-btn-stack" title="Stack onto your active recent note">
        <span>+ Stack</span>
      </button>
    `;

    badge.addEventListener('mousedown', (e) => {
      // Prevent selection collapse on click
      e.preventDefault();
      e.stopPropagation();
    });

    badge.querySelector('.keepsync-btn-clip').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleClipClick();
    });

    badge.querySelector('.keepsync-btn-stack').addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleStackClick();
    });

    document.body.appendChild(badge);
    floatingBadge = badge;
    return badge;
  }

  function showBadgeAt(rect) {
    if (!isExtensionEnabled) return;
    const badge = createFloatingBadge();

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;

    // Position above selection if space permits, else below
    const badgeHeight = 32;
    const badgeWidth = 145;
    let top = rect.top + scrollY - badgeHeight - 8;
    let left = rect.left + scrollX + (rect.width / 2) - (badgeWidth / 2);

    if (top < scrollY + 10) {
      top = rect.bottom + scrollY + 8;
    }
    if (left < 10) left = 10;
    if (left + badgeWidth > window.innerWidth - 10) {
      left = window.innerWidth - badgeWidth - 10;
    }

    badge.style.top = `${Math.round(top)}px`;
    badge.style.left = `${Math.round(left)}px`;
    badge.classList.remove('keepsync-hidden');
    badge.classList.add('keepsync-visible');
  }

  function hideBadge() {
    if (floatingBadge) {
      floatingBadge.classList.remove('keepsync-visible');
      floatingBadge.classList.add('keepsync-hidden');
    }
  }

  // -------------------------------------------------------------
  // Clipping & Stacking Actions
  // -------------------------------------------------------------

  async function handleClipClick() {
    if (!activeSelectionText) return;

    hideBadge();
    const snippetText = activeSelectionText;

    const noteData = {
      title: `Clip: ${document.title || 'Web Snippet'}`.substring(0, 80),
      content: snippetText,
      type: 'snippet',
      url: window.location.href,
      pageTitle: document.title || '',
      favicon: getPageFavicon(),
      color: 'sand'
    };

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'SAVE_NOTE',
          note: noteData
        }, () => {
          showToast('Snippet clipped to KeepSync Vault!', 'success');
        });
      }
    } catch (e) {
      console.error('KeepSync save error:', e);
      showToast('Error saving snippet', 'error');
    }
  }

  async function handleStackClick() {
    if (!activeSelectionText) return;
    const snippetText = activeSelectionText;
    hideBadge();

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'GET_RECENT_NOTE' }, (res) => {
          if (res?.note?.id) {
            chrome.runtime.sendMessage({
              action: 'APPEND_TO_NOTE',
              id: res.note.id,
              text: snippetText,
              url: window.location.href
            }, () => {
              showToast(`Excerpt stacked onto "${res.note.title || 'recent note'}"!`, 'success');
            });
          } else {
            // If no previous note exists, save as new
            handleClipClick();
          }
        });
      }
    } catch (e) {
      console.error('KeepSync stack error:', e);
      handleClipClick();
    }
  }

  function getPageFavicon() {
    const iconLink = document.querySelector('link[rel*="icon"]');
    if (iconLink && iconLink.href) return iconLink.href;
    return `${window.location.origin}/favicon.ico`;
  }

  // -------------------------------------------------------------
  // Selection Event Listeners
  // -------------------------------------------------------------

  document.addEventListener('mouseup', (e) => {
    // If clicking on our badge, don't clear
    if (floatingBadge && floatingBadge.contains(e.target)) return;

    setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        hideBadge();
        activeSelectionText = '';
        return;
      }

      const text = selection.toString().trim();
      if (text.length >= 3) {
        activeSelectionText = text;
        try {
          const range = selection.getRangeAt(0);
          activeSelectionRange = range.cloneRange();
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            showBadgeAt(rect);
          }
        } catch (err) {
          hideBadge();
        }
      } else {
        hideBadge();
      }
    }, 20);
  });

  document.addEventListener('mousedown', (e) => {
    if (floatingBadge && !floatingBadge.contains(e.target)) {
      hideBadge();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideBadge();
    }
  });

  // -------------------------------------------------------------
  // In-Page Toast Notifications
  // -------------------------------------------------------------

  let toastContainer = null;

  function getOrCreateToastContainer() {
    if (toastContainer && document.body.contains(toastContainer)) {
      return toastContainer;
    }
    const container = document.createElement('div');
    container.id = 'keepsync-toast-root';
    document.body.appendChild(container);
    toastContainer = container;
    return container;
  }

  function showToast(message, type = 'success') {
    const root = getOrCreateToastContainer();
    const toast = document.createElement('div');
    toast.className = `keepsync-toast keepsync-toast-${type}`;

    const iconHtml = type === 'success' 
      ? `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#10b981" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`
      : `<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#ef4444" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`;

    toast.innerHTML = `
      <div class="keepsync-toast-icon">${iconHtml}</div>
      <div class="keepsync-toast-msg">${escapeHtml(message)}</div>
      <button class="keepsync-toast-close">&times;</button>
    `;

    toast.querySelector('.keepsync-toast-close').addEventListener('click', () => {
      toast.remove();
    });

    root.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('keepsync-toast-out');
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }

  // -------------------------------------------------------------
  // Full Article Reader Mode Extraction
  // -------------------------------------------------------------

  function extractFullArticle() {
    const h1 = document.querySelector('article h1, main h1, h1');
    const title = (h1?.innerText || document.title || 'Saved Web Article').trim();

    const authorEl = document.querySelector('[rel="author"], .author-name, .byline, [itemprop="author"]');
    const author = authorEl ? authorEl.innerText.trim() : '';

    const candidates = [
      'article',
      '[itemprop="articleBody"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
      '.story-body'
    ];

    let contentEl = null;
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.innerText.trim().length > 300) {
        contentEl = el;
        break;
      }
    }

    if (!contentEl) {
      const allDivs = Array.from(document.querySelectorAll('div, section'));
      let maxLen = 0;
      allDivs.forEach(div => {
        const ps = div.querySelectorAll('p');
        if (ps.length >= 3) {
          const totalLen = Array.from(ps).reduce((acc, p) => acc + p.innerText.trim().length, 0);
          if (totalLen > maxLen) {
            maxLen = totalLen;
            contentEl = div;
          }
        }
      });
    }

    if (!contentEl) {
      contentEl = document.body;
    }

    const clone = contentEl.cloneNode(true);
    const junkSelectors = 'nav, header, footer, aside, script, style, noscript, iframe, .ad, .ad-banner, .advertisement, .social-share, .comments, .related-posts, form, button';
    clone.querySelectorAll(junkSelectors).forEach(el => el.remove());

    const textBlocks = [];
    const elements = clone.querySelectorAll('h1, h2, h3, h4, p, blockquote, li');

    if (elements.length > 0) {
      elements.forEach(el => {
        const text = el.innerText.trim();
        if (text.length >= 15) {
          const tag = el.tagName.toLowerCase();
          if (tag === 'h1' || tag === 'h2') textBlocks.push(`\n## ${text}\n`);
          else if (tag === 'h3' || tag === 'h4') textBlocks.push(`\n### ${text}\n`);
          else if (tag === 'blockquote') textBlocks.push(`> ${text}`);
          else if (tag === 'li') textBlocks.push(`- ${text}`);
          else textBlocks.push(text);
        }
      });
    }

    let articleBody = textBlocks.join('\n\n').trim();
    if (articleBody.length < 100) {
      articleBody = clone.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 20).join('\n\n');
    }

    const words = articleBody.split(/\s+/).filter(Boolean).length;
    const readingMinutes = Math.max(1, Math.ceil(words / 200));

    return {
      title,
      author,
      content: articleBody,
      wordCount: words,
      readingTime: `${readingMinutes} min read`,
      url: window.location.href,
      pageTitle: document.title,
      favicon: getPageFavicon()
    };
  }

  // -------------------------------------------------------------
  // Message Listener from Background / Popup
  // -------------------------------------------------------------

  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.action === 'GET_SELECTION_TEXT') {
        const text = window.getSelection()?.toString() || '';
        sendResponse({ text });
      } else if (req.action === 'EXTRACT_FULL_ARTICLE') {
        const article = extractFullArticle();
        sendResponse({ success: true, article });
      } else if (req.action === 'SHOW_TOAST') {
        showToast(req.message || 'Saved to KeepSync!', req.type || 'success');
        sendResponse({ received: true });
      }
    });
  }
})();
