/**
 * Bible Hover — Welcome Page Controller
 * Real-time settings customization, live preview sync, translations manager,
 * 0ms offline downloader, and navigation handlers.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const BibleHoverMeta = (typeof window !== 'undefined' ? window.BibleHoverMeta : null) || globalThis.BibleHoverMeta || {};
  const TRANSLATIONS = BibleHoverMeta.TRANSLATIONS || {
    BSB: { id: 'BSB', name: 'Berean Standard Bible', bundled: true },
    ESV: { id: 'ESV', name: 'English Standard Version', downloadable: true },
    NIV: { id: 'NIV', name: 'New International Version', downloadable: false },
    NASB: { id: 'NASB', name: 'New American Standard Bible', downloadable: true },
    KJV: { id: 'KJV', name: 'King James Version', downloadable: true },
    NLT: { id: 'NLT', name: 'New Living Translation', downloadable: true },
    CSB: { id: 'CSB', name: 'Christian Standard Bible', downloadable: true },
    NKJV: { id: 'NKJV', name: 'New King James Version', downloadable: true },
    WEB: { id: 'WEB', name: 'World English Bible', downloadable: true }
  };

  const CORE_ENGLISH_LIST = ['BSB', 'ESV', 'NIV', 'NASB', 'KJV', 'NLT', 'CSB', 'NKJV', 'WEB'];
  const INTL_LIST = ['TUR', 'UBIO', 'LBLA', 'RV1960', 'NAA', 'ARA', 'SCH2000', 'CUNPS', 'CUNP', 'KRV', 'HIOV', 'SYNOD', 'NRT'];

  // Hardcoded Romans 6:1-2 in all 22 supported translations with targeted keyword underline
  const SAMPLE_PASSAGES = {
    BSB: {
      v1: 'What then shall we say? Shall we continue in <span id="sampleUnderlineWord">sin</span> so that grace may increase?',
      v2: 'Certainly not! How can we who died to sin live in it any longer?'
    },
    ESV: {
      v1: 'What shall we say then? Are we to continue in <span id="sampleUnderlineWord">sin</span> that grace may abound?',
      v2: 'By no means! How can we who died to sin still live in it?'
    },
    NIV: {
      v1: 'What shall we say, then? Shall we go on <span id="sampleUnderlineWord">sinning</span> so that grace may increase?',
      v2: 'By no means! We are those who have died to sin; how can we live in it any longer?'
    },
    NASB: {
      v1: 'What shall we say then? Are we to continue in <span id="sampleUnderlineWord">sin</span> so that grace may increase?',
      v2: 'Far from it! How shall we who died to sin still live in it?'
    },
    KJV: {
      v1: 'What shall we say then? Shall we continue in <span id="sampleUnderlineWord">sin</span>, that grace may abound?',
      v2: 'God forbid. How shall we, that are dead to sin, live any longer therein?'
    },
    NKJV: {
      v1: 'What shall we say then? Shall we continue in <span id="sampleUnderlineWord">sin</span> that grace may abound?',
      v2: 'Certainly not! How shall we who died to sin live any longer in it?'
    },
    NLT: {
      v1: 'Well then, should we keep on <span id="sampleUnderlineWord">sinning</span> so that God can show us more and more of his wonderful grace?',
      v2: 'Of course not! Since we have died to sin, how can we continue to live in it?'
    },
    CSB: {
      v1: 'What should we say then? Should we continue in <span id="sampleUnderlineWord">sin</span> in order that grace may multiply?',
      v2: 'Absolutely not! How can we who died to sin still live in it?'
    },
    WEB: {
      v1: 'What shall we say then? Shall we continue in <span id="sampleUnderlineWord">sin</span>, that grace may abound?',
      v2: 'May it never be! We who died to sin, how could we live in it any longer?'
    },
    // Ukrainian
    TUR: {
      v1: 'Що ж скажемо? Чи залишатися нам у <span id="sampleUnderlineWord">гріху</span>, щоб благодать помножилася?',
      v2: 'Зовсім ні! Ми, які померли для гріха, як ще будемо жити в ньому?'
    },
    UBIO: {
      v1: 'Що ж скажемо? Залишимося в <span id="sampleUnderlineWord">гріху</span>, щоб благодать примножилась?',
      v2: 'Зовсім ні! Ми, що вмерли для гріха, як ще будемо жити в нім?'
    },
    // Spanish
    LBLA: {
      v1: '¿Qué diremos, entonces? ¿Continuaremos en <span id="sampleUnderlineWord">pecado</span> para que la gracia abunde?',
      v2: '¡De ningún modo! Nosotros, que hemos muerto al pecado, ¿cómo viviremos aún en él?'
    },
    RV1960: {
      v1: '¿Qué, pues, diremos? ¿Perseveraremos en el <span id="sampleUnderlineWord">pecado</span> para que la gracia abunde?',
      v2: 'En ninguna manera. Porque los que hemos muerto al pecado, ¿cómo viviremos aún en él?'
    },
    // Portuguese
    NAA: {
      v1: 'Que diremos, então? Devemos continuar no <span id="sampleUnderlineWord">pecado</span> para que a graça aumente?',
      v2: 'De modo nenhum! Como viveremos ainda no pecado, nós que já morremos para ele?'
    },
    ARA: {
      v1: 'Que diremos, pois? Permaneceremos no <span id="sampleUnderlineWord">pecado</span>, para que a graça seja mais abundante?',
      v2: 'De modo nenhum! Fomos mortos para o pecado; como viveremos ainda nele?'
    },
    // German
    SCH2000: {
      v1: 'Was wollen wir nun sagen? Sollen wir in der <span id="sampleUnderlineWord">Sünde</span> verharren, damit das Maß der Gnade voll werde?',
      v2: 'Das sei ferne! Wie sollten wir, die wir der Sünde gestorben sind, noch in ihr leben?'
    },
    // Chinese
    CUNPS: {
      v1: '这样，怎么说呢？我们可以仍在<span id="sampleUnderlineWord">罪</span>中、叫恩典显多吗？',
      v2: '断乎不可！我们在罪上死了的人岂可仍在罪中活着呢？'
    },
    CUNP: {
      v1: '這樣，怎麼說呢？我們可以仍在<span id="sampleUnderlineWord">罪</span>中、叫恩典顯多嗎？',
      v2: '斷乎不可！我們在罪上死了的人豈可仍在罪中活着呢？'
    },
    // Korean
    KRV: {
      v1: '그런즉 우리가 무슨 말 하리요 은혜를 더하게 하려고 <span id="sampleUnderlineWord">죄</span>에 거하겠느뇨',
      v2: '그럴 수 없느니라 죄에 대하여 죽은 우리가 어찌 그 가운데 더 살리요'
    },
    // Hindi
    HIOV: {
      v1: 'तो फिर हम क्या कहें? क्या हम <span id="sampleUnderlineWord">पाप</span> में बने रहें कि अनुग्रह बहुत हो?',
      v2: 'कदापि नहीं! हम जो पाप के स्वभाव के विचार से मर गए, फिर आगे को उस में कैसे जीवन बिताएं?'
    },
    // Russian
    SYNOD: {
      v1: 'Что же скажем? оставаться ли нам в <span id="sampleUnderlineWord">грехе</span>, чтобы умножилась благодать? Никак.',
      v2: 'Мы умерли для греха: как же нам жить в нем?'
    },
    NRT: {
      v1: 'Что же нам сказать? Будем продолжать <span id="sampleUnderlineWord">грешить</span>, чтобы умножилась благодать?',
      v2: 'Ни в коем случае! Если мы умерли для греха, то как мы можем продолжать жить в нем?'
    }
  };

  // DOM Elements — Display & Typography Settings
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

  // DOM Elements — Translations & 0ms Section
  const welcomeDefaultTranslation = document.getElementById('welcomeDefaultTranslation');
  const welcomeTransStatusBadge = document.getElementById('welcomeTransStatusBadge');
  const welcomeTransNote = document.getElementById('welcomeTransNote');
  const welcomeDownloadSelect = document.getElementById('welcomeDownloadSelect');
  const welcomeDownloadBtn = document.getElementById('welcomeDownloadBtn');
  const welcomeDownloadBtnText = document.getElementById('welcomeDownloadBtnText');
  const welcomeDownloadBtnIcon = document.getElementById('welcomeDownloadBtnIcon');
  const welcomeDownloadFeedback = document.getElementById('welcomeDownloadFeedback');
  const welcomeOfflineBiblesList = document.getElementById('welcomeOfflineBiblesList');
  const welcomeTransPillsGrid = document.getElementById('welcomeTransPillsGrid');
  const welcomeIntlTransPillsGrid = document.getElementById('welcomeIntlTransPillsGrid');
  const btnPresetTop4 = document.getElementById('btnPresetTop4');
  const btnPresetCore = document.getElementById('btnPresetCore');
  const btnPresetOnlyDefault = document.getElementById('btnPresetOnlyDefault');
  const btnPresetAll = document.getElementById('btnPresetAll');
  const btnToggleIntl = document.getElementById('btnToggleIntl');

  // DOM Elements — Live Preview Card
  const previewCard = document.getElementById('welcomePreviewCard');
  const previewTransBadge = document.getElementById('previewTransBadge');
  const previewFooterTrans = document.getElementById('previewFooterTrans');
  const welcomePreviewTransBar = document.getElementById('welcomePreviewTransBar');
  const previewSettingsBtn = document.getElementById('previewSettingsBtn');
  const previewCopyBtn = document.getElementById('previewCopyBtn');

  // DOM Elements — Navigation
  const launchVerifyBtn = document.getElementById('launchVerifyBtn');
  const bottomLaunchBtn = document.getElementById('bottomLaunchBtn');
  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const bottomDashboardBtn = document.getElementById('bottomDashboardBtn');
  const welcomeRateBtn = document.getElementById('welcomeRateBtn');

  // Default configuration
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
    showSettingsButton: true,
    enabledTranslations: ['BSB', 'ESV', 'NIV', 'NASB', 'KJV', 'NLT', 'CSB', 'NKJV', 'WEB']
  };

  // Load stored settings from chrome.storage.local
  const stored = await new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS), resolve);
    } else {
      resolve(DEFAULT_SETTINGS);
    }
  });

  const config = {
    ...DEFAULT_SETTINGS,
    ...stored,
    enabledTranslations: Array.isArray(stored.enabledTranslations) && stored.enabledTranslations.length > 0
      ? stored.enabledTranslations
      : DEFAULT_SETTINGS.enabledTranslations
  };

  // Active preview translation
  let currentPreviewTranslation = (config.defaultTranslation || 'BSB').toUpperCase();

  // Offline translations set
  let currentDownloadedOfflineSet = new Set();

  // Helper to persist changes
  function saveSetting(patch) {
    Object.assign(config, patch);
    updatePreview();

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(patch);
    }
  }

  // Populate Display & Typography UI inputs
  if (themeSelect) themeSelect.value = config.theme;
  if (scriptureFont) scriptureFont.value = config.scriptureFont;
  if (fontSizeSelect) fontSizeSelect.value = config.fontSize;
  if (defaultTranslation) defaultTranslation.value = config.defaultTranslation;
  if (welcomeDefaultTranslation) welcomeDefaultTranslation.value = config.defaultTranslation;
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

  // ==========================================================================
  // Centralized Translation Switcher
  // ==========================================================================

  function setPreviewTranslation(newTrans, shouldSave = true) {
    if (!newTrans) return;
    const transUpper = String(newTrans).toUpperCase();
    currentPreviewTranslation = transUpper;
    config.defaultTranslation = transUpper;

    if (welcomeDefaultTranslation) welcomeDefaultTranslation.value = transUpper;
    if (defaultTranslation) defaultTranslation.value = transUpper;

    // Ensure newly selected translation is included in enabledTranslations so its pill appears
    if (!config.enabledTranslations.includes(transUpper)) {
      config.enabledTranslations.push(transUpper);
      renderTranslationPillCards();
    }

    if (shouldSave) {
      saveSetting({
        defaultTranslation: transUpper,
        enabledTranslations: config.enabledTranslations
      });
    }

    updateDefaultTranslationStatusBadge();
    renderTranslationBarInPreview();
    updatePreview();
  }

  // ==========================================================================
  // Offline Storage & Translations Manager Logic
  // ==========================================================================

  function loadOfflineStatus() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_OFFLINE_STATUS' }, (res) => {
        if (res && res.ok) {
          const downloaded = res.downloaded || [];
          currentDownloadedOfflineSet = new Set(downloaded.map((d) => String(d).toUpperCase()));
          renderStoredOfflineBibles();
          updateDownloadButtonState();
          updateDefaultTranslationStatusBadge();
          renderTranslationPillCards();
          updatePreview();
        }
      });
    } else {
      renderStoredOfflineBibles();
      updateDownloadButtonState();
      updateDefaultTranslationStatusBadge();
      renderTranslationPillCards();
      updatePreview();
    }
  }

  // Update status badge next to default translation dropdown
  function updateDefaultTranslationStatusBadge() {
    if (!welcomeTransStatusBadge) return;
    const current = (currentPreviewTranslation || config.defaultTranslation || 'BSB').toUpperCase();
    const isDownloaded = currentDownloadedOfflineSet.has(current);

    if (current === 'BSB') {
      welcomeTransStatusBadge.className = 'w-status-badge bundled';
      welcomeTransStatusBadge.innerHTML = '<span>⚡ Pre-Bundled Offline (0ms)</span>';
      if (welcomeTransNote) {
        welcomeTransNote.textContent = '✓ Pre-bundled on your computer with zero copyright friction';
        welcomeTransNote.style.color = '#10b981';
      }
    } else if (isDownloaded) {
      welcomeTransStatusBadge.className = 'w-status-badge offline';
      welcomeTransStatusBadge.innerHTML = '<span>⚡ 100% Offline (0ms Local Storage)</span>';
      if (welcomeTransNote) {
        welcomeTransNote.textContent = '✓ Stored locally in your browser for 0ms instant popups';
        welcomeTransNote.style.color = '#3b82f6';
      }
    } else if (current === 'NIV') {
      welcomeTransStatusBadge.className = 'w-status-badge online';
      welcomeTransStatusBadge.innerHTML = '<span>🌐 Online Stream (Auto-Cached)</span>';
      if (welcomeTransNote) {
        welcomeTransNote.textContent = '⚡ Fetches on-demand and caches chapters locally in memory';
        welcomeTransNote.style.color = '#d97706';
      }
    } else {
      const meta = TRANSLATIONS[current];
      if (meta && meta.downloadable) {
        welcomeTransStatusBadge.className = 'w-status-badge online';
        welcomeTransStatusBadge.innerHTML = '<span>🌐 Online Stream (Downloadable for 0ms)</span>';
        if (welcomeTransNote) {
          welcomeTransNote.textContent = '💡 Download this translation below for 0ms offline popups';
          welcomeTransNote.style.color = '#d97706';
        }
      } else {
        welcomeTransStatusBadge.className = 'w-status-badge online';
        welcomeTransStatusBadge.innerHTML = '<span>🌐 Online Stream + Auto-Cache</span>';
        if (welcomeTransNote) {
          welcomeTransNote.textContent = '⚡ Streams on-demand with automatic chapter caching';
          welcomeTransNote.style.color = '#64748b';
        }
      }
    }
  }

  // Render stored offline bibles pill list
  function renderStoredOfflineBibles() {
    if (!welcomeOfflineBiblesList) return;
    welcomeOfflineBiblesList.innerHTML = '';

    // BSB is always pre-bundled
    const bsbPill = document.createElement('span');
    bsbPill.className = 'w-offline-pill bundled';
    bsbPill.title = 'Pre-bundled inside Bible Hover (0ms offline)';
    bsbPill.innerHTML = '<span>⚡ BSB</span><span class="pill-meta">Berean Standard (Bundled)</span>';
    welcomeOfflineBiblesList.appendChild(bsbPill);

    currentDownloadedOfflineSet.forEach((id) => {
      if (id === 'BSB') return;
      const meta = TRANSLATIONS[id] || { name: id };
      const pill = document.createElement('span');
      pill.className = 'w-offline-pill downloaded';
      pill.innerHTML = `
        <span>⚡ ${id}</span>
        <span class="pill-meta">${meta.name || id}</span>
        <span class="w-offline-pill-del" data-id="${id}" title="Remove offline copy">✕</span>
      `;

      pill.querySelector('.w-offline-pill-del').addEventListener('click', (e) => {
        e.stopPropagation();
        handleDeleteOfflineTranslation(id);
      });

      welcomeOfflineBiblesList.appendChild(pill);
    });
  }

  // Update download button text and style according to selected option
  function updateDownloadButtonState() {
    if (!welcomeDownloadBtn || !welcomeDownloadSelect) return;
    const selected = (welcomeDownloadSelect.value || '').toUpperCase();
    const isDownloaded = currentDownloadedOfflineSet.has(selected);

    if (isDownloaded) {
      welcomeDownloadBtn.className = 'w-download-btn danger';
      if (welcomeDownloadBtnIcon) welcomeDownloadBtnIcon.textContent = '🗑️';
      if (welcomeDownloadBtnText) welcomeDownloadBtnText.textContent = `Remove Offline ${selected}`;
    } else {
      welcomeDownloadBtn.className = 'w-download-btn primary';
      if (welcomeDownloadBtnIcon) welcomeDownloadBtnIcon.textContent = '📥';
      if (welcomeDownloadBtnText) welcomeDownloadBtnText.textContent = `Download for 0ms Offline`;
    }
  }

  welcomeDownloadSelect?.addEventListener('change', updateDownloadButtonState);

  // Delete an offline translation
  function handleDeleteOfflineTranslation(id) {
    const meta = TRANSLATIONS[id] || { name: id };
    if (!confirm(`Remove ${id} (${meta.name || id}) from offline storage?\n\nThis will free ~3–4 MB of disk space. You will still be able to read and stream ${id} online on-demand.`)) {
      return;
    }

    if (welcomeDownloadFeedback) {
      welcomeDownloadFeedback.style.display = 'block';
      welcomeDownloadFeedback.textContent = `Removing ${id} from offline storage...`;
    }

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'DELETE_TRANSLATION', translation: id }, (res) => {
        if (res && res.ok) {
          if (welcomeDownloadFeedback) {
            welcomeDownloadFeedback.textContent = `✓ ${id} successfully removed from offline storage.`;
            setTimeout(() => { welcomeDownloadFeedback.style.display = 'none'; }, 3500);
          }
          loadOfflineStatus();
        } else {
          if (welcomeDownloadFeedback) {
            welcomeDownloadFeedback.textContent = `Error removing ${id}: ${res?.error || 'Unknown error'}`;
          }
        }
      });
    } else {
      currentDownloadedOfflineSet.delete(id);
      loadOfflineStatus();
    }
  }

  // Download full translation
  welcomeDownloadBtn?.addEventListener('click', () => {
    const selected = (welcomeDownloadSelect?.value || 'ESV').toUpperCase();
    if (currentDownloadedOfflineSet.has(selected)) {
      handleDeleteOfflineTranslation(selected);
      return;
    }

    if (welcomeDownloadFeedback) {
      welcomeDownloadFeedback.style.display = 'block';
      welcomeDownloadFeedback.textContent = `Downloading complete ${selected} Bible (~3–4 MB)...`;
    }
    welcomeDownloadBtn.disabled = true;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_TRANSLATION',
        translation: selected
      }, (res) => {
        welcomeDownloadBtn.disabled = false;
        if (res && res.ok) {
          if (welcomeDownloadFeedback) {
            welcomeDownloadFeedback.textContent = `✓ ${selected} downloaded! Now 100% offline at 0ms.`;
            setTimeout(() => { welcomeDownloadFeedback.style.display = 'none'; }, 4000);
          }
          // Automatically enable this translation in hover tabs if not already present
          if (!config.enabledTranslations.includes(selected)) {
            const updated = [...config.enabledTranslations, selected];
            saveSetting({ enabledTranslations: updated });
          }
          loadOfflineStatus();
        } else {
          if (welcomeDownloadFeedback) {
            welcomeDownloadFeedback.textContent = `Download failed: ${res?.error || 'Please check your internet connection'}`;
          }
        }
      });
    } else {
      setTimeout(() => {
        welcomeDownloadBtn.disabled = false;
        currentDownloadedOfflineSet.add(selected);
        if (welcomeDownloadFeedback) {
          welcomeDownloadFeedback.textContent = `✓ ${selected} downloaded! Now 100% offline at 0ms.`;
          setTimeout(() => { welcomeDownloadFeedback.style.display = 'none'; }, 3500);
        }
        loadOfflineStatus();
      }, 800);
    }
  });

  // Render interactive translation checkboxes grid
  function renderTranslationPillCards() {
    const renderList = (container, list) => {
      if (!container) return;
      container.innerHTML = '';

      list.forEach((id) => {
        const meta = TRANSLATIONS[id] || { name: id, lang: '' };
        const isChecked = config.enabledTranslations.includes(id);
        const isDownloaded = currentDownloadedOfflineSet.has(id);

        let speedTagClass = '';
        let speedTagText = 'Online';
        if (id === 'BSB') {
          speedTagClass = 'bundled';
          speedTagText = '⚡ 0ms Bundled';
        } else if (isDownloaded) {
          speedTagClass = 'downloaded';
          speedTagText = '⚡ 0ms Offline';
        } else if (meta.downloadable) {
          speedTagText = 'Downloadable';
        } else if (id === 'NIV') {
          speedTagText = 'Online + Cache';
        }

        const card = document.createElement('label');
        card.className = `w-trans-item-card ${isChecked ? 'checked' : ''}`;
        card.innerHTML = `
          <input type="checkbox" value="${id}" ${isChecked ? 'checked' : ''}>
          <div class="w-trans-item-info">
            <div class="w-trans-item-top">
              <span class="w-trans-code-badge">${id}</span>
              <span class="w-trans-speed-tag ${speedTagClass}">${speedTagText}</span>
            </div>
            <span class="w-trans-full-name" title="${meta.name}">${meta.name}</span>
          </div>
        `;

        const cb = card.querySelector('input');
        cb.addEventListener('change', () => {
          card.classList.toggle('checked', cb.checked);
          updateEnabledTranslationsFromCheckboxes();
        });

        container.appendChild(card);
      });
    };

    renderList(welcomeTransPillsGrid, CORE_ENGLISH_LIST);
    renderList(welcomeIntlTransPillsGrid, INTL_LIST);
  }

  function updateEnabledTranslationsFromCheckboxes() {
    const selected = [];
    document.querySelectorAll('.w-trans-item-card input[type="checkbox"]:checked').forEach((cb) => {
      selected.push(cb.value);
    });

    // Ensure at least 1 translation is active
    if (selected.length === 0) {
      selected.push(currentPreviewTranslation || config.defaultTranslation || 'BSB');
    }

    // If current preview translation was unchecked, point to the first checked translation
    if (!selected.includes(currentPreviewTranslation)) {
      currentPreviewTranslation = selected[0];
    }

    saveSetting({ enabledTranslations: selected });
    renderTranslationBarInPreview();
    updatePreview();
  }

  // Quick Presets
  btnPresetTop4?.addEventListener('click', () => {
    const top4 = ['BSB', 'ESV', 'NIV', 'NASB'];
    saveSetting({ enabledTranslations: top4 });
    if (!top4.includes(currentPreviewTranslation)) {
      setPreviewTranslation('BSB', true);
    } else {
      renderTranslationPillCards();
      renderTranslationBarInPreview();
      updatePreview();
    }
  });

  btnPresetCore?.addEventListener('click', () => {
    saveSetting({ enabledTranslations: [...CORE_ENGLISH_LIST] });
    renderTranslationPillCards();
    renderTranslationBarInPreview();
    updatePreview();
  });

  btnPresetOnlyDefault?.addEventListener('click', () => {
    const def = currentPreviewTranslation || config.defaultTranslation || 'BSB';
    saveSetting({ enabledTranslations: [def] });
    renderTranslationPillCards();
    renderTranslationBarInPreview();
    updatePreview();
  });

  btnPresetAll?.addEventListener('click', () => {
    const all = [...CORE_ENGLISH_LIST, ...INTL_LIST];
    saveSetting({ enabledTranslations: all });
    renderTranslationPillCards();
    renderTranslationBarInPreview();
    updatePreview();
  });

  btnToggleIntl?.addEventListener('click', () => {
    if (!welcomeIntlTransPillsGrid) return;
    const isHidden = welcomeIntlTransPillsGrid.style.display === 'none';
    welcomeIntlTransPillsGrid.style.display = isHidden ? 'grid' : 'none';
    btnToggleIntl.textContent = isHidden ? 'Hide International Bibles' : '🌐 International Bibles (+13)';
  });

  // Event listeners for dropdowns
  welcomeDefaultTranslation?.addEventListener('change', () => {
    setPreviewTranslation(welcomeDefaultTranslation.value, true);
  });

  defaultTranslation?.addEventListener('change', () => {
    setPreviewTranslation(defaultTranslation.value, true);
  });

  // ==========================================================================
  // Live Preview Rendering
  // ==========================================================================

  // Render translation switcher bar in Live Preview Card
  function renderTranslationBarInPreview() {
    if (!welcomePreviewTransBar) return;
    welcomePreviewTransBar.innerHTML = '';

    const list = Array.isArray(config.enabledTranslations) && config.enabledTranslations.length > 0
      ? [...config.enabledTranslations]
      : ['BSB'];

    if (!list.includes(currentPreviewTranslation)) {
      list.push(currentPreviewTranslation);
    }

    // If only 1 translation is enabled or minimalist mode is on, hide the bar like content.js does
    if (config.minimalistMode || list.length <= 1) {
      welcomePreviewTransBar.style.display = 'none';
    } else {
      welcomePreviewTransBar.style.display = 'flex';
    }

    list.forEach((id) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `bh-trans-pill ${id === currentPreviewTranslation ? 'active' : ''}`;
      btn.dataset.trans = id;
      btn.textContent = id;

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setPreviewTranslation(id, true);
      });

      welcomePreviewTransBar.appendChild(btn);
    });
  }

  // Update Live Preview Card styling, badges, and Romans 6:1-2 text
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

    const current = (currentPreviewTranslation || config.defaultTranslation || 'BSB').toUpperCase();

    // 1. Update preview header translation badge
    if (previewTransBadge) {
      previewTransBadge.textContent = current;
      previewTransBadge.style.backgroundColor = config.underlineColor;
    }

    // 2. Update active pill in translation bar
    if (welcomePreviewTransBar) {
      welcomePreviewTransBar.querySelectorAll('.bh-trans-pill').forEach((pill) => {
        pill.classList.toggle('active', pill.dataset.trans === current);
      });
    }

    // 3. Update footer translation indicator & offline status
    if (previewFooterTrans) {
      previewFooterTrans.textContent = current;
    }

    const offlineIndicator = previewCard.querySelector('.bh-offline-indicator');
    if (offlineIndicator) {
      const isBundled = current === 'BSB';
      const isDownloaded = currentDownloadedOfflineSet.has(current);
      if (isBundled) {
        offlineIndicator.textContent = '⚡ Bundled 0ms';
        offlineIndicator.title = 'Pre-bundled offline Berean Bible';
      } else if (isDownloaded) {
        offlineIndicator.textContent = '⚡ Offline 0ms';
        offlineIndicator.title = 'Downloaded complete offline Bible';
      } else {
        offlineIndicator.textContent = '🌐 Online Stream';
        offlineIndicator.title = 'Streamed online with automatic caching';
      }
    }

    // 4. Update verse text for current translation
    const previewBody = previewCard.querySelector('.bh-preview-body');
    if (previewBody) {
      const sample = SAMPLE_PASSAGES[current] || SAMPLE_PASSAGES.BSB;
      previewBody.innerHTML = `
        <p>
          <sup class="bh-vn">1</sup>${sample.v1}
          <sup class="bh-vn">2</sup>${sample.v2}
        </p>
      `;
    }

    // 5. Update sample underline word styling in preview card
    const liveSampleWord = document.getElementById('sampleUnderlineWord');
    if (liveSampleWord) {
      liveSampleWord.style.textDecoration = '';
      liveSampleWord.style.backgroundColor = '';

      if (config.underlineStyle === 'dotted') {
        liveSampleWord.style.textDecoration = `underline dotted ${config.underlineColor}`;
        liveSampleWord.style.textUnderlineOffset = '3px';
      } else if (config.underlineStyle === 'dashed') {
        liveSampleWord.style.textDecoration = `underline dashed ${config.underlineColor}`;
        liveSampleWord.style.textUnderlineOffset = '3px';
      } else if (config.underlineStyle === 'solid') {
        liveSampleWord.style.textDecoration = `underline solid ${config.underlineColor}`;
        liveSampleWord.style.textUnderlineOffset = '3px';
      } else if (config.underlineStyle === 'highlight') {
        liveSampleWord.style.backgroundColor = `${config.underlineColor}26`;
        liveSampleWord.style.borderRadius = '3px';
        liveSampleWord.style.padding = '0 3px';
      }
    }
  }

  // ==========================================================================
  // Display & Typography Event Listeners
  // ==========================================================================

  themeSelect?.addEventListener('change', () => saveSetting({ theme: themeSelect.value }));
  scriptureFont?.addEventListener('change', () => saveSetting({ scriptureFont: scriptureFont.value }));
  fontSizeSelect?.addEventListener('change', () => saveSetting({ fontSize: fontSizeSelect.value }));
  preferredCommentary?.addEventListener('change', () => saveSetting({ preferredCommentary: preferredCommentary.value }));
  underlineStyle?.addEventListener('change', () => saveSetting({ underlineStyle: underlineStyle.value }));

  hoverDelay?.addEventListener('input', () => {
    const val = parseInt(hoverDelay.value, 10);
    if (hoverDelayVal) hoverDelayVal.textContent = `${val}ms`;
    saveSetting({ hoverDelay: val });
  });

  minimalistMode?.addEventListener('change', () => {
    saveSetting({ minimalistMode: minimalistMode.checked });
    renderTranslationBarInPreview();
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

  // Action buttons inside preview card
  previewSettingsBtn?.addEventListener('click', () => {
    const settingsElem = document.querySelector('.w-settings-section');
    if (settingsElem) {
      settingsElem.scrollIntoView({ behavior: 'smooth' });
    }
  });

  previewCopyBtn?.addEventListener('click', async () => {
    const current = (currentPreviewTranslation || 'BSB').toUpperCase();
    const sample = SAMPLE_PASSAGES[current] || SAMPLE_PASSAGES.BSB;
    const cleanV1 = sample.v1.replace(/<[^>]+>/g, '');
    const cleanV2 = sample.v2.replace(/<[^>]+>/g, '');
    const textToCopy = `Romans 6:1-2 (${current})\n1 ${cleanV1}\n2 ${cleanV2}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      const origTitle = previewCopyBtn.title;
      previewCopyBtn.title = '✓ Copied!';
      setTimeout(() => { previewCopyBtn.title = origTitle; }, 2000);
    } catch (_) {}
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

  welcomeRateBtn?.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ hasRatedOrShared: true, lastPromptDate: Date.now() });
    }
  });

  // System dark/light theme watcher
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (config.theme === 'auto') {
      updatePreview();
    }
  });

  // Initial load
  setPreviewTranslation(currentPreviewTranslation, false);
  loadOfflineStatus();
});
