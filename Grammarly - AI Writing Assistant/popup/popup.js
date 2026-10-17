/**
 * Grammarly - AI Writing Assistant
 * Popup Controller & Scratchpad
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const textInput = document.getElementById('text-input');
  const scoreValue = document.getElementById('score-value');
  const scoreCircle = document.getElementById('score-circle');
  const btnFixAll = document.getElementById('btn-fix-all');
  const fixCountBadge = document.getElementById('fix-count-badge');
  const btnLoadSample = document.getElementById('btn-load-sample');
  const btnCopy = document.getElementById('btn-copy');
  const btnClear = document.getElementById('btn-clear');
  const btnSettings = document.getElementById('btn-settings');
  const linkOptions = document.getElementById('link-options');

  const metricGrammar = document.getElementById('metric-grammar');
  const metricSpelling = document.getElementById('metric-spelling');
  const metricClarity = document.getElementById('metric-clarity');
  const metricTone = document.getElementById('metric-tone');

  const statWords = document.getElementById('stat-words');
  const statChars = document.getElementById('stat-chars');
  const statReading = document.getElementById('stat-reading');
  const statReadability = document.getElementById('stat-readability');

  const totalIssuesCount = document.getElementById('total-issues-count');
  const issuesList = document.getElementById('issues-list');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const toneChips = document.querySelectorAll('.tone-chip');

  // State
  let currentAnalysis = null;
  let currentFilter = 'all';
  let debounceTimeout = null;

  // Initialize SpellChecker personal dictionary
  if (typeof SpellChecker !== 'undefined') {
    await SpellChecker.loadPersonalDictionary();
  }

  // Sample text demonstrating grammar, spelling, clarity, and tone features
  const sampleText = `their are many people who has the ability to loose weight. in order to accomplish this, he have to make a decision to run every day. it's color and design was truely an unexpected surprise, but irregardless, they was definately excited about the end result.`;

  // Run full analysis
  async function performAnalysis() {
    const text = textInput.value;
    if (typeof AIService === 'undefined') return;

    currentAnalysis = await AIService.analyzeText(text);
    renderMetrics(currentAnalysis);
    renderIssuesList(currentAnalysis);
  }

  // Update Score & Metric cards
  function renderMetrics(analysis) {
    const score = analysis.overallScore;
    scoreValue.textContent = score;

    // Adjust score circle border color
    if (score >= 90) {
      scoreCircle.style.borderColor = '#10b981';
      scoreCircle.style.color = '#059669';
    } else if (score >= 75) {
      scoreCircle.style.borderColor = '#3b82f6';
      scoreCircle.style.color = '#2563eb';
    } else if (score >= 60) {
      scoreCircle.style.borderColor = '#f59e0b';
      scoreCircle.style.color = '#d97706';
    } else {
      scoreCircle.style.borderColor = '#ef4444';
      scoreCircle.style.color = '#dc2626';
    }

    const summary = analysis.summary || {
      grammarCount: 0,
      spellingCount: 0,
      clarityCount: 0,
      totalIssues: 0
    };
    const stats = analysis.stats || { wordCount: 0, charCount: 0, readingTimeSeconds: 0 };
    const readability = analysis.readability || { score: 100 };

    metricGrammar.textContent = summary.grammarCount;
    metricSpelling.textContent = summary.spellingCount;
    metricClarity.textContent = summary.clarityCount;
    metricTone.textContent = (analysis.tone && analysis.tone.primary) || 'Neutral';

    statWords.textContent = stats.wordCount;
    statChars.textContent = stats.charCount;
    statReading.textContent = `${stats.readingTimeSeconds}s`;
    statReadability.textContent = `${readability.score}%`;

    const issuesLength = (analysis.issues || []).length;
    totalIssuesCount.textContent = issuesLength;
    fixCountBadge.textContent = issuesLength;
    btnFixAll.disabled = issuesLength === 0;
  }

  // Render Issue Cards
  function renderIssuesList(analysis) {
    issuesList.innerHTML = '';
    const issues = analysis.issues || [];

    const filtered = issues.filter(issue => {
      if (currentFilter === 'all') return true;
      return issue.category === currentFilter;
    });

    if (filtered.length === 0) {
      const isClean = issues.length === 0 && textInput.value.trim().length > 0;
      issuesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${isClean ? '🎉' : '✍️'}</div>
          <div class="empty-title">${isClean ? 'Flawless Writing!' : 'No Issues Found'}</div>
          <div class="empty-desc">${isClean ? 'Your text is clear, grammatically sound, and polished.' : 'Type or paste text above to start checking.'}</div>
        </div>
      `;
      return;
    }

    filtered.forEach((issue) => {
      const card = document.createElement('div');
      card.className = `issue-item ${issue.category}`;

      const original = issue.text;
      const replacement = issue.replacement === '' ? '(remove)' : (issue.replacement || 'Improve');

      card.innerHTML = `
        <div class="issue-meta">
          <span class="category-tag ${issue.category}">${issue.type || issue.category}</span>
        </div>
        <div class="change-row">
          <span class="wrong-text">${escapeHtml(original)}</span>
          <span>→</span>
          <span class="fixed-text">${escapeHtml(replacement)}</span>
        </div>
        <div class="issue-explanation">${escapeHtml(issue.explanation || '')}</div>
        <div class="issue-actions">
          ${issue.replacement !== null ? `<button class="btn-accept" data-action="accept">Accept</button>` : ''}
          <button class="btn-ignore" data-action="ignore">Ignore</button>
          ${issue.category === 'spelling' ? `<button class="btn-dict" data-action="dict" data-word="${escapeHtml(original)}">+ Dictionary</button>` : ''}
        </div>
      `;

      // Accept single button
      const btnAccept = card.querySelector('[data-action="accept"]');
      if (btnAccept) {
        btnAccept.onclick = () => {
          textInput.value = AIService.applyFix(textInput.value, issue);
          performAnalysis();
        };
      }

      // Ignore button
      const btnIgnore = card.querySelector('[data-action="ignore"]');
      if (btnIgnore) {
        btnIgnore.onclick = () => {
          const idx = currentAnalysis.issues.indexOf(issue);
          if (idx !== -1) {
            currentAnalysis.issues.splice(idx, 1);
            renderMetrics(currentAnalysis);
            renderIssuesList(currentAnalysis);
          }
        };
      }

      // Add to dictionary
      const btnDict = card.querySelector('[data-action="dict"]');
      if (btnDict) {
        btnDict.onclick = async () => {
          const word = btnDict.getAttribute('data-word');
          await SpellChecker.addToDictionary(word);
          performAnalysis();
        };
      }

      issuesList.appendChild(card);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Event Listeners
  textInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      performAnalysis();
    }, 300);
  });

  // Fix All button
  btnFixAll.addEventListener('click', () => {
    if (!currentAnalysis || currentAnalysis.issues.length === 0) return;
    textInput.value = AIService.fixAll(textInput.value, currentAnalysis.issues);
    performAnalysis();
  });

  // Load sample text button
  btnLoadSample.addEventListener('click', () => {
    textInput.value = sampleText;
    performAnalysis();
  });

  // Copy button
  btnCopy.addEventListener('click', async () => {
    if (!textInput.value) return;
    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textInput.value);
        copied = true;
      }
    } catch (e) {
      // Fallback
    }
    if (!copied) {
      try {
        textInput.select();
        document.execCommand('copy');
        copied = true;
      } catch (err) {}
    }
    const span = btnCopy.querySelector('span');
    if (span) {
      span.textContent = 'Copied!';
      setTimeout(() => { span.textContent = 'Copy'; }, 1200);
    }
  });

  // Clear button
  btnClear.addEventListener('click', () => {
    textInput.value = '';
    performAnalysis();
  });

  // Settings buttons
  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('../options/options.html');
    }
  };
  btnSettings.addEventListener('click', openOptions);
  linkOptions.addEventListener('click', openOptions);

  // Filter tabs
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.getAttribute('data-filter');
      if (currentAnalysis) {
        renderIssuesList(currentAnalysis);
      }
    });
  });

  // AI Tone and Rephrase chips
  toneChips.forEach(chip => {
    chip.addEventListener('click', async () => {
      const mode = chip.getAttribute('data-mode');
      if (!textInput.value.trim()) return;

      chip.classList.add('loading');
      try {
        const transformed = await AIService.transformText(textInput.value, mode);
        textInput.value = transformed;
        await performAnalysis();
      } catch (err) {
        console.error('Tone transform failed:', err);
      } finally {
        chip.classList.remove('loading');
      }
    });
  });

  // Initial load
  performAnalysis();
});
