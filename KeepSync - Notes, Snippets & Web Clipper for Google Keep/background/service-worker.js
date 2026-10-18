/**
 * KeepSync Service Worker (Manifest V3)
 * Handles context menus, shortcut commands, tab messaging, and Google Keep sync coordination.
 */

try {
  importScripts('../lib/storage.js');
} catch (e) {
  console.error('Failed to import storage.js in service worker:', e);
}

// -------------------------------------------------------------
// Initialization & Context Menus
// -------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('KeepSync extension installed/updated:', details.reason);
  await setupContextMenus();
  await KeepStorage.updateBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await setupContextMenus();
  await KeepStorage.updateBadge();
});

async function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Save Selection
    chrome.contextMenus.create({
      id: 'keepsync_save_selection',
      title: '📌 Save selection to KeepSync',
      contexts: ['selection']
    });

    // Save Page
    chrome.contextMenus.create({
      id: 'keepsync_save_page',
      title: '🔗 Save page link to KeepSync',
      contexts: ['page']
    });

    // Save Link
    chrome.contextMenus.create({
      id: 'keepsync_save_link',
      title: '🌐 Save link to KeepSync',
      contexts: ['link']
    });

    // Save Image
    chrome.contextMenus.create({
      id: 'keepsync_save_image',
      title: '🖼️ Save image to KeepSync',
      contexts: ['image']
    });

    chrome.contextMenus.create({
      id: 'keepsync_sep_1',
      type: 'separator',
      contexts: ['all']
    });

    // Open Notes Vault
    chrome.contextMenus.create({
      id: 'keepsync_open_vault',
      title: '📚 Open Notes Vault Dashboard',
      contexts: ['all']
    });

    // Open Google Keep
    chrome.contextMenus.create({
      id: 'keepsync_open_keep',
      title: '⚡ Open Google Keep Web',
      contexts: ['all']
    });
  });
}

// -------------------------------------------------------------
// Context Menu Actions
// -------------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'keepsync_open_vault') {
      chrome.runtime.openOptionsPage();
      return;
    }

    if (info.menuItemId === 'keepsync_open_keep') {
      chrome.tabs.create({ url: 'https://keep.google.com/' });
      return;
    }

    let noteData = null;

    if (info.menuItemId === 'keepsync_save_selection' && info.selectionText) {
      noteData = {
        title: (tab?.title ? `Clip: ${tab.title}` : 'Web Snippet').substring(0, 80),
        content: info.selectionText.trim(),
        type: 'snippet',
        url: info.pageUrl || tab?.url || '',
        pageTitle: tab?.title || '',
        favicon: tab?.favIconUrl || '',
        color: 'sand'
      };
    } else if (info.menuItemId === 'keepsync_save_page') {
      noteData = {
        title: tab?.title || 'Saved Web Page',
        content: `Source: ${info.pageUrl || tab?.url || ''}`,
        type: 'link',
        url: info.pageUrl || tab?.url || '',
        pageTitle: tab?.title || '',
        favicon: tab?.favIconUrl || '',
        color: 'fog'
      };
    } else if (info.menuItemId === 'keepsync_save_link' && info.linkUrl) {
      noteData = {
        title: `Link: ${info.linkUrl}`,
        content: `Found on: ${tab?.title || ''}\n${info.linkUrl}`,
        type: 'link',
        url: info.linkUrl,
        pageTitle: tab?.title || '',
        favicon: tab?.favIconUrl || '',
        color: 'mint'
      };
    } else if (info.menuItemId === 'keepsync_save_image' && info.srcUrl) {
      noteData = {
        title: `Image from ${tab?.title || 'Web'}`,
        content: `![Image](${info.srcUrl})\n\nSource: ${info.pageUrl || tab?.url || ''}`,
        type: 'snippet',
        url: info.pageUrl || tab?.url || '',
        pageTitle: tab?.title || '',
        favicon: tab?.favIconUrl || '',
        color: 'blossom'
      };
    }

    if (noteData) {
      const saved = await KeepStorage.saveNote(noteData);
      
      // Notify content script to display success toast on webpage
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'SHOW_TOAST',
          message: 'Saved to KeepSync Vault!',
          type: 'success',
          note: saved
        }).catch(() => {/* tab might not support content scripts */});
      }

      // Check auto-sync setting
      const settings = await KeepStorage.getSettings();
      if (settings.autoSyncToKeep) {
        await initiateGoogleKeepSync(saved);
      }
    }
  } catch (err) {
    console.error('Error executing context menu action:', err);
  }
});

