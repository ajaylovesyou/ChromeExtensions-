/**
 * KeepSync - Google Keep Automation Content Script
 * Runs exclusively on https://keep.google.com/* to inject notes directly into the active user session.
 */

(() => {
  if (window.__KEEPSYNC_INJECTOR_LOADED__) return;
  window.__KEEPSYNC_INJECTOR_LOADED__ = true;

  console.log('⚡ KeepSync Injector loaded on Google Keep.');

  let isProcessing = false;

  // Check if there is any pending note job immediately upon page load
  setTimeout(checkPendingSyncQueue, 1200);

  // Also listen for runtime messages from background service worker
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (req.action === 'PROCESS_KEEP_SYNC_QUEUE') {
        if (req.note) {
          injectNoteIntoKeep(req.note).then(success => {
            sendResponse({ success });
          });
          return true; // Keep response channel open
        } else {
          checkPendingSyncQueue().then(success => sendResponse({ success }));
          return true;
        }
      }
    });
  }

  async function checkPendingSyncQueue() {
    if (isProcessing) return;
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'GET_PENDING_KEEP_JOB' }, async (res) => {
          if (res?.job) {
            await injectNoteIntoKeep(res.job);
            // Check if more jobs are queued
            setTimeout(checkPendingSyncQueue, 1000);
          }
        });
      }
    } catch (e) {
      console.warn('KeepSync check queue error:', e);
    }
  }

  /**
   * Automate creating a new note in Google Keep web UI
   */
  async function injectNoteIntoKeep(note) {
    if (isProcessing) return false;
    isProcessing = true;

    try {
      showKeepBanner(`Syncing note: "${note.title || 'Untitled'}"...`, 'info');

      // 1. Locate the "Take a note..." box
      const takeNoteBox = await waitForElement([
        'div[aria-label="Take a note…"]',
        'div[aria-label="Take a note..."]',
        'div[data-placeholder="Take a note…"]',
        'div[role="combobox"]',
        'div.notranslate[role="textbox"]'
      ], 7000);

      if (!takeNoteBox) {
        throw new Error('Google Keep "Take a note" box could not be located. Are you logged in?');
      }

      // 2. Click to expand note creation interface
      takeNoteBox.click();
      takeNoteBox.focus();
      await sleep(350);

      // 3. Locate Title and Body fields
      const titleBox = await waitForElement([
        'div[aria-label="Title"]',
        'div[placeholder="Title"]',
        'div[contenteditable="true"][aria-label*="Title"]'
      ], 3000);

      // Body element is usually the contenteditable textbox once expanded
      const bodyBoxes = document.querySelectorAll('div[contenteditable="true"]');
      let bodyBox = null;

      // Find the body box (which is not the title)
      for (const box of bodyBoxes) {
        if (box !== titleBox && box.getAttribute('aria-label') !== 'Title') {
          bodyBox = box;
          break;
        }
      }

      // 4. Fill Title
      if (titleBox && note.title) {
        setTextContent(titleBox, note.title);
      }

      // 5. Build and Fill Note Content
      let noteContent = note.content || '';

      // Format checklist items if note is a checklist
      if (note.type === 'checklist' && Array.isArray(note.items) && note.items.length > 0) {
        const checklistStr = note.items.map(item => `[${item.completed ? '✓' : ' '}] ${item.text}`).join('\n');
        noteContent = noteContent ? `${noteContent}\n\n${checklistStr}` : checklistStr;
      }

      // Append source URL attribution if present and not already mentioned
      if (note.url && !noteContent.includes(note.url)) {
        const sourceLine = `\n\n📌 Source: ${note.pageTitle ? note.pageTitle + ' (' + note.url + ')' : note.url}`;
        noteContent += sourceLine;
      }

      if (bodyBox && noteContent) {
        setTextContent(bodyBox, noteContent);
      }

      await sleep(400);

      // 6. Locate and Click "Close" button to save note
      const closeBtn = findCloseButton();
      if (closeBtn) {
        closeBtn.click();
      } else {
        // Fallback: click somewhere outside to trigger auto-save
        document.body.click();
      }

      await sleep(500);

      // 7. Acknowledge sync completion to background worker
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'KEEP_INJECTION_ACK',
          noteId: note.id
        });
      }

      showKeepBanner(`Note saved permanently to Google Keep!`, 'success');
      isProcessing = false;
      return true;
    } catch (err) {
      console.error('KeepSync injection error:', err);
      showKeepBanner(`Sync failed: ${err.message}`, 'error');
      isProcessing = false;
      return false;
    }
  }

  /**
   * Safely set text inside Google Keep's rich contenteditable elements
   */
  function setTextContent(element, text) {
    element.focus();

    // Try document.execCommand for realistic native typing simulation
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    sel.removeAllRanges();
    sel.addRange(range);

    let execSuccess = false;
    try {
      execSuccess = document.execCommand('insertText', false, text);
    } catch (e) {
      execSuccess = false;
    }

    if (!execSuccess || element.innerText.trim() !== text.trim()) {
      // Fallback direct innerText assignment
      element.innerText = text;
    }

    // Fire events so Angular/Keep framework updates its model
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'a' }));
  }

  function findCloseButton() {
    // 1. Check for standard Google Keep Close button
    const buttons = document.querySelectorAll('div[role="button"], button');
    for (const btn of buttons) {
      const text = (btn.innerText || btn.getAttribute('aria-label') || '').trim().toLowerCase();
      if (text === 'close' || text === 'done' || text === 'fermer' || text === 'schließen' || text === 'cerrar') {
        return btn;
      }
    }
    // 2. Class check
    const qeBtn = document.querySelector('div.notranslate.qe-note-button[role="button"]');
    if (qeBtn) return qeBtn;

    return null;
  }

  /**
   * Wait for any matching selector to appear in DOM
   */
  function waitForElement(selectors, timeout = 5000) {
    return new Promise((resolve) => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) return resolve(el);
      }

      const observer = new MutationObserver(() => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el) {
            observer.disconnect();
            clearTimeout(timer);
            return resolve(el);
          }
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      const timer = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // -------------------------------------------------------------
  // Keep Notification Banner
  // -------------------------------------------------------------

  let keepBanner = null;

  function showKeepBanner(message, type = 'success') {
    if (!keepBanner) {
      keepBanner = document.createElement('div');
      keepBanner.id = 'keepsync-keep-banner';
      document.body.appendChild(keepBanner);
    }

    const color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#f59e0b');
    keepBanner.className = `keepsync-keep-banner keepsync-${type}`;
    keepBanner.innerHTML = `
      <div class="keepsync-banner-content">
        <span class="keepsync-banner-dot" style="background:${color}"></span>
        <strong style="color:#ffffff;">KeepSync:</strong>
        <span class="keepsync-banner-text">${escapeHtml(message)}</span>
      </div>
      <button class="keepsync-banner-close">&times;</button>
    `;

    keepBanner.querySelector('.keepsync-banner-close').addEventListener('click', () => {
      keepBanner.classList.remove('keepsync-banner-show');
    });

    keepBanner.classList.add('keepsync-banner-show');

    if (type !== 'info') {
      setTimeout(() => {
        keepBanner.classList.remove('keepsync-banner-show');
      }, 4500);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }
})();
