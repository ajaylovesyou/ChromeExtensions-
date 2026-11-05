/**
 * DarkShift Pro - Options Page Controller
 * Manages full configuration, rulesets, scheduling, custom CSS, and backups.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.content-panel');

  // General Controls
  const optMasterToggle = document.getElementById('optMasterToggle');
  const optEngineRadios = document.querySelectorAll('input[name="optEngine"]');
  const optFontBoost = document.getElementById('optFontBoost');

  // Sites Controls
  const optListMode = document.getElementById('optListMode');
  const newDomainInput = document.getElementById('newDomainInput');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const domainSearchInput = document.getElementById('domainSearchInput');
  const domainsContainer = document.getElementById('domainsContainer');
  const domainsCountLabel = document.getElementById('domainsCountLabel');
  const clearAllDomainsBtn = document.getElementById('clearAllDomainsBtn');

  // Schedule Controls
  const optScheduleEnabled = document.getElementById('optScheduleEnabled');
  const scheduleOptionsContainer = document.getElementById('scheduleOptionsContainer');
  const optScheduleModeRadios = document.querySelectorAll('input[name="optScheduleMode"]');
  const timeInputsRow = document.getElementById('timeInputsRow');
  const optScheduleStart = document.getElementById('optScheduleStart');
  const optScheduleEnd = document.getElementById('optScheduleEnd');

  // Custom CSS Controls
  const cssDomainInput = document.getElementById('cssDomainInput');
  const cssCodeInput = document.getElementById('cssCodeInput');
  const saveCustomCssBtn = document.getElementById('saveCustomCssBtn');
  const customCssList = document.getElementById('customCssList');

  // Backup Controls
  const exportSettingsBtn = document.getElementById('exportSettingsBtn');
  const importSettingsBtn = document.getElementById('importSettingsBtn');
  const importFileInput = document.getElementById('importFileInput');
  const resetDefaultsBtn = document.getElementById('resetDefaultsBtn');

  const toast = document.getElementById('toast');

  let currentConfig = {};

  // Show Toast
  function showToast(msg = 'Settings Saved') {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  // Domain Normalizer
  function cleanDomain(input) {
    let d = (input || '').trim().toLowerCase();
    d = d.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '');
    d = d.split('/')[0].split('?')[0].split(':')[0];
    return d;
  }

  // Tab switching
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const panel = document.getElementById(targetTab);
      if (panel) panel.classList.add('active');
    });
  });

  // Populate UI from storage
  function loadSettings() {
    chrome.storage.local.get(null, (res) => {
      currentConfig = res || {};

      // General
      optMasterToggle.checked = currentConfig.darkshift_enabled !== false;
      const engine = currentConfig.engine || 'smart-invert';
      optEngineRadios.forEach(r => {
        r.checked = (r.value === engine);
      });
      optFontBoost.checked = currentConfig.font_boost !== false;

      // Sites
      optListMode.value = currentConfig.list_mode || 'blacklist';
      renderDomainsList();

      // Schedule
      optScheduleEnabled.checked = !!currentConfig.schedule_enabled;
      toggleSchedulePanel(optScheduleEnabled.checked);

      const sMode = currentConfig.schedule_mode || 'system';
      optScheduleModeRadios.forEach(r => {
        r.checked = (r.value === sMode);
      });
      toggleTimeRow(sMode === 'time');

      optScheduleStart.value = currentConfig.schedule_start || '20:00';
      optScheduleEnd.value = currentConfig.schedule_end || '07:00';

      // Custom CSS
      renderCustomCssList();
    });
  }

  function toggleSchedulePanel(enabled) {
    scheduleOptionsContainer.style.opacity = enabled ? '1' : '0.4';
    scheduleOptionsContainer.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  function toggleTimeRow(isTime) {
    timeInputsRow.style.display = isTime ? 'flex' : 'none';
  }

  // Render Domain Chips
  function renderDomainsList() {
    domainsContainer.innerHTML = '';
    const listMode = optListMode.value;
    const key = (listMode === 'blacklist') ? 'excluded_domains' : 'whitelisted_domains';
    const list = Array.isArray(currentConfig[key]) ? currentConfig[key] : [];

    const filterText = (domainSearchInput.value || '').trim().toLowerCase();
    const filtered = list.filter(d => !filterText || d.toLowerCase().includes(filterText));

    domainsCountLabel.textContent = `${list.length} domain${list.length === 1 ? '' : 's'} configured (${listMode} mode)`;

    if (filtered.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.color = '#64748b';
      emptyNotice.style.fontSize = '12px';
      emptyNotice.style.padding = '8px 0';
      emptyNotice.textContent = filterText ? 'No matching domains found.' : 'No domains added yet.';
      domainsContainer.appendChild(emptyNotice);
      return;
    }

    filtered.forEach(domain => {
      const chip = document.createElement('div');
      chip.className = 'domain-chip';
      chip.innerHTML = `
        <span>${domain}</span>
        <span class="domain-chip-del" title="Remove domain">&times;</span>
      `;
      chip.querySelector('.domain-chip-del').addEventListener('click', () => {
        removeDomain(domain, key);
      });
      domainsContainer.appendChild(chip);
    });
  }

  function addDomain() {
    const raw = newDomainInput.value;
    const cleaned = cleanDomain(raw);
    if (!cleaned || !cleaned.includes('.')) {
      alert('Please enter a valid website domain name (e.g. example.com)');
      return;
    }

    const listMode = optListMode.value;
    const key = (listMode === 'blacklist') ? 'excluded_domains' : 'whitelisted_domains';
    const list = Array.isArray(currentConfig[key]) ? [...currentConfig[key]] : [];

    if (list.includes(cleaned)) {
      alert(`Domain "${cleaned}" is already in the list.`);
      return;
    }

    list.push(cleaned);
    list.sort();
    currentConfig[key] = list;

    chrome.storage.local.set({ [key]: list }, () => {
      newDomainInput.value = '';
      renderDomainsList();
      showToast(`Added ${cleaned}`);
    });
  }

  function removeDomain(domain, key) {
    let list = Array.isArray(currentConfig[key]) ? [...currentConfig[key]] : [];
    list = list.filter(d => d !== domain);
    currentConfig[key] = list;

    chrome.storage.local.set({ [key]: list }, () => {
      renderDomainsList();
      showToast(`Removed ${domain}`);
    });
  }

  function renderCustomCssList() {
    customCssList.innerHTML = '';
    const rules = currentConfig.custom_css_rules || {};
    const entries = Object.entries(rules);

    if (entries.length === 0) {
      const empty = document.createElement('div');
      empty.style.color = '#64748b';
      empty.style.fontSize = '12px';
      empty.textContent = 'No custom CSS rules defined yet.';
      customCssList.appendChild(empty);
      return;
    }

    entries.forEach(([domain, css]) => {
      const card = document.createElement('div');
      card.className = 'custom-css-card';
      card.innerHTML = `
        <div>
          <div class="custom-css-domain">${domain}</div>
          <div class="custom-css-preview">${escapeHtml(css)}</div>
        </div>
        <button class="btn-link-danger">Delete</button>
      `;
      card.querySelector('.btn-link-danger').addEventListener('click', () => {
        delete currentConfig.custom_css_rules[domain];
        chrome.storage.local.set({ custom_css_rules: currentConfig.custom_css_rules }, () => {
          renderCustomCssList();
          showToast(`Deleted rule for ${domain}`);
        });
      });
      customCssList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Event Listeners: General
  optMasterToggle.addEventListener('change', () => {
    const val = optMasterToggle.checked;
    currentConfig.darkshift_enabled = val;
    chrome.storage.local.set({ darkshift_enabled: val }, () => {
      showToast(val ? 'Universal Dark Mode Enabled' : 'Dark Mode Paused');
    });
  });

  optEngineRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) {
        currentConfig.engine = r.value;
        chrome.storage.local.set({ engine: r.value }, () => {
          showToast(`Theme Engine set to ${r.value}`);
        });
      }
    });
  });

  optFontBoost.addEventListener('change', () => {
    const val = optFontBoost.checked;
    currentConfig.font_boost = val;
    chrome.storage.local.set({ font_boost: val }, () => {
      showToast(`Font Smoothing ${val ? 'Enabled' : 'Disabled'}`);
    });
  });

  // Event Listeners: Sites
  optListMode.addEventListener('change', () => {
    const mode = optListMode.value;
    currentConfig.list_mode = mode;
    chrome.storage.local.set({ list_mode: mode }, () => {
      renderDomainsList();
      showToast(`Switched to ${mode} mode`);
    });
  });

  addDomainBtn.addEventListener('click', addDomain);
  newDomainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addDomain();
  });

  domainSearchInput.addEventListener('input', renderDomainsList);

  clearAllDomainsBtn.addEventListener('click', () => {
    const listMode = optListMode.value;
    const key = (listMode === 'blacklist') ? 'excluded_domains' : 'whitelisted_domains';
    if (confirm(`Are you sure you want to clear all ${listMode} domains?`)) {
      currentConfig[key] = [];
      chrome.storage.local.set({ [key]: [] }, () => {
        renderDomainsList();
        showToast('Domain list cleared');
      });
    }
  });

  // Event Listeners: Schedule
  optScheduleEnabled.addEventListener('change', () => {
    const val = optScheduleEnabled.checked;
    currentConfig.schedule_enabled = val;
    toggleSchedulePanel(val);
    chrome.storage.local.set({ schedule_enabled: val }, () => {
      showToast(`Schedule ${val ? 'Activated' : 'Disabled'}`);
    });
  });

  optScheduleModeRadios.forEach(r => {
    r.addEventListener('change', () => {
      if (r.checked) {
        currentConfig.schedule_mode = r.value;
        toggleTimeRow(r.value === 'time');
        chrome.storage.local.set({ schedule_mode: r.value }, () => {
          showToast(`Schedule mode updated`);
        });
      }
    });
  });

  optScheduleStart.addEventListener('change', () => {
    currentConfig.schedule_start = optScheduleStart.value;
    chrome.storage.local.set({ schedule_start: optScheduleStart.value });
  });

  optScheduleEnd.addEventListener('change', () => {
    currentConfig.schedule_end = optScheduleEnd.value;
    chrome.storage.local.set({ schedule_end: optScheduleEnd.value });
  });

  // Event Listeners: Custom CSS
  saveCustomCssBtn.addEventListener('click', () => {
    const domain = cleanDomain(cssDomainInput.value);
    const css = (cssCodeInput.value || '').trim();

    if (!domain || !domain.includes('.')) {
      alert('Please specify a valid domain (e.g. reddit.com)');
      return;
    }
    if (!css) {
      alert('Please enter CSS rules to apply.');
      return;
    }

    if (!currentConfig.custom_css_rules) {
      currentConfig.custom_css_rules = {};
    }

    currentConfig.custom_css_rules[domain] = css;
    chrome.storage.local.set({ custom_css_rules: currentConfig.custom_css_rules }, () => {
      cssDomainInput.value = '';
      cssCodeInput.value = '';
      renderCustomCssList();
      showToast(`Saved custom CSS for ${domain}`);
    });
  });

  // Event Listeners: Backup & Restore
  exportSettingsBtn.addEventListener('click', () => {
    chrome.storage.local.get(null, (allData) => {
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `darkshift-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Configuration exported');
    });
  });

  importSettingsBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (typeof imported === 'object' && imported !== null) {
          chrome.storage.local.set(imported, () => {
            loadSettings();
            showToast('Settings successfully imported!');
          });
        } else {
          alert('Invalid settings backup format.');
        }
      } catch (err) {
        alert('Could not parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  resetDefaultsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all DarkShift Pro settings to factory defaults?')) {
      chrome.storage.local.clear(() => {
        // Reload default values
        location.reload();
      });
    }
  });

  loadSettings();
});
