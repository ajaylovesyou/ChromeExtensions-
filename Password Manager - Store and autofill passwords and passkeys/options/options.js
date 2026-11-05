/**
 * Bitwarden Web Vault - Options Page Controller
 * Desktop dashboard with dual-pane layout, passkey inspection, health audit, and data portability.
 */

(function() {
  'use strict';

  let currentCategory = 'all';
  let currentFolderId = null;
  let activeSearchQuery = '';
  let selectedItemId = null;
  let totpInterval = null;

  // DOM Elements
  const paneItemsList = document.getElementById('pane-items-list');
  const paneItemDetail = document.getElementById('pane-item-detail');
  const paneHealthView = document.getElementById('pane-health-view');
  const paneSettingsView = document.getElementById('pane-settings-view');
  const paneGeneratorView = document.getElementById('pane-generator-view');

  const fullItemsList = document.getElementById('full-items-list');
  const emptyListPlaceholder = document.getElementById('empty-list-placeholder');
  const paneCategoryTitle = document.getElementById('pane-category-title');
  const paneItemsCount = document.getElementById('pane-items-count');
  const fullSearchInput = document.getElementById('full-search-input');

  const detailEmptyView = document.getElementById('detail-empty-view');
  const detailActiveView = document.getElementById('detail-active-view');

  // Sidebar counters
  const cntAll = document.getElementById('cnt-all');
  const cntFav = document.getElementById('cnt-fav');
  const cntLogin = document.getElementById('cnt-login');
  const cntPasskey = document.getElementById('cnt-passkey');
  const cntCard = document.getElementById('cnt-card');
  const cntNote = document.getElementById('cnt-note');
  const sidebarHealthScore = document.getElementById('sidebar-health-score');
  const sidebarFoldersNav = document.getElementById('sidebar-folders-nav');

  /**
   * Toast notification
   */
  function showToast(msg) {
    const toast = document.getElementById('options-toast');
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 2800);
  }

  /**
   * Copy helper
   */
  async function copyText(text, label = 'Copied to clipboard!') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);
    } catch {
      showToast('Copy failed');
    }
  }

  /**
   * Initialize Options Dashboard
   */
  async function init() {
    const settings = await BitVault.getSettings();
    document.body.className = settings.theme || 'theme-bitwarden-blue';
    const themeSelect = document.getElementById('full-theme-select');
    if (themeSelect) themeSelect.value = settings.theme || 'theme-bitwarden-blue';

    await BitVault.init();

    if (BitVault.isLocked()) {
      // Prompt user or redirect to unlock
      alert('Vault is currently locked. Please unlock CipherVault in the browser extension icon first.');
    }

    renderSidebar();
    renderItemsList();
    renderHealthAudit();
    startTotpTimer();
  }

  /**
   * Render Sidebar Categories & Folders
   */
  async function renderSidebar() {
    const allItems = BitVault.getItems();
    const favs = allItems.filter(i => i.favorite);
    const logins = allItems.filter(i => i.type === 'login' || !i.type);
    const passkeys = allItems.filter(i => i.type === 'passkey');
    const cards = allItems.filter(i => i.type === 'card');
    const notes = allItems.filter(i => i.type === 'note');

    cntAll.textContent = allItems.length;
    cntFav.textContent = favs.length;
    cntLogin.textContent = logins.length;
    cntPasskey.textContent = passkeys.length;
    cntCard.textContent = cards.length;
    cntNote.textContent = notes.length;

    // Health Score
    const audit = BitHealth.auditVault(allItems);
    sidebarHealthScore.textContent = `${audit.score}%`;
    sidebarHealthScore.style.backgroundColor = audit.gradeColor;

    // Folders
    const folders = await BitVault.getFolders();
    sidebarFoldersNav.innerHTML = '';
    folders.forEach(f => {
      const folderItems = allItems.filter(i => i.folder === f.name || i.folderId === f.id);
      const btn = document.createElement('button');
      btn.className = `nav-item ${currentFolderId === f.name ? 'active' : ''}`;
      btn.innerHTML = `
        <span class="nav-icon">📁</span>
        <span class="nav-label">${escapeHtml(f.name)}</span>
        <span class="nav-counter">${folderItems.length}</span>
      `;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = 'folder';
        currentFolderId = f.name;
        showVaultPanes();
        renderItemsList();
      });
      sidebarFoldersNav.appendChild(btn);
    });
  }

  /**
   * Show Vault Panes vs Full-Page Views
   */
  function showVaultPanes() {
    paneItemsList.style.display = 'flex';
    paneItemDetail.style.display = 'block';
    paneHealthView.style.display = 'none';
    paneSettingsView.style.display = 'none';
    if (paneGeneratorView) paneGeneratorView.style.display = 'none';
  }

  function showSpecialView(viewName) {
    paneItemsList.style.display = 'none';
    paneItemDetail.style.display = 'none';
    paneHealthView.style.display = viewName === 'health' ? 'block' : 'none';
    paneSettingsView.style.display = viewName === 'settings' ? 'block' : 'none';
    if (paneGeneratorView) paneGeneratorView.style.display = viewName === 'generator' ? 'block' : 'none';

    if (viewName === 'health') {
      renderHealthAudit();
    } else if (viewName === 'generator') {
      renderOptionsGenerator();
    }
  }

  /**
   * Sidebar navigation listeners
   */
  document.querySelectorAll('.sidebar-nav .nav-item[data-nav]').forEach(item => {
    item.addEventListener('click', () => {
      const nav = item.getAttribute('data-nav');
      document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => b.classList.remove('active'));
      item.classList.add('active');

      currentFolderId = null;

      if (nav === 'health') {
        showSpecialView('health');
      } else if (nav === 'settings') {
        showSpecialView('settings');
      } else if (nav === 'generator') {
        showSpecialView('generator');
      } else if (nav === 'send') {
        alert('Create and manage encrypted Bitwarden Send items directly from the extension popup.');
      } else if (nav === 'playground') {
        window.open('../test/autofill-test-page.html', '_blank');
      } else {
        currentCategory = nav;
        showVaultPanes();
        renderItemsList();
      }
    });
  });

  /**
   * Top Header "+ New Item" Button
   */
  document.getElementById('btn-top-add-item')?.addEventListener('click', () => {
    // Switch to generator view which includes the quick-save form for new credentials
    const genTab = document.querySelector('.sidebar-nav .nav-item[data-nav="generator"]');
    if (genTab) {
      genTab.click();
    }
  });

  /**
   * Add Folder Button
   */
  document.getElementById('btn-sidebar-add-folder')?.addEventListener('click', async () => {
    const name = prompt('Enter new folder name:');
    if (name && name.trim()) {
      await BitVault.addFolder(name.trim());
      renderSidebar();
      showToast('Folder created');
    }
  });

  /**
   * Lock Vault Button
   */
  document.getElementById('btn-sidebar-lock')?.addEventListener('click', () => {
    BitVault.lockVault();
    alert('Vault locked.');
    window.close();
  });

  /**
   * Render Middle Items List
   */
  function renderItemsList() {
    let items = BitVault.getItems();

    // Category title
    const titles = {
      all: 'All Vault Items',
      favorites: 'Favorites (★)',
      login: 'Logins',
      passkey: 'Passkeys (FIDO2 / WebAuthn)',
      card: 'Payment Cards',
      note: 'Secure Notes',
      folder: `Folder: ${currentFolderId}`
    };
    paneCategoryTitle.textContent = titles[currentCategory] || 'Vault Items';

    // Filter
    if (currentCategory === 'favorites') {
      items = items.filter(i => i.favorite);
    } else if (currentCategory === 'folder') {
      items = items.filter(i => i.folder === currentFolderId || i.folderId === currentFolderId);
    } else if (currentCategory !== 'all') {
      items = items.filter(i => i.type === currentCategory || (!i.type && currentCategory === 'login'));
    }

    // Search query
    if (activeSearchQuery) {
      const q = activeSearchQuery.toLowerCase();
      items = items.filter(i => {
        return (i.name && i.name.toLowerCase().includes(q)) ||
               (i.username && i.username.toLowerCase().includes(q)) ||
               (i.uri && i.uri.toLowerCase().includes(q)) ||
               (i.notes && i.notes.toLowerCase().includes(q)) ||
               (i.rpId && i.rpId.toLowerCase().includes(q));
      });
    }

    paneItemsCount.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
    fullItemsList.innerHTML = '';

    if (items.length === 0) {
      emptyListPlaceholder.style.display = 'block';
      detailActiveView.style.display = 'none';
      detailEmptyView.style.display = 'flex';
      return;
    }

    emptyListPlaceholder.style.display = 'none';

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = `full-item-card ${item.id === selectedItemId ? 'active' : ''}`;

      let icon = (item.name || 'U').charAt(0).toUpperCase();
      let sub = item.username || item.uri || 'Login';

      if (item.type === 'passkey') { icon = '🔑'; sub = `Passkey • ${item.rpId}`; }
      else if (item.type === 'card') { icon = '💳'; sub = `Ending in ${item.number?.slice(-4) || '••••'}`; }
      else if (item.type === 'note') { icon = '📝'; sub = 'Secure Note'; }

      card.innerHTML = `
        <div class="item-left-info">
          <div class="item-icon-circle">${icon}</div>
          <div class="item-text-col">
            <span class="item-main-name">${escapeHtml(item.name || 'Untitled')}</span>
            <span class="item-sub-user">${escapeHtml(sub)}</span>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${item.favorite ? '<span style="color:#eab308; font-size:14px;">★</span>' : ''}
          ${item.totpSecret ? '<span class="badge-2fa">2FA</span>' : ''}
          <button class="btn-opt-card-delete" title="Delete item" style="background:transparent; border:none; cursor:pointer; color:#94a3b8; font-size:14px; padding:2px 4px; border-radius:4px; transition:color 0.15s ease;">🗑</button>
        </div>
      `;

      card.querySelector('.btn-opt-card-delete')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
          const name = item.name || 'Item';
          await BitVault.deleteItem(item.id);
          if (selectedItemId === item.id) {
            selectedItemId = null;
            renderItemDetails(null);
          }
          renderSidebar();
          renderItemsList();
          showToast(`Deleted "${name}"`);
        } catch (err) {
          showToast('Could not delete: ' + (err.message || err));
        }
      });

      card.addEventListener('click', () => {
        selectedItemId = item.id;
        document.querySelectorAll('.full-item-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        renderItemDetails(item);
      });

      fullItemsList.appendChild(card);
    });

    // Auto select first item if none selected
    if (!selectedItemId && items.length > 0) {
      selectedItemId = items[0].id;
      renderItemDetails(items[0]);
    }
  }

  /**
   * Render Item Details in Right Pane
   */
  function renderItemDetails(item) {
    if (!item) {
      detailActiveView.style.display = 'none';
      detailEmptyView.style.display = 'flex';
      return;
    }

    detailEmptyView.style.display = 'none';
    detailActiveView.style.display = 'block';

    let icon = (item.name || 'U').charAt(0).toUpperCase();
    let typeLabel = 'Login Credential';
    if (item.type === 'passkey') { icon = '🔑'; typeLabel = 'Passkey (FIDO2 / WebAuthn)'; }
    else if (item.type === 'card') { icon = '💳'; typeLabel = 'Payment Card'; }
    else if (item.type === 'note') { icon = '📝'; typeLabel = 'Secure Note'; }

    let fieldsHtml = '';

    // Login Fields
    if (item.type === 'login' || !item.type) {
      if (item.uri) {
        fieldsHtml += `
          <div class="field-block">
            <span class="field-label">Website URL</span>
            <div class="field-value-row">
              <a href="${escapeHtml(item.uri)}" target="_blank" style="color:var(--primary); text-decoration:none;">${escapeHtml(item.uri)} ↗</a>
              <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(item.uri)}')">Copy</button>
            </div>
          </div>
        `;
      }
      if (item.username) {
        fieldsHtml += `
          <div class="field-block">
            <span class="field-label">Username</span>
            <div class="field-value-row">
              <span>${escapeHtml(item.username)}</span>
              <button class="btn btn-secondary btn-sm btn-copy-username">Copy</button>
            </div>
          </div>
        `;
      }
      if (item.password) {
        fieldsHtml += `
          <div class="field-block">
            <span class="field-label">Password</span>
            <div class="field-value-row">
              <span id="full-pwd-display">••••••••••••••••</span>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-secondary btn-sm" id="btn-toggle-full-pwd">Reveal</button>
                <button class="btn btn-secondary btn-sm btn-copy-password">Copy</button>
              </div>
            </div>
          </div>
        `;
      }
      if (item.totpSecret) {
        fieldsHtml += `
          <div class="field-block">
            <span class="field-label">Two-Factor Authenticator (TOTP)</span>
            <div class="field-value-row">
              <span id="full-totp-display" class="totp-code-display">------</span>
              <button class="btn btn-secondary btn-sm btn-copy-totp">Copy Code</button>
            </div>
          </div>
        `;
      }
    } else if (item.type === 'passkey') {
      // Passkey Properties
      fieldsHtml += `
        <div class="field-block">
          <span class="field-label">Relying Party Domain (RP ID)</span>
          <div class="field-value-row">
            <strong>${escapeHtml(item.rpId)}</strong>
          </div>
        </div>
        <div class="field-block">
          <span class="field-label">User Account</span>
          <div class="field-value-row">
            <span>${escapeHtml(item.userName)}</span>
            <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(item.userName)}')">Copy</button>
          </div>
        </div>
        <div class="field-block">
          <span class="field-label">Cryptographic Algorithm</span>
          <div class="field-value-row">
            <span>${escapeHtml(item.algorithm || 'ES256 (ECDSA P-256)')}</span>
          </div>
        </div>
        <div class="field-block">
          <span class="field-label">Public Key Fingerprint (SHA-256)</span>
          <div class="field-value-row">
            <code class="code-pill">${escapeHtml(item.fingerprint || 'e89a4bc1029df4')}</code>
          </div>
        </div>
        <div class="field-block">
          <span class="field-label">Credential ID</span>
          <div class="field-value-row">
            <code style="font-size:11px; word-break:break-all;">${escapeHtml(item.credentialId)}</code>
          </div>
        </div>
      `;
    } else if (item.type === 'card') {
      // Card Properties
      fieldsHtml += `
        <div class="field-block">
          <span class="field-label">Cardholder</span>
          <div class="field-value-row"><span>${escapeHtml(item.cardholderName || '')}</span></div>
        </div>
        <div class="field-block">
          <span class="field-label">Card Number</span>
          <div class="field-value-row">
            <span>${escapeHtml(item.number || '')}</span>
            <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${escapeHtml(item.number || '')}')">Copy</button>
          </div>
        </div>
        <div class="field-block">
          <span class="field-label">Expiration & CVV</span>
          <div class="field-value-row">
            <span>Exp: ${escapeHtml(item.expMonth)}/${escapeHtml(item.expYear)} • CVV: ${escapeHtml(item.code)}</span>
          </div>
        </div>
      `;
    }

    if (item.notes) {
      fieldsHtml += `
        <div class="field-block">
          <span class="field-label">Notes</span>
          <div style="font-size:13px; line-height:1.5; color:var(--text-main); white-space:pre-wrap; margin-top:4px;">${escapeHtml(item.notes)}</div>
        </div>
      `;
    }

    detailActiveView.innerHTML = `
      <div class="detail-header-card">
        <div class="detail-title-group">
          <div class="detail-large-icon">${icon}</div>
          <div class="detail-title-text">
            <h2>${escapeHtml(item.name || 'Untitled Item')}</h2>
            <span>${typeLabel} • Folder: ${escapeHtml(item.folder || 'Personal')}</span>
          </div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-danger btn-sm" id="btn-full-delete-item">Delete</button>
        </div>
      </div>
      <div class="detail-fields-grid">
        ${fieldsHtml}
      </div>
    `;

    // Hook listeners
    detailActiveView.querySelector('.btn-copy-username')?.addEventListener('click', () => {
      copyText(item.username, 'Username copied!');
    });

    detailActiveView.querySelector('.btn-copy-password')?.addEventListener('click', () => {
      copyText(item.password, 'Password copied!');
    });

    const btnTogglePwd = detailActiveView.querySelector('#btn-toggle-full-pwd');
    const pwdDisplay = detailActiveView.querySelector('#full-pwd-display');
    if (btnTogglePwd && pwdDisplay) {
      let isRevealed = false;
      btnTogglePwd.addEventListener('click', () => {
        isRevealed = !isRevealed;
        pwdDisplay.textContent = isRevealed ? item.password : '••••••••••••••••';
        btnTogglePwd.textContent = isRevealed ? 'Hide' : 'Reveal';
      });
    }

    detailActiveView.querySelector('.btn-copy-totp')?.addEventListener('click', async () => {
      if (item.totpSecret) {
        const totp = await BitTOTP.generateTOTP(item.totpSecret);
        if (totp) copyText(totp.code, 'TOTP code copied!');
      }
    });

    detailActiveView.querySelector('#btn-full-delete-item')?.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const delId = item.id;
        const delName = item.name || 'Item';
        await BitVault.deleteItem(delId);
        selectedItemId = null;
        renderItemDetails(null);
        renderSidebar();
        renderItemsList();
        showToast(`Deleted "${delName}"`);
      } catch (err) {
        console.error('Full delete error:', err);
        showToast('Could not delete: ' + (err.message || err));
      }
    });

    updateFullTotpDisplay(item);
  }

  /**
   * TOTP updates in options view
   */
  async function updateFullTotpDisplay(item) {
    if (!item || !item.totpSecret) return;
    const totpSpan = document.getElementById('full-totp-display');
    if (totpSpan) {
      try {
        const totp = await BitTOTP.generateTOTP(item.totpSecret);
        if (totp) {
          totpSpan.textContent = `${totp.formatted} (${totp.secondsRemaining}s)`;
        }
      } catch {}
    }
  }

  function startTotpTimer() {
    stopTotpTimer();
    totpInterval = setInterval(() => {
      if (selectedItemId) {
        const item = BitVault.getItems().find(i => i.id === selectedItemId);
        if (item && item.totpSecret) {
          updateFullTotpDisplay(item);
        }
      }
    }, 1000);
  }

  function stopTotpTimer() {
    if (totpInterval) {
      clearInterval(totpInterval);
      totpInterval = null;
    }
  }

  /**
   * Search input listener
   */
  fullSearchInput?.addEventListener('input', (e) => {
    activeSearchQuery = e.target.value.trim();
    renderItemsList();
  });

  /**
   * Security Health & Breach Audit Dashboard
   */
  function renderHealthAudit() {
    const items = BitVault.getItems();
    const audit = BitHealth.auditVault(items);

    document.getElementById('dash-gauge-score').textContent = `${audit.score}%`;
    document.getElementById('dash-gauge-score').style.backgroundColor = audit.gradeColor;

    document.getElementById('dash-grade-heading').textContent = `Vault Health: Grade ${audit.grade} (${audit.score >= 80 ? 'Secure' : 'Action Recommended'})`;
    document.getElementById('dash-grade-desc').textContent = `${audit.weakPasswords.length} weak passwords, ${audit.reusedGroups.length} reused password groups, ${audit.inactive2FA.length} accounts missing 2FA.`;

    document.getElementById('val-breached-count').textContent = audit.breachedPasswords.length;
    document.getElementById('val-reused-count').textContent = audit.reusedGroups.length;
    document.getElementById('val-weak-count').textContent = audit.weakPasswords.length;
    document.getElementById('val-2fa-count').textContent = audit.inactive2FA.length;

    // Render lists
    const listWeak = document.getElementById('list-weak-items');
    listWeak.innerHTML = '';
    audit.weakPasswords.slice(0, 5).forEach(wp => {
      const pill = document.createElement('div');
      pill.className = 'metric-item-pill';
      pill.innerHTML = `
        <strong>${escapeHtml(wp.item.name)}</strong>
        <span style="color:#ef4444;">${escapeHtml(wp.reason)}</span>
      `;
      listWeak.appendChild(pill);
    });

    const listReused = document.getElementById('list-reused-items');
    listReused.innerHTML = '';
    audit.reusedGroups.slice(0, 5).forEach(rg => {
      const pill = document.createElement('div');
      pill.className = 'metric-item-pill';
      pill.innerHTML = `
        <span>${rg.items.map(i => escapeHtml(i.name)).join(', ')}</span>
        <span style="color:#f59e0b; font-weight:700;">Reused (${rg.count})</span>
      `;
      listReused.appendChild(pill);
    });

    const list2FA = document.getElementById('list-2fa-items');
    list2FA.innerHTML = '';
    audit.inactive2FA.slice(0, 5).forEach(two => {
      const pill = document.createElement('div');
      pill.className = 'metric-item-pill';
      pill.innerHTML = `
        <strong>${escapeHtml(two.item.name)}</strong>
        <span style="color:#10b981;">Supports TOTP 2FA</span>
      `;
      list2FA.appendChild(pill);
    });
  }

  /**
   * Export to JSON
   */
  document.getElementById('btn-full-export-json')?.addEventListener('click', () => {
    const items = BitVault.getItems();
    const jsonStr = BitImporter.exportToBitwardenJSON(items);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciphervault_vault_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('Vault exported to JSON');
  });

  /**
   * Export to CSV
   */
  document.getElementById('btn-full-export-csv')?.addEventListener('click', () => {
    const items = BitVault.getItems();
    const csvStr = BitImporter.exportToBitwardenCSV(items);
    const blob = new Blob([csvStr], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciphervault_vault_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    showToast('Vault exported to CSV');
  });

  /**
   * Import Handler
   */
  document.getElementById('btn-full-import')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const content = evt.target.result;
          const importedItems = BitImporter.importVaultData(content);
          for (const item of importedItems) {
            await BitVault.addItem(item);
          }
          showToast(`Successfully imported ${importedItems.length} items!`);
          renderSidebar();
          renderItemsList();
        } catch (err) {
          showToast('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  /**
   * Theme Selector
   */
  document.getElementById('full-theme-select')?.addEventListener('change', async (e) => {
    const theme = e.target.value;
    document.body.className = theme;
    await BitVault.saveSettings({ theme });
    showToast('Theme updated');
  });

  // ==================== GENERATOR VIEW CONTROLLER IN OPTIONS ====================
  let lastOptGenPassword = '';
  let isOptCustomPasswordMode = false;
  const btnOptPwdAuto = document.getElementById('btn-opt-pwd-auto');
  const btnOptPwdCustom = document.getElementById('btn-opt-pwd-custom');
  const inputOptGenPwd = document.getElementById('input-opt-gen-pwd');
  const btnToggleOptGenPwd = document.getElementById('btn-toggle-opt-gen-pwd');
  const optCustomPwdStrength = document.getElementById('opt-custom-pwd-strength');

  function renderOptionsGenerator() {
    const len = parseInt(document.getElementById('slider-opt-pwd-len')?.value || '16', 10);
    const upper = document.getElementById('chk-opt-gen-upper')?.checked ?? true;
    const lower = document.getElementById('chk-opt-gen-lower')?.checked ?? true;
    const num = document.getElementById('chk-opt-gen-num')?.checked ?? true;
    const spec = document.getElementById('chk-opt-gen-spec')?.checked ?? true;

    const lbl = document.getElementById('lbl-opt-pwd-len');
    if (lbl) lbl.textContent = len;

    const pwd = BitGenerator.generatePassword({
      length: len,
      uppercase: upper,
      lowercase: lower,
      numbers: num,
      special: spec,
      avoidAmbiguous: true
    });

    lastOptGenPassword = pwd;
    const outputEl = document.getElementById('opt-gen-output');
    if (outputEl) outputEl.textContent = pwd;

    if (inputOptGenPwd && !isOptCustomPasswordMode) {
      inputOptGenPwd.value = pwd;
    }

    const rating = BitCrypto.ratePasswordStrength(pwd);
    const strLabel = document.getElementById('opt-gen-strength-label');
    const entLabel = document.getElementById('opt-gen-entropy-label');
    const fillEl = document.getElementById('opt-gen-strength-fill');

    if (strLabel) strLabel.textContent = rating.label;
    if (entLabel) entLabel.textContent = `${rating.entropy} bits • ${rating.crackTime}`;
    if (fillEl) {
      fillEl.style.width = `${Math.min(100, Math.max(15, (rating.score + 1) * 20))}%`;
      fillEl.style.backgroundColor = rating.color;
    }
  }

  function updateOptCustomStrength(val) {
    if (!optCustomPwdStrength) return;
    if (!val) {
      optCustomPwdStrength.style.display = 'none';
      optCustomPwdStrength.innerHTML = '';
      return;
    }
    const rating = BitCrypto.ratePasswordStrength(val);
    optCustomPwdStrength.style.display = 'flex';
    optCustomPwdStrength.innerHTML = `Strength: <span style="color:${rating.color}; font-weight:700;">${rating.label}</span> (${rating.entropy} bits • Crack time: ${rating.crackTime})`;
  }

  btnOptPwdAuto?.addEventListener('click', () => {
    isOptCustomPasswordMode = false;
    btnOptPwdAuto.classList.add('active');
    btnOptPwdCustom?.classList.remove('active');
    if (inputOptGenPwd) {
      inputOptGenPwd.placeholder = 'Generated password';
      inputOptGenPwd.value = lastOptGenPassword;
    }
    if (optCustomPwdStrength) optCustomPwdStrength.style.display = 'none';
  });

  btnOptPwdCustom?.addEventListener('click', () => {
    isOptCustomPasswordMode = true;
    btnOptPwdCustom.classList.add('active');
    btnOptPwdAuto?.classList.remove('active');
    if (inputOptGenPwd) {
      inputOptGenPwd.value = '';
      inputOptGenPwd.placeholder = 'Type your custom password here...';
      inputOptGenPwd.focus();
    }
    updateOptCustomStrength('');
  });

  inputOptGenPwd?.addEventListener('input', () => {
    if (inputOptGenPwd.value.length > 0) {
      if (!isOptCustomPasswordMode) {
        isOptCustomPasswordMode = true;
        btnOptPwdCustom?.classList.add('active');
        btnOptPwdAuto?.classList.remove('active');
      }
      updateOptCustomStrength(inputOptGenPwd.value);
    } else if (isOptCustomPasswordMode) {
      updateOptCustomStrength('');
    }
  });

  btnToggleOptGenPwd?.addEventListener('click', () => {
    if (inputOptGenPwd) {
      if (inputOptGenPwd.type === 'password') {
        inputOptGenPwd.type = 'text';
        btnToggleOptGenPwd.textContent = '🙈';
      } else {
        inputOptGenPwd.type = 'password';
        btnToggleOptGenPwd.textContent = '👁';
      }
    }
  });

  document.getElementById('slider-opt-pwd-len')?.addEventListener('input', renderOptionsGenerator);
  ['chk-opt-gen-upper', 'chk-opt-gen-lower', 'chk-opt-gen-num', 'chk-opt-gen-spec'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderOptionsGenerator);
  });

  document.getElementById('btn-opt-refresh-gen')?.addEventListener('click', renderOptionsGenerator);

  document.getElementById('btn-opt-copy-gen')?.addEventListener('click', () => {
    if (lastOptGenPassword) {
      copyToClipboard(lastOptGenPassword, 'Generated password copied!');
    }
  });

  // Save to Vault from Generator in Options
  document.getElementById('btn-opt-gen-save')?.addEventListener('click', async () => {
    const email = document.getElementById('input-opt-gen-email')?.value.trim();
    let name = document.getElementById('input-opt-gen-name')?.value.trim();
    const pwdToSave = inputOptGenPwd?.value || lastOptGenPassword;

    if (!email) {
      showToast('Please enter an Email ID or Username');
      document.getElementById('input-opt-gen-email')?.focus();
      return;
    }

    if (!pwdToSave) {
      showToast('Please enter or generate a password');
      return;
    }

    if (!name) name = 'Generated Login';

    try {
      const newItem = {
        id: BitCrypto.generateUUID(),
        type: 'login',
        name,
        uri: `https://${name.toLowerCase().replace(/\s+/g, '')}.com`,
        username: email,
        password: pwdToSave,
        folder: 'Personal',
        favorite: false,
        notes: `Created via Web Vault Generator on ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await BitVault.addItem(newItem);
      showToast('✓ Successfully saved password & email to Vault!');
      renderSidebar();

      // Clear input fields
      const emailInput = document.getElementById('input-opt-gen-email');
      const nameInput = document.getElementById('input-opt-gen-name');
      if (emailInput) emailInput.value = '';
      if (nameInput) nameInput.value = '';
      if (inputOptGenPwd && isOptCustomPasswordMode) inputOptGenPwd.value = '';
    } catch (err) {
      showToast('Error saving: ' + err.message);
    }
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
