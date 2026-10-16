/**
 * ScamShield AI - Content Script
 * Handles real-time page inspection, deceptive link detection, and in-page alert cards.
 */

(() => {
  let hoverTooltip = null;

  // 1. Listen for background commands (e.g., context-menu safety cards or page audits)
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SHOW_SAFETY_CARD') {
      renderSafetyCard(request.data);
      sendResponse({ status: 'OK' });
      return true;
    }

    if (request.action === 'EXTRACT_PAGE_DATA') {
      const pageData = extractPageData();
      sendResponse({ pageData });
      return true;
    }
  });

  // 2. Extract DOM data for Shopping & Website safety auditing
  function extractPageData() {
    const title = document.title || '';
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    
    // Sample body text (first 5000 chars is plenty for scam/urgency patterns)
    const bodyText = (document.body?.innerText || '').substring(0, 5000);

    // Look for countdown timer elements
    const hasCountdown = !!document.querySelector('[id*="timer"], [class*="timer"], [class*="countdown"], [id*="countdown"]');

    // Look for payment icons or mentions
    const mentionsWireOrCrypto = /western union|moneygram|zelle|crypto only|bitcoin only/i.test(bodyText);

    return {
      url: window.location.href,
      hostname: window.location.hostname,
      title,
      metaDescription: metaDesc,
      bodyText,
      hasCountdown,
      mentionsWireOrCrypto
    };
  }

  // 3. Inspect Links for Deception (Text claims one domain, href leads to another)
  function inspectLinks() {
    const anchors = document.querySelectorAll('a[href]');
    const currentHost = window.location.hostname.toLowerCase().replace(/^www\./, '');

    anchors.forEach(a => {
      const text = (a.innerText || '').trim();
      const href = a.getAttribute('href');

      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      // Check if text looks like a trusted domain (e.g. paypal.com, usps.com, amazon.com)
      const urlLikeRegex = /(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})/i;
      const match = text.match(urlLikeRegex);

      if (match) {
        try {
          const displayedDomain = match[1].toLowerCase().replace(/^www\./, '');
          const targetUrl = new URL(href, window.location.href);
          const targetHost = targetUrl.hostname.toLowerCase().replace(/^www\./, '');

          // Check if mismatch exists and is not just a subdomain of displayed domain
          if (displayedDomain && targetHost && displayedDomain !== targetHost && !targetHost.endsWith('.' + displayedDomain)) {
            // Flag this deceptive link with a subtle dashed highlight
            a.style.outline = '2px dashed #ef4444';
            a.style.outlineOffset = '2px';
            a.setAttribute('data-scamshield-warning', `Deceptive Link! Shows "${displayedDomain}" but goes to "${targetHost}"`);

            a.addEventListener('mouseenter', handleLinkMouseEnter);
            a.addEventListener('mouseleave', handleLinkMouseLeave);
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    });
  }

  function handleLinkMouseEnter(e) {
    const warning = e.currentTarget.getAttribute('data-scamshield-warning');
    if (!warning) return;

    if (!hoverTooltip) {
      hoverTooltip = document.createElement('div');
      hoverTooltip.className = 'scamshield-hover-tooltip';
      document.body.appendChild(hoverTooltip);
    }

    hoverTooltip.innerHTML = `<strong>⚠️ ScamShield Alert:</strong><br>${warning}`;
    const rect = e.currentTarget.getBoundingClientRect();
    hoverTooltip.style.top = `${window.scrollY + rect.bottom + 6}px`;
    hoverTooltip.style.left = `${window.scrollX + Math.max(10, rect.left)}px`;
    hoverTooltip.style.display = 'block';
  }

  function handleLinkMouseLeave() {
    if (hoverTooltip) {
      hoverTooltip.style.display = 'none';
    }
  }

  // 4. Render Floating In-Page Safety Card
  function renderSafetyCard(data) {
    let host = document.getElementById('scamshield-safety-card-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'scamshield-safety-card-host';
      document.body.appendChild(host);
    }

    const explanation = data.explanation || {};
    const badgeClass = explanation.badgeClass || 'badge-yellow';
    const badgeText = explanation.badgeText || 'CAUTION';
    const title = explanation.title || data.title || 'Safety Check';
    const summary = explanation.summary || '';
    const reasons = explanation.reasons || [];
    const nextSteps = explanation.nextSteps || [];

    host.innerHTML = `
      <div class="scamshield-card">
        <div class="scamshield-header">
          <div class="scamshield-brand">
            <span>🛡️</span>
            <span>ScamShield AI</span>
          </div>
          <button class="scamshield-close-btn" id="scamshield-close" title="Close">&times;</button>
        </div>
        <div class="scamshield-body">
          <div class="scamshield-badge ${badgeClass}">${badgeText}</div>
          <h3 class="scamshield-card-title">${title}</h3>
          <p class="scamshield-card-summary">${summary}</p>

          ${reasons.length > 0 ? `
            <div class="scamshield-section-title">Why it's suspicious:</div>
            <ul class="scamshield-list">
              ${reasons.map(r => `<li>${r}</li>`).join('')}
            </ul>
          ` : ''}

          ${nextSteps.length > 0 ? `
            <div class="scamshield-section-title">Recommended Action:</div>
            <ul class="scamshield-list">
              ${nextSteps.map(s => `<li>${s}</li>`).join('')}
            </ul>
          ` : ''}
        </div>
        <div class="scamshield-footer">
          <span>Your Online Safety Assistant</span>
          <span>Manifest V3</span>
        </div>
      </div>
    `;

    document.getElementById('scamshield-close')?.addEventListener('click', () => {
      host.innerHTML = '';
    });
  }

  // Run initial link inspection after DOM is settled
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inspectLinks);
  } else {
    inspectLinks();
  }

  // Periodic check for dynamically loaded links (SPA websites)
  setTimeout(inspectLinks, 2000);
})();
