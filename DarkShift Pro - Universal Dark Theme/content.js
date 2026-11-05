/**
 * DarkShift Pro - Content Script
 * Applies instant dark theme, handles media preservation, anti-FOUC, and live updates.
 */

(function () {
  'use strict';

  // Current domain normalization
  const currentHostname = window.location.hostname.toLowerCase();
  
  // State cache
  let currentConfig = null;
  let isApplied = false;

  // Preflight style tag to prevent blinding white flash (FOUC)
  let preflightStyle = null;
  let customStyleElement = null;

  /**
   * Determine if the current time matches the scheduled window
   */
  function isScheduleActive(config) {
    if (!config.schedule_enabled) return true;
    
    if (config.schedule_mode === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    if (config.schedule_mode === 'time') {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const startParts = (config.schedule_start || '20:00').split(':').map(Number);
      const endParts = (config.schedule_end || '07:00').split(':').map(Number);
      
      const startMinutes = startParts[0] * 60 + (startParts[1] || 0);
      const endMinutes = endParts[0] * 60 + (endParts[1] || 0);
      
      if (startMinutes <= endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Over midnight (e.g. 20:00 to 07:00)
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    }
    
    return true;
  }

  /**
   * Check if domain should receive dark theme
   */
  function isDomainEligible(config) {
    if (!currentHostname) return true;

    // Check blacklist mode vs whitelist mode
    const listMode = config.list_mode || 'blacklist'; // 'blacklist' or 'whitelist'
    const excludedList = Array.isArray(config.excluded_domains) ? config.excluded_domains : [];
    const whiteList = Array.isArray(config.whitelisted_domains) ? config.whitelisted_domains : [];

    const isMatch = (domainList) => {
      return domainList.some(d => {
        const cleaned = d.trim().toLowerCase();
        if (!cleaned) return false;
        return currentHostname === cleaned || currentHostname.endsWith('.' + cleaned);
      });
    };

    if (listMode === 'whitelist') {
      return isMatch(whiteList);
    } else {
      // Blacklist mode: enable unless in excludedList
      return !isMatch(excludedList);
    }
  }

  /**
   * Inject instant zero-delay preflight style before DOM loads
   */
  function injectPreflight() {
    if (preflightStyle || document.getElementById('darkshift-preflight')) return;
    preflightStyle = document.createElement('style');
    preflightStyle.id = 'darkshift-preflight';
    preflightStyle.textContent = `
      html {
        background-color: #121214 !important;
        color-scheme: dark !important;
      }
    `;
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(preflightStyle);
    }
  }

  function removePreflight() {
    if (preflightStyle && preflightStyle.parentNode) {
      preflightStyle.parentNode.removeChild(preflightStyle);
      preflightStyle = null;
    }
    const existing = document.getElementById('darkshift-preflight');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
  }

  /**
   * Apply DarkShift theme attributes and CSS variables
   */
  function applyTheme(config) {
    const root = document.documentElement;
    if (!root) return;

    const engine = config.engine || 'smart-invert';
    const brightness = config.brightness !== undefined ? config.brightness : 100;
    const contrast = config.contrast !== undefined ? config.contrast : 95;
    const sepia = config.sepia !== undefined ? config.sepia : 0;
    const grayscale = config.grayscale !== undefined ? config.grayscale : 0;
    const fontBoost = !!config.font_boost;

    // Set engine attribute
    root.setAttribute('data-darkshift-theme', engine);
    root.setAttribute('data-darkshift-active', 'true');

    // Update custom CSS variables for live adjustment
    root.style.setProperty('--darkshift-brightness', `${brightness}%`);
    root.style.setProperty('--darkshift-contrast', `${contrast}%`);
    root.style.setProperty('--darkshift-sepia', `${sepia}%`);
    root.style.setProperty('--darkshift-grayscale', `${grayscale}%`);
    root.style.setProperty('--darkshift-invert', `${config.invert_level || 90}%`);

    // Font smoothing enhancement
    if (fontBoost) {
      root.classList.add('darkshift-font-boost');
    } else {
      root.classList.remove('darkshift-font-boost');
    }

    // Apply custom domain CSS if defined
    applyCustomDomainCSS(config);

    isApplied = true;
    removePreflight();
  }

  /**
   * Remove dark theme styling from page
   */
  function removeTheme() {
    const root = document.documentElement;
    if (!root) return;

    root.removeAttribute('data-darkshift-theme');
    root.removeAttribute('data-darkshift-active');
    root.classList.remove('darkshift-font-boost');
    root.style.removeProperty('--darkshift-brightness');
    root.style.removeProperty('--darkshift-contrast');
    root.style.removeProperty('--darkshift-sepia');
    root.style.removeProperty('--darkshift-grayscale');
    root.style.removeProperty('--darkshift-invert');

    removeCustomDomainCSS();
    removePreflight();
    isApplied = false;
  }

  /**
   * Apply user-defined custom CSS for specific domains
   */
  function applyCustomDomainCSS(config) {
    const customRules = config.custom_css_rules || {};
    let matchedCSS = '';

    for (const [domain, css] of Object.entries(customRules)) {
      if (currentHostname === domain || currentHostname.endsWith('.' + domain)) {
        matchedCSS += `\n/* DarkShift Custom Rule for ${domain} */\n${css}\n`;
      }
    }

    if (matchedCSS) {
      if (!customStyleElement) {
        customStyleElement = document.createElement('style');
        customStyleElement.id = 'darkshift-custom-domain-css';
        (document.head || document.documentElement).appendChild(customStyleElement);
      }
      customStyleElement.textContent = matchedCSS;
    } else {
      removeCustomDomainCSS();
    }
  }

  function removeCustomDomainCSS() {
    if (customStyleElement && customStyleElement.parentNode) {
      customStyleElement.parentNode.removeChild(customStyleElement);
      customStyleElement = null;
    }
  }

  /**
   * Evaluate whether DarkShift should be active on this page right now
   */
  function evaluateAndApply(config) {
    currentConfig = config;

    const globalEnabled = config.darkshift_enabled !== false;
    const domainEligible = isDomainEligible(config);
    const scheduleActive = isScheduleActive(config);

    if (globalEnabled && domainEligible && scheduleActive) {
      applyTheme(config);
    } else {
      removeTheme();
    }
  }

  /**
   * Initial fast bootstrap
   */
  function init() {
    // Inject preflight immediately in case page is bright
    injectPreflight();

    chrome.storage.local.get(null, (res) => {
      if (chrome.runtime.lastError || !res) {
        removePreflight();
        return;
      }

      // Default settings fallback
      const defaults = {
        darkshift_enabled: true,
        engine: 'smart-invert', // 'smart-invert', 'dynamic-dark', 'oled-dark'
        brightness: 100,
        contrast: 95,
        sepia: 0,
        grayscale: 0,
        font_boost: true,
        list_mode: 'blacklist',
        excluded_domains: [
          'youtube.com',
          'netflix.com',
          'twitch.tv'
        ],
        whitelisted_domains: [],
        schedule_enabled: false,
        schedule_mode: 'system', // 'system' or 'time'
        schedule_start: '20:00',
        schedule_end: '07:00',
        custom_css_rules: {}
      };

      const config = Object.assign({}, defaults, res);
      evaluateAndApply(config);
    });
  }

  // React to settings changes in real-time without reloading
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      chrome.storage.local.get(null, (res) => {
        if (!chrome.runtime.lastError && res) {
          evaluateAndApply(res);
        }
      });
    }
  });

  // Listen for direct messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_domain_status') {
      const isEligible = currentConfig ? isDomainEligible(currentConfig) : true;
      sendResponse({
        hostname: currentHostname,
        isApplied: isApplied,
        isEligible: isEligible,
        config: currentConfig
      });
      return true;
    }

    if (request.action === 'quick_toggle_site') {
      if (!currentConfig) return;
      const excluded = new Set(currentConfig.excluded_domains || []);
      if (excluded.has(currentHostname)) {
        excluded.delete(currentHostname);
      } else {
        excluded.add(currentHostname);
      }
      const updatedList = Array.from(excluded);
      chrome.storage.local.set({ excluded_domains: updatedList }, () => {
        sendResponse({ success: true, excluded: updatedList.includes(currentHostname) });
      });
      return true;
    }
  });

  // Fullscreen video listener: ensure video players look natural in fullscreen
  document.addEventListener('fullscreenchange', () => {
    const isFullscreen = !!document.fullscreenElement;
    if (isFullscreen && isApplied && currentConfig && currentConfig.engine === 'smart-invert') {
      // In fullscreen, ensure video elements are untouched
      if (document.fullscreenElement.tagName === 'VIDEO') {
        document.fullscreenElement.style.filter = 'none';
      }
    }
  });

  // Run at document_start
  init();
})();
