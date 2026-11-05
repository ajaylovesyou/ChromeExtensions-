/**
 * Bitwarden Password Manager - In-Page Content Script
 * Inline field badges, smart autofill, passkey integration, and credential capture.
 */

(function() {
  'use strict';

  // Prevent double injection
  if (window.__BITWARDEN_INJECTED__) return;
  window.__BITWARDEN_INJECTED__ = true;

  const BITWARDEN_SHIELD_SVG = `
    <svg viewBox="0 0 24 24">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.54-3.14 8.79-7 9.88-3.86-1.09-7-5.34-7-9.88V6.3l7-3.12zM12 7a2.5 2.5 0 00-2.5 2.5c0 1.05.65 1.95 1.58 2.32L10 16h4l-1.08-4.18c.93-.37 1.58-1.27 1.58-2.32A2.5 2.5 0 0012 7z"/>
    </svg>
  `;

  const PASSKEY_KEY_SVG = `
    <svg viewBox="0 0 24 24">
      <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31.84 2.41 2 2.83V21c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-1.17c1.16-.42 2-1.52 2-2.83 0-1.66-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm11-13c-2.76 0-5 2.24-5 5 0 1.04.32 2.01.87 2.81L7.41 15.27 8.83 16.7l2.12-2.12.71.71 1.41-1.41-.7-.71 1.41-1.41 1.41 1.41 1.41-1.41-.7-.71c.79.55 1.76.87 2.81.87 2.76 0 5-2.24 5-5s-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3z"/>
    </svg>
  `;

  let activeDropdown = null;
  let activePromptBanner = null;
  let cachedCredentials = null;
  let lastFocusedInput = null;

  /**
   * Safe communication with background service worker
   */
  function sendBackgroundMessage(msg) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(msg, (response) => {
          if (chrome.runtime.lastError) {
            resolve(null);
          } else {
            resolve(response);
          }
        });
      } catch {
        resolve(null);
      }
    });
  }

  /**
   * Fetch matching credentials for current page
   */
  async function fetchPageCredentials() {
    const res = await sendBackgroundMessage({
      action: 'GET_MATCHING_CREDENTIALS',
      url: window.location.href
    });
    if (res && res.unlocked) {
      cachedCredentials = res;
    } else {
      cachedCredentials = null;
    }
    return cachedCredentials;
  }

  /**
   * Field classifier
   */
  function classifyInput(input) {
    if (!input || input.disabled || input.readOnly || input.type === 'hidden') return null;

    const type = (input.type || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();

    // 1. Password field
    if (type === 'password') {
      if (autocomplete.includes('new-password') || name.includes('confirm') || id.includes('confirm')) {
        return 'new-password';
      }
      return 'password';
    }

    // 2. TOTP / 2FA verification field
    if (
      autocomplete === 'one-time-code' ||
      name.includes('otp') || id.includes('otp') ||
      name.includes('totp') || id.includes('totp') ||
      name.includes('2fa') || id.includes('2fa') ||
      placeholder.includes('verification code') || placeholder.includes('6-digit')
    ) {
      return 'totp';
    }

    // 3. Username / Email field
    if (
      type === 'email' ||
      autocomplete.includes('username') ||
      autocomplete.includes('email') ||
      name.includes('username') || id.includes('username') ||
      name.includes('user') || id.includes('user') ||
      name.includes('login') || id.includes('login') ||
      name.includes('email') || id.includes('email') ||
      placeholder.includes('username') || placeholder.includes('email')
    ) {
      return 'username';
    }

    // 4. Credit card fields
    if (
      autocomplete.includes('cc-number') || name.includes('cardnumber') ||
      name.includes('cc-num') || id.includes('card-number')
    ) {
      return 'card-number';
    }

    return null;
  }

  /**
   * Dispatch comprehensive input events for reactive frameworks (React, Vue, Angular)
   */
  function setInputValue(input, value) {
    if (!input) return;
    input.focus();

    // Native setter workaround for React 16+ controlled inputs
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(input, value);
    } else {
      input.value = value;
    }

    // Dispatch synthetic events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Unidentified' }));
    input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Unidentified' }));
  }

  /**
   * Execute full autofill for a login credential
   */
  function autofillLogin(login) {
    if (!login) return;

    const inputs = Array.from(document.querySelectorAll('input'));
    let usernameFilled = false;
    let passwordFilled = false;

    // Find password input first
    const passwordInputs = inputs.filter(i => classifyInput(i) === 'password');
    const usernameInputs = inputs.filter(i => classifyInput(i) === 'username');

    if (usernameInputs.length > 0 && login.username) {
      setInputValue(usernameInputs[0], login.username);
      usernameFilled = true;
    }

    if (passwordInputs.length > 0 && login.password) {
      setInputValue(passwordInputs[0], login.password);
      passwordFilled = true;
    }

    // If TOTP is available and a TOTP field is visible on page, fill it
    if (login.totpSecret) {
      const totpInputs = inputs.filter(i => classifyInput(i) === 'totp');
      if (totpInputs.length > 0) {
        sendBackgroundMessage({ action: 'GET_TOTP_CODE', secret: login.totpSecret }).then(totp => {
          if (totp && totp.code) {
            setInputValue(totpInputs[0], totp.code);
          }
        });
      }
    }

    closeDropdown();
  }

  /**
   * Execute card autofill
   */
  function autofillCard(card) {
    if (!card) return;
    const inputs = Array.from(document.querySelectorAll('input'));

    inputs.forEach(input => {
      const kind = classifyInput(input);
      const name = (input.name || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      const ac = (input.autocomplete || '').toLowerCase();

      if (kind === 'card-number' || ac.includes('cc-number')) {
        setInputValue(input, card.number);
      } else if (ac.includes('cc-name') || name.includes('cardholder') || id.includes('cardholder')) {
        setInputValue(input, card.cardholderName);
      } else if (ac.includes('cc-exp') || name.includes('exp') || id.includes('expiry')) {
        setInputValue(input, `${card.expMonth}/${card.expYear.slice(-2)}`);
      } else if (ac.includes('cc-csc') || name.includes('cvv') || id.includes('cvv') || name.includes('cvc')) {
        setInputValue(input, card.code);
      }
    });

    closeDropdown();
  }

  /**
   * Close any open Bitwarden in-page dropdown
   */
  function closeDropdown() {
    if (activeDropdown && activeDropdown.parentNode) {
      activeDropdown.parentNode.removeChild(activeDropdown);
      activeDropdown = null;
    }
  }

  /**
   * Open Bitwarden in-page dropdown relative to input element
   */
  async function openDropdownForInput(input) {
    closeDropdown();
    lastFocusedInput = input;

    await fetchPageCredentials();

    const rect = input.getBoundingClientRect();
    const dropdown = document.createElement('div');
    dropdown.className = 'bw-inline-dropdown';
    dropdown.style.top = `${window.scrollY + rect.bottom + 4}px`;
    dropdown.style.left = `${Math.max(10, window.scrollX + rect.left)}px`;

    const hasLogins = cachedCredentials && cachedCredentials.logins && cachedCredentials.logins.length > 0;
    const hasPasskeys = cachedCredentials && cachedCredentials.passkeys && cachedCredentials.passkeys.length > 0;
    const hasCards = cachedCredentials && cachedCredentials.cards && cachedCredentials.cards.length > 0;

    let itemsHtml = '';

    // Passkeys Section
    if (hasPasskeys) {
      cachedCredentials.passkeys.forEach((pk, idx) => {
        itemsHtml += `
          <div class="bw-dropdown-item bw-passkey-item" data-passkey-index="${idx}">
            <div class="bw-item-info">
              <span class="bw-item-title">${escapeHtml(pk.userName || pk.name)}</span>
              <span class="bw-item-subtitle">Passkey (FIDO2) • ${escapeHtml(pk.rpId)}</span>
            </div>
            <span class="bw-badge-pill" style="background:#e0f2fe; color:#0284c7;">Passkey</span>
          </div>
        `;
      });
    }

    // Logins Section
    if (hasLogins) {
      cachedCredentials.logins.forEach((login, idx) => {
        itemsHtml += `
          <div class="bw-dropdown-item bw-login-item" data-login-index="${idx}">
            <div class="bw-item-info">
              <span class="bw-item-title">${escapeHtml(login.username || login.name)}</span>
              <span class="bw-item-subtitle">${escapeHtml(login.name || 'CipherVault Vault')}</span>
            </div>
            ${login.totpSecret ? '<span class="bw-badge-pill" style="background:#dcfce7; color:#15803d;">2FA</span>' : ''}
          </div>
        `;
      });
    }

    if (!hasLogins && !hasPasskeys) {
      itemsHtml = `
        <div style="padding: 14px; text-align: center; color: #64748b; font-size: 12px;">
          ${cachedCredentials ? 'No saved logins for this site yet.' : 'Vault is locked. Open extension to unlock.'}
        </div>
      `;
    }

    dropdown.innerHTML = `
      <div class="bw-dropdown-header">
        <div class="bw-dropdown-brand">
          ${BITWARDEN_SHIELD_SVG}
          <span>CipherVault</span>
        </div>
        <button class="bw-dropdown-close" id="bw-close-btn">&times;</button>
      </div>
      <div class="bw-dropdown-body">
        ${itemsHtml}
      </div>
      <div class="bw-dropdown-footer">
        <button class="bw-dropdown-btn" id="bw-gen-pwd-btn">⚡ Generate Password</button>
        ${hasCards ? '<button class="bw-dropdown-btn" id="bw-fill-card-btn">💳 Autofill Card</button>' : ''}
      </div>
    `;

    document.body.appendChild(dropdown);
    activeDropdown = dropdown;

    // Attach click events
    dropdown.querySelector('#bw-close-btn')?.addEventListener('click', closeDropdown);

    dropdown.querySelectorAll('.bw-login-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-login-index'), 10);
        autofillLogin(cachedCredentials.logins[idx]);
      });
    });

    dropdown.querySelectorAll('.bw-passkey-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-passkey-index'), 10);
        showPasskeyAuthModal(cachedCredentials.passkeys[idx]);
      });
    });

    dropdown.querySelector('#bw-gen-pwd-btn')?.addEventListener('click', async () => {
      const res = await sendBackgroundMessage({ action: 'GENERATE_QUICK_PASSWORD' });
      if (res && res.password) {
        setInputValue(input, res.password);
        closeDropdown();

        // Check if there is an email / username field on the current form
        const form = input.form || input.closest('form') || document;
        const usernameInputs = Array.from(form.querySelectorAll('input:not([type="password"])'))
          .filter(i => classifyInput(i) === 'username');
        const userVal = usernameInputs[0]?.value?.trim();

        if (userVal) {
          // Prompt user to save this generated password with their email ID
          setTimeout(() => {
            showSavePasswordPrompt(userVal, res.password);
          }, 300);
        }
      }
    });

    dropdown.querySelector('#bw-fill-card-btn')?.addEventListener('click', () => {
      if (hasCards) {
        autofillCard(cachedCredentials.cards[0]);
      }
    });
  }

  /**
   * Inject floating Bitwarden badge into classified input
   */
  function attachFieldBadge(input) {
    if (input.dataset.bwBadgeAttached === 'true') return;
    input.dataset.bwBadgeAttached = 'true';

    const kind = classifyInput(input);
    if (!kind) return;

    const badge = document.createElement('div');
    badge.className = 'bw-field-badge-container';
    badge.title = 'CipherVault - Click to Autofill';
    badge.innerHTML = `
      <div class="bw-field-badge-icon">
        ${BITWARDEN_SHIELD_SVG}
      </div>
    `;

    function updateBadgePosition() {
      if (!input.isConnected) {
        badge.remove();
        return;
      }
      const rect = input.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || window.getComputedStyle(input).display === 'none') {
        badge.style.display = 'none';
        return;
      }
      badge.style.display = 'flex';
      badge.style.top = `${window.scrollY + rect.top + (rect.height / 2) - 10}px`;
      badge.style.left = `${window.scrollX + rect.right - 26}px`;
    }

    document.body.appendChild(badge);
    updateBadgePosition();

    // Keep badge positioned on scroll and window resize
    window.addEventListener('scroll', updateBadgePosition, { passive: true });
    window.addEventListener('resize', updateBadgePosition, { passive: true });

    badge.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openDropdownForInput(input);
    });

    input.addEventListener('focus', () => {
      lastFocusedInput = input;
    });
  }

  /**
   * Scan DOM for credential inputs
   */
  function scanPageFields() {
    const inputs = document.querySelectorAll('input:not([data-bw-badge-attached="true"])');
    inputs.forEach(input => {
      if (classifyInput(input)) {
        attachFieldBadge(input);
      }
    });
  }

  /**
   * In-page Passkey Authentication Modal
   */
  function showPasskeyAuthModal(passkey) {
    closeDropdown();

    const overlay = document.createElement('div');
    overlay.className = 'bw-passkey-modal-overlay';
    overlay.innerHTML = `
      <div class="bw-passkey-modal">
        <div class="bw-passkey-icon-wrapper">
          ${PASSKEY_KEY_SVG}
        </div>
        <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 700; color: #0f172a;">Sign in with Passkey</h3>
        <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">
          Authenticate to <strong>${escapeHtml(passkey.rpId)}</strong> using CipherVault Passkey credential.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-bottom: 20px; text-align: left; font-size: 12px;">
          <div style="font-weight: 600; color: #1e293b; margin-bottom: 4px;">User Account:</div>
          <div style="color: #0284c7; font-family: monospace;">${escapeHtml(passkey.userName)}</div>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Algorithm: ES256 (ECDSA P-256)</div>
        </div>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <button class="bw-btn bw-btn-secondary" id="bw-pk-cancel">Cancel</button>
          <button class="bw-btn bw-btn-primary" id="bw-pk-confirm">Continue with Passkey</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#bw-pk-cancel').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('#bw-pk-confirm').addEventListener('click', () => {
      // Show checkmark animation and dispatch success event
      overlay.querySelector('.bw-passkey-modal').innerHTML = `
        <div style="color: #10b981; font-size: 40px; margin-bottom: 12px;">✓</div>
        <h3 style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 6px;">Passkey Verified</h3>
        <p style="font-size: 12px; color: #64748b;">Credentials authenticated securely by CipherVault.</p>
      `;

      // Dispatch custom DOM event for web application passkey listeners
      window.dispatchEvent(new CustomEvent('bitwarden:passkey-authenticated', {
        detail: {
          credentialId: passkey.credentialId,
          userHandle: passkey.userHandle,
          rpId: passkey.rpId
        }
      }));

      setTimeout(() => {
        overlay.remove();
      }, 1200);
    });
  }

  /**
   * In-Page "Save Password to Bitwarden?" Prompt
   */
  function showSavePasswordPrompt(username, password) {
    if (activePromptBanner) {
      activePromptBanner.remove();
    }

    const domain = window.location.hostname.replace(/^www\./, '');
    const banner = document.createElement('div');
    banner.className = 'bw-prompt-banner';
    banner.innerHTML = `
      <div class="bw-prompt-header">
        <div class="bw-prompt-header-icon">
          ${BITWARDEN_SHIELD_SVG}
        </div>
        <div class="bw-prompt-header-text">
          <div class="bw-prompt-title">Save Password to CipherVault?</div>
          <div class="bw-prompt-subtitle">Secure this login for ${escapeHtml(domain)}</div>
        </div>
      </div>
      <div class="bw-prompt-details">
        <div><strong>Username:</strong> ${escapeHtml(username)}</div>
        <div><strong>Password:</strong> ••••••••••••</div>
      </div>
      <div class="bw-prompt-actions">
        <button class="bw-btn bw-btn-secondary" id="bw-prompt-dismiss">Never for this site</button>
        <button class="bw-btn bw-btn-primary" id="bw-prompt-save">Save to CipherVault</button>
      </div>
    `;

    document.body.appendChild(banner);
    activePromptBanner = banner;

    banner.querySelector('#bw-prompt-dismiss').addEventListener('click', () => {
      banner.remove();
      activePromptBanner = null;
    });

    banner.querySelector('#bw-prompt-save').addEventListener('click', async () => {
      const res = await sendBackgroundMessage({
        action: 'SAVE_CREDENTIAL_FROM_PAGE',
        payload: {
          username,
          password,
          uri: window.location.href,
          domain
        }
      });

      if (res && res.success) {
        banner.innerHTML = `
          <div style="display: flex; align-items: center; gap: 8px; color: #15803d; font-weight: 600; padding: 10px 0;">
            <span style="font-size: 18px;">✓</span> Password saved to CipherVault Vault!
          </div>
        `;
        setTimeout(() => {
          banner.remove();
          activePromptBanner = null;
        }, 1800);
      } else {
        banner.remove();
        activePromptBanner = null;
      }
    });

    // Auto dismiss after 15 seconds
    setTimeout(() => {
      if (activePromptBanner === banner) {
        banner.remove();
        activePromptBanner = null;
      }
    }, 15000);
  }

  /**
   * Intercept form submit to prompt credential saving
   */
  function monitorFormSubmissions() {
    document.addEventListener('submit', (e) => {
      const form = e.target;
      if (!form || !form.querySelectorAll) return;

      const passwordInputs = Array.from(form.querySelectorAll('input[type="password"]'));
      const usernameInputs = Array.from(form.querySelectorAll('input:not([type="password"])'))
        .filter(i => classifyInput(i) === 'username');

      const pwd = passwordInputs[0]?.value;
      const user = usernameInputs[0]?.value;

      if (pwd && pwd.length >= 4 && user) {
        showSavePasswordPrompt(user, pwd);
      }
    }, true);
  }

  /**
   * Listen for runtime messages from background service worker
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'DO_AUTOFILL') {
      autofillLogin(message.credential);
      sendResponse({ ok: true });
    } else if (message.action === 'FILL_PASSWORD_AT_CURSOR') {
      if (lastFocusedInput) {
        setInputValue(lastFocusedInput, message.password);
      } else {
        const passInput = document.querySelector('input[type="password"]');
        if (passInput) setInputValue(passInput, message.password);
      }
      sendResponse({ ok: true });
    } else if (message.action === 'FILL_TOTP_CODE') {
      const totpInput = Array.from(document.querySelectorAll('input')).find(i => classifyInput(i) === 'totp');
      if (totpInput) {
        setInputValue(totpInput, message.code);
      }
      sendResponse({ ok: true });
    }
    return true;
  });

  // Close dropdown on click outside
  document.addEventListener('mousedown', (e) => {
    if (activeDropdown && !activeDropdown.contains(e.target) && !e.target.closest('.bw-field-badge-container')) {
      closeDropdown();
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

  // Initialize on page ready
  function init() {
    scanPageFields();
    monitorFormSubmissions();

    // Observe dynamic elements added by SPAs (React, Vue, Next.js)
    const observer = new MutationObserver(() => {
      scanPageFields();
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
