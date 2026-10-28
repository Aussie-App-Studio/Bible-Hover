/**
 * Bible Hover — Options Dashboard Controller
 * Full-tab settings, live preview, translations manager, and offline database management.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const { TRANSLATIONS, parseSingleReference } = window.BibleHoverMeta || {};

  // Auto-save toast
  const saveToast = document.getElementById('saveToast');
  let toastTimer = null;
  function showSaveToast() {
    if (!saveToast) return;
    saveToast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      saveToast.style.opacity = '0';
    }, 1800);
  }

  // 1. Sidebar Tab Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function switchTab(tabId) {
    navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabId);
    });
    tabPanes.forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      switchTab(item.dataset.tab);
      window.location.hash = item.dataset.tab.replace('tab-', '');
    });
  });

  // Handle URL Hash on load
  if (window.location.hash) {
    const hashTab = `tab-${window.location.hash.replace('#', '')}`;
    if (document.getElementById(hashTab)) {
      switchTab(hashTab);
    }
  }

  // 2. Load Stored Configuration
  const stored = await new Promise(resolve => {
    chrome.storage.local.get([
      'enabled',
      'theme',
      'fontSize',
      'scriptureFont',
      'underlineStyle',
      'underlineColor',
      'hoverDelay',
      'minimalistMode',
      'defaultTranslation',
      'showTranslationBar',
      'enabledTranslations',
      'commentaryMode',
      'preferredCommentary',
      'studyResource',
      'multiPillResources',
      'disabledDomains'
    ], resolve);
  });

  const config = {
    enabled: stored.enabled !== false,
    theme: stored.theme || 'auto',
    fontSize: stored.fontSize || 'medium',
    scriptureFont: stored.scriptureFont || 'sans',
    underlineStyle: stored.underlineStyle || 'dotted',
    underlineColor: stored.underlineColor || '#3b82f6',
    hoverDelay: typeof stored.hoverDelay === 'number' ? stored.hoverDelay : 120,
    minimalistMode: Boolean(stored.minimalistMode),
    defaultTranslation: stored.defaultTranslation || 'BSB',
    showTranslationBar: stored.showTranslationBar !== false,
    enabledTranslations: Array.isArray(stored.enabledTranslations) && stored.enabledTranslations.length > 0
      ? stored.enabledTranslations
      : ['BSB', 'KJV', 'ESV', 'NIV', 'NLT', 'NASB', 'CSB', 'NKJV', 'WEB'],
    commentaryMode: stored.commentaryMode || 'direct_link',
    preferredCommentary: stored.preferredCommentary || 'matthew_henry',
    studyResource: stored.studyResource || 'biblehub',
    multiPillResources: Array.isArray(stored.multiPillResources)
      ? stored.multiPillResources
      : ['commentary', 'tgc', 'thesingingbible', 'youtube'],
    disabledDomains: Array.isArray(stored.disabledDomains) ? stored.disabledDomains : []
  };

  // Helper to persist changes
  function saveConfig(patch) {
    Object.assign(config, patch);
    updateLivePreview();
    chrome.storage.local.set(patch, () => {
      showSaveToast();
    });
  }

  // 3. Global Enable Switch
  const globalToggle = document.getElementById('globalToggle');
  const globalStatusLabel = document.getElementById('globalStatusLabel');
  if (globalToggle) {
    globalToggle.checked = config.enabled;
    globalStatusLabel.textContent = config.enabled ? 'Extension Active' : 'Extension Disabled';
    globalToggle.addEventListener('change', () => {
      const active = globalToggle.checked;
      globalStatusLabel.textContent = active ? 'Extension Active' : 'Extension Disabled';
      saveConfig({ enabled: active });
    });
  }

  // 4. Tab 1: Appearance Controls & Live Preview
  const themeSelect = document.getElementById('themeSelect');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const scriptureFont = document.getElementById('scriptureFont');
  const underlineStyle = document.getElementById('underlineStyle');
  const underlineColor = document.getElementById('underlineColor');
  const hoverDelay = document.getElementById('hoverDelay');
  const hoverDelayVal = document.getElementById('hoverDelayVal');
  const minimalistMode = document.getElementById('minimalistMode');
  const previewCard = document.getElementById('previewCard');
  const sampleAnchor = document.getElementById('sampleAnchor');
  const colorSwatches = document.querySelectorAll('.swatch');

  if (themeSelect) themeSelect.value = config.theme;
  if (fontSizeSelect) fontSizeSelect.value = config.fontSize;
  if (scriptureFont) scriptureFont.value = config.scriptureFont;
  if (underlineStyle) underlineStyle.value = config.underlineStyle;
  if (underlineColor) underlineColor.value = config.underlineColor;
  if (hoverDelay) {
    hoverDelay.value = config.hoverDelay;
    hoverDelayVal.textContent = `${config.hoverDelay}ms`;
  }
  if (minimalistMode) minimalistMode.checked = config.minimalistMode;

  function updateLivePreview() {
    if (!previewCard) return;

    // Resolve theme
    let effectiveTheme = config.theme;
    if (effectiveTheme === 'auto') {
      effectiveTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply preview classes
    const minClass = config.minimalistMode ? 'bh-minimalist' : '';
    const fontFam = `font-family-${config.scriptureFont || 'sans'}`;
    previewCard.className = `bh-preview-card theme-${effectiveTheme} font-${config.fontSize} ${fontFam} ${minClass}`.trim();

    // Underline and Accent Color
    if (sampleAnchor) {
      sampleAnchor.style.textDecorationColor = config.underlineColor;
      if (config.underlineStyle === 'dotted') {
        sampleAnchor.style.textDecorationLine = 'underline';
        sampleAnchor.style.textDecorationStyle = 'dotted';
        sampleAnchor.style.backgroundColor = 'transparent';
      } else if (config.underlineStyle === 'dashed') {
        sampleAnchor.style.textDecorationLine = 'underline';
        sampleAnchor.style.textDecorationStyle = 'dashed';
        sampleAnchor.style.backgroundColor = 'transparent';
      } else if (config.underlineStyle === 'solid') {
        sampleAnchor.style.textDecorationLine = 'underline';
        sampleAnchor.style.textDecorationStyle = 'solid';
        sampleAnchor.style.backgroundColor = 'transparent';
      } else if (config.underlineStyle === 'highlight') {
        sampleAnchor.style.textDecorationLine = 'none';
        sampleAnchor.style.backgroundColor = `${config.underlineColor}26`;
      } else {
        sampleAnchor.style.textDecorationLine = 'none';
        sampleAnchor.style.backgroundColor = 'transparent';
      }
    }

    // Update verse number color and badge
    const vNum = document.getElementById('previewVerseNum');
    if (vNum) vNum.style.color = config.underlineColor;
    const badge = document.getElementById('previewBadge');
    if (badge) badge.style.backgroundColor = config.underlineColor;

    // In-card tabs vs normal bar preview
    const tabBar = document.getElementById('previewTabBar');
    const transBar = document.getElementById('previewTransBar');
    const commBar = document.getElementById('previewCommBar');

    if (config.commentaryMode === 'in_card_tab') {
      if (tabBar) tabBar.style.display = 'inline-flex';
    } else {
      if (tabBar) tabBar.style.display = 'none';
    }
  }

  themeSelect?.addEventListener('change', () => saveConfig({ theme: themeSelect.value }));
  fontSizeSelect?.addEventListener('change', () => saveConfig({ fontSize: fontSizeSelect.value }));
  scriptureFont?.addEventListener('change', () => saveConfig({ scriptureFont: scriptureFont.value }));
  underlineStyle?.addEventListener('change', () => saveConfig({ underlineStyle: underlineStyle.value }));
  underlineColor?.addEventListener('input', () => {
    saveConfig({ underlineColor: underlineColor.value });
  });

  colorSwatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const col = swatch.dataset.color;
      underlineColor.value = col;
      saveConfig({ underlineColor: col });
    });
  });

  hoverDelay?.addEventListener('input', () => {
    hoverDelayVal.textContent = `${hoverDelay.value}ms`;
    saveConfig({ hoverDelay: parseInt(hoverDelay.value, 10) });
  });

  minimalistMode?.addEventListener('change', () => {
    saveConfig({ minimalistMode: minimalistMode.checked });
  });

  // 5. Tab 2: Translations & Languages Manager
  const defaultTranslation = document.getElementById('defaultTranslation');
  const showTranslationBar = document.getElementById('showTranslationBar');
  const coreTransGrid = document.getElementById('coreTransGrid');
  const intlTransGrid = document.getElementById('intlTransGrid');
  const btnSelectAllTrans = document.getElementById('btnSelectAllTrans');
  const btnSelectCoreTrans = document.getElementById('btnSelectCoreTrans');

  if (defaultTranslation) defaultTranslation.value = config.defaultTranslation;
  if (showTranslationBar) showTranslationBar.checked = config.showTranslationBar;

  defaultTranslation?.addEventListener('change', () => {
    saveConfig({ defaultTranslation: defaultTranslation.value });
  });
  showTranslationBar?.addEventListener('change', () => {
    saveConfig({ showTranslationBar: showTranslationBar.checked });
  });

  const coreList = ['BSB', 'KJV', 'ESV', 'NIV', 'NLT', 'NASB', 'CSB', 'NKJV', 'WEB'];
  const intlList = ['TUR', 'UBIO', 'LBLA', 'RV1960', 'NAA', 'ARA', 'SCH2000', 'CUNPS', 'CUNP', 'KRV', 'HIOV', 'SYNOD', 'NRT'];

  function renderTranslationCards() {
    const renderGroup = (container, list) => {
      if (!container) return;
      container.innerHTML = '';
      list.forEach(id => {
        const meta = TRANSLATIONS[id] || { name: id, lang: '' };
        const isChecked = config.enabledTranslations.includes(id);

        const card = document.createElement('label');
        card.className = `trans-card ${isChecked ? 'checked' : ''}`;
        card.innerHTML = `
          <div class="trans-card-info">
            <input type="checkbox" value="${id}" ${isChecked ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
            <span class="trans-tag">${id}</span>
            <div class="trans-names">
              <span class="trans-main-name">${meta.name}</span>
              <span class="trans-meta-label">${meta.bundled ? '⚡ Pre-Bundled (0ms)' : (meta.lang || 'Online / Offline')}</span>
            </div>
          </div>
        `;

        const cb = card.querySelector('input');
        cb.addEventListener('change', () => {
          card.classList.toggle('checked', cb.checked);
          updateEnabledTranslations();
        });

        container.appendChild(card);
      });
    };

    renderGroup(coreTransGrid, coreList);
    renderGroup(intlTransGrid, intlList);
  }

  function updateEnabledTranslations() {
    const selected = [];
    document.querySelectorAll('.trans-card input[type="checkbox"]:checked').forEach(cb => {
      selected.push(cb.value);
    });
    saveConfig({ enabledTranslations: selected });
  }

  btnSelectAllTrans?.addEventListener('click', () => {
    const all = [...coreList, ...intlList];
    saveConfig({ enabledTranslations: all });
    renderTranslationCards();
  });

  btnSelectCoreTrans?.addEventListener('click', () => {
    saveConfig({ enabledTranslations: [...coreList] });
    renderTranslationCards();
  });

  // 6. Tab 3: Commentaries & Study Resources
  const commCards = document.querySelectorAll('.comm-mode-card');
  const preferredCommentary = document.getElementById('preferredCommentary');
  const studyResource = document.getElementById('studyResource');
  const multiPillsSection = document.getElementById('multiPillsSection');
  const multiPillChips = document.querySelectorAll('#multiPillsSection input[type="checkbox"]');

  function updateCommentaryModeUI() {
    commCards.forEach(card => {
      const mode = card.dataset.mode;
      const isSelected = mode === config.commentaryMode;
      card.classList.toggle('selected', isSelected);
      const radio = card.querySelector('input');
      if (radio) radio.checked = isSelected;
    });

    if (multiPillsSection) {
      multiPillsSection.style.display = config.commentaryMode === 'multi_pills' ? 'block' : 'none';
    }
  }

  commCards.forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      saveConfig({ commentaryMode: mode });
      updateCommentaryModeUI();
    });
  });

  if (preferredCommentary) preferredCommentary.value = config.preferredCommentary;
  if (studyResource) studyResource.value = config.studyResource;

  preferredCommentary?.addEventListener('change', () => {
    saveConfig({ preferredCommentary: preferredCommentary.value });
  });
  studyResource?.addEventListener('change', () => {
    saveConfig({ studyResource: studyResource.value });
  });

  multiPillChips.forEach(cb => {
    cb.checked = config.multiPillResources.includes(cb.value);
    cb.addEventListener('change', () => {
      const activePills = [];
      multiPillChips.forEach(c => {
        if (c.checked) activePills.push(c.value);
      });
      saveConfig({ multiPillResources: activePills });
    });
  });

  // 7. Tab 4: Offline Storage & Downloads Manager
  const statDownloadedCount = document.getElementById('statDownloadedCount');
  const statCachedCount = document.getElementById('statCachedCount');
  const offlineDownloadedList = document.getElementById('offlineDownloadedList');
  const dashDownloadSelect = document.getElementById('dashDownloadSelect');
  const dashDownloadBtn = document.getElementById('dashDownloadBtn');
  const dashDownloadProgress = document.getElementById('dashDownloadProgress');
  const dashClearCacheBtn = document.getElementById('dashClearCacheBtn');

  let currentDownloadedOfflineSet = new Set();

  function loadOfflineStatus() {
    chrome.runtime.sendMessage({ type: 'GET_OFFLINE_STATUS' }, (res) => {
      if (res && res.ok) {
        const downloaded = res.downloaded || [];
        currentDownloadedOfflineSet = new Set(downloaded);

        if (statDownloadedCount) statDownloadedCount.textContent = String(downloaded.length);
        if (statCachedCount) statCachedCount.textContent = `${res.cachedChaptersCount || 0} / ${res.maxCachedChapters || 100}`;

        renderOfflineDownloadedTable(downloaded);
        updateDashDownloadButton();
      }
    });
  }

  function renderOfflineDownloadedTable(downloadedIds) {
    if (!offlineDownloadedList) return;
    offlineDownloadedList.innerHTML = '';

    if (downloadedIds.length === 0) {
      offlineDownloadedList.innerHTML = `
        <div style="padding:18px; text-align:center; color:var(--text-secondary); font-size:13px;">
          No extra full translations downloaded. The <b>BSB</b> is pre-bundled by default (~0ms).
        </div>
      `;
      return;
    }

    downloadedIds.forEach(id => {
      const meta = TRANSLATIONS[id] || { name: id };
      const row = document.createElement('div');
      row.className = 'offline-row';
      row.innerHTML = `
        <div class="offline-row-info">
          <span class="trans-tag">${id}</span>
          <div>
            <div style="font-weight:600; font-size:13px;">${meta.name || id} <span class="offline-status-badge">100% Offline</span></div>
            <div style="font-size:11px; color:var(--text-secondary);">Full 66 Books • ~3.5–4.2 MB on disk</div>
          </div>
        </div>
        <button class="dash-btn danger" data-id="${id}" style="padding:4px 10px; font-size:11.5px;">
          <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          Remove Offline Copy
        </button>
      `;

      row.querySelector('button').addEventListener('click', () => {
        handleDeleteOfflineTranslation(id);
      });

      offlineDownloadedList.appendChild(row);
    });
  }

  function updateDashDownloadButton() {
    if (!dashDownloadBtn || !dashDownloadSelect) return;
    const selected = dashDownloadSelect.value;
    if (currentDownloadedOfflineSet.has(selected)) {
      dashDownloadBtn.textContent = 'Remove Offline';
      dashDownloadBtn.className = 'dash-btn danger';
    } else {
      dashDownloadBtn.textContent = 'Download Offline';
      dashDownloadBtn.className = 'dash-btn primary';
    }
  }

  dashDownloadSelect?.addEventListener('change', updateDashDownloadButton);

  function handleDeleteOfflineTranslation(id) {
    const meta = TRANSLATIONS[id] || { name: id };
    if (!confirm(`Remove ${id} (${meta.name}) from offline storage?\n\nThis will free ~3–4 MB of disk space. You will still be able to read and stream ${id} online on-demand.`)) {
      return;
    }

    dashDownloadProgress.style.display = 'block';
    dashDownloadProgress.textContent = `Removing ${id} from offline storage...`;

    chrome.runtime.sendMessage({
      type: 'DELETE_TRANSLATION',
      translation: id
    }, (res) => {
      if (res && res.ok) {
        dashDownloadProgress.textContent = `✓ ${id} successfully removed from offline storage.`;
        loadOfflineStatus();
        setTimeout(() => { dashDownloadProgress.style.display = 'none'; }, 3500);
      } else {
        dashDownloadProgress.textContent = `Error removing ${id}: ${res?.error || 'Unknown error'}`;
      }
    });
  }

  dashDownloadBtn?.addEventListener('click', () => {
    const selected = dashDownloadSelect.value;
    if (currentDownloadedOfflineSet.has(selected)) {
      handleDeleteOfflineTranslation(selected);
      return;
    }

    dashDownloadProgress.style.display = 'block';
    dashDownloadProgress.textContent = `Downloading complete ${selected} Bible (~3–4 MB)...`;
    dashDownloadBtn.disabled = true;

    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_TRANSLATION',
      translation: selected
    }, (res) => {
      dashDownloadBtn.disabled = false;
      if (res && res.ok) {
        dashDownloadProgress.textContent = `✓ ${selected} downloaded! Now 100% offline at 0ms.`;
        loadOfflineStatus();
        setTimeout(() => { dashDownloadProgress.style.display = 'none'; }, 4000);
      } else {
        dashDownloadProgress.textContent = `Download failed: ${res?.error || 'Check internet connection'}`;
      }
    });
  });

  dashClearCacheBtn?.addEventListener('click', () => {
    if (confirm('Clear all locally cached chapters? (Pre-bundled BSB is not affected)')) {
      chrome.runtime.sendMessage({ type: 'CLEAR_CHAPTER_CACHE' }, (res) => {
        if (res && res.ok) {
          loadOfflineStatus();
          showSaveToast();
        }
      });
    }
  });

  // 8. Tab 5: Disabled Sites Manager
  const addDomainInput = document.getElementById('addDomainInput');
  const addDomainBtn = document.getElementById('addDomainBtn');
  const disabledSitesList = document.getElementById('disabledSitesList');

  function renderDisabledSites() {
    if (!disabledSitesList) return;
    disabledSitesList.innerHTML = '';

    if (config.disabledDomains.length === 0) {
      disabledSitesList.innerHTML = `
        <div style="padding:16px; text-align:center; color:var(--text-secondary); font-size:13px;">
          No disabled websites. Bible Hover is active on all supported sites.
        </div>
      `;
      return;
    }

    config.disabledDomains.forEach(domain => {
      const item = document.createElement('div');
      item.className = 'disabled-site-item';
      item.innerHTML = `
        <span>${domain}</span>
        <button class="dash-mini-btn" style="color:#ef4444;" title="Re-enable Bible Hover on this site">Remove</button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        const nextList = config.disabledDomains.filter(d => d !== domain);
        saveConfig({ disabledDomains: nextList });
        renderDisabledSites();
      });
      disabledSitesList.appendChild(item);
    });
  }

  function handleAddDomain() {
    let val = (addDomainInput?.value || '').trim().toLowerCase();
    if (!val) return;
    val = val.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (val && !config.disabledDomains.includes(val)) {
      const nextList = [...config.disabledDomains, val];
      saveConfig({ disabledDomains: nextList });
      addDomainInput.value = '';
      renderDisabledSites();
    }
  }

  addDomainBtn?.addEventListener('click', handleAddDomain);
  addDomainInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleAddDomain();
  });

  // 9. Tab 6: Scripture Sandbox & Tester
  const sandboxInput = document.getElementById('sandboxInput');
  const sandboxTransSelect = document.getElementById('sandboxTransSelect');
  const sandboxSearchBtn = document.getElementById('sandboxSearchBtn');
  const sandboxResultBox = document.getElementById('sandboxResultBox');
  const sandboxResultTitle = document.getElementById('sandboxResultTitle');
  const sandboxResultSource = document.getElementById('sandboxResultSource');
  const sandboxResultBody = document.getElementById('sandboxResultBody');
  const sandboxFullChBtn = document.getElementById('sandboxFullChBtn');
  const sandboxCopyBtn = document.getElementById('sandboxCopyBtn');

  let sandboxCachedPassage = null;
  let sandboxShowingFullCh = false;

  function runSandboxSearch(fullChapter = false) {
    const query = (sandboxInput?.value || '').trim();
    if (!query) return;

    const parsed = parseSingleReference ? parseSingleReference(query) : null;
    if (!parsed) {
      sandboxResultBox.style.display = 'block';
      sandboxResultTitle.textContent = 'Unrecognized Reference';
      sandboxResultSource.textContent = '';
      sandboxResultBody.textContent = 'Try entering a reference like "John 3:16", "Romans 8:28", or "Psalm 23".';
      return;
    }

    sandboxShowingFullCh = fullChapter;
    sandboxResultTitle.textContent = 'Loading...';
    sandboxResultSource.textContent = '';
    sandboxResultBody.textContent = '';
    sandboxResultBox.style.display = 'block';

    const trans = sandboxTransSelect.value;
    chrome.runtime.sendMessage({
      type: 'GET_PASSAGE',
      parsedRef: parsed,
      translation: trans,
      includeFullChapter: fullChapter
    }, (res) => {
      if (!res || !res.ok) {
        sandboxResultTitle.textContent = 'Error';
        sandboxResultBody.textContent = res?.error || 'Could not fetch passage.';
        return;
      }

      sandboxCachedPassage = res;
      sandboxResultTitle.textContent = `${res.canonicalLabel} (${res.translation})`;
      sandboxResultSource.textContent = `• Source: ${res.primarySource} (0ms)`;

      sandboxFullChBtn.textContent = fullChapter ? 'Verses Only' : 'Full Chapter';

      if (fullChapter && res.fullChapterVerses) {
        sandboxResultBody.innerHTML = res.fullChapterVerses
          .map(v => `<p style="margin-bottom:6px;"><b style="color:var(--accent-color);">${v.verse}</b> ${v.text}</p>`)
          .join('');
      } else {
        const verses = [];
        for (const seg of res.segments) {
          for (const v of seg.verses) {
            verses.push(`<b style="color:var(--accent-color);">${v.verse}</b> ${v.text}`);
          }
        }
        sandboxResultBody.innerHTML = verses.join(' ');
      }
    });
  }

  sandboxSearchBtn?.addEventListener('click', () => runSandboxSearch(false));
  sandboxInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runSandboxSearch(false);
  });
  sandboxFullChBtn?.addEventListener('click', () => {
    runSandboxSearch(!sandboxShowingFullCh);
  });
  sandboxCopyBtn?.addEventListener('click', () => {
    if (!sandboxCachedPassage) return;
    const text = `${sandboxResultBody.innerText}\n— ${sandboxCachedPassage.canonicalLabel} (${sandboxCachedPassage.translation})`;
    navigator.clipboard.writeText(text).then(() => {
      sandboxCopyBtn.textContent = 'Copied!';
      setTimeout(() => { sandboxCopyBtn.textContent = 'Copy'; }, 1500);
    });
  });

  // Initial Boot
  updateLivePreview();
  renderTranslationCards();
  updateCommentaryModeUI();
  loadOfflineStatus();
  renderDisabledSites();
});
