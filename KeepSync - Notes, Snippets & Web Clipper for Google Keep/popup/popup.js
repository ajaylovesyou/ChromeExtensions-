/**
 * KeepSync - Main Popup Controller
 * Manages Note creation, Live Web Clipping, Notes Vault, Trash management, and Settings.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // -------------------------------------------------------------
  // State Variables
  // -------------------------------------------------------------
  let currentNoteType = 'note';
  let currentColor = 'default';
  let isPinned = false;
  let currentReminderAt = null;
  let activeTabInfo = { title: '', url: '', favicon: '' };
  let currentTags = [];
  let currentChecklistItems = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let currentView = 'grid'; // 'grid' | 'list'
  let cachedNotes = [];
  let cachedTrash = [];
  let speechRecognizer = null;
  let isListening = false;

  // -------------------------------------------------------------
  // DOM Elements
  // -------------------------------------------------------------
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const typePills = document.querySelectorAll('.type-pill');
  const vaultCountBadge = document.getElementById('vaultCountBadge');
  const trashCountBadge = document.getElementById('trashCountBadge');
  const headerStatus = document.getElementById('headerStatus');

  // Create Tab Elements
  const noteTitleInput = document.getElementById('noteTitle');
  const noteContentInput = document.getElementById('noteContent');
  const btnPinToggle = document.getElementById('btnPinToggle');
  const textEditorArea = document.getElementById('textEditorArea');
  const checklistEditorArea = document.getElementById('checklistEditorArea');
  const checklistItemsList = document.getElementById('checklistItemsList');
  const checklistNewInput = document.getElementById('checklistNewInput');
  const tagInput = document.getElementById('tagInput');
  const tagsChipsList = document.getElementById('tagsChipsList');
  const colorSwatchesContainer = document.getElementById('colorSwatchesContainer');
  const editorCard = document.getElementById('editorCard');

  // Smart Utilities Bar Elements
  const btnVoiceDictation = document.getElementById('btnVoiceDictation');
  const voiceStatusText = document.getElementById('voiceStatusText');
  const btnSummarizeBullets = document.getElementById('btnSummarizeBullets');
  const btnExtractActionItems = document.getElementById('btnExtractActionItems');
  const btnFormatCode = document.getElementById('btnFormatCode');
  const btnReminderToggle = document.getElementById('btnReminderToggle');
  const reminderBtnLabel = document.getElementById('reminderBtnLabel');
  const reminderDropdownMenu = document.getElementById('reminderDropdownMenu');

  // Page Context Box
  const pageContextBox = document.getElementById('pageContextBox');
  const ctxFavicon = document.getElementById('ctxFavicon');
  const ctxPageTitle = document.getElementById('ctxPageTitle');
  const ctxPageUrl = document.getElementById('ctxPageUrl');
  const btnUsePageInfo = document.getElementById('btnUsePageInfo');
  const btnClipFullArticle = document.getElementById('btnClipFullArticle');
  const attachedUrlRow = document.getElementById('attachedUrlRow');
  const attachedUrlText = document.getElementById('attachedUrlText');
  const btnRemoveAttachedUrl = document.getElementById('btnRemoveAttachedUrl');

  // Create Actions
  const btnSavePermanent = document.getElementById('btnSavePermanent');
  const btnSaveAndSyncKeep = document.getElementById('btnSaveAndSyncKeep');
  const btnCopyNote = document.getElementById('btnCopyNote');

  // Vault Tab Elements
  const vaultSearchInput = document.getElementById('vaultSearchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const filterChips = document.querySelectorAll('.filter-chip');
  const vaultNotesStream = document.getElementById('vaultNotesStream');
  const vaultEmptyState = document.getElementById('vaultEmptyState');
  const btnToggleLayout = document.getElementById('btnToggleLayout');
  const btnSyncAllToKeep = document.getElementById('btnSyncAllToKeep');

  // Trash Tab Elements
  const trashNotesStream = document.getElementById('trashNotesStream');
  const trashEmptyState = document.getElementById('trashEmptyState');
  const trashSubtext = document.getElementById('trashSubtext');
  const btnEmptyTrash = document.getElementById('btnEmptyTrash');

  // Settings Elements
  const settingFloatingBadge = document.getElementById('settingFloatingBadge');
  const settingAutoSync = document.getElementById('settingAutoSync');
  const settingKeepBackground = document.getElementById('settingKeepBackground');
  const settingBadgeCount = document.getElementById('settingBadgeCount');
  const btnExportJson = document.getElementById('btnExportJson');
  const btnExportMarkdown = document.getElementById('btnExportMarkdown');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnImportJson = document.getElementById('btnImportJson');
  const importFileInput = document.getElementById('importFileInput');

  // Header Buttons
  const btnOpenKeep = document.getElementById('btnOpenKeep');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');
  const btnThemeToggle = document.getElementById('btnThemeToggle');

  // Edit Modal Elements
  const editNoteModal = document.getElementById('editNoteModal');
  const editNoteId = document.getElementById('editNoteId');
  const editNoteTitle = document.getElementById('editNoteTitle');
  const editNoteContent = document.getElementById('editNoteContent');
  const editColorSwatches = document.getElementById('editColorSwatches');
  const btnCloseEditModal = document.getElementById('btnCloseEditModal');
  const btnCancelEdit = document.getElementById('btnCancelEdit');
  const btnSaveEdit = document.getElementById('btnSaveEdit');

  // -------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------
  await loadSettings();
  await detectActiveTab();
  buildColorSwatches();
  await refreshVault();
  await refreshTrash();

  // -------------------------------------------------------------
  // Navigation Tabs Switching
  // -------------------------------------------------------------
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      navTabs.forEach(t => t.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const pane = document.getElementById(`tab-${target}`);
      if (pane) pane.classList.add('active');

      if (target === 'vault') {
        refreshVault();
      } else if (target === 'trash') {
        refreshTrash();
      }
    });
  });

  // -------------------------------------------------------------
  // Active Webpage Detection
  // -------------------------------------------------------------
  async function detectActiveTab() {
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          activeTabInfo = {
            title: tab.title || '',
            url: tab.url || '',
            favicon: tab.favIconUrl || ''
          };

          if (activeTabInfo.title) {
            ctxPageTitle.textContent = activeTabInfo.title;
          }
          if (activeTabInfo.url) {
            ctxPageUrl.textContent = activeTabInfo.url;
          }
          if (activeTabInfo.favicon) {
            ctxFavicon.src = activeTabInfo.favicon;
            ctxFavicon.style.display = 'block';
          }

          // If current tab is keep.google.com, display status
          if (activeTabInfo.url.includes('keep.google.com')) {
            headerStatus.textContent = 'Keep Active';
            headerStatus.style.color = '#10b981';
          }
        }
      }
    } catch (e) {
      console.warn('Could not read active tab:', e);
    }
  }

  btnUsePageInfo.addEventListener('click', () => {
    if (!noteTitleInput.value && activeTabInfo.title) {
      noteTitleInput.value = activeTabInfo.title;
    }
    if (activeTabInfo.url) {
      attachedUrlText.textContent = activeTabInfo.url;
      attachedUrlRow.style.display = 'flex';
      showToast('Page URL attached to note');
    }
  });

  btnRemoveAttachedUrl.addEventListener('click', () => {
    attachedUrlRow.style.display = 'none';
    attachedUrlText.textContent = '';
  });

  // Extract Full Article Reader Clip
  if (btnClipFullArticle) {
    btnClipFullArticle.addEventListener('click', async () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!tab || !tab.id) {
            showToast('No active webpage detected', 'error');
            return;
          }
          btnClipFullArticle.textContent = '⏳ Reading...';
          chrome.tabs.sendMessage(tab.id, { action: 'EXTRACT_FULL_ARTICLE' }, (res) => {
            btnClipFullArticle.textContent = '📄 Reader Clip';
            if (chrome.runtime.lastError || !res || !res.content) {
              showToast('Could not extract clean article from this page.', 'error');
              return;
            }
            if (res.title && !noteTitleInput.value) {
              noteTitleInput.value = res.title;
            }
            noteContentInput.value = res.content;
            if (res.url) {
              attachedUrlText.textContent = res.url;
              attachedUrlRow.style.display = 'flex';
            }
            showToast(`Article extracted (${res.wordCount} words, ~${res.readingTimeMinutes}m read)!`);
          });
        }
      } catch (err) {
        btnClipFullArticle.textContent = '📄 Reader Clip';
        showToast('Error reading article: ' + err.message, 'error');
      }
    });
  }

  // -------------------------------------------------------------
  // Note Type Selector
  // -------------------------------------------------------------
  typePills.forEach(pill => {
    pill.addEventListener('click', () => {
      typePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentNoteType = pill.dataset.type;

      if (currentNoteType === 'checklist') {
        textEditorArea.style.display = 'none';
        checklistEditorArea.style.display = 'block';
        checklistNewInput.focus();
      } else {
        textEditorArea.style.display = 'block';
        checklistEditorArea.style.display = 'none';
        if (currentNoteType === 'link') {
          if (!attachedUrlText.textContent && activeTabInfo.url) {
            attachedUrlText.textContent = activeTabInfo.url;
            attachedUrlRow.style.display = 'flex';
          }
          if (!noteTitleInput.value && activeTabInfo.title) {
            noteTitleInput.value = activeTabInfo.title;
          }
        }
        noteContentInput.focus();
      }
    });
  });

  // -------------------------------------------------------------
  // Checklist Item Generator
  // -------------------------------------------------------------
  checklistNewInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChecklistItem(checklistNewInput.value.trim());
      checklistNewInput.value = '';
    }
  });

  function addChecklistItem(text, completed = false) {
    if (!text) return;
    const item = {
      id: 'chk_' + Math.random().toString(36).substr(2, 7),
      text,
      completed
    };
    currentChecklistItems.push(item);
    renderChecklistItems();
  }

  function renderChecklistItems() {
    checklistItemsList.innerHTML = '';
    currentChecklistItems.forEach(item => {
      const row = document.createElement('div');
      row.className = 'checklist-item-row';
      row.innerHTML = `
        <input type="checkbox" class="checklist-checkbox" ${item.completed ? 'checked' : ''}>
        <input type="text" class="checklist-item-text ${item.completed ? 'completed' : ''}" value="${escapeHtml(item.text)}">
        <button type="button" class="checklist-del-btn" title="Delete item">&times;</button>
      `;

      const chk = row.querySelector('.checklist-checkbox');
      const txt = row.querySelector('.checklist-item-text');
      const del = row.querySelector('.checklist-del-btn');

      chk.addEventListener('change', () => {
        item.completed = chk.checked;
        txt.classList.toggle('completed', chk.checked);
      });

      txt.addEventListener('input', () => {
        item.text = txt.value;
      });

      del.addEventListener('click', () => {
        currentChecklistItems = currentChecklistItems.filter(i => i.id !== item.id);
        renderChecklistItems();
      });

      checklistItemsList.appendChild(row);
    });
  }

  // -------------------------------------------------------------
  // Smart AI & Quick Transformation Utilities
  // -------------------------------------------------------------
  // Voice Dictation (Web Speech API)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition) {
    try {
      speechRecognizer = new SpeechRecognition();
      speechRecognizer.continuous = true;
      speechRecognizer.interimResults = true;
      speechRecognizer.lang = 'en-US';

      let voiceBaseText = '';

      speechRecognizer.onstart = () => {
        isListening = true;
        btnVoiceDictation.classList.add('listening');
        voiceStatusText.textContent = 'Listening...';
        voiceBaseText = noteContentInput.value ? noteContentInput.value.trim() + ' ' : '';
        showToast('Voice dictation active - speak clearly...');
      };

      speechRecognizer.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        noteContentInput.value = voiceBaseText + transcript;
      };

      speechRecognizer.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        stopVoiceRecognition();
        if (event.error === 'not-allowed') {
          showToast('Microphone access not permitted', 'error');
        } else {
          showToast('Voice error: ' + event.error, 'error');
        }
      };

      speechRecognizer.onend = () => {
        stopVoiceRecognition();
      };
    } catch (e) {
      console.warn('SpeechRecognition init error:', e);
    }
  }

  function stopVoiceRecognition() {
    isListening = false;
    if (btnVoiceDictation) btnVoiceDictation.classList.remove('listening');
    if (voiceStatusText) voiceStatusText.textContent = 'Voice';
  }

  if (btnVoiceDictation) {
    btnVoiceDictation.addEventListener('click', () => {
      if (!SpeechRecognition) {
        showToast('Voice dictation is not supported in this browser', 'error');
        return;
      }
      if (isListening) {
        try { speechRecognizer.stop(); } catch (e) {}
        stopVoiceRecognition();
        showToast('Voice dictation stopped');
      } else {
        try {
          speechRecognizer.start();
        } catch (err) {
          console.warn('SpeechRecognition start failed:', err);
          showToast('Could not access microphone', 'error');
        }
      }
    });
  }

  // Bullet Points Summarizer
  if (btnSummarizeBullets) {
    btnSummarizeBullets.addEventListener('click', () => {
      const text = noteContentInput.value.trim();
      if (!text) {
        showToast('Enter or clip some text first to summarize', 'error');
        noteContentInput.focus();
        return;
      }
      const bullets = KeepStorage.generateBulletSummary(text);
      noteContentInput.value = bullets;
      showToast('Generated key takeaway bullet points!');
    });
  }

  // Action Items / Task Checklist Extractor
  if (btnExtractActionItems) {
    btnExtractActionItems.addEventListener('click', () => {
      const text = noteContentInput.value.trim();
      if (!text) {
        showToast('Enter or clip some text first to extract tasks', 'error');
        noteContentInput.focus();
        return;
      }
      const tasks = KeepStorage.extractActionItems(text);
      if (tasks.length === 0) {
        showToast('No action items or todos found in note text', 'error');
        return;
      }
      // Switch view to checklist mode
      typePills.forEach(p => p.classList.toggle('active', p.dataset.type === 'checklist'));
      currentNoteType = 'checklist';
      textEditorArea.style.display = 'none';
      checklistEditorArea.style.display = 'block';

      tasks.forEach(t => addChecklistItem(typeof t === 'string' ? t : (t.text || ''), false));
      showToast(`Extracted ${tasks.length} tasks into checklist!`);
    });
  }

  // Code Formatter
  if (btnFormatCode) {
    btnFormatCode.addEventListener('click', () => {
      const text = noteContentInput.value;
      if (!text.trim()) {
        showToast('Enter code to format', 'error');
        noteContentInput.focus();
        return;
      }
      const formatted = KeepStorage.formatCodeSnippet(text);
      noteContentInput.value = formatted;
      showToast('Formatted code with markdown block!');
    });
  }

  // Reminder Dropdown Menu Handlers
  if (btnReminderToggle && reminderDropdownMenu) {
    btnReminderToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = reminderDropdownMenu.style.display === 'block';
      reminderDropdownMenu.style.display = isVisible ? 'none' : 'block';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.reminder-dropdown-wrapper')) {
        reminderDropdownMenu.style.display = 'none';
      }
    });

    reminderDropdownMenu.querySelectorAll('.reminder-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation();
        const choice = option.dataset.time;
        const now = new Date();

        if (choice === 'none') {
          currentReminderAt = null;
          btnReminderToggle.classList.remove('active');
          reminderBtnLabel.textContent = 'Reminder';
          showToast('Reminder cleared');
        } else {
          let remDate = new Date();
          if (choice === 'today_evening') {
            remDate.setHours(18, 0, 0, 0);
            if (remDate.getTime() <= now.getTime()) {
              remDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours ahead
            }
          } else if (choice === 'tomorrow_morning') {
            remDate.setDate(remDate.getDate() + 1);
            remDate.setHours(9, 0, 0, 0);
          } else if (choice === 'in_2_days') {
            remDate.setDate(remDate.getDate() + 2);
            remDate.setHours(9, 0, 0, 0);
          } else if (choice === 'next_week') {
            remDate.setDate(remDate.getDate() + 7);
            remDate.setHours(9, 0, 0, 0);
          }

          currentReminderAt = remDate.toISOString();
          btnReminderToggle.classList.add('active');
          const dateLabel = remDate.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
          reminderBtnLabel.textContent = dateLabel;
          showToast(`Reminder set for ${dateLabel}!`);
        }
        reminderDropdownMenu.style.display = 'none';
      });
    });
  }

  // -------------------------------------------------------------
  // Pin Toggle
  // -------------------------------------------------------------
  btnPinToggle.addEventListener('click', () => {
    isPinned = !isPinned;
    btnPinToggle.classList.toggle('pinned', isPinned);
    showToast(isPinned ? 'Note pinned to top' : 'Note unpinned');
  });

  // -------------------------------------------------------------
  // Color Swatches Picker
  // -------------------------------------------------------------
  function buildColorSwatches() {
    colorSwatchesContainer.innerHTML = '';
    const colors = Object.keys(KEEP_COLORS);

    colors.forEach(key => {
      const c = KEEP_COLORS[key];
      const swatch = document.createElement('div');
      swatch.className = `color-swatch ${key === currentColor ? 'active' : ''}`;
      swatch.style.backgroundColor = c.bg;
      swatch.title = c.name;
      swatch.addEventListener('click', () => {
        currentColor = key;
        document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        applyEditorColor(key);
      });
      colorSwatchesContainer.appendChild(swatch);
    });
  }

  function applyEditorColor(colorKey) {
    const isDark = document.body.classList.contains('theme-dark') || 
      (document.body.classList.contains('theme-system') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const c = KEEP_COLORS[colorKey] || KEEP_COLORS.default;
    editorCard.style.backgroundColor = isDark ? c.darkBg : c.bg;
    editorCard.style.borderColor = isDark ? c.darkBorder : c.border;
  }

  // -------------------------------------------------------------
  // Tags Input & Chips
  // -------------------------------------------------------------
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      let val = tagInput.value.trim().replace(/^#/, '');
      if (val && !currentTags.includes(val)) {
        currentTags.push(val.toLowerCase());
        renderTagChips();
      }
      tagInput.value = '';
    }
  });

  function renderTagChips() {
    tagsChipsList.innerHTML = '';
    currentTags.forEach(tag => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `#${escapeHtml(tag)} <span class="tag-remove" data-tag="${escapeHtml(tag)}">&times;</span>`;
      chip.querySelector('.tag-remove').addEventListener('click', () => {
        currentTags = currentTags.filter(t => t !== tag);
        renderTagChips();
      });
      tagsChipsList.appendChild(chip);
    });
  }

  // -------------------------------------------------------------
  // Save Note Permanently (Local Vault)
  // -------------------------------------------------------------
  btnSavePermanent.addEventListener('click', async () => {
    await handleSaveNote(false);
  });

  // Save Note & Push to Google Keep
  btnSaveAndSyncKeep.addEventListener('click', async () => {
    await handleSaveNote(true);
  });

  async function handleSaveNote(syncToKeep = false) {
    const title = noteTitleInput.value.trim();
    const content = noteContentInput.value.trim();
    const attachedUrl = attachedUrlText.textContent.trim();

    if (!title && !content && currentChecklistItems.length === 0 && !attachedUrl) {
      showToast('Please enter a note title, content, or checklist item', 'error');
      noteContentInput.focus();
      return;
    }

    const noteData = {
      title,
      content,
      type: currentNoteType,
      url: attachedUrl || (currentNoteType === 'link' ? activeTabInfo.url : ''),
      pageTitle: activeTabInfo.title,
      favicon: activeTabInfo.favicon,
      color: currentColor,
      pinned: isPinned,
      tags: currentTags,
      items: currentChecklistItems,
      reminderAt: currentReminderAt,
      syncedToKeep: false
    };

    try {
      const savedNote = await KeepStorage.saveNote(noteData);

      // Register native alarm reminder if set
      if (currentReminderAt && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'SET_NOTE_REMINDER',
          noteId: savedNote.id,
          reminderAt: currentReminderAt,
          title: savedNote.title || 'KeepSync Reminder'
        });
      }

      if (syncToKeep) {
        showToast('Saved to Vault! Launching Google Keep sync...', 'success');
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            action: 'SYNC_NOTE_TO_KEEP',
            id: savedNote.id
          });
        }
      } else {
        showToast('Saved permanently to KeepSync Vault!', 'success');
      }

      resetEditor();
      await refreshVault();
    } catch (err) {
      console.error('Error saving note:', err);
      showToast('Error saving note: ' + err.message, 'error');
    }
  }

  function resetEditor() {
    noteTitleInput.value = '';
    noteContentInput.value = '';
    currentTags = [];
    currentChecklistItems = [];
    isPinned = false;
    currentReminderAt = null;
    if (reminderBtnLabel) reminderBtnLabel.textContent = 'Reminder';
    if (btnReminderToggle) btnReminderToggle.classList.remove('active');
    if (reminderDropdownMenu) reminderDropdownMenu.style.display = 'none';
    if (isListening && speechRecognizer) {
      try { speechRecognizer.stop(); } catch (e) {}
      isListening = false;
      if (btnVoiceDictation) btnVoiceDictation.classList.remove('listening');
      if (voiceStatusText) voiceStatusText.textContent = 'Voice';
    }
    btnPinToggle.classList.remove('pinned');
    attachedUrlRow.style.display = 'none';
    attachedUrlText.textContent = '';
    currentColor = 'default';
    buildColorSwatches();
    applyEditorColor('default');
    renderTagChips();
    renderChecklistItems();
  }

  // Copy Note Content
  btnCopyNote.addEventListener('click', () => {
    const title = noteTitleInput.value.trim();
    let body = noteContentInput.value.trim();
    if (currentNoteType === 'checklist') {
      body = currentChecklistItems.map(i => `[${i.completed ? 'x' : ' '}] ${i.text}`).join('\n');
    }
    const fullText = (title ? `${title}\n\n` : '') + body + (attachedUrlText.textContent ? `\n\nSource: ${attachedUrlText.textContent}` : '');
    if (!fullText.trim()) {
      showToast('Nothing to copy', 'error');
      return;
    }
    navigator.clipboard.writeText(fullText).then(() => {
      showToast('Copied to clipboard!');
    });
  });

  // -------------------------------------------------------------
  // Vault Tab & Search Filtering
  // -------------------------------------------------------------
  async function refreshVault() {
    cachedNotes = await KeepStorage.getNotes(false);
    vaultCountBadge.textContent = cachedNotes.length.toString();

    renderVaultNotes();
  }

  function renderVaultNotes() {
    const filtered = KeepStorage.filterNotes(cachedNotes, {
      query: searchQuery,
      type: currentFilter === 'all' || currentFilter === 'pinned' || currentFilter === 'reminder' ? 'all' : currentFilter,
      pinnedOnly: currentFilter === 'pinned',
      remindersOnly: currentFilter === 'reminder'
    });

    vaultNotesStream.className = `notes-stream ${currentView}-view`;
    vaultNotesStream.innerHTML = '';

    if (filtered.length === 0) {
      vaultEmptyState.style.display = 'flex';
      return;
    }

    vaultEmptyState.style.display = 'none';

    // Sort: pinned first, then newest
    filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const isDark = document.body.classList.contains('theme-dark') || 
      (document.body.classList.contains('theme-system') && window.matchMedia('(prefers-color-scheme: dark)').matches);

    filtered.forEach(note => {
      const card = createNoteCardElement(note, isDark);
      vaultNotesStream.appendChild(card);
    });
  }

  function createNoteCardElement(note, isDark) {
    const card = document.createElement('div');
    card.className = `note-card ${note.pinned ? 'pinned-card' : ''}`;
    card.dataset.id = note.id;

    const c = KEEP_COLORS[note.color] || KEEP_COLORS.default;
    card.style.backgroundColor = isDark ? c.darkBg : c.bg;
    card.style.borderColor = isDark ? c.darkBorder : c.border;

    // Header
    let titleHtml = note.title ? `<div class="card-title">${escapeHtml(note.title)}</div>` : `<div class="card-title" style="color:var(--text-tertiary);font-style:italic;">Untitled Note</div>`;
    let pinHtml = note.pinned ? `<span class="card-pin-indicator" title="Pinned">📌</span>` : '';

    // Content body
    let bodyHtml = '';
    if (note.type === 'checklist' && Array.isArray(note.items) && note.items.length > 0) {
      bodyHtml = '<div class="card-checklist-preview">';
      note.items.slice(0, 5).forEach(item => {
        bodyHtml += `
          <div class="card-check-item ${item.completed ? 'done' : ''}">
            <input type="checkbox" class="card-item-chk" data-item-id="${item.id}" ${item.completed ? 'checked' : ''}>
            <span>${escapeHtml(item.text)}</span>
          </div>
        `;
      });
      if (note.items.length > 5) {
        bodyHtml += `<small style="color:var(--text-tertiary);">+${note.items.length - 5} more items</small>`;
      }
      bodyHtml += '</div>';
    } else if (note.content) {
      bodyHtml = `<div class="card-content collapsed">${escapeHtml(note.content)}</div>`;
    }

    // URL Link
    let urlHtml = '';
    if (note.url) {
      urlHtml = `
        <a href="${escapeHtml(note.url)}" target="_blank" class="card-url-link" title="${escapeHtml(note.url)}">
          🔗 ${escapeHtml(note.pageTitle || note.url.substring(0, 35))}
        </a>
      `;
    }

    // Tags
    let tagsHtml = '';
    if (note.tags && note.tags.length > 0) {
      tagsHtml = '<div class="card-tags">';
      note.tags.forEach(t => {
        tagsHtml += `<span class="card-tag">#${escapeHtml(t)}</span>`;
      });
      tagsHtml += '</div>';
    }

    // Sync status, reminder & date
    const dateFormatted = new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const syncedHtml = note.syncedToKeep 
      ? `<span class="card-synced-badge" title="Synced to Google Keep">✓ Keep</span>` 
      : `<span style="color:var(--text-tertiary);font-size:10px;">Offline</span>`;

    let reminderHtml = '';
    if (note.reminderAt) {
      const remDate = new Date(note.reminderAt);
      const remFormatted = remDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      reminderHtml = `<span class="card-reminder-badge" title="Reminder: ${remDate.toLocaleString()}">⏰ ${remFormatted}</span>`;
    }

    card.innerHTML = `
      <div>
        <div class="card-top">
          ${titleHtml}
          ${pinHtml}
        </div>
        ${bodyHtml}
        ${urlHtml}
        ${tagsHtml}
      </div>
      <div class="card-bottom">
        <div class="card-date-badge">
          <span>${dateFormatted}</span>
          ${reminderHtml}
          ${syncedHtml}
        </div>
        <div class="card-actions">
          <button type="button" class="card-btn btn-sync-keep" title="Sync / Open in Google Keep">
            <svg viewBox="0 0 24 24" width="14" height="14"><path fill="#f59e0b" d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6A4.997 4.997 0 0 1 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.63-.8 3.16-2.15 4.1z"/></svg>
          </button>
          <button type="button" class="card-btn btn-edit-note" title="Edit Note">
            <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
          </button>
          <button type="button" class="card-btn btn-copy-card" title="Copy Content">
            <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>
          </button>
          <button type="button" class="card-btn del-btn btn-trash-note" title="Move to Trash">
            <svg viewBox="0 0 24 24" width="13" height="13"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      </div>
    `;

    // Interactive checklist toggle
    card.querySelectorAll('.card-item-chk').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        e.stopPropagation();
        const itemId = chk.dataset.itemId;
        await KeepStorage.toggleChecklistItem(note.id, itemId, chk.checked);
        const itemRow = chk.closest('.card-check-item');
        if (itemRow) itemRow.classList.toggle('done', chk.checked);
      });
    });

    // Sync to Google Keep
    card.querySelector('.btn-sync-keep').addEventListener('click', (e) => {
      e.stopPropagation();
      showToast('Syncing note to Google Keep...', 'info');
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'SYNC_NOTE_TO_KEEP', id: note.id }, () => {
          showToast('Google Keep sync task initiated!');
        });
      }
    });

    // Edit Note
    card.querySelector('.btn-edit-note').addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(note);
    });

    // Copy Content
    card.querySelector('.btn-copy-card').addEventListener('click', (e) => {
      e.stopPropagation();
      let text = (note.title ? note.title + '\n\n' : '') + (note.content || '');
      if (note.type === 'checklist' && Array.isArray(note.items)) {
        text += '\n' + note.items.map(i => `[${i.completed ? 'x' : ' '}] ${i.text}`).join('\n');
      }
      if (note.url) text += `\n\nSource: ${note.url}`;
      navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!'));
    });

    // Move to Trash (Delete action)
    card.querySelector('.btn-trash-note').addEventListener('click', async (e) => {
      e.stopPropagation();
      await KeepStorage.trashNote(note.id);
      showToast('Note moved to Trash');
      await refreshVault();
      await refreshTrash();
    });

    return card;
  }

  // -------------------------------------------------------------
  // Filter & Search Handlers
  // -------------------------------------------------------------
  vaultSearchInput.addEventListener('input', () => {
    searchQuery = vaultSearchInput.value;
    btnClearSearch.style.display = searchQuery ? 'block' : 'none';
    renderVaultNotes();
  });

  btnClearSearch.addEventListener('click', () => {
    vaultSearchInput.value = '';
    searchQuery = '';
    btnClearSearch.style.display = 'none';
    renderVaultNotes();
  });

  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderVaultNotes();
    });
  });

  btnToggleLayout.addEventListener('click', () => {
    currentView = currentView === 'grid' ? 'list' : 'grid';
    renderVaultNotes();
  });

  btnSyncAllToKeep.addEventListener('click', async () => {
    const unsynced = cachedNotes.filter(n => !n.syncedToKeep);
    if (unsynced.length === 0) {
      showToast('All notes are already synced with Keep!');
      return;
    }
    showToast(`Queuing ${unsynced.length} notes for Google Keep...`);
    for (const note of unsynced) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'SYNC_NOTE_TO_KEEP', id: note.id });
      }
    }
  });

  // -------------------------------------------------------------
  // Trash Management (Restore & Permanent Delete)
  // -------------------------------------------------------------
  async function refreshTrash() {
    cachedTrash = await KeepStorage.getTrashNotes();
    trashCountBadge.textContent = cachedTrash.length.toString();
    trashSubtext.textContent = `${cachedTrash.length} notes in trash`;

    trashNotesStream.innerHTML = '';

    if (cachedTrash.length === 0) {
      trashEmptyState.style.display = 'flex';
      btnEmptyTrash.style.display = 'none';
      return;
    }

    trashEmptyState.style.display = 'none';
    btnEmptyTrash.style.display = 'flex';

    cachedTrash.forEach(note => {
      const row = document.createElement('div');
      row.className = 'trash-card';
      row.dataset.id = note.id;

      const dateTrashed = note.trashedAt ? new Date(note.trashedAt).toLocaleDateString() : '';

      row.innerHTML = `
        <div class="trash-card-top">
          <div class="trash-card-title">${escapeHtml(note.title || 'Untitled Note')}</div>
          <div class="trash-card-actions">
            <button type="button" class="btn-restore" title="Restore to vault">Restore</button>
            <button type="button" class="btn-permanent-del" title="Delete permanently">Delete Forever</button>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text-secondary);max-height:40px;overflow:hidden;">
          ${escapeHtml(note.content || (note.url || ''))}
        </div>
        <div style="font-size:10.5px;color:var(--text-tertiary);">Deleted: ${dateTrashed}</div>
      `;

      // Restore action
      row.querySelector('.btn-restore').addEventListener('click', async () => {
        await KeepStorage.restoreNote(note.id);
        showToast('Note restored to Vault');
        await refreshTrash();
        await refreshVault();
      });

      // Permanent Delete action
      row.querySelector('.btn-permanent-del').addEventListener('click', async () => {
        if (confirm(`Permanently delete "${note.title || 'Untitled'}"? This cannot be undone.`)) {
          await KeepStorage.deleteNotePermanently(note.id);
          showToast('Note permanently deleted');
          await refreshTrash();
        }
      });

      trashNotesStream.appendChild(row);
    });
  }

  btnEmptyTrash.addEventListener('click', async () => {
    if (cachedTrash.length === 0) return;
    if (confirm(`Permanently delete all ${cachedTrash.length} notes in Trash? This cannot be undone.`)) {
      const count = await KeepStorage.emptyTrash();
      showToast(`Emptied trash (${count} notes removed permanently)`);
      await refreshTrash();
    }
  });

  // -------------------------------------------------------------
  // Edit Note Modal
  // -------------------------------------------------------------
  let editSelectedColor = 'default';

  function openEditModal(note) {
    editNoteId.value = note.id;
    editNoteTitle.value = note.title || '';
    editNoteContent.value = note.content || '';
    editSelectedColor = note.color || 'default';

    buildEditColorSwatches();
    editNoteModal.style.display = 'flex';
  }

  function buildEditColorSwatches() {
    editColorSwatches.innerHTML = '';
    Object.keys(KEEP_COLORS).forEach(key => {
      const c = KEEP_COLORS[key];
      const sw = document.createElement('div');
      sw.className = `color-swatch ${key === editSelectedColor ? 'active' : ''}`;
      sw.style.backgroundColor = c.bg;
      sw.title = c.name;
      sw.addEventListener('click', () => {
        editSelectedColor = key;
        document.querySelectorAll('#editColorSwatches .color-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
      });
      editColorSwatches.appendChild(sw);
    });
  }

  btnCloseEditModal.addEventListener('click', () => editNoteModal.style.display = 'none');
  btnCancelEdit.addEventListener('click', () => editNoteModal.style.display = 'none');

  btnSaveEdit.addEventListener('click', async () => {
    const id = editNoteId.value;
    const title = editNoteTitle.value.trim();
    const content = editNoteContent.value.trim();

    await KeepStorage.updateNote(id, {
      title,
      content,
      color: editSelectedColor
    });

    editNoteModal.style.display = 'none';
    showToast('Note updated!');
    await refreshVault();
  });

  // -------------------------------------------------------------
  // Settings & Tools
  // -------------------------------------------------------------
  async function loadSettings() {
    const settings = await KeepStorage.getSettings();
    settingFloatingBadge.checked = settings.showFloatingClipBubble !== false;
    settingAutoSync.checked = !!settings.autoSyncToKeep;
    settingKeepBackground.checked = settings.keepOpenInBackground !== false;
    settingBadgeCount.checked = settings.showBadgeCounter !== false;

    // Apply Theme
    applyTheme(settings.theme || 'system');
  }

  settingFloatingBadge.addEventListener('change', async () => {
    await KeepStorage.saveSettings({ showFloatingClipBubble: settingFloatingBadge.checked });
  });

  settingAutoSync.addEventListener('change', async () => {
    await KeepStorage.saveSettings({ autoSyncToKeep: settingAutoSync.checked });
  });

  settingKeepBackground.addEventListener('change', async () => {
    await KeepStorage.saveSettings({ keepOpenInBackground: settingKeepBackground.checked });
  });

  settingBadgeCount.addEventListener('change', async () => {
    await KeepStorage.saveSettings({ showBadgeCounter: settingBadgeCount.checked });
    await KeepStorage.updateBadge();
  });

  // Export handlers
  btnExportJson.addEventListener('click', async () => {
    const jsonStr = await KeepStorage.exportBackup();
    downloadFile(jsonStr, `KeepSync_Vault_Backup_${Date.now()}.json`, 'application/json');
    showToast('Vault backup downloaded!');
  });

  btnExportMarkdown.addEventListener('click', async () => {
    const mdStr = await KeepStorage.exportMarkdown();
    downloadFile(mdStr, `KeepSync_Notes_${Date.now()}.md`, 'text/markdown');
    showToast('Markdown notes exported!');
  });

  btnExportCsv.addEventListener('click', async () => {
    const csvStr = await KeepStorage.exportCSV();
    downloadFile(csvStr, `KeepSync_Spreadsheet_${Date.now()}.csv`, 'text/csv');
    showToast('CSV notes exported!');
  });

  btnImportJson.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const content = evt.target.result;
        const res = await KeepStorage.importBackup(content, 'merge');
        showToast(`Imported ${res.imported} notes successfully!`);
        await refreshVault();
        await refreshTrash();
      } catch (err) {
        alert('Failed to import backup: ' + err.message);
      }
    };
    reader.readAsText(file);
    importFileInput.value = '';
  });

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  // -------------------------------------------------------------
  // Header Actions
  // -------------------------------------------------------------
  btnOpenKeep.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://keep.google.com/' });
  });

  btnOpenDashboard.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  btnThemeToggle.addEventListener('click', async () => {
    const currentTheme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(nextTheme);
    await KeepStorage.saveSettings({ theme: nextTheme });
  });

  function applyTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-system');
    if (theme === 'dark') {
      document.body.classList.add('theme-dark');
    } else if (theme === 'light') {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.add('theme-system');
    }
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function showToast(message, type = 'success') {
    const toast = document.getElementById('popupToast');
    const msg = document.getElementById('popupToastMsg');
    msg.textContent = message;
    toast.style.display = 'block';

    setTimeout(() => {
      toast.style.display = 'none';
    }, 2800);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }
});
