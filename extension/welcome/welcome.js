/**
 * Bible Hover — Welcome Page Controller
 * Real-time settings customization, live preview sync, and navigation handlers.
 */

document.addEventListener('DOMContentLoaded', async () => {
  // References to DOM elements
  const themeSelect = document.getElementById('themeSelect');
  const scriptureFont = document.getElementById('scriptureFont');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const defaultTranslation = document.getElementById('defaultTranslation');
  const preferredCommentary = document.getElementById('preferredCommentary');
  const underlineStyle = document.getElementById('underlineStyle');
  const hoverDelay = document.getElementById('hoverDelay');
  const hoverDelayVal = document.getElementById('hoverDelayVal');
  const minimalistMode = document.getElementById('minimalistMode');
  const detectInlineTranslations = document.getElementById('detectInlineTranslations');
  const colorSwatches = document.querySelectorAll('.w-swatch');
  const previewCard = document.getElementById('welcomePreviewCard');
  const sampleUnderlineWord = document.getElementById('sampleUnderlineWord');
  const launchVerifyBtn = document.getElementById('launchVerifyBtn');
  const bottomLaunchBtn = document.getElementById('bottomLaunchBtn');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const bottomDashboardBtn = document.getElementById('bottomDashboardBtn');
  const feedbackLink = document.getElementById('welcomeFeedbackLink');

  // Default fallback values
  const DEFAULT_SETTINGS = {
    theme: 'auto',
    fontSize: 'medium',
    scriptureFont: 'sans',
    underlineStyle: 'dotted',
    underlineColor: '#3b82f6',
    hoverDelay: 120,
    minimalistMode: false,
    defaultTranslation: 'BSB',
    preferredCommentary: 'matthew_henry',
    detectInlineTranslations: true,
    showTranslationBar: true,
    showSettingsButton: true
  };

  // Load stored settings from chrome.storage.local
  const stored = await new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), resolve);
    } else {
      resolve(DEFAULT_SETTINGS);
    }
  });

  const config = { ...DEFAULT_SETTINGS, ...stored };

  // Helper to persist changes
  function saveSetting(patch) {
    Object.assign(config, patch);
    updatePreview();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(patch);
    }
  }

  // Populate UI inputs with active config
  if (themeSelect) themeSelect.value = config.theme;
  if (scriptureFont) scriptureFont.value = config.scriptureFont;
  if (fontSizeSelect) fontSizeSelect.value = config.fontSize;
  if (defaultTranslation) defaultTranslation.value = config.defaultTranslation;
  if (preferredCommentary) preferredCommentary.value = config.preferredCommentary;
  if (underlineStyle) underlineStyle.value = config.underlineStyle;
  if (hoverDelay) {
    hoverDelay.value = config.hoverDelay;
    if (hoverDelayVal) hoverDelayVal.textContent = `${config.hoverDelay}ms`;
  }
  if (minimalistMode) minimalistMode.checked = Boolean(config.minimalistMode);
  if (detectInlineTranslations) detectInlineTranslations.checked = config.detectInlineTranslations !== false;

  // Active color swatch
  function updateActiveSwatch(color) {
    colorSwatches.forEach((swatch) => {
      const isMatch = swatch.dataset.color.toLowerCase() === color.toLowerCase();
      swatch.classList.toggle('active', isMatch);
    });
  }
  updateActiveSwatch(config.underlineColor);

  // Update Live Preview Card
  function updatePreview() {
    if (!previewCard) return;

    // Resolve system dark/light if theme === 'auto'
    let effectiveTheme = config.theme;
    if (effectiveTheme === 'auto') {
      effectiveTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    const minClass = config.minimalistMode ? 'bh-minimalist' : '';
    const fontFamClass = `font-family-${config.scriptureFont || 'sans'}`;
    const fontSizeClass = `font-${config.fontSize || 'medium'}`;

    previewCard.className = `bh-preview-card theme-${effectiveTheme} ${fontSizeClass} ${fontFamClass} ${minClass}`.trim();

    // Update translation badge in preview header
    const previewTransBadge = document.getElementById('previewTransBadge');
    if (previewTransBadge) {
      previewTransBadge.textContent = config.defaultTranslation || 'BSB';
    }

    // Update active state in preview translation switcher
    document.querySelectorAll('.bh-trans-pill').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.trans === config.defaultTranslation);
    });

    // Update sample underline word styling in preview card
    if (sampleUnderlineWord) {
      sampleUnderlineWord.style.textDecoration = '';
      sampleUnderlineWord.style.backgroundColor = '';

      if (config.underlineStyle === 'dotted') {
        sampleUnderlineWord.style.textDecoration = `underline dotted ${config.underlineColor}`;
        sampleUnderlineWord.style.textUnderlineOffset = '3px';
      } else if (config.underlineStyle === 'dashed') {
        sampleUnderlineWord.style.textDecoration = `underline dashed ${config.underlineColor}`;
        sampleUnderlineWord.style.textUnderlineOffset = '3px';
      } else if (config.underlineStyle === 'solid') {
        sampleUnderlineWord.style.textDecoration = `underline solid ${config.underlineColor}`;
        sampleUnderlineWord.style.textUnderlineOffset = '3px';
      } else if (config.underlineStyle === 'highlight') {
        sampleUnderlineWord.style.backgroundColor = `${config.underlineColor}26`;
        sampleUnderlineWord.style.borderRadius = '3px';
        sampleUnderlineWord.style.padding = '0 3px';
      }
    }
  }

  // Initial preview paint
  updatePreview();

  // Listen for preference changes
  themeSelect?.addEventListener('change', () => saveSetting({ theme: themeSelect.value }));
  scriptureFont?.addEventListener('change', () => saveSetting({ scriptureFont: scriptureFont.value }));
  fontSizeSelect?.addEventListener('change', () => saveSetting({ fontSize: fontSizeSelect.value }));
  defaultTranslation?.addEventListener('change', () => saveSetting({ defaultTranslation: defaultTranslation.value }));
  preferredCommentary?.addEventListener('change', () => saveSetting({ preferredCommentary: preferredCommentary.value }));
  underlineStyle?.addEventListener('change', () => saveSetting({ underlineStyle: underlineStyle.value }));

  hoverDelay?.addEventListener('input', () => {
    const val = parseInt(hoverDelay.value, 10);
    if (hoverDelayVal) hoverDelayVal.textContent = `${val}ms`;
    saveSetting({ hoverDelay: val });
  });

  minimalistMode?.addEventListener('change', () => {
    saveSetting({ minimalistMode: minimalistMode.checked });
  });

  detectInlineTranslations?.addEventListener('change', () => {
    saveSetting({ detectInlineTranslations: detectInlineTranslations.checked });
  });

  colorSwatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      updateActiveSwatch(color);
      saveSetting({ underlineColor: color });
    });
  });

  // Interactive switcher tabs on preview card
  document.querySelectorAll('.bh-trans-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      const trans = pill.dataset.trans;
      if (trans) {
        if (defaultTranslation) defaultTranslation.value = trans;
        saveSetting({ defaultTranslation: trans });
      }
    });
  });

  // Navigation Handlers
  function openVerificationPage() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('test-page.html') });
    } else {
      window.open('../test-page.html', '_blank');
    }
  }

  function openDashboardPage() {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
    } else {
      window.open('../options/options.html', '_blank');
    }
  }

  launchVerifyBtn?.addEventListener('click', openVerificationPage);
  bottomLaunchBtn?.addEventListener('click', openVerificationPage);
  openDashboardBtn?.addEventListener('click', openDashboardPage);
  bottomDashboardBtn?.addEventListener('click', openDashboardPage);

  // Rate on Extension Store button click
  const welcomeRateBtn = document.getElementById('welcomeRateBtn');
  welcomeRateBtn?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ hasRatedOrShared: true, lastPromptDate: Date.now() });
    }
  });

  // System color scheme change watcher (for 'auto' theme)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (config.theme === 'auto') {
      updatePreview();
    }
  });
});
