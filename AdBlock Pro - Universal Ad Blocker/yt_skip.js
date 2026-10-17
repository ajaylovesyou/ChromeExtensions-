/**
 * AdBlock Pro - Ultra-Fast YouTube Instant Ad Skipper
 * Runs in the MAIN world to access YouTube's native player API directly,
 * eliminating the 5-10 second black screen / buffering delay completely.
 */

(function () {
  'use strict';

  // Prevent duplicate execution if injected both by manifest and content script
  if (window.__adBlockProYtSkipperInstalled) return;
  window.__adBlockProYtSkipperInstalled = true;

  let originalSpeed = 1.0;
  let isAdActive = false;
  let skipCount = 0;

  function isAdBlockDisabled() {
    return document.documentElement && document.documentElement.getAttribute('data-adblock-pro-disabled') === 'true';
  }

  function getPlayer() {
    return document.getElementById('movie_player') || document.querySelector('.html5-video-player');
  }

  function getMainVideo() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function instantSkip() {
    if (isAdBlockDisabled()) return;

    const player = getPlayer();
    const video = getMainVideo();

    if (!player && !video) return;

    // Detect if YouTube is currently displaying an ad
    const hasAdClass = player && (
      player.classList.contains('ad-showing') ||
      player.classList.contains('ad-interrupting')
    );
    const hasAdOverlay = document.querySelector('.ytp-ad-player-overlay, .ytp-ad-text, .ytp-ad-preview-container');

    if (hasAdClass || hasAdOverlay) {
      if (!isAdActive) {
        isAdActive = true;
        skipCount++;
        if (video && video.playbackRate <= 2.0) {
          originalSpeed = video.playbackRate;
        }
      }

      // 1. Direct native player skipAd call (Instant 0ms bypass)
      if (player && typeof player.skipAd === 'function') {
        try {
          player.skipAd();
        } catch (e) {}
      }

      // 2. Click any YouTube skip button immediately
      const skipSelectors = [
        '.ytp-ad-skip-button',
        '.ytp-ad-skip-button-modern',
        '.ytp-skip-ad-button',
        '.ytp-ad-skip-button-slot button',
        '.ytp-ad-overlay-close-button',
        'button[class*="ytp-ad-skip-button"]'
      ];
      for (const sel of skipSelectors) {
        const btn = document.querySelector(sel);
        if (btn) {
          try {
            btn.click();
          } catch (e) {}
          break;
        }
      }

      // 3. Fast-forward video to end instantly & mute ad audio
      if (video) {
        video.muted = true;
        if (isFinite(video.duration) && video.duration > 0) {
          video.currentTime = video.duration;
        }
        video.playbackRate = 16.0;
        try {
          video.dispatchEvent(new Event('ended'));
        } catch (e) {}
      }

      // 4. Force video start immediately so it does not hang
      if (player && typeof player.playVideo === 'function') {
        try {
          player.playVideo();
        } catch (e) {}
      }
      if (video && video.paused) {
        video.play().catch(() => {});
      }
    } else {
      // Ad has ended or skipped: restore playback immediately
      if (isAdActive) {
        isAdActive = false;

        if (video) {
          video.muted = false;
          video.playbackRate = originalSpeed || 1.0;
          if (video.paused) {
            video.play().catch(() => {});
          }
        }

        if (player && typeof player.playVideo === 'function') {
          try {
            player.playVideo();
          } catch (e) {}
        }
      }
    }

    // Dismiss any anti-adblock enforcement dialogs & unpause video
    dismissEnforcementDialogs(player, video);
  }

  function dismissEnforcementDialogs(player, video) {
    if (isAdBlockDisabled()) return;

    const dialogs = document.querySelectorAll(
      'tp-yt-paper-dialog, ytd-enforcement-message-view-model, #error-screen'
    );
    if (dialogs.length > 0) {
      dialogs.forEach((dialog) => {
        const text = (dialog.innerText || '').toLowerCase();
        if (text.includes('ad blocker') || text.includes('terms of service')) {
          dialog.remove();
          if (player && typeof player.playVideo === 'function') {
            try {
              player.playVideo();
            } catch (e) {}
          }
          if (video && video.paused) {
            video.play().catch(() => {});
          }
        }
      });
    }
  }

  // High-performance event listener binding
  function bindVideoEvents() {
    const video = getMainVideo();
    if (!video || video._adBlockProBound) return;

    video._adBlockProBound = true;
    const events = ['timeupdate', 'play', 'playing', 'loadstart', 'canplay', 'ratechange'];
    events.forEach((evt) => {
      video.addEventListener(evt, instantSkip, { passive: true });
    });
  }

  // MutationObserver for synchronous class change detection
  const observer = new MutationObserver(() => {
    instantSkip();
    bindVideoEvents();
  });

  const rootEl = document.documentElement;
  if (rootEl) {
    observer.observe(rootEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'src']
    });
  }

  // Fast polling check (every 40ms) to guarantee instant video transition
  setInterval(instantSkip, 40);

  // Initial execution
  if (document.readyState !== 'loading') {
    bindVideoEvents();
    instantSkip();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      bindVideoEvents();
      instantSkip();
    });
  }
})();