// -------------------------------------------------------------
// Keyboard Shortcut Commands
// -------------------------------------------------------------

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick_clip_selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_SELECTION_TEXT' });
      if (response && response.text) {
        const saved = await KeepStorage.saveNote({
          title: `Clip: ${tab.title || 'Web Snippet'}`.substring(0, 80),
          content: response.text.trim(),
          type: 'snippet',
          url: tab.url || '',
          pageTitle: tab.title || '',
          favicon: tab.favIconUrl || '',
          color: 'sand'
        });

        chrome.tabs.sendMessage(tab.id, {
          action: 'SHOW_TOAST',
          message: 'Selection clipped to KeepSync!',
          type: 'success',
          note: saved
        }).catch(() => {});
      } else {
        // If nothing selected, save page link
        const saved = await KeepStorage.saveNote({
          title: tab.title || 'Saved Page',
          content: tab.url || '',
          type: 'link',
          url: tab.url || '',
          pageTitle: tab.title || '',
          favicon: tab.favIconUrl || '',
          color: 'fog'
        });

        chrome.tabs.sendMessage(tab.id, {
          action: 'SHOW_TOAST',
          message: 'Page link saved to KeepSync!',
          type: 'success',
          note: saved
        }).catch(() => {});
      }
    } catch (e) {
      console.log('Could not clip on tab:', e);
    }
  }
});

// -------------------------------------------------------------
// Message Listener
// -------------------------------------------------------------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle async messages properly
  const handleAsync = async () => {
    switch (request.action) {
      case 'GET_ACTIVE_TAB_INFO': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return {
          title: tab?.title || '',
          url: tab?.url || '',
          favicon: tab?.favIconUrl || ''
        };
      }

      case 'SAVE_NOTE': {
        const note = await KeepStorage.saveNote(request.note);
        if (request.syncToKeep) {
          await initiateGoogleKeepSync(note);
        }
        return { success: true, note };
      }

      case 'UPDATE_NOTE': {
        const updated = await KeepStorage.updateNote(request.id, request.patch);
        return { success: !!updated, note: updated };
      }

      case 'TRASH_NOTE': {
        const trashed = await KeepStorage.trashNote(request.id);
        return { success: !!trashed, note: trashed };
      }

      case 'RESTORE_NOTE': {
        const restored = await KeepStorage.restoreNote(request.id);
        return { success: !!restored, note: restored };
      }

      case 'DELETE_NOTE_PERMANENTLY': {
        const res = await KeepStorage.deleteNotePermanently(request.id);
        return { success: res };
      }

      case 'EMPTY_TRASH': {
        const count = await KeepStorage.emptyTrash();
        return { success: true, deletedCount: count };
      }

      case 'BULK_TRASH': {
        const count = await KeepStorage.bulkTrash(request.ids || []);
        return { success: true, count };
      }

      case 'BULK_DELETE_PERMANENT': {
        const count = await KeepStorage.bulkDeletePermanently(request.ids || []);
        return { success: true, count };
      }

      case 'SYNC_NOTE_TO_KEEP': {
        const note = await KeepStorage.getNoteById(request.id);
        if (!note) return { success: false, error: 'Note not found' };
        await initiateGoogleKeepSync(note);
        return { success: true };
      }

      case 'KEEP_INJECTION_ACK': {
        // Called by keep-injector.js on keep.google.com
        if (request.noteId) {
          await KeepStorage.markAsSynced(request.noteId);
        }
        return { success: true };
      }

      case 'GET_PENDING_KEEP_JOB': {
        // keep-injector asks if there are queued sync jobs
        const pending = await KeepStorage.popKeepSyncQueue();
        return { job: pending };
      }

      case 'OPEN_KEEP_TAB': {
        chrome.tabs.create({ url: 'https://keep.google.com/' });
        return { success: true };
      }

      case 'GET_RECENT_NOTE': {
        const recent = await KeepStorage.getRecentActiveNote();
        return { note: recent };
      }

      case 'APPEND_TO_NOTE': {
        const updated = await KeepStorage.appendToNote(request.id, request.text, request.url);
        return { success: !!updated, note: updated };
      }

      case 'SET_NOTE_REMINDER': {
        const { id, reminderAt } = request;
        const updated = await KeepStorage.updateNote(id, { reminderAt });
        if (reminderAt) {
          const alarmTime = new Date(reminderAt).getTime();
          if (alarmTime > Date.now()) {
            chrome.alarms.create(`reminder_${id}`, { when: alarmTime });
          }
        } else {
          chrome.alarms.clear(`reminder_${id}`);
        }
        return { success: !!updated, note: updated };
      }

      default:
        return { error: 'Unknown action' };
    }
  };

  handleAsync().then(sendResponse).catch(err => {
    console.error('Service worker message error:', err);
    sendResponse({ error: err.message });
  });

  return true; // Keep channel open for async response
});

