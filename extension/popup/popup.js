/**
 * Bible Hover — Popup Controller
 * Manages preferences, site blocklist, full-translation offline downloads, and instant verse search.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const BibleHoverMeta = (typeof window !== 'undefined' ? window.BibleHoverMeta : null) || globalThis.BibleHoverMeta || {};
  const parseSingleReference = BibleHoverMeta.parseSingleReference || (() => null);
  const TRANSLATIONS = BibleHoverMeta.TRANSLATIONS || {};

  // DOM Elements
  const globalToggle = document.getElementById('globalToggle');
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');
  const quickResult = document.getElementById('quickResult');
  const resultTitle = document.getElementById('resultTitle');
  const resultBody = document.getElementById('resultBody');
  const resultCopyBtn = document.getElementById('resultCopyBtn');

  const currentDomainEl = document.getElementById('currentDomain');
  const siteLabelEl = document.getElementById('siteLabel');
  const siteCard = document.getElementById('siteCard');
  const sitePowerBtn = document.getElementById('sitePowerBtn');
  const siteToggleSwitch = document.getElementById('siteToggleSwitch');
  const siteStatusDot = document.getElementById('siteStatusDot');
  const siteStatusText = document.getElementById('siteStatusText');
  const siteDetailsClickArea = document.getElementById('siteDetailsClickArea');
  const siteNoticeCard = document.getElementById('siteNoticeCard');

  const defaultTranslation = document.getElementById('defaultTranslation');
  const studyResource = document.getElementById('studyResource');
  const minimalistMode = document.getElementById('minimalistMode');
  const showSettingsButton = document.getElementById('showSettingsButton');
  const detectInlineTranslations = document.getElementById('detectInlineTranslations');
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

  const DEFAULT_DISABLED_DOMAINS = [
    'bible.com',
    'biblegateway.com',
    'biblehub.com',
    'openbible.info',
    'openbible.com',
    'blueletterbible.org',
    'esv.org',
    'docs.google.com',
    'googledocs.com',
    'sheets.google.com'
  ];

  function isHostMatchingEntry(host, entry) {
    const h = String(host || '').toLowerCase().trim();
    const d = String(entry || '').toLowerCase().trim();
    if (!h || !d) return false;
    return h === d || h.endsWith('.' + d) || d === 'www.' + h;
  }

  function extractFileName(pathname, fallback) {
    try {
      const last = String(pathname || '').split('/').filter(Boolean).pop();
      return last ? decodeURIComponent(last) : fallback;
    } catch {
      return fallback;
    }
  }

  function analyzeTabUrl(rawUrl) {
    const fallback = {
      kind: 'system',
      domain: '',
      displayDomain: 'Browser System Page',
      label: 'Browser Page',
      isPublishedDoc: false
    };
    if (!rawUrl) return fallback;

    try {
      const url = new URL(rawUrl);
      const protocol = url.protocol.toLowerCase();
      const host = url.hostname.toLowerCase();
      const pathname = url.pathname || '';
      const isChromePdfViewer =
        protocol === 'chrome-extension:' && host === 'mhjfbmdgcfjbbpaeojofohoefgiehjai';

      if (pathname.toLowerCase().endsWith('.pdf') || isChromePdfViewer) {
        return {
          kind: 'pdf',
          domain: '',
          displayDomain: extractFileName(pathname, 'PDF Document'),
          label: 'PDF Document',
          isPublishedDoc: false
        };
      }

      if (protocol === 'file:') {
        return {
          kind: 'local_file',
          domain: '',
          displayDomain: extractFileName(pathname, 'Local File'),
          label: 'Local File',
          isPublishedDoc: false
        };
      }

      if (protocol.startsWith('http')) {
        const isDocsHost =
          host === 'docs.google.com' ||
          host.endsWith('.docs.google.com') ||
          host === 'googledocs.com' ||
          host.endsWith('.googledocs.com');
        const isPublishedDoc = isDocsHost && /\/pub(html)?(\/|$)/i.test(pathname);

        if (isPublishedDoc) {
          return {
            kind: 'web',
            domain: host,
            displayDomain: host,
            label: 'Published Google Doc',
            isPublishedDoc: true
          };
        }

        if (isDocsHost && /^\/forms\//i.test(pathname)) {
          return {
            kind: 'web',
            domain: host,
            displayDomain: host,
            label: 'Google Forms',
            isPublishedDoc: false
          };
        }

        if (
          host === 'sheets.google.com' ||
          host.endsWith('.sheets.google.com') ||
          (isDocsHost && /^\/spreadsheets\//i.test(pathname))
        ) {
          return {
            kind: 'google_sheets',
            domain: host,
            displayDomain: host,
            label: 'Google Sheets',
            isPublishedDoc: false
          };
        }

        if (isDocsHost) {
          return {
            kind: 'google_docs',
            domain: host,
            displayDomain: host,
            label: 'Google Docs Editor',
            isPublishedDoc: false
          };
        }

        return {
          kind: 'web',
          domain: host,
          displayDomain: host,
          label: 'Current Website',
          isPublishedDoc: false
        };
      }

      return fallback;
    } catch {
      return {
        kind: 'system',
        domain: '',
        displayDomain: 'Unknown Page',
        label: 'Browser Page',
        isPublishedDoc: false
      };
    }
  }

  let tabInfo = analyzeTabUrl('');
  let currentDomain = '';
  let isFileAccessAllowed = null;
  let disabledDomains = [...DEFAULT_DISABLED_DOMAINS];
  let lastSearchedPassage = null;

  // 1. Get current active tab context
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      tabInfo = analyzeTabUrl(tabs[0].url);
      currentDomain = tabInfo.domain;
    }
  } catch (e) {
    tabInfo = analyzeTabUrl('');
  }

  if (tabInfo.kind === 'local_file' && chrome.extension?.isAllowedFileSchemeAccess) {
    try {
      isFileAccessAllowed = await new Promise((resolve) => {
        chrome.extension.isAllowedFileSchemeAccess((allowed) => resolve(Boolean(allowed)));
      });
    } catch {
      isFileAccessAllowed = null;
    }
  }

  if (siteLabelEl) siteLabelEl.textContent = tabInfo.label;
  currentDomainEl.textContent = tabInfo.displayDomain;
  currentDomainEl.title = tabInfo.displayDomain;

  // 2. Load stored settings
  const stored = await chrome.storage.local.get([
    'enabled',
    'defaultTranslation',
    'detectInlineTranslations',
    'studyResource',
    'showTranslationBar',
    'showSettingsButton',
    'minimalistMode',
    'enabledTranslations',
    'theme',
    'underlineStyle',
    'underlineColor',
    'fontSize',
    'scriptureFont',
    'disabledDomains',
    'defaultSitesSeededV2',
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
    if (stored.detectInlineTranslations !== undefined && detectInlineTranslations) {
      detectInlineTranslations.checked = stored.detectInlineTranslations;
    }
    if (stored.minimalistMode !== undefined) minimalistMode.checked = stored.minimalistMode;
    if (stored.showSettingsButton !== undefined && showSettingsButton) {
      showSettingsButton.checked = stored.showSettingsButton;
    }

    if (Array.isArray(stored.enabledTranslations)) {
      const activeSet = new Set(stored.enabledTranslations);
      allTransCheckboxes.forEach(cb => {
        cb.checked = activeSet.has(cb.value);
      });
      updateIntlActiveCount(activeSet);
      const hasActiveIntl = ['TUR', 'UBIO', 'LBLA', 'RV1960', 'NVI', 'NTV', 'BTX3', 'NTBT', 'NAA', 'ARA', 'SCH2000', 'CUNPS', 'CUNP', 'KRV', 'HIOV', 'SYNOD', 'NRT'].some(v => activeSet.has(v));
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
    if (Array.isArray(stored.disabledDomains)) {
      disabledDomains = stored.defaultSitesSeededV2
        ? stored.disabledDomains
        : Array.from(new Set([...stored.disabledDomains, ...DEFAULT_DISABLED_DOMAINS]));
    }

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

  // 4. Site-Specific Toggle (uBlock Origin Style Power Button + Toggle Switch)
  function canToggleCurrentSite() {
    return tabInfo.kind === 'web' && Boolean(currentDomain);
  }

  function isCurrentSiteDisabled() {
    if (!currentDomain) return false;
    if (tabInfo.isPublishedDoc) {
      return disabledDomains.some(d => String(d || '').toLowerCase().trim() === 'docs.google.com/pub');
    }
    return disabledDomains.some(d => isHostMatchingEntry(currentDomain, d));
  }

  function isDefaultExcludedSite(host) {
    if (!host) return false;
    return DEFAULT_DISABLED_DOMAINS.some(d => isHostMatchingEntry(host, d));
  }

  function toggleCurrentSite() {
    if (!canToggleCurrentSite()) return;
    if (tabInfo.isPublishedDoc) {
      if (isCurrentSiteDisabled()) {
        disabledDomains = disabledDomains.filter(d => String(d || '').toLowerCase().trim() !== 'docs.google.com/pub');
      } else if (!disabledDomains.includes('docs.google.com/pub')) {
        disabledDomains.push('docs.google.com/pub');
      }
    } else if (isCurrentSiteDisabled()) {
      // Remove any entry that matches currentDomain (including parent domain like "bible.com" when on "www.bible.com")
      disabledDomains = disabledDomains.filter(d => !isHostMatchingEntry(currentDomain, d));
    } else {
      const cleanDomain = currentDomain.replace(/^www\./, '');
      if (!disabledDomains.includes(cleanDomain)) {
        disabledDomains.push(cleanDomain);
      }
    }
    chrome.storage.local.set({ disabledDomains, defaultSitesSeededV2: true }, () => {
      updateSiteToggleUI();
    });
  }

  sitePowerBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCurrentSite();
  });

  siteToggleSwitch?.addEventListener('change', () => {
    toggleCurrentSite();
  });

  siteDetailsClickArea?.addEventListener('click', () => {
    toggleCurrentSite();
  });

  function appendBoldSegments(parent, parts) {
    for (const part of parts) {
      if (typeof part === 'string') {
        parent.appendChild(document.createTextNode(part));
      } else if (part && part.bold) {
        const strong = document.createElement('strong');
        strong.textContent = part.bold;
        parent.appendChild(strong);
      }
    }
  }

  function buildNoticeGuide(guideTitle, steps, altParts) {
    const guide = document.createElement('div');
    guide.className = 'site-notice-guide';

    if (guideTitle) {
      const heading = document.createElement('div');
      heading.className = 'site-notice-guide-title';
      heading.textContent = guideTitle;
      guide.appendChild(heading);
    }

    const stepsList = document.createElement('div');
    stepsList.className = 'site-notice-steps';
    steps.forEach((stepParts, idx) => {
      const row = document.createElement('div');
      row.className = 'site-notice-step';

      const num = document.createElement('span');
      num.className = 'site-notice-step-num';
      num.textContent = String(idx + 1);

      const text = document.createElement('span');
      appendBoldSegments(text, stepParts);

      row.appendChild(num);
      row.appendChild(text);
      stepsList.appendChild(row);
    });
    guide.appendChild(stepsList);

    if (altParts) {
      const alt = document.createElement('div');
      alt.className = 'site-notice-alt';
      appendBoldSegments(alt, altParts);
      guide.appendChild(alt);
    }

    return guide;
  }

  function renderSiteNotice() {
    if (!siteNoticeCard) return;
    siteNoticeCard.innerHTML = '';

    let icon = '';
    let title = '';
    let descParts = null;
    let guide = null;
    let actionBtn = null;

    if (tabInfo.kind === 'google_docs') {
      icon = '📝';
      title = 'Why Bible Hover isn’t active while editing';
      descParts = [
        'Google Docs draws pages like an image instead of standard webpage text, so extensions can’t underline verses in the editor.'
      ];
      guide = buildNoticeGuide(
        'How to read this Doc with Bible Hover (Publish to web):',
        [
          ['In Google Docs, click ', { bold: 'File' }, ' → ', { bold: 'Share' }, ' → ', { bold: 'Publish to web' }, '.'],
          ['Click ', { bold: 'Publish' }, ' and open the link it gives you.'],
          ['Hover any verse — existing links (like BibleGateway) still open when clicked!']
        ],
        [
          { bold: 'Keep it private? ' },
          'Use ',
          { bold: 'File → Download → Web Page (.html, zipped)' },
          ', unzip it, and open the ',
          { bold: '.html' },
          ' file in Chrome.'
        ]
      );
    } else if (tabInfo.kind === 'google_sheets') {
      icon = '📊';
      title = 'Why Bible Hover isn’t active in Google Sheets';
      descParts = [
        'Google Sheets draws cells on a spreadsheet grid instead of normal webpage text. Use ',
        { bold: 'Quick Search' },
        ' above, or ',
        { bold: 'File → Share → Publish to web' },
        ' to view it as a webpage.'
      ];
    } else if (tabInfo.kind === 'pdf') {
      icon = '📄';
      title = 'Chrome’s PDF viewer blocks hover previews';
      descParts = [
        'Browser extensions aren’t allowed to scan or underline verses inside PDF files.'
      ];
      guide = buildNoticeGuide(
        'Easy ways to view this with Bible Hover:',
        [
          ['From Google Docs? Use ', { bold: 'File → Share → Publish to web' }, ' instead of downloading as a PDF.'],
          ['Or download as ', { bold: 'Web Page (.html, zipped)' }, ' and open the ', { bold: '.html' }, ' file in Chrome.']
        ],
        ['You can also type or paste any reference into ', { bold: 'Quick Search' }, ' at the top.']
      );
    } else if (tabInfo.kind === 'local_file' && isFileAccessAllowed !== true) {
      icon = '📁';
      title = 'Local file access is turned off';
      descParts = [
        'Chrome blocks extensions from local HTML files by default.'
      ];
      guide = buildNoticeGuide(
        'To enable Bible Hover on local HTML files:',
        [
          ['Open ', { bold: 'Extension Details' }, ' using the button below.'],
          ['Turn on ', { bold: 'Allow access to file URLs' }, ', then refresh this tab.']
        ]
      );
      if (chrome.runtime?.id && chrome.tabs?.create) {
        actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'site-notice-action-btn';
        actionBtn.textContent = 'Open Extension Details ↗';
        actionBtn.addEventListener('click', () => {
          chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
        });
      }
    } else {
      siteNoticeCard.style.display = 'none';
      return;
    }

    const header = document.createElement('div');
    header.className = 'site-notice-header';

    const iconEl = document.createElement('span');
    iconEl.className = 'site-notice-icon';
    iconEl.textContent = icon;

    const titleEl = document.createElement('span');
    titleEl.className = 'site-notice-title';
    titleEl.textContent = title;

    header.appendChild(iconEl);
    header.appendChild(titleEl);
    siteNoticeCard.appendChild(header);

    if (descParts) {
      const desc = document.createElement('p');
      desc.className = 'site-notice-desc';
      appendBoldSegments(desc, descParts);
      siteNoticeCard.appendChild(desc);
    }

    if (guide) siteNoticeCard.appendChild(guide);
    if (actionBtn) siteNoticeCard.appendChild(actionBtn);

    siteNoticeCard.style.display = 'flex';
  }

  function updateSiteToggleUI() {
    if (siteLabelEl) siteLabelEl.textContent = tabInfo.label;
    currentDomainEl.textContent = tabInfo.displayDomain;
    currentDomainEl.title = tabInfo.displayDomain;

    if (!canToggleCurrentSite()) {
      const isLocalActive = tabInfo.kind === 'local_file' && isFileAccessAllowed === true;
      const statusVariant = isLocalActive
        ? 'active'
        : tabInfo.kind === 'system'
          ? 'paused'
          : 'notice';

      const statusMessages = {
        google_docs: 'Not supported in Docs editor',
        google_sheets: 'Not supported in Sheets editor',
        pdf: 'Not supported in PDF viewer',
        local_file: isLocalActive ? 'Active on this local file' : 'Local file access is off',
        system: 'Unavailable on browser system pages'
      };

      if (sitePowerBtn) {
        sitePowerBtn.disabled = true;
        sitePowerBtn.className = `site-power-btn ${isLocalActive ? 'active' : 'paused'}`;
        sitePowerBtn.title = isLocalActive
          ? 'Managed via "Allow access to file URLs" in Extension Details'
          : statusMessages[tabInfo.kind] || 'Unavailable on this page';
      }
      if (siteToggleSwitch) {
        siteToggleSwitch.disabled = true;
        siteToggleSwitch.checked = isLocalActive;
        siteToggleSwitch.title = sitePowerBtn?.title || '';
      }
      if (siteDetailsClickArea) {
        siteDetailsClickArea.classList.add('non-interactive');
        siteDetailsClickArea.removeAttribute('title');
      }
      if (siteStatusDot) siteStatusDot.className = `site-status-dot ${statusVariant}`;
      if (siteStatusText) {
        siteStatusText.textContent = statusMessages[tabInfo.kind] || 'Unavailable on this page';
        siteStatusText.className = `site-status-text ${statusVariant}`;
      }
      if (siteCard) {
        if (isLocalActive) {
          siteCard.classList.remove('paused');
        } else {
          siteCard.classList.add('paused');
        }
      }
      renderSiteNotice();
      return;
    }

    if (siteDetailsClickArea) {
      siteDetailsClickArea.classList.remove('non-interactive');
      siteDetailsClickArea.title = 'Click to toggle Bible Hover for this website';
    }
    if (sitePowerBtn) sitePowerBtn.disabled = false;
    if (siteToggleSwitch) siteToggleSwitch.disabled = false;

    const isDomainDisabled = isCurrentSiteDisabled();
    if (isDomainDisabled) {
      if (siteCard) siteCard.classList.add('paused');
      if (sitePowerBtn) {
        sitePowerBtn.className = 'site-power-btn paused';
        sitePowerBtn.title = `Turn on Bible Hover for ${currentDomain}`;
      }
      if (siteToggleSwitch) {
        siteToggleSwitch.checked = false;
        siteToggleSwitch.title = `Turn on Bible Hover for ${currentDomain}`;
      }
      if (siteStatusDot) siteStatusDot.className = 'site-status-dot paused';
      if (siteStatusText) {
        if (tabInfo.isPublishedDoc) {
          siteStatusText.textContent = 'Paused on published docs • Click to enable';
        } else {
          siteStatusText.textContent = isDefaultExcludedSite(currentDomain)
            ? 'Paused by default • Click to enable'
            : 'Paused on this website';
        }
        siteStatusText.className = 'site-status-text paused';
      }
    } else {
      if (siteCard) siteCard.classList.remove('paused');
      if (sitePowerBtn) {
        sitePowerBtn.className = 'site-power-btn active';
        sitePowerBtn.title = `Turn off Bible Hover for ${currentDomain}`;
      }
      if (siteToggleSwitch) {
        siteToggleSwitch.checked = true;
        siteToggleSwitch.title = `Turn off Bible Hover for ${currentDomain}`;
      }
      if (siteStatusDot) siteStatusDot.className = 'site-status-dot active';
      if (siteStatusText) {
        siteStatusText.textContent = tabInfo.isPublishedDoc
          ? 'Active on published Google Doc'
          : 'Active on this website';
        siteStatusText.className = 'site-status-text active';
      }
    }
    renderSiteNotice();
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

  detectInlineTranslations?.addEventListener('change', () => {
    chrome.storage.local.set({ detectInlineTranslations: detectInlineTranslations.checked });
  });

  minimalistMode.addEventListener('change', () => {
    chrome.storage.local.set({ minimalistMode: minimalistMode.checked });
  });

  showSettingsButton?.addEventListener('change', () => {
    chrome.storage.local.set({ showSettingsButton: showSettingsButton.checked });
  });

  function updateIntlActiveCount(activeSet) {
    if (!intlActiveCount) return;
    const intlValues = ['TUR', 'UBIO', 'LBLA', 'RV1960', 'NVI', 'NTV', 'BTX3', 'NTBT', 'NAA', 'ARA', 'SCH2000', 'CUNPS', 'CUNP', 'KRV', 'HIOV', 'SYNOD', 'NRT'];
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
  const footerWelcomeLink = document.getElementById('footerWelcomeLink');
  const footerFeedbackLink = document.getElementById('footerFeedbackLink');
  openDashboardBtn?.addEventListener('click', openFullDashboard);
  footerDashboardLink?.addEventListener('click', openFullDashboard);
  footerWelcomeLink?.addEventListener('click', (e) => {
    e.preventDefault();
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: chrome.runtime.getURL('welcome/welcome.html') });
    } else {
      window.open(chrome.runtime.getURL('welcome/welcome.html'));
    }
  });
  footerFeedbackLink?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = 'https://docs.google.com/forms/d/e/1FAIpQLSfgsw6-DU97aqOTvIyiBVZMiO3Xv8VrK_0QkT09ZIGhU6D2Sw/viewform';
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url });
    } else {
      window.open(url, '_blank');
    }
  });

  // --- Organic Share & Rate Prompt System ---
  const STORE_BASE_URL = 'https://chromewebstore.google.com/detail/bible-hover-%E2%80%94-instant-scr/eikdpekimeeaiehcbnhigbjbgpcfnmbp';
  const STORE_REVIEWS_URL = STORE_BASE_URL;
  const SHARE_TEXT = `Check out Bible Hover — instant 0ms scripture previews and study commentaries in your browser. 100% free with no ads!`;

  const shareBanner = document.getElementById('shareBanner');
  const shareRateBtn = document.getElementById('shareRateBtn');
  const shareFriendsBtn = document.getElementById('shareFriendsBtn');
  const shareLinksDrawer = document.getElementById('shareLinksDrawer');
  const shareBannerDismissBtn = document.getElementById('shareBannerDismissBtn');
  const shareRemindLaterBtn = document.getElementById('shareRemindLaterBtn');
  const shareThanksNotice = document.getElementById('shareThanksNotice');
  const shareCopyLinkBtn = document.getElementById('shareCopyLinkBtn');
  const shareCopyText = document.getElementById('shareCopyText');
  const shareEmailBtn = document.getElementById('shareEmailBtn');
  const shareWhatsAppBtn = document.getElementById('shareWhatsAppBtn');
  const shareXBtn = document.getElementById('shareXBtn');

  async function checkAndRenderSharePrompt() {
    const data = await chrome.storage.local.get([
      'installDate',
      'lastPromptDate',
      'hasRatedOrShared',
      'verseHoverCount'
    ]);

    const now = Date.now();
    let installDate = data.installDate;
    if (!installDate) {
      installDate = now;
      chrome.storage.local.set({ installDate: now });
    }

    const daysSinceInstall = (now - installDate) / (1000 * 60 * 60 * 24);
    const lastPrompt = data.lastPromptDate;
    const daysSinceLastPrompt = lastPrompt ? (now - lastPrompt) / (1000 * 60 * 60 * 24) : 9999;
    const hovers = data.verseHoverCount || 0;

    let shouldShow = false;

    if (!lastPrompt) {
      // First prompt window (sometime in first two weeks, once user tested it)
      // Shown if installed >= 3 days OR if user has hovered over >= 5 verses
      if (daysSinceInstall >= 3 || hovers >= 5) {
        shouldShow = true;
      }
    } else {
      // Annual recurring prompt: at least 365 days after the previous prompt
      if (daysSinceLastPrompt >= 365) {
        shouldShow = true;
      }
    }

    if (shouldShow && shareBanner) {
      shareBanner.style.display = 'block';
    }
  }

  function dismissPrompt() {
    if (!shareBanner) return;
    shareBanner.style.display = 'none';
    chrome.storage.local.set({
      lastPromptDate: Date.now()
    });
  }

  function handlePromptCompleted() {
    chrome.storage.local.set({
      hasRatedOrShared: true,
      lastPromptDate: Date.now()
    });
    const actions = document.getElementById('shareBannerActions');
    const footer = document.getElementById('shareBannerFooter');
    if (actions) actions.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (shareLinksDrawer) shareLinksDrawer.style.display = 'none';
    if (shareThanksNotice) shareThanksNotice.style.display = 'block';
    setTimeout(() => {
      if (shareBanner) shareBanner.style.display = 'none';
    }, 3500);
  }

  shareRateBtn?.addEventListener('click', () => {
    if (chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: STORE_REVIEWS_URL });
    } else {
      window.open(STORE_REVIEWS_URL, '_blank');
    }
    handlePromptCompleted();
  });

  shareFriendsBtn?.addEventListener('click', () => {
    if (shareLinksDrawer) {
      shareLinksDrawer.style.display = shareLinksDrawer.style.display === 'none' ? 'block' : 'none';
    }
  });

  shareCopyLinkBtn?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(`${SHARE_TEXT}\n${STORE_BASE_URL}`);
      if (shareCopyText) shareCopyText.textContent = 'Copied!';
      setTimeout(() => {
        if (shareCopyText) shareCopyText.textContent = 'Copy Link';
        handlePromptCompleted();
      }, 1000);
    } catch {
      handlePromptCompleted();
    }
  });

  shareEmailBtn?.addEventListener('click', () => {
    const subject = encodeURIComponent('Helpful free Bible study tool: Bible Hover');
    const body = encodeURIComponent(`Hi!\n\nI've been using this free Chrome extension called Bible Hover. Whenever you hover over any Bible verse reference online, it instantly shows the scripture passage and study commentaries with zero delay.\n\nIt's completely free with no ads or tracking:\n${STORE_BASE_URL}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    handlePromptCompleted();
  });

  shareWhatsAppBtn?.addEventListener('click', () => {
    const text = encodeURIComponent(`Check out Bible Hover — free instant scripture & commentary previews in your browser:\n${STORE_BASE_URL}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    handlePromptCompleted();
  });

  shareXBtn?.addEventListener('click', () => {
    const text = encodeURIComponent('Check out Bible Hover — instant 0ms scripture previews and study commentaries in your browser. Free & open source:');
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(STORE_BASE_URL)}`, '_blank');
    handlePromptCompleted();
  });

  shareBannerDismissBtn?.addEventListener('click', dismissPrompt);
  shareRemindLaterBtn?.addEventListener('click', dismissPrompt);

  // Check and display organic share prompt
  checkAndRenderSharePrompt();
  window.checkAndRenderSharePrompt = checkAndRenderSharePrompt;

});
