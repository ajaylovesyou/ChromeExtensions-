/**
 * Grammarly - AI Writing Assistant
 * Options & Settings Controller
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const toggleExtension = document.getElementById('toggle-extension');
  const toggleFloatingWidget = document.getElementById('toggle-floating-widget');
  const toggleGrammar = document.getElementById('toggle-grammar');
  const toggleSpelling = document.getElementById('toggle-spelling');
  const toggleClarity = document.getElementById('toggle-clarity');
  const toggleTone = document.getElementById('toggle-tone');

  const selectAudience = document.getElementById('select-audience');
  const selectTone = document.getElementById('select-tone');

  const dictWordInput = document.getElementById('dict-word-input');
  const btnAddWord = document.getElementById('btn-add-word');
  const dictChipsContainer = document.getElementById('dict-chips-container');

  const selectAiProvider = document.getElementById('select-ai-provider');
  const cloudApiFields = document.getElementById('cloud-api-fields');
  const inputApiKey = document.getElementById('input-api-key');
  const btnToggleKey = document.getElementById('btn-toggle-key');
  const inputApiModel = document.getElementById('input-api-model');

  const domainInput = document.getElementById('domain-input');
  const btnAddDomain = document.getElementById('btn-add-domain');
  const domainChipsContainer = document.getElementById('domain-chips-container');

  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const toast = document.getElementById('toast');

  // State
  let customDictionary = [];
  let disabledDomains = [];

  // Default Settings Schema
  const defaultSettings = {
    enableExtension: true,
    showFloatingWidget: true,
    enableGrammar: true,
    enableSpelling: true,
    enableClarity: true,
    enableTone: true,
    targetAudience: 'general',
    targetTone: 'professional',
    customDictionary: ["Grammarly", "Google", "GitHub", "API", "AI", "OAuth", "DevOps", "JSON", "JavaScript", "TypeScript"],
    aiProvider: 'offline',
    apiKey: '',
    apiModel: 'gpt-4o-mini',
    disabledDomains: []
  };

  // Load settings
  async function loadSettings() {
    const data = await chrome.storage.sync.get(defaultSettings);

    toggleExtension.checked = !!data.enableExtension;
    toggleFloatingWidget.checked = !!data.showFloatingWidget;
    toggleGrammar.checked = !!data.enableGrammar;
    toggleSpelling.checked = !!data.enableSpelling;
    toggleClarity.checked = !!data.enableClarity;
    toggleTone.checked = !!data.enableTone;

    selectAudience.value = data.targetAudience || 'general';
    selectTone.value = data.targetTone || 'professional';

    customDictionary = Array.isArray(data.customDictionary) ? [...data.customDictionary] : [...defaultSettings.customDictionary];
    renderDictChips();

    selectAiProvider.value = data.aiProvider || 'offline';
    inputApiKey.value = data.apiKey || '';
    inputApiModel.value = data.apiModel || 'gpt-4o-mini';
    updateCloudFieldsVisibility();

    disabledDomains = Array.isArray(data.disabledDomains) ? [...data.disabledDomains] : [];
    renderDomainChips();
  }

  // Render Dictionary Chips
  function renderDictChips() {
    dictChipsContainer.innerHTML = '';
    if (customDictionary.length === 0) {
      dictChipsContainer.innerHTML = '<span style="font-size:12px; color:#94a3b8;">No custom words added yet.</span>';
      return;
    }

    customDictionary.forEach((word, index) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `
        ${escapeHtml(word)}
        <button class="chip-remove" data-index="${index}">✕</button>
      `;
      chip.querySelector('.chip-remove').onclick = () => {
        customDictionary.splice(index, 1);
        renderDictChips();
      };
      dictChipsContainer.appendChild(chip);
    });
  }

  // Render Excluded Domains Chips
  function renderDomainChips() {
    domainChipsContainer.innerHTML = '';
    if (disabledDomains.length === 0) {
      domainChipsContainer.innerHTML = '<span style="font-size:12px; color:#94a3b8;">No domains excluded. Assistant runs everywhere.</span>';
      return;
    }

    disabledDomains.forEach((domain, index) => {
      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.innerHTML = `
        ${escapeHtml(domain)}
        <button class="chip-remove" data-index="${index}">✕</button>
      `;
      chip.querySelector('.chip-remove').onclick = () => {
        disabledDomains.splice(index, 1);
        renderDomainChips();
      };
      domainChipsContainer.appendChild(chip);
    });
  }

  // Show/Hide Cloud API Fields
  function updateCloudFieldsVisibility() {
    cloudApiFields.style.display = selectAiProvider.value === 'offline' ? 'none' : 'block';
  }

  selectAiProvider.addEventListener('change', () => {
    updateCloudFieldsVisibility();
    if (selectAiProvider.value === 'groq') {
      inputApiModel.value = 'llama-3.1-8b-instant';
    } else if (selectAiProvider.value === 'openai') {
      inputApiModel.value = 'gpt-4o-mini';
    }
  });

  // Toggle API key visibility
  btnToggleKey.addEventListener('click', () => {
    if (inputApiKey.type === 'password') {
      inputApiKey.type = 'text';
      btnToggleKey.textContent = '🔒';
    } else {
      inputApiKey.type = 'password';
      btnToggleKey.textContent = '👁️';
    }
  });

  // Add word to dictionary
  btnAddWord.addEventListener('click', () => {
    const val = dictWordInput.value.trim();
    if (val && !customDictionary.includes(val)) {
      customDictionary.push(val);
      renderDictChips();
      dictWordInput.value = '';
    }
  });

  dictWordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddWord.click();
    }
  });

  // Add domain to exclusions
  btnAddDomain.addEventListener('click', () => {
    const val = domainInput.value.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (val && !disabledDomains.includes(val)) {
      disabledDomains.push(val);
      renderDomainChips();
      domainInput.value = '';
    }
  });

  domainInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      btnAddDomain.click();
    }
  });

  // Save Settings
  btnSave.addEventListener('click', async () => {
    const settings = {
      enableExtension: toggleExtension.checked,
      showFloatingWidget: toggleFloatingWidget.checked,
      enableGrammar: toggleGrammar.checked,
      enableSpelling: toggleSpelling.checked,
      enableClarity: toggleClarity.checked,
      enableTone: toggleTone.checked,
      targetAudience: selectAudience.value,
      targetTone: selectTone.value,
      customDictionary,
      aiProvider: selectAiProvider.value,
      apiKey: inputApiKey.value.trim(),
      apiModel: inputApiModel.value.trim(),
      disabledDomains
    };

    await chrome.storage.sync.set(settings);
    showToast('Settings saved successfully!');
  });

  // Reset Defaults
  btnReset.addEventListener('click', async () => {
    if (confirm('Are you sure you want to restore default settings?')) {
      await chrome.storage.sync.set(defaultSettings);
      await loadSettings();
      showToast('Defaults restored.');
    }
  });

  // Show Toast
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
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

  // Sidebar link highlight
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Initial load
  loadSettings();
});