// -------------------------------------------------------------
// Google Keep Sync Engine
// -------------------------------------------------------------

async function initiateGoogleKeepSync(note) {
  // 1. Add to pending queue in storage
  await KeepStorage.queueKeepSync(note);

  const settings = await KeepStorage.getSettings();
  const keepUrlPattern = 'https://keep.google.com/*';

  // 2. Look for existing Google Keep tab
  const tabs = await chrome.tabs.query({ url: keepUrlPattern });

  if (tabs.length > 0) {
    const keepTab = tabs[0];
    // Activate tab if user didn't want background tab
    if (!settings.keepOpenInBackground) {
      await chrome.tabs.update(keepTab.id, { active: true });
    }
    // Ping content script to execute pending job
    chrome.tabs.sendMessage(keepTab.id, {
      action: 'PROCESS_KEEP_SYNC_QUEUE',
      note: note
    }).catch(async (err) => {
      // Content script might need reload or was sleeping, inject if needed
      try {
        await chrome.scripting.executeScript({
          target: { tabId: keepTab.id },
          files: ['content/keep-injector.js']
        });
        setTimeout(() => {
          chrome.tabs.sendMessage(keepTab.id, {
            action: 'PROCESS_KEEP_SYNC_QUEUE',
            note: note
          });
        }, 800);
      } catch (injectionError) {
        console.error('Failed injecting into existing Keep tab:', injectionError);
      }
    });
  } else {
    // 3. Open a new Keep tab
    const newTab = await chrome.tabs.create({
      url: 'https://keep.google.com/',
      active: !settings.keepOpenInBackground
    });

    // Content script on keep.google.com will automatically check queue once loaded
    console.log('Opened Google Keep tab for sync:', newTab.id);
  }
}

// -------------------------------------------------------------
// Omnibox Address Bar Integration ("ks <search>")
// -------------------------------------------------------------

if (chrome.omnibox) {
  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    const q = text.trim();
    if (!q) return;

    try {
      const activeNotes = await KeepStorage.getNotes(false);
      const matches = KeepStorage.filterNotes(activeNotes, { query: q }).slice(0, 5);

      const suggestions = matches.map(note => {
        const title = escapeXml(note.title || 'Untitled Note');
        const preview = escapeXml((note.content || note.url || '').substring(0, 60));
        return {
          content: note.id,
          description: `<match>${title}</match> <dim>- ${preview}</dim>`
        };
      });

      suggest(suggestions);
    } catch (e) {
      console.warn('Omnibox search error:', e);
    }
  });

  chrome.omnibox.onInputEntered.addListener(async (text) => {
    try {
      const activeNotes = await KeepStorage.getNotes(false);
      let targetNote = activeNotes.find(n => n.id === text.trim());
      if (!targetNote && text.trim()) {
        const matches = KeepStorage.filterNotes(activeNotes, { query: text.trim() });
        if (matches.length > 0) targetNote = matches[0];
      }

      if (targetNote && targetNote.url) {
        chrome.tabs.create({ url: targetNote.url });
      } else {
        chrome.runtime.openOptionsPage();
      }
    } catch (e) {
      chrome.runtime.openOptionsPage();
    }
  });
}

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

// -------------------------------------------------------------
// Alarms & Reminder Notifications
// -------------------------------------------------------------

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name.startsWith('reminder_')) {
      const noteId = alarm.name.replace('reminder_', '');
      const note = await KeepStorage.getNoteById(noteId);
      if (note && !note.isTrash) {
        if (chrome.notifications) {
          chrome.notifications.create(`notif_${note.id}`, {
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: `⏰ KeepSync Reminder: ${note.title || 'Untitled Note'}`,
            message: (note.content || note.url || 'You set a reminder for this note!').substring(0, 100),
            priority: 2
          });
        }
      }
    }
  });
}

