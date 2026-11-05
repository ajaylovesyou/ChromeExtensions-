/**
 * DarkShift Pro - Popup Controller
 * Manages master power, per-site toggling, engine switching, and live filter sliders.
 */

document.addEventListener('DOMContentLoaded', () => {
  // UI Element References
  const masterPowerBtn = document.getElementById('masterPowerBtn');
  const masterStatusLabel = document.getElementById('masterStatusLabel');
  const masterSubLabel = document.getElementById('masterSubLabel');
  const openOptionsBtn = document.getElementById('openOptionsBtn');

  const currentDomainEl = document.getElementById('currentDomain');
  const siteStatusText = document.getElementById('siteStatusText');
  const siteToggle = document.getElementById('siteToggle');

  const engineBtns = document.querySelectorAll('.engine-btn');

  const inputBrightness = document.getElementById('inputBrightness');
  const valBrightness = document.getElementById('valBrightness');
  const inputContrast = document.getElementById('inputContrast');
  const valContrast = document.getElementById('valContrast');
  const inputSepia = document.getElementById('inputSepia');
  const valSepia = document.getElementById('valSepia');
  const inputGrayscale = document.getElementById('inputGrayscale');
  const valGrayscale = document.getElementById('valGrayscale');

  const fontBoostToggle = document.getElementById('fontBoostToggle');
  const resetSlidersBtn = document.getElementById('resetSlidersBtn');

  let activeHostname = '';
  let activeTabId = null;
  let currentConfig = {};

  // Debounce helper for slider storage saving
  let saveTimeout = null;
  function debounceSave(data) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set(data);
    }, 60);
  }

  /**
   * Update the UI to reflect the configuration state
   */
  function renderState() {
    const isGlobal = currentConfig.darkshift_enabled !== false;

    // Master Hero
    if (isGlobal) {
      masterPowerBtn.classList.add('active');
      masterStatusLabel.textContent = 'Universal Dark Active';
      masterSubLabel.textContent = 'Applying comfort theme across websites';
    } else {
      masterPowerBtn.classList.remove('active');
      masterStatusLabel.textContent = 'Universal Dark Paused';
      masterSubLabel.textContent = 'Original website colors restored';
    }

    // Engine selection
    const activeEngine = currentConfig.engine || 'smart-invert';
    engineBtns.forEach(btn => {
      if (btn.getAttribute('data-engine') === activeEngine) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Sliders
    const b = currentConfig.brightness !== undefined ? currentConfig.brightness : 100;
    const c = currentConfig.contrast !== undefined ? currentConfig.contrast : 95;
    const s = currentConfig.sepia !== undefined ? currentConfig.sepia : 0;
    const g = currentConfig.grayscale !== undefined ? currentConfig.grayscale : 0;

    inputBrightness.value = b;
    valBrightness.textContent = `${b}%`;

    inputContrast.value = c;
    valContrast.textContent = `${c}%`;

    inputSepia.value = s;
    valSepia.textContent = `${s}%`;

    inputGrayscale.value = g;
    valGrayscale.textContent = `${g}%`;

    // Font Boost
    fontBoostToggle.checked = currentConfig.font_boost !== false;

    // Per-site toggle
    updateSiteSection();
  }

  /**
   * Determine and update the current domain's toggle status
   */
  function updateSiteSection() {
    if (!activeHostname) {
      currentDomainEl.textContent = 'Browser Internal Page';
      siteStatusText.textContent = 'Extension disabled on this page';
      siteStatusText.className = 'site-state disabled';
      siteToggle.disabled = true;
      siteToggle.checked = false;
      return;
    }

    currentDomainEl.textContent = activeHostname;
    const listMode = currentConfig.list_mode || 'blacklist';
    const excluded = Array.isArray(currentConfig.excluded_domains) ? currentConfig.excluded_domains : [];
    const whitelisted = Array.isArray(currentConfig.whitelisted_domains) ? currentConfig.whitelisted_domains : [];

    let isSiteActive = true;
    if (listMode === 'blacklist') {
      isSiteActive = !excluded.some(d => activeHostname === d || activeHostname.endsWith('.' + d));
    } else {
      isSiteActive = whitelisted.some(d => activeHostname === d || activeHostname.endsWith('.' + d));
    }

    siteToggle.disabled = false;
    siteToggle.checked = isSiteActive;

    if (isSiteActive) {
      siteStatusText.textContent = 'Dark theme active on this site';
      siteStatusText.className = 'site-state';
    } else {
      siteStatusText.textContent = 'Site excluded (Original theme)';
      siteStatusText.className = 'site-state disabled';
    }
  }

  /**
   * Load active tab and configuration
   */
  function init() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs && tabs[0]) {
        activeTabId = tabs[0].id;
        try {
          const url = new URL(tabs[0].url);
          if (url.protocol.startsWith('http')) {
            activeHostname = url.hostname.toLowerCase();
          }
        } catch {
          activeHostname = '';
        }
      }

      chrome.storage.local.get(null, (res) => {
        currentConfig = res || {};
        renderState();
      });
    });
  }

  // Master Power Button
  masterPowerBtn.addEventListener('click', () => {
    const next = !(currentConfig.darkshift_enabled !== false);
    currentConfig.darkshift_enabled = next;
    renderState();
    chrome.storage.local.set({ darkshift_enabled: next });
  });

  // Per-Site Switch
  siteToggle.addEventListener('change', () => {
    if (!activeHostname) return;

    const listMode = currentConfig.list_mode || 'blacklist';
    const shouldBeActive = siteToggle.checked;

    if (listMode === 'blacklist') {
      let list = Array.isArray(currentConfig.excluded_domains) ? [...currentConfig.excluded_domains] : [];
      if (shouldBeActive) {
        // Remove from excluded
        list = list.filter(d => d !== activeHostname && !activeHostname.endsWith('.' + d));
      } else {
        // Add to excluded
        if (!list.includes(activeHostname)) {
          list.push(activeHostname);
        }
      }
      currentConfig.excluded_domains = list;
      chrome.storage.local.set({ excluded_domains: list }, () => {
        updateSiteSection();
      });
    } else {
      let list = Array.isArray(currentConfig.whitelisted_domains) ? [...currentConfig.whitelisted_domains] : [];
      if (shouldBeActive) {
        if (!list.includes(activeHostname)) {
          list.push(activeHostname);
        }
      } else {
        list = list.filter(d => d !== activeHostname && !activeHostname.endsWith('.' + d));
      }
      currentConfig.whitelisted_domains = list;
      chrome.storage.local.set({ whitelisted_domains: list }, () => {
        updateSiteSection();
      });
    }
  });

  // Engine Buttons
  engineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const selected = btn.getAttribute('data-engine');
      currentConfig.engine = selected;
      renderState();
      chrome.storage.local.set({ engine: selected });
    });
  });

  // Brightness Slider
  inputBrightness.addEventListener('input', () => {
    const val = parseInt(inputBrightness.value, 10);
    valBrightness.textContent = `${val}%`;
    currentConfig.brightness = val;
    debounceSave({ brightness: val });
  });

  // Contrast Slider
  inputContrast.addEventListener('input', () => {
    const val = parseInt(inputContrast.value, 10);
    valContrast.textContent = `${val}%`;
    currentConfig.contrast = val;
    debounceSave({ contrast: val });
  });

  // Warmth / Sepia Slider
  inputSepia.addEventListener('input', () => {
    const val = parseInt(inputSepia.value, 10);
    valSepia.textContent = `${val}%`;
    currentConfig.sepia = val;
    debounceSave({ sepia: val });
  });

  // Grayscale Slider
  inputGrayscale.addEventListener('input', () => {
    const val = parseInt(inputGrayscale.value, 10);
    valGrayscale.textContent = `${val}%`;
    currentConfig.grayscale = val;
    debounceSave({ grayscale: val });
  });

  // Font Boost Toggle
  fontBoostToggle.addEventListener('change', () => {
    const val = fontBoostToggle.checked;
    currentConfig.font_boost = val;
    chrome.storage.local.set({ font_boost: val });
  });

  // Reset Sliders
  resetSlidersBtn.addEventListener('click', () => {
    currentConfig.brightness = 100;
    currentConfig.contrast = 95;
    currentConfig.sepia = 0;
    currentConfig.grayscale = 0;
    renderState();
    chrome.storage.local.set({
      brightness: 100,
      contrast: 95,
      sepia: 0,
      grayscale: 0
    });
  });

  // Open Options Page
  openOptionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  init();
});
