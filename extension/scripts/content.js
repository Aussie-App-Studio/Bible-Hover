/**
 * Bible Hover — Content Script
 * High-performance non-destructive DOM tagging with TreeWalker & MutationObserver
 * Isolated Shadow DOM Hover Tooltip Card with instant translations, copy, & chapter expansion.
 */

(function () {
  'use strict';

  // Prevent duplicate execution if injected multiple times
  if (window.__BIBLE_HOVER_INITIALIZED__) return;
  window.__BIBLE_HOVER_INITIALIZED__ = true;

  const BibleHoverMeta = (typeof window !== 'undefined' ? window.BibleHoverMeta : null) || globalThis.BibleHoverMeta || {};
  const findReferencesInText = BibleHoverMeta.findReferencesInText || (() => []);
  const TRANSLATIONS = BibleHoverMeta.TRANSLATIONS || {};

  // Configuration state
  let config = {
    enabled: true,
    scanMode: 'auto', // 'auto' | 'selection'
    defaultTranslation: 'BSB',
    detectInlineTranslations: true,
    studyResource: 'biblehub', // 'biblehub' | 'thesingingbible' | 'bible_com' | 'youversion' | 'desiringgod' | 'youtube'
    showTranslationBar: true,
    showSettingsButton: true,
    minimalistMode: false,
    enabledTranslations: ['BSB', 'KJV', 'ESV', 'NIV', 'NLT', 'NASB', 'CSB', 'NKJV', 'WEB'],
    theme: 'auto',
    underlineStyle: 'dotted',
    underlineColor: '#3b82f6',
    fontSize: 'medium',
    scriptureFont: 'sans',
    hoverDelay: 120,
    disabledDomains: [
      'docs.google.com',
      'sheets.google.com',
      'slides.google.com',
      'drive.google.com',
      'github.com',
      'gitlab.com',
      'vscode.dev',
      'codepen.io',
      'codesandbox.io',
      'figma.com',
      'canva.com'
    ],
    commentaryMode: 'direct_link', // 'direct_link' | 'in_card_tab' | 'side_drawer' | 'multi_pills'
    preferredCommentary: 'matthew_henry', // 'matthew_henry' | 'john_calvin' | 'jfb' | 'maclaren' | 'biblehub_all' | 'john_gill' | 'geneva_1599' | 'guzik' | 'tgc' | 'constable' | 'utley'
    multiPillResources: ['commentary', 'guzik', 'tgc', 'constable', 'thesingingbible', 'youtube']
  };

  // State
  let isSiteDisabled = false;
  let detectedRefCount = 0;
  let observer = null;

  // Tooltip controller variables
  let hostEl = null;
  let shadowRoot = null;
  let tooltipEl = null;
  let activeTarget = null;
  let currentRefData = null;
  let currentActiveTranslation = null;
  let showTimer = null;
  let hideTimer = null;
  let isMouseOverTooltip = false;
  let isMouseOverTarget = false;
  let showingFullChapter = false;

  // Commentary state variables
  let currentCardView = 'scripture'; // 'scripture' | 'commentary'
  let cachedCommentaries = null;
  let drawerEl = null;
  let backdropEl = null;
  let isDrawerOpen = false;

  // Tags and classes to completely ignore during DOM scanning
  const IGNORE_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT',
    'CODE', 'PRE', 'KBD', 'SAMP', 'VAR', 'OUTPUT', 'BUTTON',
    'SVG', 'svg', 'MATH', 'math', 'CANVAS', 'IFRAME', 'VIDEO', 'AUDIO'
  ]);

  // Classes for rich-text editors, code editors, and internal UI to skip entire subtrees
  const IGNORE_CLASSES = new Set([
    // Bible Hover internal classes
    'bh-ref', 'bh-preview-card', 'w-preview-box', 'no-bh-scan',
    // Monaco Editor (VS Code Web, GitHub, Cloud Consoles)
    'monaco-editor', 'monaco-diff-editor', 'monaco-mouse-cursor-text', 'view-lines', 'view-line',
    // CodeMirror (v5 & v6)
    'CodeMirror', 'cm-editor', 'cm-content', 'cm-scroller', 'cm-line',
    // Ace Editor
    'ace_editor', 'ace_content', 'ace_text-layer',
    // Google Docs / Sheets / Workspace
    'kix-appview-editor', 'kix-canvas-tile-content', 'kix-page', 'kix-paginateddocumentplugin',
    'docs-editor', 'docs-editor-container', 'waffle-grid-container',
    // Quill & Draft.js
    'ql-editor', 'ql-container', 'DraftEditor-root', 'DraftEditor-editorContainer', 'public-DraftEditor-content',
    // ProseMirror, Tiptap, CKEditor, TinyMCE, Froala
    'ProseMirror', 'ck-editor', 'ck-content', 'mce-content-body', 'tox-edit-area', 'fr-element', 'fr-wrapper',
    // Code blocks & repository diff viewers (GitHub, GitLab, Prism, Highlight.js)
    'blob-code', 'blob-code-inner', 'react-code-text', 'react-code-lines', 'diff-table', 'hljs'
  ]);

  function shouldIgnoreElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    if (IGNORE_TAGS.has(el.nodeName)) return true;
    if (el.isContentEditable) return true;
    if (el.id === 'bible-hover-root' || el.id === 'welcomePreviewCard') return true;

    const cl = el.classList;
    if (cl && cl.length > 0) {
      for (let i = 0; i < cl.length; i++) {
        if (IGNORE_CLASSES.has(cl[i])) return true;
      }
    }

    if (typeof el.getAttribute === 'function') {
      const ce = el.getAttribute('contenteditable');
      if (ce === 'true' || ce === '' || ce === 'plaintext-only') return true;
      const role = el.getAttribute('role');
      if (role === 'textbox' || role === 'code') return true;
      if (el.hasAttribute('data-slate-editor') || el.hasAttribute('data-lexical-editor')) return true;
    }

    return false;
  }

  function hasIgnoredAncestor(el) {
    let cur = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (shouldIgnoreElement(cur)) return true;
      cur = cur.parentElement;
    }
    return false;
  }

  // Check if current hostname is disabled in settings
  function checkSiteDisabled(disabledDomains) {
    if (!Array.isArray(disabledDomains)) return false;
    const host = window.location.hostname.toLowerCase();
    return disabledDomains.some(d => host === d.toLowerCase() || host.endsWith('.' + d.toLowerCase()));
  }

  // Safe message sender to prevent "Extension context invalidated" & unhandled lastError
  function safeSendMessage(msg, callback) {
    if (!chrome.runtime?.id) {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      return;
    }
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        if (chrome.runtime.lastError) {
          // Handled silently to avoid logging "Receiving end does not exist"
          return;
        }
        if (callback) callback(response);
      });
    } catch (e) {
      // Extension context invalidated; detach observer
      if (observer) {
        observer.disconnect();
        observer = null;
      }
    }
  }

  // --- Tooltip & Shadow DOM Construction ---
  function initShadowHost() {
    if (hostEl) return;

    hostEl = document.createElement('div');
    hostEl.id = 'bible-hover-root';
    hostEl.style.cssText = 'position:absolute;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
    
    shadowRoot = hostEl.attachShadow({ mode: 'open' });

    // Inject Tooltip styles into Shadow DOM
    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      * {
        box-sizing: border-box;
      }

      .bh-tooltip {
        position: fixed;
        width: 440px;
        max-width: calc(100vw - 32px);
        max-height: 480px;
        border-radius: 12px;
        box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.22), 0 4px 12px rgba(0, 0, 0, 0.1);
        display: flex;
        flex-direction: column;
        pointer-events: auto;
        opacity: 0;
        transform: translateY(6px) scale(0.98);
        transition: opacity 0.15s ease, transform 0.15s ease;
        visibility: hidden;
        overflow: hidden;
        border: 1px solid rgba(0, 0, 0, 0.1);
        line-height: 1.5;
        font-size: 14px;
      }

      .bh-tooltip.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        visibility: visible;
      }

      /* Themes */
      .bh-tooltip.theme-light {
        background: #ffffff;
        color: #1f2937;
        border-color: #e5e7eb;
      }
      .bh-tooltip.theme-light .bh-header {
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }
      .bh-tooltip.theme-light .bh-footer {
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
      }

      .bh-tooltip.theme-dark {
        background: #18191c;
        color: #e5e7eb;
        border-color: #2e3035;
      }
      .bh-tooltip.theme-dark .bh-header {
        background: #202226;
        border-bottom: 1px solid #2e3035;
      }
      .bh-tooltip.theme-dark .bh-footer {
        background: #202226;
        border-top: 1px solid #2e3035;
      }

      .bh-tooltip.theme-sepia {
        background: #fdf6e2;
        color: #433422;
        border-color: #e6dcbe;
      }
      .bh-tooltip.theme-sepia .bh-header {
        background: #f7edd4;
        border-bottom: 1px solid #e6dcbe;
      }
      .bh-tooltip.theme-sepia .bh-footer {
        background: #f7edd4;
        border-top: 1px solid #e6dcbe;
      }

      /* Font sizes */
      .bh-tooltip.font-small { font-size: 13px; }
      .bh-tooltip.font-small .bh-ref-title { font-size: 14px; }
      .bh-tooltip.font-medium { font-size: 14.5px; }
      .bh-tooltip.font-medium .bh-ref-title { font-size: 15.5px; }
      .bh-tooltip.font-large { font-size: 16px; }
      .bh-tooltip.font-large .bh-ref-title { font-size: 17px; }

      /* Scripture Font Families (affects verse text body, leaving UI chrome clean) */
      .bh-tooltip.font-family-sans .bh-body,
      .bh-drawer.font-family-sans .bh-drawer-scripture {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .bh-tooltip.font-family-serif .bh-body,
      .bh-drawer.font-family-serif .bh-drawer-scripture {
        font-family: Georgia, "Palatino Linotype", "Book Antiqua", Palatino, "Times New Roman", serif;
        line-height: 1.68;
      }
      .bh-tooltip.font-family-garamond .bh-body,
      .bh-drawer.font-family-garamond .bh-drawer-scripture {
        font-family: Garamond, "EB Garamond", "Baskerville", "Baskerville Old Face", "Hoefler Text", "Times New Roman", serif;
        line-height: 1.7;
      }
      .bh-tooltip.font-family-humanist .bh-body,
      .bh-drawer.font-family-humanist .bh-drawer-scripture {
        font-family: "Candara", "Calibri", "Segoe UI", Optima, Arial, sans-serif;
        line-height: 1.65;
      }
      .bh-tooltip.font-family-dyslexic .bh-body,
      .bh-drawer.font-family-dyslexic .bh-drawer-scripture {
        font-family: "OpenDyslexic", "Comic Sans MS", "Comic Sans", "Verdana", sans-serif;
        letter-spacing: 0.04em;
        word-spacing: 0.08em;
        line-height: 1.82;
      }
      .bh-tooltip.font-family-mono .bh-body,
      .bh-drawer.font-family-mono .bh-drawer-scripture {
        font-family: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "Courier New", monospace;
        font-size: 0.93em;
        line-height: 1.6;
      }

      /* Header */
      .bh-header {
        padding: 10px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        user-select: none;
        flex-shrink: 0;
      }
      .bh-title-group {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        overflow: hidden;
      }
      .bh-ref-title {
        font-weight: 700;
        letter-spacing: -0.01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bh-badge {
        font-size: 10.5px;
        font-weight: 600;
        padding: 2px 6px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: #3b82f6;
        color: #ffffff;
      }
      .bh-badge.offline {
        background: #10b981;
      }
      .bh-badge.cached {
        background: #8b5cf6;
      }

      .bh-actions {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .bh-btn {
        background: transparent;
        border: none;
        outline: none;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 500;
        color: inherit;
        text-decoration: none;
        opacity: 0.75;
        transition: opacity 0.15s, background-color 0.15s;
      }
      .bh-btn:hover {
        opacity: 1;
        background-color: rgba(128, 128, 128, 0.15);
      }
      .bh-btn svg {
        width: 14px;
        height: 14px;
        stroke: currentColor;
        stroke-width: 2;
        fill: none;
      }

      /* Settings Button Wrapper & Tooltip */
      .bh-settings-wrapper {
        position: relative;
        display: inline-flex;
        align-items: center;
      }
      .bh-settings-tooltip {
        position: absolute;
        top: calc(100% + 7px);
        right: -4px;
        background: #111827;
        color: #f9fafb;
        padding: 6px 10px;
        border-radius: 7px;
        font-size: 11px;
        line-height: 1.35;
        white-space: nowrap;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-4px);
        transition: opacity 0.15s ease, transform 0.15s ease;
        box-shadow: 0 8px 20px -2px rgba(0, 0, 0, 0.35);
        z-index: 1000;
        text-align: right;
        border: 1px solid rgba(255, 255, 255, 0.15);
      }
      .bh-settings-tooltip-title {
        font-weight: 600;
        font-size: 11.5px;
        color: #ffffff;
      }
      .bh-settings-tooltip-sub {
        font-size: 10px;
        color: #9ca3af;
        margin-top: 1px;
      }
      .bh-settings-tooltip::before {
        content: '';
        position: absolute;
        bottom: 100%;
        right: 10px;
        border-width: 5px;
        border-style: solid;
        border-color: transparent transparent #111827 transparent;
      }
      .bh-settings-wrapper:hover .bh-settings-tooltip {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }
      .bh-tooltip.theme-dark .bh-settings-tooltip {
        background: #1f2227;
        border-color: #374151;
      }
      .bh-tooltip.theme-dark .bh-settings-tooltip::before {
        border-bottom-color: #1f2227;
      }
      .bh-tooltip.theme-sepia .bh-settings-tooltip {
        background: #3c2f1f;
        color: #fdf6e2;
        border-color: #5c4731;
      }
      .bh-tooltip.theme-sepia .bh-settings-tooltip-title {
        color: #fff9ed;
      }
      .bh-tooltip.theme-sepia .bh-settings-tooltip-sub {
        color: #d6c7b0;
      }
      .bh-tooltip.theme-sepia .bh-settings-tooltip::before {
        border-bottom-color: #3c2f1f;
      }

      /* Minimalist Mode (Pure Scripture Only) */
      .bh-tooltip.bh-minimalist {
        width: 390px;
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08);
      }
      .bh-tooltip.bh-minimalist .bh-actions,
      .bh-tooltip.bh-minimalist .bh-badge,
      .bh-tooltip.bh-minimalist .bh-tab-bar,
      .bh-tooltip.bh-minimalist .bh-trans-bar,
      .bh-tooltip.bh-minimalist .bh-comm-bar,
      .bh-tooltip.bh-minimalist .bh-footer {
        display: none !important;
      }
      .bh-tooltip.bh-minimalist .bh-header {
        padding: 9px 14px 2px 14px;
        border-bottom: none;
        background: transparent;
      }
      .bh-tooltip.bh-minimalist .bh-ref-title {
        font-size: 13.5px;
        font-weight: 700;
        opacity: 0.85;
      }
      .bh-tooltip.bh-minimalist .bh-body {
        padding: 4px 14px 14px 14px;
        line-height: 1.6;
        cursor: pointer;
        user-select: text;
      }
      .bh-tooltip.bh-minimalist .bh-verse-item {
        margin-bottom: 6px;
      }

      /* Translation Selector Bar */
      .bh-trans-bar {
        padding: 6px 12px;
        display: flex;
        gap: 5px;
        overflow-x: auto;
        white-space: nowrap;
        scrollbar-width: thin;
        scrollbar-color: rgba(128, 128, 128, 0.3) transparent;
        border-bottom: 1px solid rgba(128, 128, 128, 0.1);
        flex-shrink: 0;
        cursor: grab;
        user-select: none;
        touch-action: pan-x;
        overscroll-behavior-x: contain;
      }
      .bh-trans-bar.bh-grabbing {
        cursor: grabbing !important;
      }
      .bh-trans-bar::-webkit-scrollbar {
        height: 3.5px;
        display: block;
      }
      .bh-trans-bar::-webkit-scrollbar-track {
        background: transparent;
      }
      .bh-trans-bar::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.28);
        border-radius: 4px;
        transition: background 0.15s ease;
      }
      .bh-trans-bar:hover::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.5);
      }
      .bh-trans-pill {
        font-size: 11.5px;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 12px;
        cursor: pointer;
        opacity: 0.65;
        background: rgba(128, 128, 128, 0.1);
        transition: all 0.12s ease;
        user-select: none;
        flex-shrink: 0;
        line-height: 1.2;
      }
      .bh-trans-pill:hover {
        opacity: 1;
        background: rgba(128, 128, 128, 0.2);
      }
      .bh-trans-pill.active {
        opacity: 1;
        background: #3b82f6;
        color: #ffffff;
      }

      /* Body */
      .bh-body {
        padding: 12px 16px;
        overflow-y: auto;
        flex: 1 1 auto;
        min-height: 0;
        overscroll-behavior: contain;
      }
      .bh-body::-webkit-scrollbar {
        width: 6px;
      }
      .bh-body::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.3);
        border-radius: 3px;
      }
      .bh-verse-item {
        margin-bottom: 8px;
      }
      .bh-verse-item:last-child {
        margin-bottom: 0;
      }
      .bh-verse-num {
        font-weight: 700;
        font-size: 0.78em;
        vertical-align: super;
        color: #3b82f6;
        margin-right: 4px;
        user-select: none;
      }
      .bh-verse-item.highlight {
        background: rgba(59, 130, 246, 0.12);
        border-radius: 4px;
        padding: 2px 4px;
      }

      /* Loading / Error */
      .bh-loading {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 24px 0;
        opacity: 0.7;
      }
      .bh-spinner {
        width: 18px;
        height: 18px;
        border: 2px solid rgba(128, 128, 128, 0.3);
        border-top-color: #3b82f6;
        border-radius: 50%;
        animation: bh-spin 0.6s linear infinite;
      }
      @keyframes bh-spin {
        to { transform: rotate(360deg); }
      }
      .bh-error {
        color: #ef4444;
        padding: 16px 0;
        text-align: center;
        font-size: 13px;
      }

      /* Footer */
      .bh-footer {
        padding: 8px 12px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11.5px;
        user-select: none;
        flex-shrink: 0;
        gap: 8px;
        flex-wrap: wrap;
        border-top: 1px solid rgba(0, 0, 0, 0.06);
      }
      .bh-tooltip.theme-dark .bh-footer {
        border-top-color: rgba(255, 255, 255, 0.08);
      }
      .bh-tooltip.theme-sepia .bh-footer {
        border-top-color: rgba(67, 52, 34, 0.08);
      }
      .bh-footer-left {
        opacity: 0.75;
        font-size: 11px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 140px;
      }
      .bh-footer-right {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .bh-link-btn {
        color: #2563eb;
        text-decoration: none;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 500;
        font-size: 11px;
        white-space: nowrap;
        padding: 2.5px 8px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.07);
        transition: all 0.15s ease;
      }
      .bh-link-btn:hover {
        background: rgba(37, 99, 235, 0.1);
        border-color: rgba(37, 99, 235, 0.3);
        text-decoration: none;
      }
      .bh-tooltip.theme-dark .bh-link-btn,
      .bh-drawer.theme-dark .bh-link-btn {
        color: #93c5fd;
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.12);
      }
      .bh-tooltip.theme-dark .bh-link-btn:hover,
      .bh-drawer.theme-dark .bh-link-btn:hover {
        background: rgba(59, 130, 246, 0.2);
        border-color: rgba(59, 130, 246, 0.4);
      }
      .bh-tooltip.theme-sepia .bh-link-btn,
      .bh-drawer.theme-sepia .bh-link-btn {
        color: #92400e;
        background: rgba(120, 53, 15, 0.06);
        border-color: rgba(120, 53, 15, 0.12);
      }
      .bh-tooltip.theme-sepia .bh-link-btn:hover,
      .bh-drawer.theme-sepia .bh-link-btn:hover {
        background: rgba(120, 53, 15, 0.12);
        border-color: rgba(120, 53, 15, 0.25);
      }

      /* Mode 2: Card Header View Switcher Tabs */
      .bh-tab-bar {
        display: none;
        background: rgba(0, 0, 0, 0.06);
        border-radius: 6px;
        padding: 2px;
        gap: 2px;
        margin-left: 8px;
        flex-shrink: 0;
      }
      .bh-tooltip.theme-dark .bh-tab-bar {
        background: rgba(255, 255, 255, 0.1);
      }
      .bh-tab-btn {
        background: transparent;
        border: none;
        font-size: 11px;
        font-weight: 500;
        padding: 2px 7px;
        border-radius: 4px;
        cursor: pointer;
        color: inherit;
        opacity: 0.7;
        transition: all 0.12s ease;
      }
      .bh-tab-btn:hover {
        opacity: 1;
      }
      .bh-tab-btn.active {
        background: #ffffff;
        color: #1f2937;
        opacity: 1;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .bh-tooltip.theme-dark .bh-tab-btn.active {
        background: #374151;
        color: #f9fafb;
      }
      .bh-tooltip.theme-sepia .bh-tab-btn.active {
        background: #fffdf8;
        color: #433422;
      }

      /* Commentator Filter Pill Bar (Mode 2 & 3) */
      .bh-comm-bar {
        display: none;
        overflow-x: auto;
        white-space: nowrap;
        gap: 6px;
        padding: 6px 12px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.07);
        scrollbar-width: thin;
        scrollbar-color: rgba(128, 128, 128, 0.3) transparent;
        flex-shrink: 0;
        align-items: center;
        cursor: grab;
        user-select: none;
        touch-action: pan-x;
        overscroll-behavior-x: contain;
      }
      .bh-comm-bar.bh-grabbing {
        cursor: grabbing !important;
      }
      .bh-comm-bar::-webkit-scrollbar {
        height: 3.5px;
        display: block;
      }
      .bh-comm-bar::-webkit-scrollbar-track {
        background: transparent;
      }
      .bh-comm-bar::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.28);
        border-radius: 4px;
        transition: background 0.15s ease;
      }
      .bh-comm-bar:hover::-webkit-scrollbar-thumb {
        background: rgba(128, 128, 128, 0.5);
      }
      .bh-comm-pill {
        font-size: 11px;
        font-weight: 500;
        padding: 3px 9px;
        border-radius: 12px;
        background: rgba(0, 0, 0, 0.04);
        border: 1px solid rgba(0, 0, 0, 0.08);
        cursor: pointer;
        color: inherit;
        flex-shrink: 0;
        transition: all 0.15s ease;
      }
      .bh-comm-pill:hover {
        background: rgba(0, 0, 0, 0.08);
      }
      .bh-comm-pill.active {
        background: #2563eb;
        color: #ffffff;
        border-color: #2563eb;
        box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
      }
      .bh-tooltip.theme-dark .bh-comm-pill,
      .bh-drawer.theme-dark .bh-comm-pill {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.12);
      }
      .bh-tooltip.theme-dark .bh-comm-pill:hover,
      .bh-drawer.theme-dark .bh-comm-pill:hover {
        background: rgba(255, 255, 255, 0.14);
      }
      .bh-tooltip.theme-dark .bh-comm-pill.active,
      .bh-drawer.theme-dark .bh-comm-pill.active {
        background: #3b82f6;
        color: #ffffff;
        border-color: #3b82f6;
      }
      .bh-tooltip.theme-sepia .bh-comm-pill,
      .bh-drawer.theme-sepia .bh-comm-pill {
        background: rgba(120, 53, 15, 0.06);
        border-color: rgba(120, 53, 15, 0.12);
      }
      .bh-tooltip.theme-sepia .bh-comm-pill:hover,
      .bh-drawer.theme-sepia .bh-comm-pill:hover {
        background: rgba(120, 53, 15, 0.1);
      }
      .bh-tooltip.theme-sepia .bh-comm-pill.active,
      .bh-drawer.theme-sepia .bh-comm-pill.active {
        background: #92400e;
        color: #ffffff;
        border-color: #92400e;
      }

      /* Scrollbar Theme Accents */
      .bh-tooltip.theme-dark .bh-trans-bar,
      .bh-tooltip.theme-dark .bh-comm-bar,
      .bh-drawer.theme-dark .bh-comm-bar {
        scrollbar-color: rgba(255, 255, 255, 0.22) transparent;
      }
      .bh-tooltip.theme-dark .bh-trans-bar::-webkit-scrollbar-thumb,
      .bh-tooltip.theme-dark .bh-comm-bar::-webkit-scrollbar-thumb,
      .bh-drawer.theme-dark .bh-comm-bar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
      }
      .bh-tooltip.theme-dark .bh-trans-bar:hover::-webkit-scrollbar-thumb,
      .bh-tooltip.theme-dark .bh-comm-bar:hover::-webkit-scrollbar-thumb,
      .bh-drawer.theme-dark .bh-comm-bar:hover::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.42);
      }

      .bh-tooltip.theme-sepia .bh-trans-bar,
      .bh-tooltip.theme-sepia .bh-comm-bar,
      .bh-drawer.theme-sepia .bh-comm-bar {
        scrollbar-color: rgba(120, 53, 15, 0.22) transparent;
      }
      .bh-tooltip.theme-sepia .bh-trans-bar::-webkit-scrollbar-thumb,
      .bh-tooltip.theme-sepia .bh-comm-bar::-webkit-scrollbar-thumb,
      .bh-drawer.theme-sepia .bh-comm-bar::-webkit-scrollbar-thumb {
        background: rgba(120, 53, 15, 0.2);
      }
      .bh-tooltip.theme-sepia .bh-trans-bar:hover::-webkit-scrollbar-thumb,
      .bh-tooltip.theme-sepia .bh-comm-bar:hover::-webkit-scrollbar-thumb,
      .bh-drawer.theme-sepia .bh-comm-bar:hover::-webkit-scrollbar-thumb {
        background: rgba(120, 53, 15, 0.42);
      }

      /* Commentary Content Blocks */
      .bh-comm-item {
        margin-bottom: 12px;
        padding: 10px 14px;
        background: rgba(0, 0, 0, 0.02);
        border: 1px solid rgba(0, 0, 0, 0.06);
        border-radius: 8px;
        transition: background 0.15s ease;
      }
      .bh-tooltip.theme-dark .bh-comm-item,
      .bh-drawer.theme-dark .bh-comm-item {
        background: rgba(255, 255, 255, 0.03);
        border-color: rgba(255, 255, 255, 0.07);
      }
      .bh-tooltip.theme-sepia .bh-comm-item,
      .bh-drawer.theme-sepia .bh-comm-item {
        background: rgba(67, 52, 34, 0.03);
        border-color: rgba(67, 52, 34, 0.08);
      }
      .bh-comm-author {
        font-size: 12.5px;
        font-weight: 700;
        margin-bottom: 6px;
        color: #1e40af;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .bh-tooltip.theme-dark .bh-comm-author,
      .bh-drawer.theme-dark .bh-comm-author { color: #93c5fd; }
      .bh-tooltip.theme-sepia .bh-comm-author,
      .bh-drawer.theme-sepia .bh-comm-author { color: #92400e; }
      .bh-comm-text {
        font-size: 13.5px;
        line-height: 1.65;
        white-space: pre-line;
      }

      /* Mode 3: Side Study Drawer Backdrop & Drawer */
      .bh-drawer-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.35);
        backdrop-filter: blur(2px);
        z-index: 2147483646;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      }
      .bh-drawer-backdrop.open {
        opacity: 1;
        pointer-events: auto;
      }
      .bh-drawer {
        position: fixed;
        top: 0;
        right: 0;
        width: 520px;
        max-width: 92vw;
        height: 100vh;
        box-shadow: -8px 0 32px rgba(0, 0, 0, 0.28);
        z-index: 2147483647;
        display: flex;
        flex-direction: column;
        transform: translateX(105%);
        transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: auto;
        border-left: 1px solid rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        line-height: 1.55;
      }
      .bh-drawer.open {
        transform: translateX(0);
      }
      .bh-drawer.theme-light {
        background: #ffffff;
        color: #1f2937;
      }
      .bh-drawer.theme-dark {
        background: #18191c;
        color: #e5e7eb;
        border-left-color: #2e3035;
      }
      .bh-drawer.theme-sepia {
        background: #fdf6e2;
        color: #433422;
        border-left-color: #e6dcbe;
      }
      .bh-drawer-header {
        padding: 12px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        flex-shrink: 0;
      }
      .bh-drawer.theme-light .bh-drawer-header { background: #f9fafb; }
      .bh-drawer.theme-dark .bh-drawer-header { background: #202226; }
      .bh-drawer.theme-sepia .bh-drawer-header { background: #f7edd4; }
      .bh-drawer-title-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .bh-drawer-title {
        font-size: 16px;
        font-weight: 700;
      }
      .bh-drawer-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .bh-drawer-scripture {
        margin: 12px 18px 6px;
        padding: 12px 14px;
        background: rgba(0, 0, 0, 0.03);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 8px;
        font-size: 13.5px;
        line-height: 1.6;
        max-height: 140px;
        overflow-y: auto;
        flex-shrink: 0;
        scrollbar-width: thin;
      }
      .bh-drawer.theme-dark .bh-drawer-scripture {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.08);
      }
      .bh-drawer.theme-sepia .bh-drawer-scripture {
        background: rgba(67, 52, 34, 0.04);
        border-color: rgba(67, 52, 34, 0.08);
      }
      .bh-drawer-body {
        padding: 14px 18px;
        overflow-y: auto;
        flex: 1;
        scrollbar-width: thin;
      }

      /* Drawer Navigation Tabs */
      .bh-drawer-nav {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 18px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
        overflow-x: auto;
        scrollbar-width: thin;
        flex-shrink: 0;
      }
      .bh-drawer.theme-dark .bh-drawer-nav {
        border-bottom-color: rgba(255, 255, 255, 0.08);
      }
      .bh-drawer.theme-sepia .bh-drawer-nav {
        border-bottom-color: rgba(67, 52, 34, 0.08);
      }
      .bh-drawer-tab {
        background: none;
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 14px;
        padding: 4px 10px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        color: inherit;
        opacity: 0.78;
        transition: all 0.15s ease;
      }
      .bh-drawer-tab:hover {
        opacity: 1;
        border-color: #3b82f6;
        color: #2563eb;
      }
      .bh-drawer-tab.active {
        opacity: 1;
        background: #3b82f6;
        color: #ffffff;
        border-color: #3b82f6;
        box-shadow: 0 1px 4px rgba(59, 130, 246, 0.3);
      }
      .bh-drawer.theme-dark .bh-drawer-tab {
        border-color: rgba(255, 255, 255, 0.15);
      }
      .bh-drawer.theme-dark .bh-drawer-tab.active {
        background: #3b82f6;
        color: #ffffff;
      }
      .bh-drawer.theme-sepia .bh-drawer-tab.active {
        background: #92400e;
        border-color: #92400e;
        color: #ffffff;
      }

      /* Drawer Commentary Cards */
      .bh-drawer-source-card {
        padding: 18px;
        border-radius: 10px;
        background: rgba(0, 0, 0, 0.02);
        border: 1px solid rgba(0, 0, 0, 0.08);
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .bh-drawer.theme-dark .bh-drawer-source-card {
        background: rgba(255, 255, 255, 0.03);
        border-color: rgba(255, 255, 255, 0.08);
      }
      .bh-drawer.theme-sepia .bh-drawer-source-card {
        background: rgba(67, 52, 34, 0.03);
        border-color: rgba(67, 52, 34, 0.08);
      }
      .bh-source-header {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .bh-source-badge {
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #3b82f6;
      }
      .bh-drawer.theme-dark .bh-source-badge { color: #60a5fa; }
      .bh-drawer.theme-sepia .bh-source-badge { color: #b45309; }
      .bh-source-title {
        font-size: 16px;
        font-weight: 700;
        margin: 0;
        line-height: 1.35;
      }
      .bh-source-desc {
        font-size: 13.5px;
        line-height: 1.6;
        margin: 0;
        opacity: 0.88;
      }
      .bh-source-meta {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px;
        border-radius: 6px;
        background: rgba(0, 0, 0, 0.03);
        font-size: 12.5px;
      }
      .bh-drawer.theme-dark .bh-source-meta {
        background: rgba(255, 255, 255, 0.04);
      }
      .bh-drawer.theme-sepia .bh-source-meta {
        background: rgba(67, 52, 34, 0.04);
      }
      .bh-source-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 6px;
      }
      .bh-source-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 600;
        text-decoration: none;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .bh-source-btn.primary {
        background: #3b82f6;
        color: #ffffff;
        border: 1px solid #3b82f6;
      }
      .bh-source-btn.primary:hover {
        background: #2563eb;
        border-color: #2563eb;
      }
      .bh-source-btn.secondary {
        background: transparent;
        color: inherit;
        border: 1px solid rgba(0, 0, 0, 0.18);
      }
      .bh-drawer.theme-dark .bh-source-btn.secondary {
        border-color: rgba(255, 255, 255, 0.2);
      }
      .bh-source-btn.secondary:hover {
        background: rgba(0, 0, 0, 0.05);
      }
      .bh-drawer.theme-dark .bh-source-btn.secondary:hover {
        background: rgba(255, 255, 255, 0.08);
      }

      /* In-Card Rating Prompt Overlay */
      .bh-rate-overlay {
        position: absolute;
        inset: 0;
        z-index: 60;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        backdrop-filter: blur(8px);
        animation: bhFadeIn 0.2s ease-out;
      }
      .bh-tooltip.theme-light .bh-rate-overlay {
        background: rgba(255, 255, 255, 0.95);
        color: #0f172a;
      }
      .bh-tooltip.theme-dark .bh-rate-overlay {
        background: rgba(20, 22, 28, 0.96);
        color: #f8fafc;
      }
      .bh-tooltip.theme-sepia .bh-rate-overlay {
        background: rgba(253, 246, 226, 0.96);
        color: #433422;
      }
      .bh-rate-card {
        position: relative;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        width: 100%;
        max-width: 360px;
      }
      .bh-rate-close {
        position: absolute;
        top: -12px;
        right: -8px;
        background: transparent;
        border: none;
        font-size: 16px;
        cursor: pointer;
        color: inherit;
        opacity: 0.55;
        padding: 4px;
        transition: opacity 0.15s ease;
      }
      .bh-rate-close:hover {
        opacity: 1;
      }
      .bh-rate-stars {
        font-size: 20px;
        letter-spacing: 2px;
        user-select: none;
      }
      .bh-rate-title {
        font-size: 15px;
        font-weight: 700;
        line-height: 1.3;
      }
      .bh-rate-msg {
        font-size: 12px;
        line-height: 1.55;
        opacity: 0.88;
        font-style: italic;
      }
      .bh-rate-actions {
        display: flex;
        flex-direction: column;
        gap: 7px;
        width: 100%;
        margin-top: 4px;
      }
      .bh-rate-btn-primary {
        background: #2563eb;
        color: #ffffff !important;
        font-weight: 700;
        padding: 8px 14px;
        border-radius: 8px;
        text-decoration: none;
        font-size: 12.5px;
        box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
        transition: all 0.15s ease;
        display: block;
        text-align: center;
      }
      .bh-rate-btn-primary:hover {
        background: #1d4ed8;
        transform: translateY(-1px);
      }
      .bh-rate-btn-secondary {
        background: transparent;
        border: 1px solid rgba(125, 125, 125, 0.3);
        color: inherit;
        font-size: 11.5px;
        font-weight: 600;
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background-color 0.15s ease;
      }
      .bh-rate-btn-secondary:hover {
        background: rgba(125, 125, 125, 0.12);
      }
    `;

    shadowRoot.appendChild(style);

    // Build Tooltip DOM
    tooltipEl = document.createElement('div');
    tooltipEl.className = 'bh-tooltip';
    tooltipEl.innerHTML = `
      <div class="bh-rate-overlay" id="bhRateOverlay" style="display: none;">
        <div class="bh-rate-card">
          <button class="bh-rate-close" id="bhRateCloseBtn" title="Close & continue to scripture">✕</button>
          <div class="bh-rate-stars">⭐⭐⭐⭐⭐</div>
          <div class="bh-rate-title">Help Others Discover Bible Hover</div>
          <div class="bh-rate-msg">
            “If this app is helpful to you and you think it will be helpful to others, please rate it on the extension store. Google heavily weights reviews when deciding how much to highlight or hide extensions, and it would be nice for many people to benefit from the work.”
          </div>
          <div class="bh-rate-actions">
            <a class="bh-rate-btn-primary" id="bhRateStoreBtn" target="_blank" rel="noopener noreferrer">⭐ Rate on Extension Store ↗</a>
            <button class="bh-rate-btn-secondary" id="bhRateLaterBtn">Continue to Scripture →</button>
          </div>
        </div>
      </div>
      <div class="bh-header">
        <div class="bh-title-group">
          <span class="bh-ref-title">Reference</span>
          <span class="bh-badge" id="bhBadge">BSB</span>
          <div class="bh-tab-bar" id="bhTabBar">
            <button class="bh-tab-btn active" id="bhTabScripture">Scripture</button>
            <button class="bh-tab-btn" id="bhTabCommentary">Commentary</button>
          </div>
        </div>
        <div class="bh-actions">
          <button class="bh-btn" id="bhCopyBtn" title="Copy verse text">
            <svg viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg>
            <span id="bhCopyText" style="margin-left:4px;">Copy</span>
          </button>
          <div class="bh-settings-wrapper" id="bhSettingsWrapper">
            <button class="bh-btn" id="bhSettingsBtn" aria-label="Bible Hover Settings" title="Bible Hover Settings">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
              </svg>
            </button>
            <div class="bh-settings-tooltip">
              <div class="bh-settings-tooltip-title">Settings & Customization</div>
              <div class="bh-settings-tooltip-sub">Tip: Can be hidden in Settings</div>
            </div>
          </div>
          <button class="bh-btn" id="bhCloseBtn" title="Close">
            <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="bh-trans-bar" id="bhTransBar"></div>
      <div class="bh-comm-bar" id="bhCommBar"></div>
      <div class="bh-body" id="bhBody"></div>
      <div class="bh-footer">
        <div class="bh-footer-left" id="bhFooterLeft"></div>
        <div class="bh-footer-right" id="bhFooterRight">
          <span class="bh-link-btn" id="bhChapterToggle">Full Chapter</span>
          <a class="bh-link-btn" id="bhExternalLink" target="_blank" rel="noopener noreferrer">Study ↗</a>
        </div>
      </div>
    `;

    shadowRoot.appendChild(tooltipEl);

    // Build Study Drawer Backdrop & Drawer (Mode 3)
    backdropEl = document.createElement('div');
    backdropEl.className = 'bh-drawer-backdrop';
    backdropEl.id = 'bhDrawerBackdrop';
    backdropEl.addEventListener('click', closeStudyDrawer);
    shadowRoot.appendChild(backdropEl);

    drawerEl = document.createElement('div');
    drawerEl.className = 'bh-drawer';
    drawerEl.id = 'bhStudyDrawer';
    drawerEl.innerHTML = `
      <div class="bh-drawer-header">
        <div class="bh-drawer-title-group">
          <span class="bh-drawer-title" id="bhDrawerTitle">Scripture Study Notes</span>
          <span class="bh-badge" id="bhDrawerBadge">Study Drawer</span>
        </div>
        <div class="bh-drawer-actions">
          <div class="bh-settings-wrapper" id="bhDrawerSettingsWrapper">
            <button class="bh-btn bh-btn-icon" id="bhDrawerSettingsBtn" aria-label="Bible Hover Settings" title="Bible Hover Settings">
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"></path>
              </svg>
            </button>
            <div class="bh-settings-tooltip">
              <div class="bh-settings-tooltip-title">Settings & Customization</div>
              <div class="bh-settings-tooltip-sub">Tip: Can be hidden in Settings</div>
            </div>
          </div>
          <a class="bh-btn" id="bhDrawerFeedbackBtn" href="https://docs.google.com/forms/d/e/1FAIpQLSfgsw6-DU97aqOTvIyiBVZMiO3Xv8VrK_0QkT09ZIGhU6D2Sw/viewform" target="_blank" rel="noopener noreferrer" title="Feedback / Report Issue">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
          </a>
          <button class="bh-btn" id="bhDrawerCloseBtn" title="Close Drawer (Esc)">
            <svg viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>
      <div class="bh-drawer-scripture" id="bhDrawerScripture"></div>
      <div class="bh-drawer-nav" id="bhDrawerNav">
        <button class="bh-drawer-tab active" data-tab="classical">💬 Classical (BibleHub)</button>
        <button class="bh-drawer-tab" data-tab="guzik">✝️ Guzik (Enduring Word)</button>
        <button class="bh-drawer-tab" data-tab="tgc">🏛 TGC</button>
        <button class="bh-drawer-tab" data-tab="constable">📚 Constable (DTS)</button>
        <button class="bh-drawer-tab" data-tab="utley">🌐 Utley (FBC)</button>
      </div>
      <div class="bh-comm-bar" id="bhDrawerCommBar" style="display:flex;"></div>
      <div class="bh-drawer-body" id="bhDrawerBody"></div>
    `;
    shadowRoot.appendChild(drawerEl);

    document.body.appendChild(hostEl);

    setupHorizontalScrollable(shadowRoot.getElementById('bhTransBar'));
    setupHorizontalScrollable(shadowRoot.getElementById('bhCommBar'));
    setupHorizontalScrollable(shadowRoot.getElementById('bhDrawerNav'));
    setupHorizontalScrollable(shadowRoot.getElementById('bhDrawerCommBar'));

    // Event listeners on tooltip
    tooltipEl.addEventListener('mouseenter', () => {
      isMouseOverTooltip = true;
      clearTimeout(hideTimer);
    });

    tooltipEl.addEventListener('mouseleave', () => {
      isMouseOverTooltip = false;
      scheduleHideTooltip();
    });

    const closeBtn = shadowRoot.getElementById('bhCloseBtn');
    closeBtn.addEventListener('click', () => hideTooltip(true));

    // Rating & Review in-card overlay listeners
    const rateOverlay = shadowRoot.getElementById('bhRateOverlay');
    const rateStoreBtn = shadowRoot.getElementById('bhRateStoreBtn');
    const rateCloseBtn = shadowRoot.getElementById('bhRateCloseBtn');
    const rateLaterBtn = shadowRoot.getElementById('bhRateLaterBtn');
    const STORE_REVIEW_URL = `https://chromewebstore.google.com/detail/bible-hover/${chrome.runtime?.id || 'makhkcghaglcfnicpkckpbimlmhobcop'}/reviews`;

    if (rateStoreBtn) {
      rateStoreBtn.href = STORE_REVIEW_URL;
      rateStoreBtn.addEventListener('click', () => {
        chrome.storage.local.set({ hasRatedOrShared: true });
        if (rateOverlay) rateOverlay.style.display = 'none';
      });
    }

    const dismissRatePrompt = () => {
      chrome.storage.local.set({ lastPromptDate: Date.now() });
      if (rateOverlay) rateOverlay.style.display = 'none';
    };

    rateCloseBtn?.addEventListener('click', dismissRatePrompt);
    rateLaterBtn?.addEventListener('click', dismissRatePrompt);

    const copyBtn = shadowRoot.getElementById('bhCopyBtn');
    copyBtn.addEventListener('click', handleCopyVerse);

    const chapterToggle = shadowRoot.getElementById('bhChapterToggle');
    chapterToggle.addEventListener('click', handleToggleFullChapter);

    // Click anywhere on card body to copy in Minimalist Mode
    const bodyEl = shadowRoot.getElementById('bhBody');
    bodyEl?.addEventListener('click', () => {
      if (config.minimalistMode && !window.getSelection()?.toString().trim()) {
        handleCopyVerse();
      }
    });

    // Mode 2 Card Header Tabs
    const tabScripture = shadowRoot.getElementById('bhTabScripture');
    const tabCommentary = shadowRoot.getElementById('bhTabCommentary');

    tabScripture?.addEventListener('click', () => {
      if (currentCardView === 'scripture') return;
      currentCardView = 'scripture';
      tabScripture.classList.add('active');
      tabCommentary.classList.remove('active');
      shadowRoot.getElementById('bhCommBar').style.display = 'none';
      renderTranslationBar();
      if (resCachedPassage) {
        updateCardFooterActions(resCachedPassage);
        renderScriptureVerses(resCachedPassage);
      } else {
        loadPassageContent(currentRefData, currentActiveTranslation, showingFullChapter);
      }
    });

    tabCommentary?.addEventListener('click', () => {
      if (currentCardView === 'commentary') return;
      currentCardView = 'commentary';
      tabCommentary.classList.add('active');
      tabScripture.classList.remove('active');
      shadowRoot.getElementById('bhTransBar').style.display = 'none';
      shadowRoot.getElementById('bhCommBar').style.display = 'flex';
      if (resCachedPassage) {
        updateCardFooterActions(resCachedPassage);
      }
      loadCardCommentary(resCachedPassage || currentRefData);
    });

    // Mode 3 Drawer Close
    const drawerCloseBtn = shadowRoot.getElementById('bhDrawerCloseBtn');
    drawerCloseBtn?.addEventListener('click', closeStudyDrawer);

    // Settings Button Handlers (Opens Options Dashboard)
    const bhSettingsBtn = shadowRoot.getElementById('bhSettingsBtn');
    bhSettingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      safeSendMessage({ type: 'OPEN_OPTIONS' });
    });

    const bhDrawerSettingsBtn = shadowRoot.getElementById('bhDrawerSettingsBtn');
    bhDrawerSettingsBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      safeSendMessage({ type: 'OPEN_OPTIONS' });
    });

    updateSettingsButtonVisibility();
  }

  // Update visibility of the in-card settings buttons based on user preference
  function updateSettingsButtonVisibility() {
    const wrapper = shadowRoot?.getElementById('bhSettingsWrapper');
    if (wrapper) {
      wrapper.style.display = (config.showSettingsButton !== false && !config.minimalistMode) ? 'inline-flex' : 'none';
    }
    const drawerWrapper = shadowRoot?.getElementById('bhDrawerSettingsWrapper');
    if (drawerWrapper) {
      drawerWrapper.style.display = (config.showSettingsButton !== false) ? 'inline-flex' : 'none';
    }
  }

  // Determine current active theme
  function resolveTheme() {
    if (config.theme === 'auto') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return config.theme;
  }

  // Position tooltip relative to hovered element
  function positionTooltip(target) {
    if (!tooltipEl || !target) return;

    const rect = target.getBoundingClientRect();
    const ttWidth = tooltipEl.offsetWidth || 440;
    const ttHeight = tooltipEl.offsetHeight || 260;
    const padding = 12;

    // Default: Below the reference
    let top = rect.bottom + 8;
    let left = rect.left;

    // Flip above if running off bottom of screen
    if (top + ttHeight > window.innerHeight - padding) {
      const topAbove = rect.top - ttHeight - 8;
      if (topAbove >= padding) {
        top = topAbove;
      }
    }

    // Clamp horizontally within viewport
    if (left + ttWidth > window.innerWidth - padding) {
      left = window.innerWidth - ttWidth - padding;
    }
    if (left < padding) {
      left = padding;
    }

    tooltipEl.style.top = `${Math.round(top)}px`;
    tooltipEl.style.left = `${Math.round(left)}px`;
  }

  // Set up smooth mousewheel and grab-and-drag scrolling on horizontal pill bars
  function setupHorizontalScrollable(containerEl) {
    if (!containerEl || containerEl._hScrollActive) return;
    containerEl._hScrollActive = true;

    // 1. Mouse wheel translation (vertical wheel up/down scrolls horizontally)
    containerEl.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          containerEl.scrollLeft += e.deltaY * 0.9;
        }
      } else if (e.deltaX !== 0) {
        e.preventDefault();
        containerEl.scrollLeft += e.deltaX;
      }
    }, { passive: false });

    // 2. Click & drag (grab-to-scroll)
    let isDown = false;
    let startX = 0;
    let scrollStart = 0;
    let hasDragged = false;

    containerEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only primary mouse button
      isDown = true;
      hasDragged = false;
      startX = e.clientX;
      scrollStart = containerEl.scrollLeft;
      containerEl.classList.add('bh-grabbing');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) {
        hasDragged = true;
      }
      containerEl.scrollLeft = scrollStart - dx;
    });

    const stopDrag = () => {
      if (isDown) {
        isDown = false;
        containerEl.classList.remove('bh-grabbing');
        setTimeout(() => {
          hasDragged = false;
        }, 60);
      }
    };

    window.addEventListener('mouseup', stopDrag);

    // Suppress click event on pills if mouse was dragged
    containerEl.addEventListener('click', (e) => {
      if (hasDragged) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  // Populate translation pill selector bar
  function renderTranslationBar() {
    const bar = shadowRoot.getElementById('bhTransBar');
    if (!bar) return;
    setupHorizontalScrollable(bar);

    // If translation switcher bar is turned off by user, or only 1 or 0 translations enabled, hide the bar!
    let enabledList = Array.isArray(config.enabledTranslations) && config.enabledTranslations.length > 0
      ? [...config.enabledTranslations]
      : ['BSB', 'KJV', 'ESV', 'NIV', 'NLT', 'NASB', 'CSB', 'NKJV', 'WEB'];

    if (currentActiveTranslation && !enabledList.includes(currentActiveTranslation)) {
      enabledList.push(currentActiveTranslation);
    }

    if (config.minimalistMode || !config.showTranslationBar || enabledList.length <= 1) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    bar.innerHTML = '';

    for (const t of enabledList) {
      const pill = document.createElement('span');
      pill.className = `bh-trans-pill ${t === currentActiveTranslation ? 'active' : ''}`;
      pill.textContent = t;
      pill.title = TRANSLATIONS[t]?.name || t;
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (t !== currentActiveTranslation) {
          currentActiveTranslation = t;
          renderTranslationBar();
          loadPassageContent(currentRefData, currentActiveTranslation, showingFullChapter);
        }
      });
      bar.appendChild(pill);
      if (t === currentActiveTranslation) {
        requestAnimationFrame(() => {
          pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
      }
    }
  }

  // Fetch verse passage data via background worker
  function loadPassageContent(parsedRef, translation, includeFullChapter = false) {
    const body = shadowRoot.getElementById('bhBody');
    const badge = shadowRoot.getElementById('bhBadge');
    const footerLeft = shadowRoot.getElementById('bhFooterLeft');

    body.innerHTML = `
      <div class="bh-loading">
        <div class="bh-spinner"></div>
        <span>Loading Scripture...</span>
      </div>
    `;

    safeSendMessage({
      type: 'GET_PASSAGE',
      parsedRef,
      translation,
      includeFullChapter
    }, (res) => {
      if (!res || !res.ok) {
        body.innerHTML = `<div class="bh-error">${res?.error || 'Failed to load reference.'}</div>`;
        return;
      }

      // Update badge & footer
      badge.textContent = res.translation;
      badge.className = `bh-badge ${res.source}`;
      footerLeft.textContent = res.translationName || res.translation;

      // Cache passage result
      resCachedPassage = res;

      // Update footer actions according to chosen Commentary Mode (Options 1, 2, 3, or 4)
      updateCardFooterActions(res);

      // Render verses if in scripture view
      if (currentCardView === 'scripture') {
        renderScriptureVerses(res);
      } else {
        loadCardCommentary(res);
      }

      // Re-position tooltip if height changed
      if (activeTarget) {
        positionTooltip(activeTarget);
      }
    });
  }

  // Render scripture verses into #bhBody
  function renderScriptureVerses(res) {
    const body = shadowRoot.getElementById('bhBody');
    if (!body || !res) return;
    body.innerHTML = '';
    const firstCh = res.primaryChapter || 1;

    if (showingFullChapter && res.fullChapterVerses) {
      const highlightedVerses = new Set();
      for (const seg of res.segments) {
        if (seg.chapter === firstCh && !seg.isWholeChapter) {
          for (let v = seg.verseStart; v <= seg.verseEnd; v++) {
            highlightedVerses.add(v);
          }
        }
      }

      let firstHighlightEl = null;
      for (const vObj of res.fullChapterVerses) {
        const div = document.createElement('div');
        const isHL = highlightedVerses.has(vObj.verse);
        div.className = `bh-verse-item ${isHL ? 'highlight' : ''}`;
        div.innerHTML = `<span class="bh-verse-num">${vObj.verse}</span> ${escapeHtml(vObj.text)}`;
        body.appendChild(div);
        if (isHL && !firstHighlightEl) firstHighlightEl = div;
      }

      if (firstHighlightEl) {
        requestAnimationFrame(() => {
          const topOffset = firstHighlightEl.offsetTop - body.offsetTop;
          body.scrollTop = Math.max(0, topOffset - 40);
        });
      }
    } else {
      for (const seg of res.segments) {
        for (const vObj of seg.verses) {
          const div = document.createElement('div');
          div.className = 'bh-verse-item';
          div.innerHTML = `<span class="bh-verse-num">${vObj.verse}</span> ${escapeHtml(vObj.text)}`;
          body.appendChild(div);
        }
      }
    }
  }

  // Update card footer actions based on chosen commentary mode
  function updateCardFooterActions(res) {
    const footerRight = shadowRoot.getElementById('bhFooterRight');
    const footerLeft = shadowRoot.getElementById('bhFooterLeft');
    if (!footerRight || !res) return;

    footerRight.innerHTML = '';

    const mode = config.commentaryMode || 'direct_link';
    const commLink = getCommentaryLink(res, config.preferredCommentary || 'biblehub_all');
    const studyLink = generateStudyResourceLink(res, config.studyResource || 'biblehub');
    const isPassageWholeChapter = !!(res.segments && res.segments.length === 1 && res.segments[0].isWholeChapter);

    if (mode === 'direct_link') {
      // Option 1: Direct Link to Commentary + Study Link
      if (footerLeft && res.translation) {
        footerLeft.textContent = res.translationName || res.translation;
      }

      if (!isPassageWholeChapter) {
        const chapterToggle = document.createElement('span');
        chapterToggle.className = 'bh-link-btn';
        chapterToggle.id = 'bhChapterToggle';
        chapterToggle.textContent = showingFullChapter ? 'Verses Only' : 'Full Chapter';
        chapterToggle.addEventListener('click', handleToggleFullChapter);
        footerRight.appendChild(chapterToggle);
      }

      const cA = document.createElement('a');
      cA.className = 'bh-link-btn';
      cA.href = commLink.url;
      cA.target = '_blank';
      cA.rel = 'noopener noreferrer';
      cA.innerHTML = `${commLink.label} ↗`;
      cA.title = `Read commentary on ${commLink.label}`;
      footerRight.appendChild(cA);

      const sA = document.createElement('a');
      sA.className = 'bh-link-btn';
      sA.href = studyLink.url;
      sA.target = '_blank';
      sA.rel = 'noopener noreferrer';
      sA.innerHTML = `${studyLink.label} ↗`;
      sA.title = `Study on ${studyLink.label}`;
      footerRight.appendChild(sA);

    } else if (mode === 'in_card_tab') {
      // Option 2: In-Card Tab Switcher (Scripture <-> Commentary in header)
      if (footerLeft && res.translation) {
        footerLeft.textContent = currentCardView === 'commentary' ? 'Notes' : (res.translationName || res.translation);
      }

      if (currentCardView === 'commentary') {
        const bA = document.createElement('a');
        bA.className = 'bh-link-btn';
        bA.href = commLink.url;
        bA.target = '_blank';
        bA.rel = 'noopener noreferrer';
        bA.innerHTML = `💬 BibleHub ↗`;
        bA.title = 'Open all commentary notes on BibleHub';
        footerRight.appendChild(bA);

        const tgcLink = getCommentaryLink(res, 'tgc');
        const tA = document.createElement('a');
        tA.className = 'bh-link-btn';
        tA.href = tgcLink.url;
        tA.target = '_blank';
        tA.rel = 'noopener noreferrer';
        tA.innerHTML = `🏛 TGC ↗`;
        tA.title = 'Open commentary on The Gospel Coalition';
        footerRight.appendChild(tA);

        const backBtn = document.createElement('span');
        backBtn.className = 'bh-link-btn';
        backBtn.innerHTML = `← Scripture`;
        backBtn.title = 'Return to scripture text';
        backBtn.addEventListener('click', () => {
          shadowRoot.getElementById('bhTabScripture')?.click();
        });
        footerRight.appendChild(backBtn);
      } else {
        if (!isPassageWholeChapter) {
          const chapterToggle = document.createElement('span');
          chapterToggle.className = 'bh-link-btn';
          chapterToggle.id = 'bhChapterToggle';
          chapterToggle.textContent = showingFullChapter ? 'Verses Only' : 'Full Chapter';
          chapterToggle.addEventListener('click', handleToggleFullChapter);
          footerRight.appendChild(chapterToggle);
        }

        const sA = document.createElement('a');
        sA.className = 'bh-link-btn';
        sA.href = studyLink.url;
        sA.target = '_blank';
        sA.rel = 'noopener noreferrer';
        sA.innerHTML = `${studyLink.label} ↗`;
        sA.title = `Study on ${studyLink.label}`;
        footerRight.appendChild(sA);
      }

    } else if (mode === 'side_drawer') {
      // Option 3: Side Study Drawer Button
      if (footerLeft && res.translation) {
        footerLeft.textContent = res.translationName || res.translation;
      }

      if (!isPassageWholeChapter) {
        const chapterToggle = document.createElement('span');
        chapterToggle.className = 'bh-link-btn';
        chapterToggle.id = 'bhChapterToggle';
        chapterToggle.textContent = showingFullChapter ? 'Verses Only' : 'Full Chapter';
        chapterToggle.addEventListener('click', handleToggleFullChapter);
        footerRight.appendChild(chapterToggle);
      }

      const drawerBtn = document.createElement('span');
      drawerBtn.className = 'bh-link-btn';
      drawerBtn.innerHTML = `📖 Study Drawer`;
      drawerBtn.title = 'Open full-height study side drawer';
      drawerBtn.addEventListener('click', () => {
        openStudyDrawer(res);
      });
      footerRight.appendChild(drawerBtn);

      const sA = document.createElement('a');
      sA.className = 'bh-link-btn';
      sA.href = studyLink.url;
      sA.target = '_blank';
      sA.rel = 'noopener noreferrer';
      sA.innerHTML = `${studyLink.label} ↗`;
      sA.title = `Study on ${studyLink.label}`;
      footerRight.appendChild(sA);

    } else if (mode === 'multi_pills') {
      // Option 4: Multi-Resource Action Pills in Footer
      const pillKeys = Array.isArray(config.multiPillResources) && config.multiPillResources.length > 0
        ? config.multiPillResources
        : ['commentary', 'tgc', 'thesingingbible', 'youtube'];

      // When 4 or more pills, clear footerLeft so pills have maximum horizontal breathing room
      if (footerLeft) {
        footerLeft.textContent = pillKeys.length >= 4 ? '' : (res.translation || '');
      }

      if (!isPassageWholeChapter) {
        const chapterToggle = document.createElement('span');
        chapterToggle.className = 'bh-link-btn';
        chapterToggle.id = 'bhChapterToggle';
        chapterToggle.textContent = showingFullChapter ? 'Verses' : 'Full Ch.';
        chapterToggle.addEventListener('click', handleToggleFullChapter);
        footerRight.appendChild(chapterToggle);
      }

      for (const pKey of pillKeys) {
        const info = getResourcePillInfo(res, pKey);
        if (info) {
          const pA = document.createElement('a');
          pA.className = 'bh-link-btn';
          pA.href = info.url;
          pA.target = '_blank';
          pA.rel = 'noopener noreferrer';
          pA.innerHTML = `${info.label} ↗`;
          footerRight.appendChild(pA);
        }
      }
    }
  }

  // Get commentary URL based on chosen commentator
  function getCommentaryLink(passageRes, pref) {
    const bookNameUrl = (passageRes.bookName || '').toLowerCase().replace(/\s+/g, '_');
    const firstCh = passageRes.primaryChapter || 1;
    const firstV = passageRes.segments?.[0]?.verseStart || 1;
    const tgcSlug = (passageRes.bookName || '')
      .toLowerCase()
      .replace(/song of songs/i, 'song-of-solomon')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    switch (pref) {
      case 'matthew_henry':
        return {
          label: '💬 Matthew Henry',
          url: `https://biblehub.com/commentaries/mhc/${bookNameUrl}/${firstCh}.htm`
        };
      case 'john_calvin':
        return {
          label: '💬 John Calvin',
          url: `https://biblehub.com/commentaries/calvin/${bookNameUrl}/${firstCh}.htm`
        };
      case 'jfb':
        return {
          label: '💬 JFB Commentary',
          url: `https://biblehub.com/commentaries/jfb/${bookNameUrl}/${firstCh}.htm`
        };
      case 'maclaren':
        return {
          label: '💬 Alexander MacLaren',
          url: `https://biblehub.com/commentaries/maclaren/${bookNameUrl}/${firstCh}.htm`
        };
      case 'john_gill':
        return {
          label: '💬 John Gill',
          url: `https://biblehub.com/commentaries/gill/${bookNameUrl}/${firstCh}.htm`
        };
      case 'geneva_1599':
        return {
          label: '💬 Geneva 1599',
          url: `https://biblehub.com/commentaries/gsb/${bookNameUrl}/${firstCh}.htm`
        };
      case 'tgc':
        return {
          label: '🏛 TGC Commentary',
          url: `https://www.thegospelcoalition.org/commentary/${tgcSlug}/`
        };
      case 'guzik': {
        let bName = (passageRes.bookName || '').toLowerCase().trim();
        if (bName === 'psalms') bName = 'psalm';
        if (bName.includes('song of')) bName = 'song-of-solomon';
        const slug = bName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return {
          label: '✝️ Guzik (Enduring Word)',
          shortLabel: '✝️ Guzik',
          url: `https://enduringword.com/bible-commentary/${slug}-${firstCh}/`
        };
      }
      case 'constable': {
        const bName = encodeURIComponent(passageRes.bookName || 'Genesis');
        return {
          label: "📚 Constable's Notes (NetBible)",
          shortLabel: '📚 Constable',
          url: `https://netbible.org/bible/${bName}+${firstCh}`
        };
      }
      case 'utley': {
        const bName = passageRes.bookName || '';
        return {
          label: '🌐 Utley (Free Bible)',
          shortLabel: '🌐 Utley',
          url: `https://www.google.com/search?q=site:freebiblecommentary.org+${encodeURIComponent(bName + ' ' + firstCh)}`
        };
      }
      case 'biblehub_all':
      default:
        return {
          label: '💬 Commentaries',
          url: `https://biblehub.com/commentaries/${bookNameUrl}/${firstCh}-${firstV}.htm`
        };
    }
  }

  // Get info for multi-action pills (Option 4)
  function getResourcePillInfo(passageRes, pillKey) {
    const bookNameUrl = (passageRes.bookName || '').toLowerCase().replace(/\s+/g, '_');
    const firstCh = passageRes.primaryChapter || 1;
    const firstV = passageRes.segments?.[0]?.verseStart || 1;
    const cleanLabel = (passageRes.canonicalLabel || '').replace(/[–—]/g, '-');
    const canonical = encodeURIComponent(cleanLabel);
    const tgcSlug = (passageRes.bookName || '')
      .toLowerCase()
      .replace(/song of songs/i, 'song-of-solomon')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    switch (pillKey) {
      case 'commentary':
        return {
          label: '💬 Commentaries',
          url: `https://biblehub.com/commentaries/${bookNameUrl}/${firstCh}-${firstV}.htm`
        };
      case 'tgc':
        return {
          label: '🏛 TGC',
          url: `https://www.thegospelcoalition.org/commentary/${tgcSlug}/`
        };
      case 'guzik': {
        let bName = (passageRes.bookName || '').toLowerCase().trim();
        if (bName === 'psalms') bName = 'psalm';
        if (bName.includes('song of')) bName = 'song-of-solomon';
        const slug = bName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        return {
          label: '✝️ Guzik',
          url: `https://enduringword.com/bible-commentary/${slug}-${firstCh}/`
        };
      }
      case 'constable': {
        const bName = encodeURIComponent(passageRes.bookName || 'Genesis');
        return {
          label: '📚 Constable',
          url: `https://netbible.org/bible/${bName}+${firstCh}`
        };
      }
      case 'utley': {
        const bName = passageRes.bookName || '';
        return {
          label: '🌐 Utley',
          url: `https://www.google.com/search?q=site:freebiblecommentary.org+${encodeURIComponent(bName + ' ' + firstCh)}`
        };
      }
      case 'thesingingbible': {
        const bookSlug = (passageRes.bookName || '')
          .toLowerCase()
          .replace(/song of songs/i, 'song of solomon')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const bookNumStr = String(passageRes.bookId || 1).padStart(2, '0');
        return {
          label: '🎵 TheSinging.Bible',
          url: `https://thesinging.bible/#sbe/male/adult/country/${bookNumStr}-${bookSlug}/${firstCh}`
        };
      }
      case 'youtube':
        return {
          label: '📺 YouTube',
          url: `https://www.youtube.com/results?search_query=${canonical}+sermon`
        };
      case 'bible_com':
        return {
          label: '📖 Bible.com',
          url: `https://www.bible.com/search/bible?q=${canonical}`
        };
      default:
        return null;
    }
  }

  // Load commentary notes into in-card view (Option 2)
  function loadCardCommentary(passageRes) {
    if (!passageRes) return;
    const body = shadowRoot.getElementById('bhBody');
    const commBar = shadowRoot.getElementById('bhCommBar');

    body.innerHTML = `
      <div class="bh-loading">
        <div class="bh-spinner"></div>
        <span>Loading Commentary Notes...</span>
      </div>
    `;

    const firstV = passageRes.segments?.[0]?.verseStart || 1;
    safeSendMessage({
      type: 'GET_COMMENTARY',
      bookId: passageRes.bookId,
      chapter: passageRes.primaryChapter,
      verseStart: firstV
    }, (cRes) => {
      if (currentCardView !== 'commentary') return;

      if (!cRes || !cRes.ok || !Array.isArray(cRes.commentaries) || cRes.commentaries.length === 0) {
        const commLink = getCommentaryLink(passageRes, 'biblehub_all');
        body.innerHTML = `<div class="bh-error">No commentary notes found in quick view. <a href="${commLink.url}" target="_blank" style="color:#3b82f6;">Search on BibleHub ↗</a></div>`;
        return;
      }

      cachedCommentaries = cRes.commentaries;
      buildCommentatorChips(cachedCommentaries, commBar, (authorKey) => {
        renderCommentaryItems(cachedCommentaries, authorKey, body);
      });
      renderCommentaryItems(cachedCommentaries, 'all', body);

      if (activeTarget) {
        positionTooltip(activeTarget);
      }
    });
  }

  // Build filter pills for commentators
  function buildCommentatorChips(commentaries, containerEl, onSelect) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    setupHorizontalScrollable(containerEl);
    if (!commentaries || commentaries.length === 0) return;

    const seen = new Set();
    const authors = [{ key: 'all', label: 'All' }];
    for (const c of commentaries) {
      if (!seen.has(c.key)) {
        seen.add(c.key);
        let short = c.title
          .replace(/['’]s Commentary.*|'s Concise.*|'s Notes.*|'s Exposition.*| Commentary.*| Notes.*/gi, '')
          .trim();
        if (c.key === 'matthew_henry') short = 'Matthew Henry';
        if (c.key === 'john_calvin') short = 'John Calvin';
        if (c.key === 'jfb') short = 'JFB';
        if (c.key === 'maclaren') short = 'MacLaren';
        authors.push({ key: c.key, label: short });
      }
    }

    // Subtly promote Matthew Henry and John Calvin to appear first after 'All'
    authors.sort((a, b) => {
      if (a.key === 'all') return -1;
      if (b.key === 'all') return 1;
      const rank = (k) => (k === 'matthew_henry' ? 1 : k === 'john_calvin' ? 2 : 3);
      return rank(a.key) - rank(b.key);
    });

    let activeKey = 'all';
    authors.forEach(a => {
      const pill = document.createElement('span');
      pill.className = `bh-comm-pill ${a.key === activeKey ? 'active' : ''}`;
      pill.textContent = a.label;
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        containerEl.querySelectorAll('.bh-comm-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeKey = a.key;
        onSelect(a.key);
        pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
      containerEl.appendChild(pill);
      if (a.key === activeKey) {
        requestAnimationFrame(() => {
          pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
      }
    });
  }

  // Render commentary items into target container
  function renderCommentaryItems(commentaries, filterKey, targetEl) {
    if (!targetEl) return;
    targetEl.innerHTML = '';
    const filtered = filterKey === 'all' ? commentaries : commentaries.filter(c => c.key === filterKey);
    if (filtered.length === 0) {
      targetEl.innerHTML = '<div class="bh-error">No commentary notes for this author.</div>';
      return;
    }
    for (const item of filtered) {
      const block = document.createElement('div');
      block.className = 'bh-comm-item';
      block.innerHTML = `
        <div class="bh-comm-author">📖 ${escapeHtml(item.title)}</div>
        <div class="bh-comm-text">${escapeHtml(item.text)}</div>
      `;
      targetEl.appendChild(block);
    }
  }

  // Open side study drawer (Option 3 & Approach 2 Multi-Source Tabs)
  let activeDrawerTab = 'classical';
  let cachedDrawerCommentaries = null;

  function openStudyDrawer(passageRes) {
    if (!drawerEl || !passageRes) return;
    hideTooltip(true); // Close floating tooltip so screen is clean!
    const theme = resolveTheme();
    const fontFam = `font-family-${config.scriptureFont || 'sans'}`;
    drawerEl.className = `bh-drawer theme-${theme} ${fontFam} open`;
    if (backdropEl) backdropEl.classList.add('open');
    isDrawerOpen = true;

    drawerEl.querySelector('#bhDrawerTitle').textContent = `${passageRes.canonicalLabel} • Study Notes`;

    // Scripture passage preview
    const scrEl = drawerEl.querySelector('#bhDrawerScripture');
    const versesHtml = passageRes.segments.flatMap(s => s.verses.map(v => `<b>${v.verse}</b> ${escapeHtml(v.text)}`)).join(' ');
    scrEl.innerHTML = `<strong>${passageRes.canonicalLabel} (${passageRes.translation}):</strong><br>${versesHtml}`;

    const bodyEl = drawerEl.querySelector('#bhDrawerBody');
    const commBarEl = drawerEl.querySelector('#bhDrawerCommBar');
    const navEl = drawerEl.querySelector('#bhDrawerNav');

    const firstCh = passageRes.primaryChapter || 1;
    const firstV = passageRes.segments?.[0]?.verseStart || 1;

    // Direct resource links
    const commLink = getCommentaryLink(passageRes, 'biblehub_all');
    const guzikLink = getCommentaryLink(passageRes, 'guzik');
    const tgcLink = getCommentaryLink(passageRes, 'tgc');
    const constableLink = getCommentaryLink(passageRes, 'constable');
    const utleyLink = getCommentaryLink(passageRes, 'utley');

    cachedDrawerCommentaries = null;

    function renderActiveTab(tabKey) {
      activeDrawerTab = tabKey;

      // Update active state in nav buttons
      navEl.querySelectorAll('.bh-drawer-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabKey);
      });

      if (tabKey === 'classical') {
        commBarEl.style.display = 'flex';
        if (cachedDrawerCommentaries) {
          buildCommentatorChips(cachedDrawerCommentaries, commBarEl, (authorKey) => {
            renderCommentaryItems(cachedDrawerCommentaries, authorKey, bodyEl);
          });
          renderCommentaryItems(cachedDrawerCommentaries, 'all', bodyEl);
        } else {
          bodyEl.innerHTML = `
            <div class="bh-loading">
              <div class="bh-spinner"></div>
              <span>Loading Classical Commentary Notes...</span>
            </div>
          `;
          safeSendMessage({
            type: 'GET_COMMENTARY',
            bookId: passageRes.bookId,
            chapter: firstCh,
            verseStart: firstV
          }, (cRes) => {
            if (activeDrawerTab !== 'classical') return;
            if (!cRes || !cRes.ok || !Array.isArray(cRes.commentaries) || cRes.commentaries.length === 0) {
              bodyEl.innerHTML = `<div class="bh-error">No quick commentary notes found for this verse. <a href="${commLink.url}" target="_blank" style="color:#3b82f6;">Search all notes on BibleHub ↗</a></div>`;
              return;
            }
            cachedDrawerCommentaries = cRes.commentaries;
            buildCommentatorChips(cachedDrawerCommentaries, commBarEl, (authorKey) => {
              renderCommentaryItems(cachedDrawerCommentaries, authorKey, bodyEl);
            });
            renderCommentaryItems(cachedDrawerCommentaries, 'all', bodyEl);
          });
        }
      } else if (tabKey === 'guzik') {
        commBarEl.style.display = 'none';
        bodyEl.innerHTML = `
          <div class="bh-drawer-source-card">
            <div class="bh-source-header">
              <span class="bh-source-badge">Pastor David Guzik • Enduring Word</span>
              <h3 class="bh-source-title">Enduring Word Bible Commentary</h3>
            </div>
            <p class="bh-source-desc">
              David Guzik's verse-by-verse commentary covers the entire Bible with clear, accessible, Christ-centered pastoral exposition. Used by millions of pastors, missionaries, and teachers worldwide, completely free without paywalls.
            </p>
            <div class="bh-source-meta">
              <span class="bh-meta-item">📖 Target Passage: <strong>${passageRes.canonicalLabel}</strong></span>
              <span class="bh-meta-item">🏷 Expository Unit: <strong>${passageRes.bookName} Chapter ${firstCh}</strong></span>
            </div>
            <div class="bh-source-actions">
              <a class="bh-source-btn primary" href="${guzikLink.url}" target="_blank" rel="noopener noreferrer">
                Open ${passageRes.canonicalLabel} on Enduring Word ↗
              </a>
              <a class="bh-source-btn secondary" href="https://enduringword.com/" target="_blank" rel="noopener noreferrer">
                EnduringWord.com Home ↗
              </a>
            </div>
          </div>
        `;
      } else if (tabKey === 'tgc') {
        commBarEl.style.display = 'none';
        bodyEl.innerHTML = `
          <div class="bh-drawer-source-card">
            <div class="bh-source-header">
              <span class="bh-source-badge">The Gospel Coalition • TGCBC</span>
              <h3 class="bh-source-title">The Gospel Coalition Bible Commentary</h3>
            </div>
            <p class="bh-source-desc">
              Written by contemporary evangelical scholars and pastors (edited by D.A. Carson), the TGC Bible Commentary provides accessible, robust theological analysis, historical context, and pastoral application for each biblical book.
            </p>
            <div class="bh-source-meta">
              <span class="bh-meta-item">📖 Target Passage: <strong>${passageRes.canonicalLabel}</strong></span>
              <span class="bh-meta-item">🏛 Scholarly Volume: <strong>${passageRes.bookName} Exposition</strong></span>
            </div>
            <div class="bh-source-actions">
              <a class="bh-source-btn primary" href="${tgcLink.url}" target="_blank" rel="noopener noreferrer">
                Open ${passageRes.bookName} on The Gospel Coalition ↗
              </a>
            </div>
          </div>
        `;
      } else if (tabKey === 'constable') {
        commBarEl.style.display = 'none';
        bodyEl.innerHTML = `
          <div class="bh-drawer-source-card">
            <div class="bh-source-header">
              <span class="bh-source-badge">Dr. Thomas L. Constable • Dallas Theological Seminary</span>
              <h3 class="bh-source-title">Constable's Expository Notes</h3>
            </div>
            <p class="bh-source-desc">
              Having taught at DTS for 45 years, Dr. Constable wrote massive, verse-by-verse exegetical commentaries on all 66 books of the Bible (totaling over 10,000 pages). Released 100% free online without publisher paywalls via Sonic Light and NET Bible.
            </p>
            <div class="bh-source-meta">
              <span class="bh-meta-item">📖 Target Passage: <strong>${passageRes.canonicalLabel}</strong></span>
              <span class="bh-meta-item">📚 Study Panels: <strong>Integrated in NET Bible & Sonic Light</strong></span>
            </div>
            <div class="bh-source-actions">
              <a class="bh-source-btn primary" href="${constableLink.url}" target="_blank" rel="noopener noreferrer">
                Read with Constable Notes on NetBible ↗
              </a>
              <a class="bh-source-btn secondary" href="https://soniclight.com/constable-notes-pdf/" target="_blank" rel="noopener noreferrer">
                Sonic Light Notes & PDFs ↗
              </a>
            </div>
          </div>
        `;
      } else if (tabKey === 'utley') {
        commBarEl.style.display = 'none';
        bodyEl.innerHTML = `
          <div class="bh-drawer-source-card">
            <div class="bh-source-header">
              <span class="bh-source-badge">Dr. Bob Utley • Free Bible Commentary</span>
              <h3 class="bh-source-title">Free Bible Commentary Study Guides</h3>
            </div>
            <p class="bh-source-desc">
              Retired Baptist seminary professor of hermeneutics Dr. Bob Utley put his entire 32-volume verse-by-verse exegetical commentary series online for missionaries and global pastors. Emphasizes original language word studies, textual issues, and historical context. Translated into over 40 languages.
            </p>
            <div class="bh-source-meta">
              <span class="bh-meta-item">📖 Target Passage: <strong>${passageRes.canonicalLabel}</strong></span>
              <span class="bh-meta-item">🌐 Global Access: <strong>Translated into 40+ Languages</strong></span>
            </div>
            <div class="bh-source-actions">
              <a class="bh-source-btn primary" href="${utleyLink.url}" target="_blank" rel="noopener noreferrer">
                Search ${passageRes.canonicalLabel} on FreeBibleCommentary ↗
              </a>
              <a class="bh-source-btn secondary" href="https://www.freebiblecommentary.org/" target="_blank" rel="noopener noreferrer">
                FreeBibleCommentary.org (40+ Languages) ↗
              </a>
            </div>
          </div>
        `;
      }
    }

    // Connect tab click events
    navEl.querySelectorAll('.bh-drawer-tab').forEach(btn => {
      btn.onclick = () => renderActiveTab(btn.dataset.tab);
    });

    // Default to user's preferred commentary tab if applicable, otherwise classical
    const preferredTab = ['guzik', 'tgc', 'constable', 'utley'].includes(config.preferredCommentary)
      ? config.preferredCommentary
      : 'classical';
    renderActiveTab(preferredTab);
  }

  // Close side study drawer
  function closeStudyDrawer() {
    if (!drawerEl) return;
    drawerEl.classList.remove('open');
    if (backdropEl) backdropEl.classList.remove('open');
    isDrawerOpen = false;
  }

  // Generate external study link according to user preference
  function generateStudyResourceLink(passageRes, resourceKey) {
    const bookNameUrl = passageRes.bookName.toLowerCase().replace(/\s+/g, '_');
    const firstCh = passageRes.primaryChapter || 1;
    const cleanLabel = (passageRes.canonicalLabel || '').replace(/[–—]/g, '-');
    const canonical = encodeURIComponent(cleanLabel);

    switch (resourceKey) {
      case 'thesingingbible':
      case 'singingbible': {
        const bookSlug = (passageRes.bookName || '')
          .toLowerCase()
          .replace(/song of songs/i, 'song of solomon')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const bookNumStr = String(passageRes.bookId || 1).padStart(2, '0');
        return {
          label: '🎵 TheSinging.Bible',
          url: `https://thesinging.bible/#sbe/male/adult/country/${bookNumStr}-${bookSlug}/${firstCh}`
        };
      }
      case 'bible_com': {
        return {
          label: '📖 Bible.com',
          url: `https://www.bible.com/search/bible?q=${canonical}`
        };
      }
      case 'youversion': {
        return {
          label: '📖 YouVersion',
          url: `https://www.bible.com/search/bible?q=${canonical}`
        };
      }
      case 'desiringgod': {
        return {
          label: '🕊 DesiringGod',
          url: `https://www.desiringgod.org/search/results?utf8=%E2%9C%93&q=${canonical}`
        };
      }
      case 'youtube': {
        return {
          label: '📺 YouTube',
          url: `https://www.youtube.com/results?search_query=${canonical}+sermon`
        };
      }
      case 'biblehub':
      default: {
        return {
          label: '📖 BibleHub',
          url: `https://biblehub.com/${bookNameUrl}/${firstCh}.htm`
        };
      }
    }
  }

  let resCachedPassage = null;

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Handle Copy Verse button
  function handleCopyVerse() {
    if (!resCachedPassage) return;

    let textToCopy = '';
    if (showingFullChapter && resCachedPassage.fullChapterVerses) {
      textToCopy = resCachedPassage.fullChapterVerses.map(v => `${v.verse} ${v.text}`).join('\n');
      textToCopy += `\n— ${resCachedPassage.bookName} ${resCachedPassage.primaryChapter} (${resCachedPassage.translation})`;
    } else {
      const parts = [];
      for (const seg of resCachedPassage.segments) {
        for (const v of seg.verses) {
          parts.push(`${v.verse} ${v.text}`);
        }
      }
      textToCopy = parts.join(' ');
      textToCopy += `\n— ${resCachedPassage.canonicalLabel} (${resCachedPassage.translation})`;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      const copyText = shadowRoot.getElementById('bhCopyText');
      if (copyText) {
        const orig = copyText.textContent;
        copyText.textContent = 'Copied!';
        setTimeout(() => { copyText.textContent = orig; }, 1500);
      }
      const titleEl = shadowRoot.querySelector('.bh-ref-title');
      if (titleEl && config.minimalistMode) {
        const origTitle = titleEl.textContent;
        titleEl.textContent = `${origTitle} • Copied!`;
        setTimeout(() => { titleEl.textContent = origTitle; }, 1400);
      }
    });
  }

  function handleToggleFullChapter() {
    showingFullChapter = !showingFullChapter;
    loadPassageContent(currentRefData, currentActiveTranslation, showingFullChapter);
  }

  // Show tooltip for an active tagged element
  function showTooltipFor(target, parsedRef) {
    initShadowHost();

    activeTarget = target;
    currentRefData = parsedRef;
    showingFullChapter = false;
    currentCardView = 'scripture';

    // In-card tabs reset
    const tabBar = shadowRoot.getElementById('bhTabBar');
    const commBar = shadowRoot.getElementById('bhCommBar');
    const tabScripture = shadowRoot.getElementById('bhTabScripture');
    const tabCommentary = shadowRoot.getElementById('bhTabCommentary');

    if (tabBar) {
      tabBar.style.display = config.commentaryMode === 'in_card_tab' ? 'inline-flex' : 'none';
    }
    if (commBar) {
      commBar.style.display = 'none';
    }
    tabScripture?.classList.add('active');
    tabCommentary?.classList.remove('active');

    // Use cited translation if present and auto-detection is enabled; otherwise user's default
    const allowInline = config.detectInlineTranslations !== false;
    currentActiveTranslation = (allowInline && parsedRef.translation)
      ? parsedRef.translation
      : (config.defaultTranslation || 'BSB');

    // Apply active theme & font size classes
    const theme = resolveTheme();
    const minClass = config.minimalistMode ? 'bh-minimalist' : '';
    const fontFam = `font-family-${config.scriptureFont || 'sans'}`;
    tooltipEl.className = `bh-tooltip theme-${theme} font-${config.fontSize} ${fontFam} ${minClass}`.trim();
    updateSettingsButtonVisibility();

    // Set title
    const titleEl = shadowRoot.querySelector('.bh-ref-title');
    titleEl.textContent = parsedRef.canonicalLabel;

    // Render pills & load passage
    renderTranslationBar();
    loadPassageContent(parsedRef, currentActiveTranslation, false);

    // If study drawer is currently open, update drawer for hovered reference
    if (isDrawerOpen) {
      openStudyDrawer(parsedRef);
    }

    // Check if in-card rating prompt should appear after a couple of uses
    checkInCardRatingPrompt();

    // Initial positioning & show
    tooltipEl.classList.add('visible');
    positionTooltip(target);
  }

  function checkInCardRatingPrompt() {
    const rateOverlay = shadowRoot?.getElementById('bhRateOverlay');
    if (!rateOverlay) return;

    try {
      chrome.storage.local.get(['verseHoverCount', 'hasRatedOrShared', 'lastPromptDate'], (data) => {
        if (!data || data.hasRatedOrShared) {
          rateOverlay.style.display = 'none';
          return;
        }

        const count = data.verseHoverCount || 0;
        const now = Date.now();
        const lastPrompt = data.lastPromptDate || 0;
        const daysSinceLastPrompt = (now - lastPrompt) / (1000 * 60 * 60 * 24);

        // Trigger after the extension has been used a couple of times (>= 5 hovers), snoozed for 7 days
        if (count >= 5 && daysSinceLastPrompt >= 7) {
          rateOverlay.style.display = 'flex';
        } else {
          rateOverlay.style.display = 'none';
        }
      });
    } catch {
      rateOverlay.style.display = 'none';
    }
  }

  // Developer / test trigger for testing the in-card rating overlay
  window.addEventListener('message', (e) => {
    if (e.data === 'BH_TEST_SHOW_RATE_OVERLAY') {
      const rateOverlay = shadowRoot?.getElementById('bhRateOverlay');
      if (rateOverlay) rateOverlay.style.display = 'flex';
    }
  });

  function scheduleHideTooltip() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!isMouseOverTooltip && !isMouseOverTarget) {
        hideTooltip();
      }
    }, 200);
  }

  function hideTooltip(immediate = false) {
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    if (!tooltipEl) return;

    if (immediate) {
      tooltipEl.classList.remove('visible');
      activeTarget = null;
    } else {
      tooltipEl.classList.remove('visible');
      activeTarget = null;
    }
  }

  // --- Dynamic Style Generator for Tagged Verses ---
  let dynamicStyleEl = null;
  function updateDynamicUnderlineStyles() {
    if (!dynamicStyleEl) {
      dynamicStyleEl = document.createElement('style');
      dynamicStyleEl.id = 'bible-hover-dynamic-style';
      document.head.appendChild(dynamicStyleEl);
    }

    let decoration = 'none';
    let background = 'transparent';

    switch (config.underlineStyle) {
      case 'dotted':
        decoration = `underline dotted ${config.underlineColor}`;
        break;
      case 'dashed':
        decoration = `underline dashed ${config.underlineColor}`;
        break;
      case 'solid':
        decoration = `underline solid ${config.underlineColor}`;
        break;
      case 'highlight':
        background = `${config.underlineColor}22`; // 13% opacity
        decoration = `underline solid ${config.underlineColor}`;
        break;
      case 'none':
      default:
        decoration = 'none';
        break;
    }

    dynamicStyleEl.textContent = `
      .bh-ref {
        text-decoration: ${decoration} !important;
        text-decoration-skip-ink: none !important;
        text-underline-offset: 3px !important;
        background-color: ${background} !important;
        cursor: pointer !important;
        border-radius: 2px !important;
        transition: background-color 0.15s ease !important;
      }
      .bh-ref:hover {
        background-color: ${config.underlineColor}33 !important;
      }
    `;
  }

  // --- Event Delegation for Tagged Verses ---
  let delegatedBody = null;
  function setupHoverDelegation() {
    if (!document.body || delegatedBody === document.body) return;
    delegatedBody = document.body;

    document.body.addEventListener('mouseover', (e) => {
      if (!config.enabled || isSiteDisabled) return;
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      const span = target.classList?.contains('bh-ref') ? target : target.closest('.bh-ref');
      if (!span) return;
      if (e.relatedTarget && span.contains(e.relatedTarget)) return;

      let parsed = span._bhParsedRef;
      if (!parsed && span.dataset.bhRef) {
        try {
          parsed = JSON.parse(span.dataset.bhRef);
          span._bhParsedRef = parsed;
        } catch {
          return;
        }
      }
      if (!parsed) return;

      isMouseOverTarget = true;
      clearTimeout(hideTimer);
      clearTimeout(showTimer);
      showTimer = setTimeout(() => {
        showTooltipFor(span, parsed);
      }, config.hoverDelay);
    });

    document.body.addEventListener('mouseout', (e) => {
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      const span = target.classList?.contains('bh-ref') ? target : target.closest('.bh-ref');
      if (!span) return;
      if (e.relatedTarget && span.contains(e.relatedTarget)) return;

      isMouseOverTarget = false;
      clearTimeout(showTimer);
      scheduleHideTooltip();
    });
  }

  // Fast pre-filter: requires at least 2 letters + optional period + whitespace + 1-3 digit chapter/verse number.
  // Preserves whole chapters ("Romans 6", "Gal 3") while skipping prices, timestamps, 4-digit years, and bare numbers.
  const QUICK_REF_PREFILTER_REGEX = /\p{L}{2}\.?\s+\d{1,3}(?!\d)/u;

  // --- Safe DOM Text Node Tagging ---
  function tagTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || text.length < 4 || !QUICK_REF_PREFILTER_REGEX.test(text)) return;

    const matches = findReferencesInText(text);
    if (matches.length === 0) return;

    const parent = textNode.parentNode;
    if (!parent) return;

    // Fragment to hold replaced text + spans
    const frag = document.createDocumentFragment();
    let lastIdx = 0;

    for (const m of matches) {
      // Text before match
      if (m.startIndex > lastIdx) {
        frag.appendChild(document.createTextNode(text.substring(lastIdx, m.startIndex)));
      }

      // Create tagged span (hover events handled via delegation on document.body)
      const span = document.createElement('span');
      span.className = 'bh-ref';
      span.textContent = text.substring(m.startIndex, m.endIndex);
      span.dataset.bhRef = JSON.stringify(m.parsed);
      span._bhParsedRef = m.parsed;

      frag.appendChild(span);
      detectedRefCount++;
      lastIdx = m.endIndex;
    }

    // Remaining text
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.substring(lastIdx)));
    }

    parent.replaceChild(frag, textNode);
  }

  // Efficient TreeWalker over element subtrees (prunes ignored branches via FILTER_REJECT)
  function scanElement(rootElement, skipBadgeUpdate = false) {
    if (!rootElement || !config.enabled || isSiteDisabled) return;
    if (rootElement.nodeType === Node.ELEMENT_NODE && hasIgnoredAncestor(rootElement)) return;

    setupHoverDelegation();

    const walker = document.createTreeWalker(
      rootElement,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            return shouldIgnoreElement(node)
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_SKIP;
          }
          const text = node.nodeValue;
          if (!text || text.length < 4 || !QUICK_REF_PREFILTER_REGEX.test(text)) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodesToProcess = [];
    while (walker.nextNode()) {
      nodesToProcess.push(walker.currentNode);
    }

    for (const node of nodesToProcess) {
      tagTextNode(node);
    }

    // Update extension badge with detected count
    if (!skipBadgeUpdate && detectedRefCount > 0) {
      safeSendMessage({
        type: 'SET_BADGE_COUNT',
        count: detectedRefCount
      });
    }
  }

  // Idle task scheduler with fallback for browsers without requestIdleCallback
  const scheduleIdleTask = typeof window.requestIdleCallback === 'function'
    ? (cb) => window.requestIdleCallback(cb, { timeout: 500 })
    : (cb) => window.setTimeout(() => {
        const start = performance.now();
        cb({
          didTimeout: false,
          timeRemaining: () => Math.max(0, 12 - (performance.now() - start))
        });
      }, 50);

  // MutationObserver for SPAs / dynamic content with requestIdleCallback & time-sliced chunking
  function setupMutationObserver() {
    if (observer) observer.disconnect();

    let debounceTimerId = null;
    let idleCallbackId = null;
    const pendingNodes = new Set();

    function processPendingSlice(deadline) {
      idleCallbackId = null;
      if (!config.enabled || isSiteDisabled) {
        pendingNodes.clear();
        return;
      }

      const sliceStart = performance.now();
      const prevCount = detectedRefCount;
      const iterator = pendingNodes.values();
      let step = iterator.next();

      while (!step.done) {
        const el = step.value;
        pendingNodes.delete(el);

        if (el.isConnected) {
          scanElement(el, true);
        }

        step = iterator.next();

        // Yield to main thread if idle deadline is reached or slice exceeds 10ms
        if (
          !step.done &&
          ((deadline && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() <= 1) ||
            (performance.now() - sliceStart > 10))
        ) {
          break;
        }
      }

      if (detectedRefCount > prevCount) {
        safeSendMessage({
          type: 'SET_BADGE_COUNT',
          count: detectedRefCount
        });
      }

      if (pendingNodes.size > 0 && !idleCallbackId) {
        idleCallbackId = scheduleIdleTask(processPendingSlice);
      }
    }

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const added of m.addedNodes) {
          if (added.nodeType === Node.ELEMENT_NODE && !shouldIgnoreElement(added)) {
            pendingNodes.add(added);
          }
        }
      }

      if (pendingNodes.size > 0 && !debounceTimerId && !idleCallbackId) {
        debounceTimerId = setTimeout(() => {
          debounceTimerId = null;
          if (!idleCallbackId && pendingNodes.size > 0) {
            idleCallbackId = scheduleIdleTask(processPendingSlice);
          }
        }, 120);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // On-Selection / On-Demand lookup mode (0% background scanning overhead)
  let selectionListenerAttached = false;
  function setupSelectionLookup() {
    if (selectionListenerAttached) return;
    selectionListenerAttached = true;

    let selectionTimer = null;
    const handleSelectionCheck = (e) => {
      if (!config.enabled || isSiteDisabled || config.scanMode !== 'selection') return;
      if (hostEl && (e.target === hostEl || hostEl.contains(e.target))) return;

      clearTimeout(selectionTimer);
      selectionTimer = setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
          if (!isMouseOverTooltip) {
            hideTooltip(true);
          }
          return;
        }

        const text = sel.toString().trim();
        if (!text || text.length < 4 || text.length > 160) return;

        const matches = findReferencesInText(text);
        if (matches.length === 0) return;

        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return;

        const virtualTarget = {
          getBoundingClientRect: () => range.getBoundingClientRect()
        };
        showTooltipFor(virtualTarget, matches[0].parsed);
      }, 20);
    };

    document.addEventListener('mouseup', handleSelectionCheck, { passive: true });
    document.addEventListener('keyup', (e) => {
      if (e.key && (e.key.startsWith('Arrow') || e.key === 'Shift')) {
        handleSelectionCheck(e);
      }
    }, { passive: true });
  }

  function applyScanningMode() {
    if (!config.enabled || isSiteDisabled) {
      hideTooltip(true);
      if (observer) observer.disconnect();
      return;
    }

    setupSelectionLookup();

    if (config.scanMode === 'selection') {
      if (observer) observer.disconnect();
    } else {
      scanElement(document.body);
      setupMutationObserver();
    }
  }

  // Close tooltip on Esc key or resize/scroll outside
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isDrawerOpen) {
        closeStudyDrawer();
      } else {
        hideTooltip(true);
      }
    }
  });

  window.addEventListener('scroll', () => {
    if (activeTarget && tooltipEl && tooltipEl.classList.contains('visible')) {
      positionTooltip(activeTarget);
    }
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeTarget && tooltipEl && tooltipEl.classList.contains('visible')) {
      positionTooltip(activeTarget);
    }
  }, { passive: true });

  // Load settings and initialize
  try {
    if (chrome.runtime?.id && chrome.storage?.local) {
      chrome.storage.local.get(null, (stored) => {
        if (!chrome.runtime?.id || chrome.runtime.lastError) return;
        if (stored) {
          config = { ...config, ...stored };
        }

        isSiteDisabled = checkSiteDisabled(config.disabledDomains);
        if (!config.enabled || isSiteDisabled) return;

        updateDynamicUnderlineStyles();

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            applyScanningMode();
          });
        } else {
          applyScanningMode();
        }
      });
    }
  } catch (e) {
    // Suppress context invalidated during extension reload
  }

  // Listen for settings changes from popup
  try {
    if (chrome.runtime?.id && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (!chrome.runtime?.id || area !== 'local') {
          if (!chrome.runtime?.id && observer) {
            observer.disconnect();
            observer = null;
          }
          return;
        }

        let stylesNeedUpdate = false;
        for (const [k, v] of Object.entries(changes)) {
          config[k] = v.newValue;
          if (k === 'underlineStyle' || k === 'underlineColor') {
            stylesNeedUpdate = true;
          }
        }

        isSiteDisabled = checkSiteDisabled(config.disabledDomains);

        if (stylesNeedUpdate) {
          updateDynamicUnderlineStyles();
        }

        if (changes.minimalistMode && tooltipEl) {
          if (config.minimalistMode) {
            tooltipEl.classList.add('bh-minimalist');
          } else {
            tooltipEl.classList.remove('bh-minimalist');
          }
          renderTranslationBar();
          if (resCachedPassage) {
            updateCardFooterActions(resCachedPassage);
          }
        }

        if (changes.showSettingsButton || changes.minimalistMode) {
          updateSettingsButtonVisibility();
        }

        if (changes.enabled || changes.disabledDomains || changes.scanMode) {
          applyScanningMode();
        }
      });
    }
  } catch (e) {
    // Suppress context invalidated during extension reload
  }

})();
