/**
 * Bitwarden Password Manager - Popup Controller
 * Full orchestration of vault views, cryptographic unlocking, generator, send, and in-tab autofill.
 */

(function() {
  'use strict';

  let currentTabUrl = '';
  let currentTabId = null;
  let activeFilter = 'all';
  let searchQuery = '';
  let editingItemId = null;
  let viewingItemId = null;
  let totpInterval = null;

  // DOM Elements
  const viewVault = document.getElementById('view-vault');
  const viewGenerator = document.getElementById('view-generator');
  const viewSend = document.getElementById('view-send');
  const viewSettings = document.getElementById('view-settings');
  const viewAuth = document.getElementById('view-auth');

  const bottomNav = document.getElementById('bottom-nav');
  const headerActions = document.getElementById('header-actions');

  const authUnlockForm = document.getElementById('auth-unlock-form');
  const authSetupForm = document.getElementById('auth-setup-form');
  const authStatusText = document.getElementById('auth-status-text');

  // Input & Modal Elements
  const inputUnlockPassword = document.getElementById('input-unlock-password');
  const inputUnlockPin = document.getElementById('input-unlock-pin');
  const btnDoUnlock = document.getElementById('btn-do-unlock');
  const btnShowHint = document.getElementById('btn-show-hint');
  const boxPasswordHint = document.getElementById('box-password-hint');

  const inputSetupPassword = document.getElementById('input-setup-password');
  const inputSetupConfirm = document.getElementById('input-setup-confirm');
  const inputSetupHint = document.getElementById('input-setup-hint');
  const btnDoSetup = document.getElementById('btn-do-setup');

  const vaultSearchInput = document.getElementById('vault-search-input');
  const btnClearSearch = document.getElementById('btn-clear-search');
  const vaultItemsList = document.getElementById('vault-items-list');
  const vaultEmptyState = document.getElementById('vault-empty-state');
  const vaultTotalCount = document.getElementById('vault-total-count');

  const tabLoginsSection = document.getElementById('tab-logins-section');
  const tabLoginsList = document.getElementById('tab-logins-list');
  const tabMatchCount = document.getElementById('tab-match-count');

  // Modal Item Elements
  const modalItem = document.getElementById('modal-item');
  const modalItemTitle = document.getElementById('modal-item-title');
  const itemTypeSelect = document.getElementById('item-type-select');
  const itemNameInput = document.getElementById('item-name-input');
  const itemFolderSelect = document.getElementById('item-folder-select');
  const itemUriInput = document.getElementById('item-uri-input');
  const itemUsernameInput = document.getElementById('item-username-input');
  const itemPasswordInput = document.getElementById('item-password-input');
  const btnModalPwdCustom = document.getElementById('btn-modal-pwd-custom');
  const btnModalGenPwd = document.getElementById('btn-modal-gen-pwd');
  const modalPwdStrengthHint = document.getElementById('modal-pwd-strength-hint');
  const itemTotpInput = document.getElementById('item-totp-input');
  const itemNotesInput = document.getElementById('item-notes-input');
  const itemFavoriteCheck = document.getElementById('item-favorite-check');

  // Passkey Specific Modal Inputs
  const modalFieldsLogin = document.getElementById('modal-fields-login');
  const modalFieldsPasskey = document.getElementById('modal-fields-passkey');
  const modalFieldsCard = document.getElementById('modal-fields-card');
  const itemRpidInput = document.getElementById('item-rpid-input');
  const itemPkUsernameInput = document.getElementById('item-pk-username-input');
  const itemPkDisplayInput = document.getElementById('item-pk-display-input');

  // Card Specific Modal Inputs
  const itemCardholderInput = document.getElementById('item-cardholder-input');
  const itemBrandSelect = document.getElementById('item-brand-select');
  const itemCardnumInput = document.getElementById('item-cardnum-input');
  const itemExpmonthInput = document.getElementById('item-expmonth-input');
  const itemExpyearInput = document.getElementById('item-expyear-input');
  const itemCvvInput = document.getElementById('item-cvv-input');

  // Details Modal Elements
  const modalDetails = document.getElementById('modal-details');
  const detailItemTitle = document.getElementById('detail-item-title');
  const detailItemSubtitle = document.getElementById('detail-item-subtitle');
  const detailTypeIcon = document.getElementById('detail-type-icon');
  const detailFieldsBody = document.getElementById('detail-fields-body');

  /**
   * Show Toast Alert
   */
  function showToast(message, duration = 2500) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, duration);
  }

  /**
   * Secure Copy to Clipboard
   */
  async function copyToClipboard(text, label = 'Copied to clipboard!') {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast(label);

      // Auto clear clipboard after configured timeout
      const settings = await BitVault.getSettings();
      const seconds = settings.clipboardClearSeconds || 30;
      if (seconds > 0) {
        setTimeout(async () => {
          try {
            const currentClip = await navigator.clipboard.readText();
            if (currentClip === text) {
              await navigator.clipboard.writeText('');
            }
          } catch {}
        }, seconds * 1000);
      }
    } catch {
      showToast('Could not copy to clipboard');
    }
  }

  /**
   * Switch Active View
   */
  function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));

    const targetView = document.getElementById(viewId);
    if (targetView) targetView.classList.add('active');

    const targetTab = document.querySelector(`.nav-tab[data-view="${viewId}"]`);
    if (targetTab) targetTab.classList.add('active');

    if (viewId === 'view-generator') {
      if (currentTabUrl && genSaveSite && !genSaveSite.value) {
        try {
          const u = new URL(currentTabUrl);
          const domain = u.hostname.replace(/^www\./, '');
          genSaveSite.value = domain.charAt(0).toUpperCase() + domain.slice(1);
        } catch {}
      }
      refreshGenerator();
    } else if (viewId === 'view-send') {
      renderActiveSends();
    } else if (viewId === 'view-settings') {
      renderSettingsAndHealth();
    }
  }

  /**
   * Apply Theme
   */
  function applyTheme(themeName) {
    document.body.className = themeName || 'theme-bitwarden-blue';
  }

  /**
   * Query Active Browser Tab
   */
  async function detectActiveTab() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          currentTabUrl = tab.url || '';
          currentTabId = tab.id || null;
        }
      } catch {}
    }
  }

  /**
   * Initialize and Check Auth Status
   */
  async function initApp() {
    await detectActiveTab();
    const settings = await BitVault.getSettings();
    applyTheme(settings.theme);

    const status = await BitVault.init();

    if (!status.initialized) {
      // First time setup
      showAuthScreen(true);
    } else if (status.locked) {
      // Vault exists but is locked
      showAuthScreen(false);
    } else {
      // Unlocked
      showUnlockedApp();
    }
  }

  function showAuthScreen(isFirstTime) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    viewAuth.classList.add('active');
    bottomNav.style.display = 'none';
    headerActions.style.display = 'none';

    if (isFirstTime) {
      authStatusText.textContent = 'Welcome! Create your vault';
      authUnlockForm.style.display = 'none';
      authSetupForm.style.display = 'flex';
    } else {
      authStatusText.textContent = 'Your vault is locked';
      authUnlockForm.style.display = 'flex';
      authSetupForm.style.display = 'none';

      // Check if PIN unlock is enabled
      BitVault.getSettings().then(s => {
        const pinGroup = document.getElementById('group-unlock-pin');
        if (pinGroup) {
          pinGroup.style.display = s.quickPinEnabled ? 'block' : 'none';
        }
      });
    }
  }

  function showUnlockedApp() {
    bottomNav.style.display = 'flex';
    headerActions.style.display = 'flex';
    switchView('view-vault');
    renderVault();
    startTotpTimer();
  }

  /**
   * Setup First-Time Vault
   */
  btnDoSetup?.addEventListener('click', async () => {
    const pwd = inputSetupPassword.value.trim();
    const confirm = inputSetupConfirm.value.trim();
    const hint = inputSetupHint.value.trim();

    if (!pwd || pwd.length < 8) {
      showToast('Master password must be at least 8 characters');
      return;
    }
    if (pwd !== confirm) {
      showToast('Passwords do not match');
      return;
    }

    try {
      btnDoSetup.textContent = 'Encrypting & Generating Vault...';
      btnDoSetup.disabled = true;

      await BitVault.setupVault(pwd, hint);
      showToast('Vault created with AES-256 encryption!');
      showUnlockedApp();
    } catch (err) {
      showToast(err.message || 'Error setting up vault');
    } finally {
      btnDoSetup.textContent = 'Create Vault';
      btnDoSetup.disabled = false;
    }
  });

  /**
   * Unlock Existing Vault
   */
  btnDoUnlock?.addEventListener('click', async () => {
    const pwd = inputUnlockPassword.value;
    const pin = inputUnlockPin?.value?.trim();

    if (pin && pin.length >= 4) {
      try {
        btnDoUnlock.textContent = 'Unlocking...';
        btnDoUnlock.disabled = true;
        await BitVault.unlockWithPin(pin);
        inputUnlockPin.value = '';
        showUnlockedApp();
        return;
      } catch (err) {
        showToast('PIN incorrect');
      } finally {
        btnDoUnlock.textContent = 'Unlock Vault';
        btnDoUnlock.disabled = false;
      }
    }

    if (!pwd) {
      showToast('Please enter your master password');
      return;
    }

    try {
      btnDoUnlock.textContent = 'Decrypting Vault...';
      btnDoUnlock.disabled = true;

      await BitVault.unlockVault(pwd);
      inputUnlockPassword.value = '';
      showUnlockedApp();
    } catch (err) {
      showToast(err.message || 'Incorrect password');
    } finally {
      btnDoUnlock.textContent = 'Unlock Vault';
      btnDoUnlock.disabled = false;
    }
  });

  // Enter key trigger for unlock
  inputUnlockPassword?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnDoUnlock.click();
  });
  inputUnlockPin?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnDoUnlock.click();
  });

  // Password Hint Toggle
  btnShowHint?.addEventListener('click', () => {
    const hint = BitVault.getPasswordHint();
    if (hint) {
      boxPasswordHint.textContent = `Hint: "${hint}"`;
      boxPasswordHint.style.display = 'block';
    } else {
      boxPasswordHint.textContent = 'No password hint was provided during setup.';
      boxPasswordHint.style.display = 'block';
    }
  });

  // Toggle password visibility on Unlock & Setup screens
  document.getElementById('btn-toggle-unlock-pwd')?.addEventListener('click', () => {
    inputUnlockPassword.type = inputUnlockPassword.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('btn-toggle-setup-pwd')?.addEventListener('click', () => {
    inputSetupPassword.type = inputSetupPassword.type === 'password' ? 'text' : 'password';
  });

  // Demo Password Fill Buttons for effortless testing
  document.getElementById('btn-fill-demo-unlock')?.addEventListener('click', () => {
    inputUnlockPassword.value = 'Bitwarden2026!';
    showToast('Demo master password filled!');
  });

  document.getElementById('btn-fill-demo-setup')?.addEventListener('click', () => {
    inputSetupPassword.value = 'Bitwarden2026!';
    inputSetupConfirm.value = 'Bitwarden2026!';
    inputSetupHint.value = 'Default demo password';
    showToast('Demo credentials filled!');
  });

  // Quick Create & Save Banner on Vault View
  document.getElementById('btn-quick-create-login')?.addEventListener('click', () => {
    openAddItemModal('login');
  });

  /**
   * Lock Vault Button in Header
   */
  document.getElementById('btn-lock-vault')?.addEventListener('click', () => {
    BitVault.lockVault();
    stopTotpTimer();
    showToast('Vault locked');
    showAuthScreen(false);
  });

  /**
   * Open Full Vault Options Page
   */
  document.getElementById('btn-open-options')?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../options/options.html', '_blank');
    }
  });

  /**
   * Render Vault Items List
   */
  async function renderVault() {
    if (BitVault.isLocked()) return;

    // 1. Current Tab Matching Logins
    if (currentTabUrl && !currentTabUrl.startsWith('chrome://')) {
      const matchData = BitVault.getCredentialsForUrl(currentTabUrl);
      const matched = [...(matchData.logins || []), ...(matchData.passkeys || [])];

      if (matched.length > 0) {
        tabLoginsSection.style.display = 'block';
        tabMatchCount.textContent = matched.length;
        tabLoginsList.innerHTML = '';
        matched.forEach(item => {
          tabLoginsList.appendChild(createItemCard(item, true));
        });
      } else {
        tabLoginsSection.style.display = 'none';
      }
    } else {
      tabLoginsSection.style.display = 'none';
    }

    // 2. All Vault Items
    const items = BitVault.getItems({
      type: activeFilter === 'favorites' ? null : activeFilter,
      favorite: activeFilter === 'favorites',
      query: searchQuery
    });

    vaultTotalCount.textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
    vaultItemsList.innerHTML = '';

    if (items.length === 0) {
      vaultEmptyState.style.display = 'block';
    } else {
      vaultEmptyState.style.display = 'none';
      items.forEach(item => {
        vaultItemsList.appendChild(createItemCard(item, false));
      });
    }
  }

  /**
   * Create an Item Card element
   */
  function createItemCard(item, isTabMatch = false) {
    const card = document.createElement('div');
    card.className = 'vault-item-card';

    let avatarText = (item.name || 'U').charAt(0).toUpperCase();
    let avatarClass = 'item-avatar';
    let subtext = item.username || item.uri || 'Login';

    if (item.type === 'passkey') {
      avatarClass += ' passkey';
      avatarText = '🔑';
      subtext = `Passkey • ${item.rpId || 'WebAuthn'}`;
    } else if (item.type === 'card') {
      avatarClass += ' card';
      avatarText = '💳';
      subtext = `Card ending in ${item.number ? item.number.slice(-4) : '••••'}`;
    } else if (item.type === 'note') {
      avatarClass += ' note';
      avatarText = '📝';
      subtext = 'Secure Note';
    }

    let totpBadgeHtml = '';
    if (item.totpSecret) {
      totpBadgeHtml = `<div class="totp-badge-container" id="totp-box-${item.id}">2FA: ------</div>`;
    }

    card.innerHTML = `
      <div class="item-left">
        <div class="${avatarClass}">${avatarText}</div>
        <div class="item-meta">
          <div class="item-name">${escapeHtml(item.name || 'Untitled Item')}</div>
          <div class="item-subtext">${escapeHtml(subtext)}</div>
          ${totpBadgeHtml}
        </div>
      </div>
      <div class="item-actions">
        ${isTabMatch ? `
          <button class="action-btn-sm btn-autofill" title="Autofill this site">
            <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
        ` : ''}
        ${item.username ? `
          <button class="action-btn-sm btn-copy-user" title="Copy Username">
            <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </button>
        ` : ''}
        ${item.password ? `
          <button class="action-btn-sm btn-copy-pwd" title="Copy Password">
            <svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
          </button>
        ` : ''}
        <button class="action-btn-sm btn-card-delete" title="Delete item">
          <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
    `;

    // Click card opens details modal
    card.addEventListener('click', (e) => {
      if (e.target.closest('.item-actions')) return;
      openDetailsModal(item);
    });

    // Action button listeners
    card.querySelector('.btn-copy-user')?.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(item.username, 'Username copied!');
    });

    card.querySelector('.btn-copy-pwd')?.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(item.password, 'Password copied! (Will clear in 30s)');
    });

    card.querySelector('.btn-autofill')?.addEventListener('click', (e) => {
      e.stopPropagation();
      executeAutofillInTab(item);
    });

    card.querySelector('.btn-card-delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        const name = item.name || 'Item';
        await BitVault.deleteItem(item.id);
        showToast(`Deleted "${name}"`);
        await renderVault();
      } catch (err) {
        console.error('Card delete error:', err);
        showToast('Could not delete: ' + (err.message || err));
      }
    });

    return card;
  }

  /**
   * Execute Autofill in Active Browser Tab
   */
  async function executeAutofillInTab(item) {
    if (!currentTabId) {
      await detectActiveTab();
    }
    if (currentTabId) {
      try {
        await chrome.tabs.sendMessage(currentTabId, {
          action: 'DO_AUTOFILL',
          credential: item
        });
        showToast('Credentials filled into page!');
        window.close(); // Close popup like official Bitwarden
      } catch {
        showToast('Could not autofill. Please refresh the page.');
      }
    }
  }

  /**
   * TOTP Countdown Timer
   */
  function startTotpTimer() {
    stopTotpTimer();
    updateTotpDisplays();
    totpInterval = setInterval(updateTotpDisplays, 1000);
  }

  function stopTotpTimer() {
    if (totpInterval) {
      clearInterval(totpInterval);
      totpInterval = null;
    }
  }

  async function updateTotpDisplays() {
    if (BitVault.isLocked()) return;
    const items = BitVault.getItems();
    const totpItems = items.filter(it => it.totpSecret);

    for (const item of totpItems) {
      const box = document.getElementById(`totp-box-${item.id}`);
      if (box) {
        try {
          const totp = await BitTOTP.generateTOTP(item.totpSecret);
          if (totp) {
            box.textContent = `${totp.formatted} (${totp.secondsRemaining}s)`;
            box.style.cursor = 'pointer';
            box.onclick = (e) => {
              e.stopPropagation();
              copyToClipboard(totp.code, 'TOTP 2FA code copied!');
            };
          }
        } catch {}
      }
    }
  }

  /**
   * Search and Filter Listeners
   */
  vaultSearchInput?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    btnClearSearch.style.display = searchQuery ? 'block' : 'none';
    renderVault();
  });

  btnClearSearch?.addEventListener('click', () => {
    vaultSearchInput.value = '';
    searchQuery = '';
    btnClearSearch.style.display = 'none';
    renderVault();
  });

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.getAttribute('data-filter');
      renderVault();
    });
  });

  /**
   * Navigation Tabs Switching
   */
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-view');
      switchView(targetView);
    });
  });

  // ==================== GENERATOR VIEW CONTROLLER ====================
  const genOutputText = document.getElementById('gen-output-text');
  const btnCopyGenerated = document.getElementById('btn-copy-generated');
  const btnRefreshGenerated = document.getElementById('btn-refresh-generated');

  const genSaveCard = document.getElementById('gen-save-card');
  const genSaveEmail = document.getElementById('gen-save-email');
  const genSaveSite = document.getElementById('gen-save-site');
  const genSavePwd = document.getElementById('gen-save-pwd');
  const btnToggleGenSavePwd = document.getElementById('btn-toggle-gen-save-pwd');
  const btnGenUseAlias = document.getElementById('btn-gen-use-alias');
  const btnGenSaveVault = document.getElementById('btn-gen-save-vault');
  const btnGenSaveAutofill = document.getElementById('btn-gen-save-autofill');

  const btnGenSrcAuto = document.getElementById('btn-gen-src-auto');
  const btnGenSrcCustom = document.getElementById('btn-gen-src-custom');
  const genCustomStrengthHint = document.getElementById('gen-custom-strength-hint');
  let isGenCustomPasswordMode = false;

  const sliderPwdLength = document.getElementById('slider-pwd-length');
  const lblPwdLength = document.getElementById('lbl-pwd-length');
  const chkOptUpper = document.getElementById('chk-opt-upper');
  const chkOptLower = document.getElementById('chk-opt-lower');
  const chkOptNumbers = document.getElementById('chk-opt-numbers');
  const chkOptSpecial = document.getElementById('chk-opt-special');
  const chkOptAmbiguous = document.getElementById('chk-opt-ambiguous');

  const genStrengthLabel = document.getElementById('gen-strength-label');
  const genEntropyLabel = document.getElementById('gen-entropy-label');
  const genStrengthFill = document.getElementById('gen-strength-fill');

  let currentGenMode = 'password';

  function refreshGenerator() {
    if (currentGenMode === 'password') {
      const length = parseInt(sliderPwdLength.value, 10);
      lblPwdLength.textContent = length;
      const pwd = BitGenerator.generatePassword({
        length,
        uppercase: chkOptUpper.checked,
        lowercase: chkOptLower.checked,
        numbers: chkOptNumbers.checked,
        special: chkOptSpecial.checked,
        avoidAmbiguous: chkOptAmbiguous.checked
      });

      genOutputText.textContent = pwd;
      if (genSavePwd && !isGenCustomPasswordMode) genSavePwd.value = pwd;
      updateStrengthDisplay(pwd);
    } else if (currentGenMode === 'passphrase') {
      const count = parseInt(document.getElementById('slider-words-count').value, 10);
      document.getElementById('lbl-words-count').textContent = count;
      const sep = document.getElementById('select-word-separator').value;
      const cap = document.getElementById('chk-passphrase-cap').checked;
      const num = document.getElementById('chk-passphrase-num').checked;

      const phrase = BitGenerator.generatePassphrase({
        wordCount: count,
        separator: sep,
        capitalize: cap,
        includeNumber: num
      });

      genOutputText.textContent = phrase;
      if (genSavePwd && !isGenCustomPasswordMode) genSavePwd.value = phrase;
      updateStrengthDisplay(phrase);
    } else if (currentGenMode === 'username') {
      const type = document.getElementById('select-alias-type').value;
      const email = document.getElementById('input-base-email').value || 'user@example.com';
      const user = BitGenerator.generateUsername(type, email);
      genOutputText.textContent = user;
      if (genSaveEmail) genSaveEmail.value = user;
      document.getElementById('gen-strength-container').style.display = 'none';
      return;
    }

    document.getElementById('gen-strength-container').style.display = 'flex';
  }

  function updateStrengthDisplay(pwd) {
    const rating = BitCrypto.ratePasswordStrength(pwd);
    genStrengthLabel.textContent = rating.label;
    genEntropyLabel.textContent = `${rating.entropy} bits • ${rating.crackTime}`;
    genStrengthFill.style.width = `${Math.min(100, Math.max(15, (rating.score + 1) * 20))}%`;
    genStrengthFill.style.backgroundColor = rating.color;
  }

  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentGenMode = btn.getAttribute('data-gen-mode');

      document.getElementById('gen-options-password').style.display = currentGenMode === 'password' ? 'flex' : 'none';
      document.getElementById('gen-options-passphrase').style.display = currentGenMode === 'passphrase' ? 'flex' : 'none';
      document.getElementById('gen-options-username').style.display = currentGenMode === 'username' ? 'flex' : 'none';

      refreshGenerator();
    });
  });

  sliderPwdLength?.addEventListener('input', refreshGenerator);
  [chkOptUpper, chkOptLower, chkOptNumbers, chkOptSpecial, chkOptAmbiguous].forEach(el => el?.addEventListener('change', refreshGenerator));
  document.getElementById('slider-words-count')?.addEventListener('input', refreshGenerator);
  document.getElementById('select-word-separator')?.addEventListener('change', refreshGenerator);
  document.getElementById('chk-passphrase-cap')?.addEventListener('change', refreshGenerator);
  document.getElementById('chk-passphrase-num')?.addEventListener('change', refreshGenerator);
  document.getElementById('select-alias-type')?.addEventListener('change', (e) => {
    document.getElementById('row-base-email').style.display = e.target.value === 'plus_address' ? 'flex' : 'none';
    refreshGenerator();
  });

  btnRefreshGenerated?.addEventListener('click', refreshGenerator);
  btnCopyGenerated?.addEventListener('click', () => {
    copyToClipboard(genOutputText.textContent, 'Generated value copied!');
  });

  // Generator Quick-Save: Toggle password visibility
  btnToggleGenSavePwd?.addEventListener('click', () => {
    if (genSavePwd.type === 'password') {
      genSavePwd.type = 'text';
      btnToggleGenSavePwd.textContent = '🙈';
    } else {
      genSavePwd.type = 'password';
      btnToggleGenSavePwd.textContent = '👁';
    }
  });

  // Generator Quick-Save: Password Source Switcher (Auto-Generated vs Enter My Own)
  function updateGenCustomStrength(val) {
    if (!genCustomStrengthHint) return;
    if (!val) {
      genCustomStrengthHint.style.display = 'none';
      genCustomStrengthHint.innerHTML = '';
      return;
    }
    const rating = BitCrypto.ratePasswordStrength(val);
    genCustomStrengthHint.style.display = 'flex';
    genCustomStrengthHint.innerHTML = `Strength: <span style="color:${rating.color}; font-weight:700;">${rating.label}</span> (${rating.entropy} bits • Crack time: ${rating.crackTime})`;
  }

  btnGenSrcAuto?.addEventListener('click', () => {
    isGenCustomPasswordMode = false;
    btnGenSrcAuto.classList.add('active');
    btnGenSrcCustom?.classList.remove('active');
    if (genSavePwd) {
      genSavePwd.placeholder = 'Generated password';
      genSavePwd.value = genOutputText.textContent || '';
    }
    if (genCustomStrengthHint) genCustomStrengthHint.style.display = 'none';
  });

  btnGenSrcCustom?.addEventListener('click', () => {
    isGenCustomPasswordMode = true;
    btnGenSrcCustom.classList.add('active');
    btnGenSrcAuto?.classList.remove('active');
    if (genSavePwd) {
      genSavePwd.value = '';
      genSavePwd.placeholder = 'Type your custom password here...';
      genSavePwd.focus();
    }
    updateGenCustomStrength('');
  });

  genSavePwd?.addEventListener('input', () => {
    if (genSavePwd.value.length > 0) {
      if (!isGenCustomPasswordMode) {
        isGenCustomPasswordMode = true;
        btnGenSrcCustom?.classList.add('active');
        btnGenSrcAuto?.classList.remove('active');
      }
      updateGenCustomStrength(genSavePwd.value);
    } else if (isGenCustomPasswordMode) {
      updateGenCustomStrength('');
    }
  });

  // Generator Quick-Save: Generate smart email alias
  btnGenUseAlias?.addEventListener('click', () => {
    let domain = 'example.com';
    if (currentTabUrl) {
      try { domain = new URL(currentTabUrl).hostname.replace(/^www\./, ''); } catch {}
    }
    const alias = BitGenerator.generateUsername('plus_address', 'alex.developer@gmail.com');
    genSaveEmail.value = alias;
    showToast('Generated email alias!');
  });

  // Generator Quick-Save: Save to Vault
  btnGenSaveVault?.addEventListener('click', async () => {
    const email = genSaveEmail.value.trim();
    const pwd = genSavePwd.value;
    let site = genSaveSite.value.trim();

    if (!email) {
      showToast('Please enter an Email ID or Username');
      genSaveEmail.focus();
      return;
    }
    if (!pwd) {
      showToast('Please generate or enter a password');
      return;
    }
    if (!site) {
      site = 'Saved Login';
    }

    try {
      btnGenSaveVault.disabled = true;
      btnGenSaveVault.textContent = 'Saving...';

      const newItem = {
        id: BitCrypto.generateUUID(),
        type: 'login',
        name: site,
        uri: currentTabUrl || `https://${site.toLowerCase().replace(/\s+/g, '')}.com`,
        username: email,
        password: pwd,
        folder: 'Personal',
        favorite: false,
        notes: `Created via Password Generator Quick-Save on ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await BitVault.addItem(newItem);
      showToast('✓ Saved password with email to Vault!');

      // Switch to vault view to see saved item
      switchView('view-vault');
      renderVault();
    } catch (err) {
      showToast(`Error saving: ${err.message}`);
    } finally {
      btnGenSaveVault.disabled = false;
      btnGenSaveVault.textContent = '💾 Save to Vault';
    }
  });

  // Generator Quick-Save: Save to Vault & Autofill Active Tab
  btnGenSaveAutofill?.addEventListener('click', async () => {
    const email = genSaveEmail.value.trim();
    const pwd = genSavePwd.value;
    let site = genSaveSite.value.trim();

    if (!email) {
      showToast('Please enter an Email ID or Username');
      genSaveEmail.focus();
      return;
    }
    if (!pwd) {
      showToast('Please generate or enter a password');
      return;
    }
    if (!site) {
      site = 'Saved Login';
    }

    try {
      btnGenSaveAutofill.disabled = true;
      btnGenSaveAutofill.textContent = 'Saving...';

      const newItem = {
        id: BitCrypto.generateUUID(),
        type: 'login',
        name: site,
        uri: currentTabUrl || `https://${site.toLowerCase().replace(/\s+/g, '')}.com`,
        username: email,
        password: pwd,
        folder: 'Personal',
        favorite: false,
        notes: `Created & Autofilled on ${new Date().toLocaleDateString()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await BitVault.addItem(newItem);

      // Trigger in-page autofill
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, {
          action: 'DO_AUTOFILL',
          credential: newItem
        }, () => {
          showToast('✓ Saved & Autofilled page!');
        });
      } else {
        showToast('✓ Saved password with email to Vault!');
      }

      switchView('view-vault');
      renderVault();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      btnGenSaveAutofill.disabled = false;
      btnGenSaveAutofill.textContent = '⚡ Save & Fill Tab';
    }
  });

  // ==================== SEND VIEW CONTROLLER ====================
  const btnCreateSend = document.getElementById('btn-create-send');
  const inputSendName = document.getElementById('input-send-name');
  const textareaSendText = document.getElementById('textarea-send-text');
  const selectSendExpiry = document.getElementById('select-send-expiry');
  const selectSendViews = document.getElementById('select-send-views');
  const activeSendsList = document.getElementById('active-sends-list');

  btnCreateSend?.addEventListener('click', async () => {
    const text = textareaSendText.value.trim();
    if (!text) {
      showToast('Please enter text to encrypt');
      return;
    }

    const name = inputSendName.value.trim() || 'Confidential Send';
    const hours = parseInt(selectSendExpiry.value, 10);
    const views = parseInt(selectSendViews.value, 10);

    try {
      btnCreateSend.textContent = 'Encrypting Send...';
      btnCreateSend.disabled = true;

      const sendItem = await BitSend.createSend({
        name,
        text,
        expirationHours: hours,
        maxAccessCount: views
      });

      await BitVault.saveSend(sendItem);
      showToast('Encrypted Send created!');

      inputSendName.value = '';
      textareaSendText.value = '';
      renderActiveSends();
    } catch (err) {
      showToast(err.message || 'Error creating Send');
    } finally {
      btnCreateSend.textContent = '🔒 Create Encrypted Send';
      btnCreateSend.disabled = false;
    }
  });

  async function renderActiveSends() {
    const sends = await BitVault.getSends();
    activeSendsList.innerHTML = '';

    if (sends.length === 0) {
      activeSendsList.innerHTML = `
        <div style="padding: 12px; text-align: center; color: #94a3b8; font-size: 11px;">
          No active Sends. Create an encrypted snippet above to share securely.
        </div>
      `;
      return;
    }

    sends.forEach(send => {
      const remainingMs = new Date(send.expiresAt).getTime() - Date.now();
      const hoursLeft = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60)));

      const row = document.createElement('div');
      row.className = 'send-item-row';
      row.innerHTML = `
        <div>
          <div style="font-weight: 600; color: var(--text-main);">${escapeHtml(send.name)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">
            Expires in ${hoursLeft}h • ${send.accessCount || 0}/${send.maxAccessCount || '∞'} views
          </div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="action-btn-sm btn-copy-send" title="Copy Send Link">🔗</button>
          <button class="action-btn-sm btn-del-send" title="Delete Send">🗑</button>
        </div>
      `;

      row.querySelector('.btn-copy-send').addEventListener('click', () => {
        copyToClipboard(`https://send.bitwarden.com/#${send.id}`, 'Send link copied!');
      });

      row.querySelector('.btn-del-send').addEventListener('click', async () => {
        await BitVault.deleteSend(send.id);
        renderActiveSends();
      });

      activeSendsList.appendChild(row);
    });
  }

  // ==================== SETTINGS & HEALTH VIEW CONTROLLER ====================
  const healthDialScore = document.getElementById('health-dial-score');
  const healthGradeLabel = document.getElementById('health-grade-label');
  const healthSummaryText = document.getElementById('health-summary-text');
  const selectVaultTimeout = document.getElementById('select-vault-timeout');
  const chkQuickPin = document.getElementById('chk-quick-pin');
  const selectClipboardTimer = document.getElementById('select-clipboard-timer');
  const chkInlineBadges = document.getElementById('chk-inline-badges');
  const chkAskSave = document.getElementById('chk-ask-save');
  const selectAppTheme = document.getElementById('select-app-theme');

  async function renderSettingsAndHealth() {
    const items = BitVault.getItems();
    const audit = BitHealth.auditVault(items);

    healthDialScore.textContent = `${audit.score}%`;
    healthDialScore.style.backgroundColor = audit.gradeColor;
    healthGradeLabel.textContent = `Grade ${audit.grade} • Vault ${audit.score >= 80 ? 'Healthy' : 'Needs Attention'}`;
    healthSummaryText.textContent = `${audit.weakPasswords.length} weak, ${audit.reusedGroups.length} reused groups`;

    const settings = await BitVault.getSettings();
    selectVaultTimeout.value = String(settings.vaultTimeout);
    chkQuickPin.checked = !!settings.quickPinEnabled;
    selectClipboardTimer.value = String(settings.clipboardClearSeconds);
    chkInlineBadges.checked = settings.showInlineBadges !== false;
    chkAskSave.checked = settings.askToSaveLogins !== false;
    selectAppTheme.value = settings.theme || 'theme-bitwarden-blue';
  }

  document.getElementById('btn-view-health-report')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  document.getElementById('btn-settings-lock-now')?.addEventListener('click', () => {
    BitVault.lockVault();
    stopTotpTimer();
    showAuthScreen(false);
  });

  selectVaultTimeout?.addEventListener('change', async (e) => {
    await BitVault.saveSettings({ vaultTimeout: parseInt(e.target.value, 10) });
    showToast('Vault timeout updated');
  });

  chkQuickPin?.addEventListener('change', async (e) => {
    if (e.target.checked) {
      const pin = prompt('Set a 4 to 6 digit Quick PIN:');
      if (pin && pin.length >= 4) {
        await BitVault.setQuickPin(pin);
        showToast('Quick PIN enabled!');
      } else {
        e.target.checked = false;
      }
    } else {
      await BitVault.setQuickPin(null);
      showToast('Quick PIN disabled');
    }
  });

  selectClipboardTimer?.addEventListener('change', async (e) => {
    await BitVault.saveSettings({ clipboardClearSeconds: parseInt(e.target.value, 10) });
    showToast('Clipboard timer updated');
  });

  chkInlineBadges?.addEventListener('change', async (e) => {
    await BitVault.saveSettings({ showInlineBadges: e.target.checked });
  });

  chkAskSave?.addEventListener('change', async (e) => {
    await BitVault.saveSettings({ askToSaveLogins: e.target.checked });
  });

  selectAppTheme?.addEventListener('change', async (e) => {
    const theme = e.target.value;
    applyTheme(theme);
    await BitVault.saveSettings({ theme });
  });

  // Export Vault
  document.getElementById('btn-export-vault')?.addEventListener('click', async () => {
    const items = BitVault.getItems();
    const jsonStr = BitImporter.exportToBitwardenJSON(items);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ciphervault_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('Vault exported to JSON');
  });

  // Import Vault
  document.getElementById('btn-import-vault')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv';
    input.onchange = async (e) => {
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
          showToast(`Imported ${importedItems.length} items successfully!`);
          renderVault();
        } catch (err) {
          showToast('Import failed: ' + err.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });

  // ==================== ADD / EDIT ITEM MODAL ====================
  document.getElementById('btn-add-item')?.addEventListener('click', () => {
    openItemModal(null);
  });

  document.getElementById('btn-close-item-modal')?.addEventListener('click', () => {
    modalItem.style.display = 'none';
  });

  document.getElementById('btn-modal-cancel')?.addEventListener('click', () => {
    modalItem.style.display = 'none';
  });

  itemTypeSelect?.addEventListener('change', (e) => {
    updateModalFieldsForType(e.target.value);
  });

  function updateModalFieldsForType(type) {
    modalFieldsLogin.style.display = type === 'login' ? 'block' : 'none';
    modalFieldsPasskey.style.display = type === 'passkey' ? 'block' : 'none';
    modalFieldsCard.style.display = type === 'card' ? 'block' : 'none';
  }

  function openItemModal(itemToEdit = null) {
    editingItemId = itemToEdit ? itemToEdit.id : null;
    modalItemTitle.textContent = itemToEdit ? 'Edit Item' : 'Add Item';

    if (itemToEdit) {
      itemTypeSelect.value = itemToEdit.type || 'login';
      itemNameInput.value = itemToEdit.name || '';
      itemFolderSelect.value = itemToEdit.folder || 'Personal';
      itemNotesInput.value = itemToEdit.notes || '';
      itemFavoriteCheck.checked = !!itemToEdit.favorite;

      if (itemToEdit.type === 'login' || !itemToEdit.type) {
        itemUriInput.value = itemToEdit.uri || '';
        itemUsernameInput.value = itemToEdit.username || '';
        itemPasswordInput.value = itemToEdit.password || '';
        itemTotpInput.value = itemToEdit.totpSecret || '';
        if (itemToEdit.password) {
          updateModalPasswordStrength(itemToEdit.password);
          btnModalPwdCustom?.classList.add('active');
          btnModalGenPwd?.classList.remove('active');
        } else {
          updateModalPasswordStrength('');
        }
      } else if (itemToEdit.type === 'passkey') {
        itemRpidInput.value = itemToEdit.rpId || '';
        itemPkUsernameInput.value = itemToEdit.userName || '';
        itemPkDisplayInput.value = itemToEdit.userDisplayName || '';
      } else if (itemToEdit.type === 'card') {
        itemCardholderInput.value = itemToEdit.cardholderName || '';
        itemBrandSelect.value = itemToEdit.brand || 'Visa';
        itemCardnumInput.value = itemToEdit.number || '';
        itemExpmonthInput.value = itemToEdit.expMonth || '';
        itemExpyearInput.value = itemToEdit.expYear || '';
        itemCvvInput.value = itemToEdit.code || '';
      }
    } else {
      // New Item
      itemTypeSelect.value = 'login';
      itemNameInput.value = '';
      itemFolderSelect.value = 'Personal';
      itemNotesInput.value = '';
      itemFavoriteCheck.checked = false;

      // Auto pre-fill URI from current webpage
      if (currentTabUrl && !currentTabUrl.startsWith('chrome://')) {
        itemUriInput.value = currentTabUrl;
        try {
          const parsed = new URL(currentTabUrl);
          const domain = parsed.hostname.replace(/^www\./, '');
          itemNameInput.value = domain.charAt(0).toUpperCase() + domain.slice(1);
          itemRpidInput.value = domain;
        } catch {}
      } else {
        itemUriInput.value = '';
      }

      itemUsernameInput.value = '';
      itemPasswordInput.value = BitGenerator.generatePassword({ length: 16 });
      itemPasswordInput.placeholder = 'Enter password or click Generate';
      itemTotpInput.value = '';
      updateModalPasswordStrength(itemPasswordInput.value);
      btnModalGenPwd?.classList.add('active');
      btnModalPwdCustom?.classList.remove('active');
    }

    const btnModalDel = document.getElementById('btn-modal-delete');
    if (btnModalDel) {
      btnModalDel.style.display = itemToEdit ? 'inline-block' : 'none';
      btnModalDel.textContent = 'Delete';
      btnModalDel.classList.remove('btn-delete-confirming');
      delete btnModalDel.dataset.confirming;
    }

    updateModalFieldsForType(itemTypeSelect.value);
    modalItem.style.display = 'flex';
  }

  function updateModalPasswordStrength(val) {
    if (!modalPwdStrengthHint) return;
    if (!val) {
      modalPwdStrengthHint.style.display = 'none';
      modalPwdStrengthHint.innerHTML = '';
      return;
    }
    const rating = BitCrypto.ratePasswordStrength(val);
    modalPwdStrengthHint.style.display = 'flex';
    modalPwdStrengthHint.innerHTML = `Strength: <span style="color:${rating.color}; font-weight:700;">${rating.label}</span> (${rating.entropy} bits • Crack time: ${rating.crackTime})`;
  }

  // Quick generator inside modal
  btnModalGenPwd?.addEventListener('click', () => {
    btnModalGenPwd.classList.add('active');
    btnModalPwdCustom?.classList.remove('active');
    itemPasswordInput.value = BitGenerator.generatePassword({ length: 16 });
    itemPasswordInput.placeholder = 'Enter password or click Generate';
    updateModalPasswordStrength(itemPasswordInput.value);
    showToast('Generated new password!');
  });

  // Enter my own custom password inside modal
  btnModalPwdCustom?.addEventListener('click', () => {
    btnModalPwdCustom.classList.add('active');
    btnModalGenPwd?.classList.remove('active');
    itemPasswordInput.value = '';
    itemPasswordInput.placeholder = 'Type your custom password...';
    itemPasswordInput.focus();
    updateModalPasswordStrength('');
  });

  // Real-time strength calculation on typing in modal
  itemPasswordInput?.addEventListener('input', () => {
    if (itemPasswordInput.value.length > 0) {
      btnModalPwdCustom?.classList.add('active');
      btnModalGenPwd?.classList.remove('active');
      updateModalPasswordStrength(itemPasswordInput.value);
    } else {
      updateModalPasswordStrength('');
    }
  });

  // Toggle password visibility in modal
  document.getElementById('btn-toggle-item-pwd')?.addEventListener('click', () => {
    itemPasswordInput.type = itemPasswordInput.type === 'password' ? 'text' : 'password';
  });

  // Modal Delete item
  document.getElementById('btn-modal-delete')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!editingItemId) return;
    try {
      const delId = editingItemId;
      const item = BitVault.getItems().find(it => String(it.id) === String(delId));
      const name = item ? item.name : 'Item';
      await BitVault.deleteItem(delId);
      modalItem.style.display = 'none';
      editingItemId = null;
      showToast(`Deleted "${name}"`);
      await renderVault();
    } catch (err) {
      console.error('Modal delete error:', err);
      showToast('Could not delete: ' + (err.message || err));
    }
  });

  // Save Item
  document.getElementById('btn-modal-save')?.addEventListener('click', async () => {
    const name = itemNameInput.value.trim();
    if (!name) {
      showToast('Item Name is required');
      return;
    }

    const type = itemTypeSelect.value;
    const baseData = {
      name,
      type,
      folder: itemFolderSelect.value,
      notes: itemNotesInput.value.trim(),
      favorite: itemFavoriteCheck.checked
    };

    if (type === 'login') {
      baseData.uri = itemUriInput.value.trim();
      baseData.username = itemUsernameInput.value.trim();
      baseData.password = itemPasswordInput.value;
      baseData.totpSecret = itemTotpInput.value.trim() || null;
    } else if (type === 'passkey') {
      const rpId = itemRpidInput.value.trim();
      const uName = itemPkUsernameInput.value.trim();
      const uDisp = itemPkDisplayInput.value.trim();

      if (!rpId || !uName) {
        showToast('Relying Party domain & User Account required for passkey');
        return;
      }

      if (!editingItemId) {
        // Generate authentic Passkey credential
        const passkeyObj = await BitPasskey.generatePasskey(rpId, uName, uDisp);
        Object.assign(baseData, passkeyObj);
      } else {
        baseData.rpId = rpId;
        baseData.userName = uName;
        baseData.userDisplayName = uDisp;
      }
    } else if (type === 'card') {
      baseData.cardholderName = itemCardholderInput.value.trim();
      baseData.brand = itemBrandSelect.value;
      baseData.number = itemCardnumInput.value.trim();
      baseData.expMonth = itemExpmonthInput.value.trim();
      baseData.expYear = itemExpyearInput.value.trim();
      baseData.code = itemCvvInput.value.trim();
    }

    try {
      if (editingItemId) {
        await BitVault.updateItem(editingItemId, baseData);
        showToast('Item updated successfully!');
      } else {
        await BitVault.addItem(baseData);
        showToast('Item saved to vault!');
      }

      modalItem.style.display = 'none';
      renderVault();
    } catch (err) {
      showToast(err.message || 'Error saving item');
    }
  });

  // ==================== VIEW DETAILS MODAL ====================
  function openDetailsModal(item) {
    viewingItemId = item.id;
    detailItemTitle.textContent = item.name || 'Untitled';

    const btnDetailDel = document.getElementById('btn-detail-delete');
    if (btnDetailDel) {
      btnDetailDel.textContent = 'Delete';
      btnDetailDel.style.display = 'inline-block';
    }

    let iconText = (item.name || 'U').charAt(0).toUpperCase();
    let sub = 'Login';
    if (item.type === 'passkey') { iconText = '🔑'; sub = 'Passkey (FIDO2)'; }
    else if (item.type === 'card') { iconText = '💳'; sub = 'Payment Card'; }
    else if (item.type === 'note') { iconText = '📝'; sub = 'Secure Note'; }

    detailTypeIcon.textContent = iconText;
    detailItemSubtitle.textContent = sub;

    detailFieldsBody.innerHTML = '';

    if (item.type === 'login' || !item.type) {
      if (item.uri) addDetailField('Website URL', item.uri, true);
      if (item.username) addDetailField('Username', item.username, true);
      if (item.password) addDetailField('Password', item.password, true, true);
      if (item.totpSecret) addDetailField('2FA Key', item.totpSecret, true);
    } else if (item.type === 'passkey') {
      addDetailField('Relying Party (RP ID)', item.rpId);
      addDetailField('User Account', item.userName, true);
      addDetailField('Algorithm', item.algorithm || 'ES256 (ECDSA P-256)');
      if (item.fingerprint) addDetailField('Key Fingerprint', item.fingerprint);
      if (item.createdAt) addDetailField('Created At', new Date(item.createdAt).toLocaleDateString());
    } else if (item.type === 'card') {
      if (item.cardholderName) addDetailField('Cardholder', item.cardholderName);
      if (item.number) addDetailField('Card Number', item.number, true);
      if (item.expMonth && item.expYear) addDetailField('Expiration', `${item.expMonth}/${item.expYear}`);
      if (item.code) addDetailField('CVV', item.code, true, true);
    }

    if (item.notes) {
      addDetailField('Notes', item.notes, false);
    }

    modalDetails.style.display = 'flex';
  }

  function addDetailField(label, value, copyable = false, isSecret = false) {
    const row = document.createElement('div');
    row.className = 'detail-field-row';

    const displayVal = isSecret ? '••••••••••••' : escapeHtml(value);

    row.innerHTML = `
      <span class="detail-field-label">${escapeHtml(label)}</span>
      <div class="detail-field-value">
        <span class="val-text" data-raw="${escapeHtml(value)}">${displayVal}</span>
        <div style="display: flex; gap: 4px;">
          ${isSecret ? `<button class="action-btn-sm btn-reveal-secret" title="Reveal">👁</button>` : ''}
          ${copyable ? `<button class="action-btn-sm btn-copy-field" title="Copy">📋</button>` : ''}
        </div>
      </div>
    `;

    if (isSecret) {
      const btnRev = row.querySelector('.btn-reveal-secret');
      const valSpan = row.querySelector('.val-text');
      let revealed = false;
      btnRev?.addEventListener('click', () => {
        revealed = !revealed;
        valSpan.textContent = revealed ? value : '••••••••••••';
      });
    }

    row.querySelector('.btn-copy-field')?.addEventListener('click', () => {
      copyToClipboard(value, `${label} copied!`);
    });

    detailFieldsBody.appendChild(row);
  }

  document.getElementById('btn-close-details-modal')?.addEventListener('click', () => {
    modalDetails.style.display = 'none';
  });

  document.getElementById('btn-detail-edit')?.addEventListener('click', () => {
    modalDetails.style.display = 'none';
    const item = BitVault.getItems().find(it => it.id === viewingItemId);
    if (item) openItemModal(item);
  });

  document.getElementById('btn-detail-delete')?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!viewingItemId) return;
    try {
      const delId = viewingItemId;
      const item = BitVault.getItems().find(it => String(it.id) === String(delId));
      const name = item ? item.name : 'Item';
      await BitVault.deleteItem(delId);
      modalDetails.style.display = 'none';
      viewingItemId = null;
      showToast(`Deleted "${name}"`);
      await renderVault();
    } catch (err) {
      console.error('Detail delete error:', err);
      showToast('Could not delete: ' + (err.message || err));
    }
  });

  document.getElementById('btn-detail-autofill')?.addEventListener('click', () => {
    const item = BitVault.getItems().find(it => it.id === viewingItemId);
    if (item) executeAutofillInTab(item);
  });

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.action === 'ITEM_ADDED_RELOAD') {
        BitVault.syncPendingItems().then(() => {
          renderVault();
        });
      }
    });
  }

  // Kickstart on DOM load
  document.addEventListener('DOMContentLoaded', initApp);
})();
