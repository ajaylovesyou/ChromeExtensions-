/**
 * KeepSync - Desktop Manager / Options Page Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  let allNotes = [];
  let currentView = 'all'; // 'all' | 'pinned' | 'snippet' | 'link' | 'checklist' | 'trash'
  let searchQuery = '';
  let selectedIds = new Set();
  let modalColor = 'default';

  // DOM Elements
  const navItems = document.querySelectorAll('.nav-item');
  const dashSearchInput = document.getElementById('dashSearchInput');
  const notesContainer = document.getElementById('notesContainer');
  const dashEmptyState = document.getElementById('dashEmptyState');
  const bulkActionBar = document.getElementById('bulkActionBar');
  const selectedCountText = document.getElementById('selectedCountText');
  const trashActionBar = document.getElementById('trashActionBar');
  const btnDashEmptyTrash = document.getElementById('btnDashEmptyTrash');
  const btnBulkSyncSelected = document.getElementById('btnBulkSyncSelected');
  const btnBulkTrashSelected = document.getElementById('btnBulkTrashSelected');
  const btnBulkClearSelection = document.getElementById('btnBulkClearSelection');
  const btnBulkSyncKeep = document.getElementById('btnBulkSyncKeep');
  const btnExportAll = document.getElementById('btnExportAll');
  const btnExportMd = document.getElementById('btnExportMd');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnImportBackup = document.getElementById('btnImportBackup');
  const dashImportFileInput = document.getElementById('dashImportFileInput');
  const btnNewNoteDash = document.getElementById('btnNewNoteDash');

  // Sidebar counters
  const sideCountAll = document.getElementById('sideCountAll');
  const sideCountPinned = document.getElementById('sideCountPinned');
  const sideCountSnippets = document.getElementById('sideCountSnippets');
  const sideCountLinks = document.getElementById('sideCountLinks');
  const sideCountChecklists = document.getElementById('sideCountChecklists');
  const sideCountReminders = document.getElementById('sideCountReminders');
  const sideCountTrash = document.getElementById('sideCountTrash');

  // Stats bar elements
  const statTotalNotes = document.getElementById('statTotalNotes');
  const statTotalWords = document.getElementById('statTotalWords');
  const statTotalChecklists = document.getElementById('statTotalChecklists');
  const statRemindersCount = document.getElementById('statRemindersCount');
  const statSyncRate = document.getElementById('statSyncRate');

  // Modal elements
  const dashEditModal = document.getElementById('dashEditModal');
  const dashModalTitle = document.getElementById('dashModalTitle');
  const btnDashCloseModal = document.getElementById('btnDashCloseModal');
  const dashEditId = document.getElementById('dashEditId');
  const dashEditTitle = document.getElementById('dashEditTitle');
  const dashEditContent = document.getElementById('dashEditContent');
  const dashColorSwatches = document.getElementById('dashColorSwatches');
  const btnDashCancelEdit = document.getElementById('btnDashCancelEdit');
  const btnDashSaveEdit = document.getElementById('btnDashSaveEdit');

  // Initial load
  const settings = await KeepStorage.getSettings();
  applyTheme(settings.theme || 'system');
  await loadDashboardNotes();
  buildModalColorSwatches();

  // Sidebar navigation click
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      currentView = item.dataset.view;
      selectedIds.clear();
      updateBulkActionBar();
      renderDashboard();
    });
  });

  // Search input
  dashSearchInput.addEventListener('input', () => {
    searchQuery = dashSearchInput.value.trim().toLowerCase();
    renderDashboard();
  });

  async function loadDashboardNotes() {
    allNotes = await KeepStorage.getNotes(true);
    updateSidebarCounters();
    renderDashboard();
  }

  function updateSidebarCounters() {
    const active = allNotes.filter(n => !n.isTrash);
    const trashed = allNotes.filter(n => !!n.isTrash);

    sideCountAll.textContent = active.length;
    sideCountPinned.textContent = active.filter(n => n.pinned).length;
    sideCountSnippets.textContent = active.filter(n => n.type === 'snippet').length;
    sideCountLinks.textContent = active.filter(n => n.type === 'link').length;
    sideCountChecklists.textContent = active.filter(n => n.type === 'checklist').length;
    if (sideCountReminders) sideCountReminders.textContent = active.filter(n => !!n.reminderAt).length;
    sideCountTrash.textContent = trashed.length;

    updateVaultStats();
  }

  function updateVaultStats() {
    const active = allNotes.filter(n => !n.isTrash);
    const stats = KeepStorage.getVaultStats(active);

    if (statTotalNotes) statTotalNotes.textContent = stats.totalNotes;
    if (statTotalWords) statTotalWords.textContent = stats.totalWords.toLocaleString();
    if (statTotalChecklists) statTotalChecklists.textContent = stats.byType.checklist || 0;
    if (statRemindersCount) statRemindersCount.textContent = stats.activeReminders;
    if (statSyncRate) statSyncRate.textContent = `${stats.syncRatePercent}%`;
  }

  function renderDashboard() {
    const isTrashView = currentView === 'trash';
    trashActionBar.style.display = isTrashView ? 'flex' : 'none';

    let displayList = isTrashView ? allNotes.filter(n => !!n.isTrash) : allNotes.filter(n => !n.isTrash);

    // View filter
    if (!isTrashView) {
      if (currentView === 'pinned') displayList = displayList.filter(n => n.pinned);
      else if (currentView === 'reminder') displayList = displayList.filter(n => !!n.reminderAt);
      else if (currentView !== 'all') displayList = displayList.filter(n => n.type === currentView);
    }

    // Search query
    if (searchQuery) {
      displayList = displayList.filter(n => {
        const tMatch = (n.title || '').toLowerCase().includes(searchQuery);
        const cMatch = (n.content || '').toLowerCase().includes(searchQuery);
        const uMatch = (n.url || '').toLowerCase().includes(searchQuery);
        const tagMatch = Array.isArray(n.tags) && n.tags.some(t => t.toLowerCase().includes(searchQuery));
        return tMatch || cMatch || uMatch || tagMatch;
      });
    }

    notesContainer.innerHTML = '';

    if (displayList.length === 0) {
      dashEmptyState.style.display = 'flex';
      return;
    }

    dashEmptyState.style.display = 'none';

    // Sort: pinned first (if active), newest first
    displayList.sort((a, b) => {
      if (!isTrashView) {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    displayList.forEach(note => {
      const card = createDashCard(note, isTrashView);
      notesContainer.appendChild(card);
    });
  }

  function createDashCard(note, isTrashView) {
    const card = document.createElement('div');
    card.className = `dash-card ${note.pinned ? 'pinned' : ''}`;
    card.dataset.id = note.id;

    const c = KEEP_COLORS[note.color] || KEEP_COLORS.default;
    card.style.backgroundColor = c.bg;
    card.style.borderColor = c.border;

    let bodyText = note.content || '';
    if (note.type === 'checklist' && Array.isArray(note.items)) {
      bodyText = note.items.map(i => `[${i.completed ? '✓' : ' '}] ${i.text}`).join('\n');
    }

    let urlHtml = note.url ? `<a href="${escapeHtml(note.url)}" target="_blank" class="dash-card-url">🔗 ${escapeHtml(note.pageTitle || note.url.substring(0, 40))}</a>` : '';
    let tagsHtml = (note.tags && note.tags.length > 0) ? `<div class="dash-card-tags">${note.tags.map(t => `<span class="dash-card-tag">#${escapeHtml(t)}</span>`).join('')}</div>` : '';

    const isSelected = selectedIds.has(note.id);

    let reminderHtml = '';
    if (note.reminderAt) {
      const remDate = new Date(note.reminderAt);
      const remFormatted = remDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      reminderHtml = `<span class="dash-reminder-badge" title="Reminder: ${remDate.toLocaleString()}">⏰ ${remFormatted}</span>`;
    }

    card.innerHTML = `
      <div class="dash-card-header">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" class="card-select-chk" ${isSelected ? 'checked' : ''}>
          <span class="dash-card-title">${escapeHtml(note.title || 'Untitled Note')}</span>
        </label>
        ${note.pinned ? '<span title="Pinned">📌</span>' : ''}
      </div>
      <div class="dash-card-body">${escapeHtml(bodyText)}</div>
      ${urlHtml}
      ${tagsHtml}
      <div class="dash-card-footer">
        <div style="display:flex;align-items:center;gap:6px;">
          <span>${new Date(note.createdAt).toLocaleDateString()}</span>
          ${reminderHtml}
        </div>
        <div class="dash-card-actions">
          ${isTrashView ? `
            <button class="dash-btn btn-dash-restore" title="Restore Note">🔄</button>
            <button class="dash-btn danger btn-dash-perm-del" title="Delete Forever">❌</button>
          ` : `
            <button class="dash-btn btn-dash-keep" title="Sync to Google Keep">⚡</button>
            <button class="dash-btn btn-dash-edit" title="Edit Note">✏️</button>
            <button class="dash-btn danger btn-dash-trash" title="Move to Trash">🗑️</button>
          `}
        </div>
      </div>
    `;

    // Selection toggle
    const chk = card.querySelector('.card-select-chk');
    chk.addEventListener('change', (e) => {
      e.stopPropagation();
      if (chk.checked) selectedIds.add(note.id);
      else selectedIds.delete(note.id);
      updateBulkActionBar();
    });

    if (isTrashView) {
      card.querySelector('.btn-dash-restore').addEventListener('click', async () => {
        await KeepStorage.restoreNote(note.id);
        await loadDashboardNotes();
      });
      card.querySelector('.btn-dash-perm-del').addEventListener('click', async () => {
        if (confirm(`Permanently delete "${note.title || 'Untitled'}"?`)) {
          await KeepStorage.deleteNotePermanently(note.id);
          await loadDashboardNotes();
        }
      });
    } else {
      card.querySelector('.btn-dash-keep').addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'SYNC_NOTE_TO_KEEP', id: note.id });
        alert('Sync task dispatched to Google Keep!');
      });
      card.querySelector('.btn-dash-edit').addEventListener('click', () => {
        openDashEditModal(note);
      });
      card.querySelector('.btn-dash-trash').addEventListener('click', async () => {
        await KeepStorage.trashNote(note.id);
        await loadDashboardNotes();
      });
    }

    return card;
  }

  function updateBulkActionBar() {
    if (selectedIds.size > 0) {
      bulkActionBar.style.display = 'flex';
      selectedCountText.textContent = `${selectedIds.size} notes selected`;
    } else {
      bulkActionBar.style.display = 'none';
    }
  }

  btnBulkClearSelection.addEventListener('click', () => {
    selectedIds.clear();
    updateBulkActionBar();
    renderDashboard();
  });

  btnBulkTrashSelected.addEventListener('click', async () => {
    if (selectedIds.size === 0) return;
    const isTrashView = currentView === 'trash';
    if (isTrashView) {
      if (confirm(`Permanently delete ${selectedIds.size} selected notes? This cannot be undone.`)) {
        await KeepStorage.bulkDeletePermanently(Array.from(selectedIds));
        selectedIds.clear();
        updateBulkActionBar();
        await loadDashboardNotes();
      }
    } else {
      await KeepStorage.bulkTrash(Array.from(selectedIds));
      selectedIds.clear();
      updateBulkActionBar();
      await loadDashboardNotes();
    }
  });

  btnBulkSyncSelected.addEventListener('click', async () => {
    for (const id of selectedIds) {
      chrome.runtime.sendMessage({ action: 'SYNC_NOTE_TO_KEEP', id });
    }
    alert(`Queued ${selectedIds.size} notes to Google Keep!`);
  });

  btnDashEmptyTrash.addEventListener('click', async () => {
    const trashed = allNotes.filter(n => n.isTrash);
    if (trashed.length === 0) return;
    if (confirm(`Permanently delete all ${trashed.length} notes in trash?`)) {
      await KeepStorage.emptyTrash();
      await loadDashboardNotes();
    }
  });

  btnBulkSyncKeep.addEventListener('click', () => {
    const unsynced = allNotes.filter(n => !n.isTrash && !n.syncedToKeep);
    if (unsynced.length === 0) {
      alert('All notes are already synced with Google Keep!');
      return;
    }
    for (const note of unsynced) {
      chrome.runtime.sendMessage({ action: 'SYNC_NOTE_TO_KEEP', id: note.id });
    }
    alert(`Queued ${unsynced.length} unsynced notes to Google Keep!`);
  });

  btnExportAll.addEventListener('click', async () => {
    const jsonStr = await KeepStorage.exportBackup();
    downloadFile(jsonStr, `KeepSync_All_Notes_Backup_${Date.now()}.json`, 'application/json');
  });

  if (btnExportMd) {
    btnExportMd.addEventListener('click', async () => {
      const mdStr = await KeepStorage.exportMarkdown();
      downloadFile(mdStr, `KeepSync_Notes_${Date.now()}.md`, 'text/markdown');
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', async () => {
      const csvStr = await KeepStorage.exportCSV();
      downloadFile(csvStr, `KeepSync_Spreadsheet_${Date.now()}.csv`, 'text/csv');
    });
  }

  if (btnImportBackup && dashImportFileInput) {
    btnImportBackup.addEventListener('click', () => {
      dashImportFileInput.click();
    });

    dashImportFileInput.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const content = evt.target.result;
          const res = await KeepStorage.importBackup(content, 'merge');
          alert(`Successfully restored backup! Imported ${res.imported} notes.`);
          await loadDashboardNotes();
        } catch (err) {
          alert('Failed to import backup: ' + err.message);
        }
      };
      reader.readAsText(file);
      dashImportFileInput.value = '';
    });
  }

  btnNewNoteDash.addEventListener('click', () => {
    openDashEditModal({ id: null, title: '', content: '', color: 'default' });
  });

  // Modal
  function openDashEditModal(note) {
    dashEditId.value = note.id || '';
    dashEditTitle.value = note.title || '';
    dashEditContent.value = note.content || '';
    modalColor = note.color || 'default';
    dashModalTitle.textContent = note.id ? 'Edit Note' : 'Create New Note';
    highlightModalColor(modalColor);
    dashEditModal.style.display = 'flex';
  }

  function buildModalColorSwatches() {
    dashColorSwatches.innerHTML = '';
    Object.keys(KEEP_COLORS).forEach(k => {
      const c = KEEP_COLORS[k];
      const sw = document.createElement('div');
      sw.className = `swatch-item ${k === modalColor ? 'active' : ''}`;
      sw.style.backgroundColor = c.bg;
      sw.title = c.name;
      sw.addEventListener('click', () => {
        modalColor = k;
        highlightModalColor(k);
      });
      dashColorSwatches.appendChild(sw);
    });
  }

  function highlightModalColor(key) {
    document.querySelectorAll('.swatch-item').forEach(sw => {
      sw.classList.toggle('active', sw.title === (KEEP_COLORS[key] || {}).name);
    });
  }

  btnDashCloseModal.addEventListener('click', () => dashEditModal.style.display = 'none');
  btnDashCancelEdit.addEventListener('click', () => dashEditModal.style.display = 'none');

  btnDashSaveEdit.addEventListener('click', async () => {
    const id = dashEditId.value;
    const title = dashEditTitle.value.trim();
    const content = dashEditContent.value.trim();

    if (!title && !content) {
      alert('Please enter a title or note content.');
      return;
    }

    if (id) {
      await KeepStorage.updateNote(id, { title, content, color: modalColor });
    } else {
      await KeepStorage.saveNote({ title, content, color: modalColor, type: 'note' });
    }

    dashEditModal.style.display = 'none';
    await loadDashboardNotes();
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

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.innerText = text;
    return div.innerHTML;
  }
});
