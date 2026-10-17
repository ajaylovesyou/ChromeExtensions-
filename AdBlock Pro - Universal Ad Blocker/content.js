/**
 * AdBlock Pro - Universal Content Script
 * Handles dynamic cosmetic element hiding, universal video ad auto-skip, and anti-adblock mitigations.
 */

(function () {
  'use strict';

  let isEnabled = true;
  let isWhitelisted = false;
  let cosmeticEnabled = true;
  let videoEnabled = true;
  let antiAdblockEnabled = true;

  let blockedCount = 0;
  let currentHost = window.location.hostname || '';
  try {
    currentHost = currentHost.replace(/^www\./, '');
  } catch (e) {}

  let observer = null;
  let videoHeartbeatInterval = null;

  // Initialize status from extension storage
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      [
        'adblock_enabled',
        'whitelisted_domains',
        'shield_cosmetic',
        'shield_video',
        'shield_anti_adblock'
      ],
      (res) => {
        if (chrome.runtime.lastError || !res) {
          applyDisabledState();
          return;
        }

        applySettings(res);
      }
    );

    // Real-time synchronization when user toggles settings in popup/options
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        chrome.storage.local.get(
          [
            'adblock_enabled',
            'whitelisted_domains',
            'shield_cosmetic',
            'shield_video',
            'shield_anti_adblock'
          ],
          (res) => {
            if (!chrome.runtime.lastError && res) {
              applySettings(res);
            }
          }
        );
      }
    });
  }

  function applySettings(res) {
    isEnabled = res.adblock_enabled !== false;
    const whitelist = Array.isArray(res.whitelisted_domains) ? res.whitelisted_domains : [];
    isWhitelisted = isDomainWhitelisted(currentHost, whitelist);

    cosmeticEnabled = res.shield_cosmetic !== false;
    videoEnabled = res.shield_video !== false;
    antiAdblockEnabled = res.shield_anti_adblock !== false;

    if (!isEnabled || isWhitelisted) {
      applyDisabledState();
      stopBlocker();
      return;
    }

    if (!cosmeticEnabled) {
      applyDisabledState();
    } else {
      removeDisabledState();
    }

    // Start or re-init blocker
    initAdBlocker();
  }

  function isDomainWhitelisted(host, list) {
    if (!host || !list || list.length === 0) return false;
    const h = host.toLowerCase().replace(/^www\./, '');
    return list.some((item) => {
      const clean = (item || '').toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      return clean && (h === clean || h.endsWith('.' + clean));
    });
  }

  function applyDisabledState() {
    try {
      const root = document.documentElement;
      if (root && root.setAttribute) {
        root.setAttribute('data-adblock-pro-disabled', 'true');
      }
    } catch (e) {}
  }

  function removeDisabledState() {
    try {
      const root = document.documentElement;
      if (root && root.removeAttribute) {
        root.removeAttribute('data-adblock-pro-disabled');
      }
    } catch (e) {}
  }

  function stopBlocker() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (videoHeartbeatInterval) {
      clearInterval(videoHeartbeatInterval);
      videoHeartbeatInterval = null;
    }
  }

  // Listen for real-time messages from popup
  if (chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'GET_TAB_STATS') {
        sendResponse({ blockedCount, host: currentHost });
        return false;
      }
      if (msg.type === 'TOGGLE_STATE') {
        location.reload();
        return false;
      }
    });
  }

  let isInitialized = false;

  function initAdBlocker() {
    if (isInitialized) return;
    isInitialized = true;

    // 1. YouTube instant script fallback (manifest injects in MAIN world, fallback if needed)
    if (currentHost.includes('youtube.com') && window === window.top) {
      ensureMainWorldScript('yt_skip.js');
    }

    // 2. Initial cosmetic DOM sweep if cosmetic shield is enabled
    if (cosmeticEnabled) {
      runCosmeticSweep();
    }

    // 3. Observe dynamic ad injections
    observer = new MutationObserver(debounce(() => {
      if (cosmeticEnabled) runCosmeticSweep();
      if (videoEnabled) handleUniversalVideoAds();
    }, 80));

    const targetNode = document.documentElement || document.body;
    if (targetNode) {
      observer.observe(targetNode, {
        childList: true,
        subtree: true
      });
    }

    // 4. Video ad handler heartbeat (only if video shield is active)
    if (videoEnabled) {
      videoHeartbeatInterval = setInterval(() => {
        // Only run query selectors if video elements exist on page
        if (document.querySelector('video') || document.querySelector('.html5-video-player')) {
          handleUniversalVideoAds();
        }
      }, 400);
    }

    // 5. Anti-adblock mitigations if enabled
    if (antiAdblockEnabled) {
      defuseAggressivePopups();
      mitigateAntiAdBlockModals();
    }
  }

  function ensureMainWorldScript(file) {
    try {
      if (window.__adBlockProYtSkipperInstalled) return;
      if (document.querySelector(`script[src*="${file}"]`)) return;

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(file);
      script.onload = function () {
        this.remove();
      };
      (document.head || document.documentElement).appendChild(script);
    } catch (e) {
      // Handled by manifest MAIN world injection
    }
  }

  const adSelectors = [
    'ins.adsbygoogle',
    '[id^="google_ads_iframe"]',
    '[id^="div-gpt-ad"]',
    '[id*="google_ads_"]',
    '[class*="google-ads"]',
    'div[data-google-query-id]',
    'div[data-ad-slot]',
    'div[data-ad-unit]',
    '.ad-container',
    '.ad-wrapper',
    '.ad-banner',
    '.ad-slot',
    '.ad-unit',
    '.ad-box',
    '.sticky-ad',
    '.floating-ad',
    '.bottom-ad-bar',
    '.top-ad-bar',
    '.native-ad-unit',
    '.sponsored-post',
    '.sponsored-content',
    '.taboola-placeholder',
    '#taboola-below-article-thumbnails',
    '.trc_related_container',
    '.outbrain',
    '.ob-widget',
    '.rc-container',
    '.mgbox',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[src*="criteo.com"]',
    'iframe[src*="amazon-adsystem.com"]',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    '#masthead-ad'
  ];

  function runCosmeticSweep() {
    if (!cosmeticEnabled || !isEnabled || isWhitelisted) return;

    let newlyBlocked = 0;
    const combinedSelector = adSelectors.join(',');

    try {
      const elements = document.querySelectorAll(combinedSelector);
      elements.forEach((el) => {
        if (el && el.style.display !== 'none') {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('height', '0px', 'important');
          newlyBlocked++;
        }
      });
    } catch (e) {
      // Ignore selector errors
    }

    if (newlyBlocked > 0) {
      blockedCount += newlyBlocked;
      reportBlockedCount(newlyBlocked);
    }
  }

  // Universal Video Ad Handling (YouTube backup & generic HTML5 video players)
  function handleUniversalVideoAds() {
    if (!videoEnabled || !isEnabled || isWhitelisted) return;

    // 1. YouTube instant handling (as backup to yt_skip.js)
    const ytPlayer = document.querySelector('.html5-video-player');
    if (ytPlayer && (ytPlayer.classList.contains('ad-showing') || ytPlayer.classList.contains('ad-interrupting'))) {
      const ytVideo = ytPlayer.querySelector('video');
      if (ytVideo) {
        ytVideo.muted = true;
        if (isFinite(ytVideo.duration) && ytVideo.duration > 0) {
          ytVideo.currentTime = ytVideo.duration;
        }
        ytVideo.playbackRate = 16.0;
        try {
          ytVideo.dispatchEvent(new Event('ended'));
        } catch (e) {}
      }

      const skipBtns = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-slot button',
        '.ytp-ad-overlay-close-button'
      ];
      for (const sel of skipBtns) {
        const btn = document.querySelector(sel);
        if (btn) {
          try {
            btn.click();
            blockedCount++;
            reportBlockedCount(1);
          } catch (e) {}
          break;
        }
      }

      // Resume video playback
      if (ytVideo && ytVideo.paused) {
        ytVideo.play().catch(() => {});
      }
    }

    // 2. Generic HTML5 Video Ad Overlays & Pre-rolls (DailyMotion, Twitch, news sites, etc.)
    const genericAdOverlays = document.querySelectorAll(
      '.vjs-ad-overlay, .ima-ad-container, .video-ad-overlay, [class*="ad-overlay"], [id*="ad-overlay"]'
    );

    genericAdOverlays.forEach((overlay) => {
      if (overlay && overlay.style.display !== 'none') {
        overlay.style.setProperty('display', 'none', 'important');
        blockedCount++;
        reportBlockedCount(1);

        const video = document.querySelector('video');
        if (video && video.paused) {
          video.play().catch(() => {});
        }
      }
    });

    // 3. Prevent video stalling after ad skip
    const allVideos = document.querySelectorAll('video');
    allVideos.forEach((v) => {
      if (!v._instantPlayHooked) {
        v._instantPlayHooked = true;
        v.addEventListener('ended', () => {
          setTimeout(() => {
            if (v && v.paused && v.duration > 30) {
              v.play().catch(() => {});
            }
          }, 30);
        });
      }
    });
  }

  function mitigateAntiAdBlockModals() {
    window.addEventListener('load', () => {
      checkAndRestoreScroll();
    });
    setInterval(checkAndRestoreScroll, 1200);
  }

  function checkAndRestoreScroll() {
    if (!antiAdblockEnabled || !isEnabled || isWhitelisted) return;

    try {
      const body = document.body;
      if (!body) return;
      const bodyStyle = window.getComputedStyle(body);
      if (bodyStyle.overflow === 'hidden' || document.documentElement.style.overflow === 'hidden') {
        const allModals = document.querySelectorAll('div[class*="modal"], div[class*="overlay"], div[id*="adblock"], tp-yt-paper-dialog, ytd-enforcement-message-view-model');
        allModals.forEach((modal) => {
          const text = (modal.innerText || '').toLowerCase();
          if (text.includes('ad blocker') || text.includes('adblock') || text.includes('disable your ad') || text.includes('terms of service')) {
            modal.style.setProperty('display', 'none', 'important');
            modal.remove();
            document.body.style.setProperty('overflow', 'auto', 'important');
            document.documentElement.style.setProperty('overflow', 'auto', 'important');

            const video = document.querySelector('video');
            if (video && video.paused) {
              video.play().catch(() => {});
            }
          }
        });
      }
    } catch (e) {}
  }

  function defuseAggressivePopups() {
    const originalOpen = window.open;
    window.open = function (url) {
      if (!url || typeof url !== 'string') return originalOpen.apply(this, arguments);

      const isSuspectAdUrl = /adserver|popunder|clickadu|propellerads|popads|syndication/i.test(url);
      if (isSuspectAdUrl && isEnabled && !isWhitelisted) {
        console.warn('[AdBlock Pro] Blocked aggressive popup to:', url);
        blockedCount++;
        reportBlockedCount(1);
        return null;
      }
      return originalOpen.apply(this, arguments);
    };
  }

  function reportBlockedCount(count) {
    if (!chrome.runtime || !chrome.runtime.id) return;
    try {
      chrome.runtime.sendMessage(
        {
          type: 'ADS_BLOCKED_REPORT',
          count: count,
          host: currentHost
        },
        () => {
          if (chrome.runtime.lastError) {
            // Suppress error if background service worker is idle or reloaded
          }
        }
      );
    } catch (e) {
      // Extension context invalidated
    }
  }

  function debounce(func, wait) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
})();
