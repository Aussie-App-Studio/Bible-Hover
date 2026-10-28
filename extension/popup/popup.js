/**
 * Bible Hover — Popup Controller
 * Manages preferences, site blocklist, full-translation offline downloads, and instant verse search.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const { parseSingleReference, TRANSLATIONS } = window.BibleHoverMeta;

  // DOM Elements
  const globalToggle = document.getElementById('globalToggle');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const quickResult = document.getElementById('quickResult');
  const resultTitle = document.getElementById('resultTitle');
  const resultBody = document.getElementById('resultBody');
  const resultCopyBtn = document.getElementById('resultCopyBtn');

  const currentDomainEl = document.getElementById('currentDomain');
  const siteToggleBtn = document.getElementById('siteToggleBtn');

  const defaultTranslation = document.getElementById('defaultTranslation');
  const studyResource = document.getElementById('studyResource');
  const minimalistMode = document.getElementById('minimalistMode');
  const showTranslationBar = document.getElementById('showTranslationBar');
  const translationChipsContainer = document.getElementById('translationChips');
  const toggleIntlLangsBtn = document.getElementById('toggleIntlLangsBtn');
  const intlTransContainer = document.getElementById('intlTransContainer');
  const intlActiveCount = document.getElementById('intlActiveCount');
  const allTransCheckboxes = document.querySelectorAll(
    '#translationChips input[type="checkbox"], #intlTransContainer input[type="checkbox"]'
  );
  const themeSelect = document.getElementById('themeSelect');
  const underlineStyle = document.getElementById('underlineStyle');
  const underlineColor = document.getElementById('underlineColor');
  const fontSizeSelect = document.getElementById('fontSizeSelect');
  const scriptureFont = document.getElementById('scriptureFont');

  const commentaryMode = document.getElementById('commentaryMode');
  const preferredCommentary = document.getElementById('preferredCommentary');
  const multiPillsConfig = document.getElementById('multiPillsConfig');
  const multiPillChips = document.getElementById('multiPillChips');
  const commentaryHint = document.getElementById('commentaryHint');

  const cachedChaptersCount = document.getElementById('cachedChaptersCount');
  const downloadSelect = document.getElementById('downloadSelect');
  const downloadBtn = document.getElementById('downloadBtn');
  const downloadProgress = document.getElementById('downloadProgress');
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const downloadedSection = document.getElementById('downloadedSection');
  const downloadedList = document.getElementById('downloadedList');
  const downloadedCountBadge = document.getElementById('downloadedCountBadge');

  let currentDownloadedSet = new Set();
  const originalDownloadLabels = new Map();
  if (downloadSelect) {
    Array.from(downloadSelect.options).forEach(opt => {
      originalDownloadLabels.set(opt.value, opt.textContent);
    });
  }

  let currentDomain = '';
  let disabledDomains = [];
  let lastSearchedPassage = null;

  // 1. Get current active tab domain
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      const url = new URL(tabs[0].url);
      if (url.protocol.startsWith('http')) {
        currentDomain = url.hostname.toLowerCase();
        currentDomainEl.textContent = currentDomain;
      } else {
        currentDomainEl.textContent = 'Browser page (Inactive)';
        siteToggleBtn.disabled = true;
      }
    }
  } catch (e) {
    currentDomainEl.textContent = 'Unknown';
  }

  // 2. Load stored settings
  const stored = await chrome.storage.local.get([
    'enabled',
    'defaultTranslation',
    'studyResource',
    'showTranslationBar',
    'minimalistMode',
    'enabledTranslations',
    'theme',
    'underlineStyle',
    'underlineColor',
    'fontSize',
    'scriptureFont',
    'disabledDomains',
    'commentaryMode',
    'preferredCommentary',
    'multiPillResources'
  ]);

  if (stored) {
    if (stored.enabled !== undefined) globalToggle.checked = stored.enabled;
    if (stored.defaultTranslation) defaultTranslation.value = stored.defaultTranslation;
    if (stored.studyResource) {
      if (stored.studyResource === 'gty') {
        studyResource.value = 'thesingingbible';
        chrome.storage.local.set({ studyResource: 'thesingingbible' });
      } else {
        studyResource.value = stored.studyResource;
      }
    }
    if (stored.showTranslationBar !== undefined) showTranslationBar.checked = stored.showTranslationBar;
    if (stored.minimalistMode !== undefined) minimalistMode.checked = stored.minimalistMode;

    if (Array.isArray(stored.enabledTranslations)) {
      const activeSet = new Set(stored.enabledTranslations);
      allTransCheckboxes.forEach(cb => {
        cb.checked = activeSet.has(cb.value);
      });
      updateIntlActiveCount(activeSet);
      const hasActiveIntl = ['TUR', 'UBIO', 'LBLA', 'RV1960', 'NAA', 'ARA', 'SCH2000', 'CUNPS', 'CUNP', 'KRV', 'HIOV', 'SYNOD', 'NRT'].some(v => activeSet.has(v));
      if (hasActiveIntl && intlTransContainer) {
        intlTransContainer.style.display = 'block';
        if (toggleIntlLangsBtn) toggleIntlLangsBtn.textContent = '− Hide';
      }
    }

    if (stored.theme) themeSelect.value = stored.theme;
    if (stored.underlineStyle) underlineStyle.value = stored.underlineStyle;
    if (stored.underlineColor) underlineColor.value = stored.underlineColor;
    if (stored.fontSize) fontSizeSelect.value = stored.fontSize;
    if (stored.scriptureFont && scriptureFont) scriptureFont.value = stored.scriptureFont;
    if (Array.isArray(stored.disabledDomains)) disabledDomains = stored.disabledDomains;

    if (stored.commentaryMode) commentaryMode.value = stored.commentaryMode;
    if (stored.preferredCommentary) preferredCommentary.value = stored.preferredCommentary;

    if (Array.isArray(stored.multiPillResources)) {
      const pillSet = new Set(stored.multiPillResources);
      multiPillChips.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = pillSet.has(cb.value);
      });
    }
    updateCommentaryUI();
  }

  updateSiteToggleUI();
  updateOfflineStatus();

  // 3. Global Toggle
  globalToggle.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: globalToggle.checked });
  });

  // 4. Site-Specific Toggle
  siteToggleBtn.addEventListener('click', () => {
    if (!currentDomain) return;
    const idx = disabledDomains.indexOf(currentDomain);
    if (idx >= 0) {
      disabledDomains.splice(idx, 1);
    } else {
      disabledDomains.push(currentDomain);
    }
    chrome.storage.local.set({ disabledDomains }, () => {
      updateSiteToggleUI();
    });
  });

  function updateSiteToggleUI() {
    if (!currentDomain || siteToggleBtn.disabled) return;
    const isDomainDisabled = disabledDomains.includes(currentDomain);
    if (isDomainDisabled) {
      siteToggleBtn.textContent = 'Disabled';
      siteToggleBtn.className = 'pill-btn disabled';
    } else {
      siteToggleBtn.textContent = 'Enabled';
      siteToggleBtn.className = 'pill-btn active';
    }
  }

  // 5. Settings Change Handlers
  defaultTranslation.addEventListener('change', () => {
    chrome.storage.local.set({ defaultTranslation: defaultTranslation.value });
  });

  studyResource.addEventListener('change', () => {
    chrome.storage.local.set({ studyResource: studyResource.value });
  });

  showTranslationBar.addEventListener('change', () => {
    chrome.storage.local.set({ showTranslationBar: showTranslationBar.checked });
  });

  minimalistMode.addEventListener('change', () => {
    chrome.storage.local.set({ minimalistMode: minimalistMode.checked });
  });

  function updateIntlActiveCount(activeSet) {
    if (!intlActiveCount) return;
    const intlValues = ['TUR', 'UBIO', 'LBLA', 'RV1960', 'NAA', 'ARA', 'SCH2000', 'CUNPS', 'CUNP', 'KRV', 'HIOV', 'SYNOD', 'NRT'];
    const count = intlValues.filter(v => activeSet.has(v)).length;
    if (count > 0) {
      intlActiveCount.textContent = `(${count} active)`;
      intlActiveCount.style.display = 'inline';
    } else {
      intlActiveCount.style.display = 'none';
    }
  }

  if (toggleIntlLangsBtn && intlTransContainer) {
    toggleIntlLangsBtn.addEventListener('click', () => {
      const isHidden = intlTransContainer.style.display === 'none';
      intlTransContainer.style.display = isHidden ? 'block' : 'none';
      toggleIntlLangsBtn.textContent = isHidden ? '− Hide' : '+ Languages';
    });
  }

  allTransCheckboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const activeTranslations = Array.from(
        document.querySelectorAll('#translationChips input[type="checkbox"]:checked, #intlTransContainer input[type="checkbox"]:checked')
      ).map(c => c.value);
      chrome.storage.local.set({ enabledTranslations: activeTranslations });
      updateIntlActiveCount(new Set(activeTranslations));
    });
  });

  themeSelect.addEventListener('change', () => {
    chrome.storage.local.set({ theme: themeSelect.value });
  });

  underlineStyle.addEventListener('change', () => {
    chrome.storage.local.set({ underlineStyle: underlineStyle.value });
  });

  underlineColor.addEventListener('input', () => {
    chrome.storage.local.set({ underlineColor: underlineColor.value });
  });

  fontSizeSelect.addEventListener('change', () => {
    chrome.storage.local.set({ fontSize: fontSizeSelect.value });
  });

  scriptureFont?.addEventListener('change', () => {
    chrome.storage.local.set({ scriptureFont: scriptureFont.value });
  });

  function updateCommentaryUI() {
    const mode = commentaryMode.value;
    if (mode === 'multi_pills') {
      multiPillsConfig.style.display = 'block';
    } else {
      multiPillsConfig.style.display = 'none';
    }

    const hints = {
      direct_link: 'Adds a 1-click button to open your preferred commentary in a new tab.',
      in_card_tab: 'Adds Scripture and Commentary tabs in the card to read notes right in the popup.',
      side_drawer: 'Adds a Study Drawer button to slide out full-height commentary notes on the right side of the page.',
      multi_pills: 'Displays multiple direct study pills in the card footer simultaneously.'
    };
    commentaryHint.textContent = hints[mode] || hints.direct_link;
  }

  commentaryMode.addEventListener('change', () => {
    chrome.storage.local.set({ commentaryMode: commentaryMode.value });
    updateCommentaryUI();
  });

  preferredCommentary.addEventListener('change', () => {
    chrome.storage.local.set({ preferredCommentary: preferredCommentary.value });
  });

  multiPillChips.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const activePills = Array.from(
        multiPillChips.querySelectorAll('input[type="checkbox"]:checked')
      ).map(c => c.value);
      chrome.storage.local.set({ multiPillResources: activePills });
    });
  });

  // Color preset buttons
  document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', () => {
      const color = preset.dataset.color;
      underlineColor.value = color;
      chrome.storage.local.set({ underlineColor: color });
    });
  });

  // 6. Quick Verse Lookup
  async function performQuickSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    const parsed = parseSingleReference(query);
    if (!parsed) {
      quickResult.style.display = 'block';
      resultTitle.textContent = 'Unrecognized Reference';
      resultBody.textContent = 'Try entering a reference like "John 3:16", "Romans 8:28", or "Psalm 23".';
      resultCopyBtn.style.display = 'none';
      return;
    }

    resultTitle.textContent = 'Loading...';
    resultBody.textContent = '';
    quickResult.style.display = 'block';
    resultCopyBtn.style.display = 'none';

    chrome.runtime.sendMessage({
      type: 'GET_PASSAGE',
      parsedRef: parsed,
      translation: defaultTranslation.value,
      includeFullChapter: false
    }, (res) => {
      if (!res || !res.ok) {
        resultTitle.textContent = 'Error';
        resultBody.textContent = res?.error || 'Could not fetch scripture.';
        return;
      }

      lastSearchedPassage = res;
      resultTitle.textContent = `${res.canonicalLabel} (${res.translation})`;
      resultCopyBtn.style.display = 'inline-block';

      const verses = [];
      for (const seg of res.segments) {
        for (const v of seg.verses) {
          verses.push(`${v.verse} ${v.text}`);
        }
      }
      resultBody.textContent = verses.join(' ');
    });
  }

  searchBtn.addEventListener('click', performQuickSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performQuickSearch();
  });

  resultCopyBtn.addEventListener('click', () => {
    if (!lastSearchedPassage) return;
    const text = `${resultBody.textContent}\n— ${lastSearchedPassage.canonicalLabel} (${lastSearchedPassage.translation})`;
    navigator.clipboard.writeText(text).then(() => {
      resultCopyBtn.textContent = 'Copied!';
      setTimeout(() => { resultCopyBtn.textContent = 'Copy'; }, 1500);
    });
  });

  // 7. Offline Database & Cache Management
  function updateDownloadButtonState() {
    if (!downloadBtn || !downloadSelect) return;
    const selected = downloadSelect.value;
    if (currentDownloadedSet.has(selected)) {
      downloadBtn.textContent = 'Remove';
      downloadBtn.className = 'pill-btn danger';
      downloadBtn.title = `Remove ${selected} from offline storage (free disk space)`;
    } else {
      downloadBtn.textContent = 'Download';
      downloadBtn.className = 'pill-btn primary';
      downloadBtn.title = `Download full 66-book ${selected} for offline reading`;
    }
  }

  if (downloadSelect) {
    downloadSelect.addEventListener('change', updateDownloadButtonState);
  }

  function handleDeleteDownloadedTranslation(id) {
    const meta = TRANSLATIONS[id] || { name: id };
    if (!confirm(`Remove ${id} (${meta.name}) from offline storage?\n\nThis will free ~3-4 MB of disk space. You will still be able to read and stream ${id} online on-demand.`)) {
      return;
    }

    downloadProgress.style.display = 'block';
    downloadProgress.textContent = `Removing ${id} from offline storage...`;
    if (downloadBtn) downloadBtn.disabled = true;

    chrome.runtime.sendMessage({
      type: 'DELETE_TRANSLATION',
      translation: id
    }, (res) => {
      if (downloadBtn) downloadBtn.disabled = false;
      if (res && res.ok) {
        downloadProgress.textContent = `✓ ${id} successfully removed from offline storage.`;
        updateOfflineStatus();
        setTimeout(() => { downloadProgress.style.display = 'none'; }, 3500);
      } else {
        downloadProgress.textContent = `Error removing ${id}: ${res?.error || 'Unknown error'}`;
      }
    });
  }

  function updateOfflineStatus() {
    chrome.runtime.sendMessage({ type: 'GET_OFFLINE_STATUS' }, (res) => {
      if (res && res.ok) {
        const count = res.cachedChaptersCount || 0;
        const max = res.maxCachedChapters || 100;
        cachedChaptersCount.textContent = `${count} / ${max}`;

        const downloaded = res.downloaded || [];
        currentDownloadedSet = new Set(downloaded);

        // Update download select labels
        if (downloadSelect) {
          Array.from(downloadSelect.options).forEach(opt => {
            if (currentDownloadedSet.has(opt.value)) {
              opt.textContent = `✓ ${opt.value} (Downloaded Offline)`;
            } else {
              opt.textContent = originalDownloadLabels.get(opt.value) || opt.textContent;
            }
          });
          updateDownloadButtonState();
        }

        // Render Downloaded Offline Bibles list
        if (downloadedSection && downloadedList) {
          if (downloaded.length > 0) {
            downloadedSection.style.display = 'block';
            if (downloadedCountBadge) downloadedCountBadge.textContent = String(downloaded.length);
            downloadedList.innerHTML = '';

            downloaded.forEach(id => {
              const meta = TRANSLATIONS[id] || { name: id };
              const row = document.createElement('div');
              row.className = 'downloaded-row';

              const info = document.createElement('div');
              info.className = 'downloaded-info';

              const tag = document.createElement('span');
              tag.className = 'downloaded-tag';
              tag.textContent = id;

              const details = document.createElement('div');
              details.className = 'downloaded-details';

              const name = document.createElement('span');
              name.className = 'downloaded-name';
              name.textContent = meta.name || id;

              const sub = document.createElement('span');
              sub.className = 'downloaded-sub';
              sub.textContent = 'Full 66 Books • Offline (0ms)';

              details.appendChild(name);
              details.appendChild(sub);
              info.appendChild(tag);
              info.appendChild(details);

              const delBtn = document.createElement('button');
              delBtn.className = 'delete-trans-btn';
              delBtn.title = `Remove ${id} from offline storage`;
              delBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                Remove
              `;
              delBtn.addEventListener('click', () => {
                handleDeleteDownloadedTranslation(id);
              });

              row.appendChild(info);
              row.appendChild(delBtn);
              downloadedList.appendChild(row);
            });
          } else {
            downloadedSection.style.display = 'none';
          }
        }
      }
    });
  }

  downloadBtn.addEventListener('click', () => {
    const selectedTrans = downloadSelect.value;
    if (currentDownloadedSet.has(selectedTrans)) {
      handleDeleteDownloadedTranslation(selectedTrans);
      return;
    }

    downloadProgress.style.display = 'block';
    downloadProgress.textContent = `Downloading complete ${selectedTrans} Bible (~3-4 MB)...`;
    downloadBtn.disabled = true;

    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_TRANSLATION',
      translation: selectedTrans
    }, (res) => {
      downloadBtn.disabled = false;
      if (res && res.ok) {
        downloadProgress.textContent = `✓ ${selectedTrans} downloaded! Now 100% offline at 0ms.`;
        updateOfflineStatus();
        setTimeout(() => { downloadProgress.style.display = 'none'; }, 4000);
      } else {
        downloadProgress.textContent = `Download error: ${res?.error || 'Unknown error'}`;
      }
    });
  });

  clearCacheBtn.addEventListener('click', () => {
    if (confirm('Clear all locally cached chapters? (Bundled BSB is not affected)')) {
      chrome.runtime.sendMessage({ type: 'CLEAR_CHAPTER_CACHE' }, (res) => {
        if (res && res.ok) {
          updateOfflineStatus();
        }
      });
    }
  });

  // Open Full-Tab Settings Dashboard
  function openFullDashboard(e) {
    if (e) e.preventDefault();
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  }

  const openDashboardBtn = document.getElementById('openDashboardBtn');
  const footerDashboardLink = document.getElementById('footerDashboardLink');
  openDashboardBtn?.addEventListener('click', openFullDashboard);
  footerDashboardLink?.addEventListener('click', openFullDashboard);

});
