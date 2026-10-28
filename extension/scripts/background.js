/**
 * Bible Hover — Background Service Worker
 * Hybrid 0ms Offline Engine (Bundled BSB/KJV + IndexedDB Full Bibles + Chapter Cache)
 * + Multi-Provider Online Translation Router (Bolls.life & BiblePortal)
 */

importScripts('../shared/bible-metadata.js');

const { BOOKS, BOOK_BY_ID, TRANSLATIONS } = globalThis.BibleHoverMeta;

const DEFAULT_SETTINGS = {
  enabled: true,
  defaultTranslation: 'BSB',
  studyResource: 'biblehub', // 'biblehub' | 'thesingingbible' | 'bible_com' | 'youversion' | 'desiringgod' | 'youtube'
  showTranslationBar: true,  // show/hide translation switcher pill bar in hover card
  minimalistMode: false,     // pure scripture only (hide all links, translations, buttons & footers)
  enabledTranslations: ['BSB', 'KJV', 'ESV', 'NIV', 'NLT', 'NASB', 'CSB', 'NKJV', 'WEB'],
  theme: 'auto',          // 'auto' | 'light' | 'dark' | 'sepia'
  underlineStyle: 'dotted', // 'dotted' | 'dashed' | 'solid' | 'highlight' | 'none'
  underlineColor: '#3b82f6',
  fontSize: 'medium',     // 'small' | 'medium' | 'large'
  scriptureFont: 'sans',  // 'sans' | 'serif' | 'garamond' | 'humanist' | 'dyslexic' | 'mono'
  hoverDelay: 120,
  disabledDomains: [],
  commentaryMode: 'direct_link', // 'direct_link' | 'in_card_tab' | 'side_drawer' | 'multi_pills'
  preferredCommentary: 'matthew_henry', // 'matthew_henry' | 'john_calvin' | 'jfb' | 'maclaren' | 'biblehub_all' | 'john_gill' | 'geneva_1599' | 'tgc'
  multiPillResources: ['commentary', 'tgc', 'thesingingbible', 'youtube']
};

// In-memory caches for instant 0ms lookups
const memoryBibles = new Map();       // translationId -> 66-book array
const loadingBibles = new Map();      // translationId -> Promise
const memoryChapterCache = new Map(); // "TRANS:bookId:chapter" -> Array<string>
const memoryCommentaryCache = new Map(); // "COMM:bookId:chapter:verse" -> Array<CommentaryBlock>
const MAX_MEMORY_CHAPTERS = 50;       // Keep in-memory cache tiny (< 1 MB)

// Cache Limits & Auto-Pruning
const MAX_CACHED_CHAPTERS_IDB = 100;  // Max 100 chapters in IndexedDB (~1.5 MB total cap)
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days auto-expiration
const CACHE_ALARM_NAME = 'BH_CACHE_MAINTENANCE';

/**
 * In-memory LRU helpers to guarantee memory footprint remains under 1 MB.
 */
function getMemoryChapter(key) {
  if (!memoryChapterCache.has(key)) return null;
  const val = memoryChapterCache.get(key);
  // Re-insert to refresh LRU order (end of Map = most recently used)
  memoryChapterCache.delete(key);
  memoryChapterCache.set(key, val);
  return val;
}

function setMemoryChapter(key, verses) {
  if (memoryChapterCache.has(key)) {
    memoryChapterCache.delete(key);
  }
  while (memoryChapterCache.size >= MAX_MEMORY_CHAPTERS) {
    const oldestKey = memoryChapterCache.keys().next().value;
    memoryChapterCache.delete(oldestKey);
  }
  memoryChapterCache.set(key, verses);
}

// IndexedDB Configuration
const DB_NAME = 'BibleHoverDB';
const DB_VERSION = 2;
let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('fullBibles')) {
        db.createObjectStore('fullBibles', { keyPath: 'id' });
      }
      let cacheStore;
      if (!db.objectStoreNames.contains('chapterCache')) {
        cacheStore = db.createObjectStore('chapterCache', { keyPath: 'key' });
      } else {
        cacheStore = req.transaction.objectStore('chapterCache');
      }
      if (!cacheStore.indexNames.contains('timestamp')) {
        cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function idbGet(storeName, key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB get error:', err);
    return null;
  }
}

async function idbPut(storeName, value) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(value);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IDB put error:', err);
    return false;
  }
}

async function idbDelete(storeName, key) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return false;
  }
}

async function idbGetAllKeys(storeName) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return [];
  }
}

async function idbClear(storeName) {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    return false;
  }
}

/**
 * Automatically purges expired chapters (older than CACHE_TTL_MS)
 * and limits total stored chapters in IndexedDB to MAX_CACHED_CHAPTERS_IDB using LRU.
 */
async function pruneChapterCache() {
  try {
    const db = await openDB();
    const now = Date.now();
    const cutoff = now - CACHE_TTL_MS;

    return await new Promise((resolve, reject) => {
      const tx = db.transaction('chapterCache', 'readwrite');
      const store = tx.objectStore('chapterCache');
      const countReq = store.count();

      countReq.onsuccess = () => {
        let totalCount = countReq.result;
        let deletedCount = 0;

        if (totalCount === 0) {
          resolve({ deletedCount: 0, remainingCount: 0 });
          return;
        }

        const index = store.index('timestamp');
        const cursorReq = index.openCursor(); // ascending order (oldest timestamp first)

        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (!cursor) {
            resolve({ deletedCount, remainingCount: totalCount });
            return;
          }

          const record = cursor.value;
          const isExpired = !record.timestamp || record.timestamp < cutoff;
          const isOverCapacity = totalCount > MAX_CACHED_CHAPTERS_IDB;

          if (isExpired || isOverCapacity) {
            cursor.delete();
            deletedCount++;
            totalCount--;
            cursor.continue();
          } else {
            // Ordered ascending: once an item is neither expired nor over capacity,
            // all subsequent entries are newer and within capacity limits.
            resolve({ deletedCount, remainingCount: totalCount });
          }
        };

        cursorReq.onerror = () => reject(cursorReq.error);
      };

      countReq.onerror = () => reject(countReq.error);
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Cache prune error:', err);
    return { deletedCount: 0, error: err.message };
  }
}

let pruneDebounceTimer = null;
function scheduleCachePrune() {
  if (pruneDebounceTimer) return;
  pruneDebounceTimer = setTimeout(() => {
    pruneDebounceTimer = null;
    pruneChapterCache().catch(() => {});
  }, 1000);
}

// Setup background alarms for regular periodic maintenance
try {
  chrome.alarms?.get(CACHE_ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms?.create(CACHE_ALARM_NAME, {
        periodInMinutes: 1440 // Check every 24 hours
      });
    }
  });

  chrome.alarms?.onAlarm.addListener((alarm) => {
    if (alarm.name === CACHE_ALARM_NAME) {
      pruneChapterCache().catch(() => {});
    }
  });
} catch (err) {
  console.warn('Alarms setup notice:', err);
}

// Initialize default settings on install
chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  const toSet = {};
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    if (stored[k] === undefined) toSet[k] = v;
  }
  if (Object.keys(toSet).length > 0) {
    await chrome.storage.local.set(toSet);
  }
  // Auto-migrate legacy 'gty' setting to 'thesingingbible'
  if (stored.studyResource === 'gty') {
    await chrome.storage.local.set({ studyResource: 'thesingingbible' });
  }

  // Pre-warm default bundled Bible
  const trans = stored.defaultTranslation || DEFAULT_SETTINGS.defaultTranslation;
  if (trans === 'BSB') {
    loadFullBibleIfAvailable('BSB').catch(() => {});
  }
  // Run startup cache pruning pass
  pruneChapterCache().catch(() => {});
});

// Run maintenance check on worker initialization
pruneChapterCache().catch(() => {});
chrome.storage?.local?.get('studyResource', (res) => {
  if (res?.studyResource === 'gty') {
    chrome.storage.local.set({ studyResource: 'thesingingbible' });
  }
});

/**
 * Loads a full 66-book Bible from bundled JSON (BSB/KJV) or IndexedDB (`fullBibles`).
 */
async function loadFullBibleIfAvailable(translationId) {
  const id = translationId.toUpperCase();
  if (memoryBibles.has(id)) return memoryBibles.get(id);
  if (loadingBibles.has(id)) return loadingBibles.get(id);

  const loadPromise = (async () => {
    try {
      if (id === 'BSB') {
        const fileUrl = chrome.runtime.getURL('data/bsb.json');
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error(`Failed to load bundled ${id}`);
        const books = await res.json();
        memoryBibles.set(id, books);
        return books;
      }

      // Check IndexedDB for downloaded full translation
      const record = await idbGet('fullBibles', id);
      if (record && record.books) {
        memoryBibles.set(id, record.books);
        return record.books;
      }
      return null;
    } finally {
      loadingBibles.delete(id);
    }
  })();

  loadingBibles.set(id, loadPromise);
  return loadPromise;
}

/**
 * Cleans HTML markup, footnotes, Strong's numbers, and excess whitespace from online API verse strings.
 */
function sanitizeVerseText(raw) {
  if (!raw) return '';
  return raw
    .replace(/<sup[^>]*>.*?<\/sup>/gi, '')
    .replace(/<S>.*?<\/S>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&ldquo;/gi, '“')
    .replace(/&rdquo;/gi, '”')
    .replace(/&lsquo;/gi, '‘')
    .replace(/&rsquo;/gi, '’')
    .replace(/&amp;/gi, '&')
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches an entire chapter of verses (1-indexed array at index `v - 1`)
 * from local bundle, IndexedDB, or online APIs, and caches it permanently.
 */
async function getChapterVerses(translationId, bookId, chapter) {
  const id = (translationId || 'BSB').toUpperCase();
  const book = BOOK_BY_ID.get(bookId);
  if (!book || chapter < 1 || chapter > book.chapters.length) {
    throw new Error(`Invalid reference: Book ${bookId} Chapter ${chapter}`);
  }

  // 1. Check Full Bible in memory or bundled/IDB
  const fullBible = await loadFullBibleIfAvailable(id);
  if (fullBible && fullBible[bookId - 1] && fullBible[bookId - 1][chapter - 1]) {
    return {
      verses: fullBible[bookId - 1][chapter - 1],
      source: TRANSLATIONS[id]?.bundled ? 'offline' : 'downloaded'
    };
  }

  // 2. Check in-memory chapter cache
  const cacheKey = `${id}:${bookId}:${chapter}`;
  const memVerses = getMemoryChapter(cacheKey);
  if (memVerses) {
    return { verses: memVerses, source: 'cached' };
  }

  // 3. Check IndexedDB chapterCache
  const cachedRecord = await idbGet('chapterCache', cacheKey);
  if (cachedRecord && Array.isArray(cachedRecord.verses) && cachedRecord.verses.length > 0) {
    setMemoryChapter(cacheKey, cachedRecord.verses);
    // Refresh timestamp in background for LRU tracking
    idbPut('chapterCache', {
      ...cachedRecord,
      timestamp: Date.now()
    }).catch(() => {});
    return { verses: cachedRecord.verses, source: 'cached' };
  }

  // 4. Fetch online from best provider
  const transMeta = TRANSLATIONS[id] || TRANSLATIONS.BSB;
  let verses = null;

  // Try Bolls.life first if supported (fast, returns whole chapter array cleanly)
  if (transMeta.bollsCode) {
    try {
      const url = `https://bolls.life/get-text/${transMeta.bollsCode}/${bookId}/${chapter}/`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const maxDataV = data.reduce((max, item) => Math.max(max, item.verse || 0), 0);
          const totalV = Math.max(book.chapters[chapter - 1] || 0, maxDataV);
          const arr = new Array(totalV).fill('');
          for (const item of data) {
            if (item.verse >= 1 && item.verse <= totalV) {
              arr[item.verse - 1] = sanitizeVerseText(item.text);
            }
          }
          if (arr.some(v => v.length > 0)) {
            verses = arr;
          }
        }
      }
    } catch (err) {
      console.warn(`Bolls.life fetch failed for ${id}:`, err);
    }
  }

  // Try BiblePortal API (primary for NIV, fallback for others)
  if (!verses && transMeta.bpCode) {
    try {
      const query = `${book.name} ${chapter}`;
      const url = `https://api.bibleportal.com/api/search?version=${encodeURIComponent(transMeta.bpCode)}&search=${encodeURIComponent(query)}&type=tooltip`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        const passages = json?.data?.[0]?.results?.[0]?.passages || [];
        if (passages.length > 0) {
          const maxV = book.chapters[chapter - 1];
          const arr = new Array(maxV).fill('');
          for (const p of passages) {
            if (!p.subhead && p.verse >= 1 && p.verse <= maxV) {
              const cleaned = sanitizeVerseText(p.plain || p.content || '');
              arr[p.verse - 1] = arr[p.verse - 1] ? `${arr[p.verse - 1]} ${cleaned}` : cleaned;
            }
          }
          if (arr.some(v => v.length > 0)) {
            verses = arr;
          }
        }
      }
    } catch (err) {
      console.warn(`BiblePortal fetch failed for ${id}:`, err);
    }
  }

  // Ultimate fallback to bundled BSB if user is completely offline and requested an uncached online translation
  if (!verses) {
    const fallbackBible = await loadFullBibleIfAvailable('BSB');
    if (fallbackBible) {
      return {
        verses: fallbackBible[bookId - 1][chapter - 1],
        source: 'offline-fallback',
        fallbackTranslation: 'BSB'
      };
    }
    throw new Error(`Unable to load ${book.name} ${chapter} (${id}). Check your internet connection.`);
  }

  // Save in memory & IndexedDB with timestamp and trigger background prune
  setMemoryChapter(cacheKey, verses);
  idbPut('chapterCache', {
    key: cacheKey,
    translation: id,
    bookId,
    chapter,
    verses,
    timestamp: Date.now()
  }).then(() => {
    scheduleCachePrune();
  }).catch(() => {});

  return { verses, source: 'online' };
}

/**
 * Resolves a full parsed scripture reference (with 1 or more segments) into verse objects.
 */
async function resolvePassage(parsedRef, requestedTranslation, includeFullChapter = false) {
  const transId = (requestedTranslation || parsedRef.translation || 'BSB').toUpperCase();
  const book = BOOK_BY_ID.get(parsedRef.bookId);
  if (!book) throw new Error('Unknown Bible book');

  const segmentResults = [];
  let primarySource = 'offline';
  let actualTranslation = transId;

  for (const seg of parsedRef.segments) {
    const chapterData = await getChapterVerses(transId, book.id, seg.chapter);
    if (chapterData.fallbackTranslation) {
      actualTranslation = chapterData.fallbackTranslation;
      primarySource = 'offline-fallback';
    } else if (chapterData.source === 'online') {
      primarySource = 'online';
    } else if (chapterData.source === 'cached' && primarySource !== 'online') {
      primarySource = 'cached';
    } else if (chapterData.source === 'downloaded' && primarySource === 'offline') {
      primarySource = 'downloaded';
    }

    const verses = [];
    const startV = Math.max(1, seg.verseStart);
    const endV = Math.min(chapterData.verses.length, seg.verseEnd);

    for (let v = startV; v <= endV; v++) {
      const text = chapterData.verses[v - 1];
      if (text) {
        verses.push({
          chapter: seg.chapter,
          verse: v,
          text
        });
      }
    }

    segmentResults.push({
      chapter: seg.chapter,
      verseStart: startV,
      verseEnd: endV,
      isWholeChapter: seg.isWholeChapter,
      verses
    });
  }

  let fullChapterVerses = null;
  const firstChapter = parsedRef.segments[0]?.chapter || 1;
  if (includeFullChapter) {
    const chData = await getChapterVerses(actualTranslation, book.id, firstChapter);
    fullChapterVerses = chData.verses.map((text, idx) => ({
      chapter: firstChapter,
      verse: idx + 1,
      text: text || ''
    })).filter(v => v.text.length > 0);
  }

  const transMeta = TRANSLATIONS[actualTranslation] || TRANSLATIONS.BSB;

  return {
    ok: true,
    bookId: book.id,
    bookName: book.name,
    canonicalLabel: parsedRef.canonicalLabel,
    translation: actualTranslation,
    translationName: transMeta.name,
    requestedTranslation: transId,
    source: primarySource,
    primaryChapter: firstChapter,
    totalChaptersInBook: book.chapters.length,
    segments: segmentResults,
    fullChapterVerses
  };
}

/**
 * Downloads an entire translation from Bolls.life and saves it in IndexedDB `fullBibles`
 * for 100% offline 0ms usage.
 */
async function downloadFullTranslation(translationId) {
  const id = translationId.toUpperCase();
  const meta = TRANSLATIONS[id];
  if (!meta || !meta.downloadable || !meta.bollsCode) {
    throw new Error(`Translation ${id} is not available for full offline download.`);
  }

  const url = `https://bolls.life/static/translations/${meta.bollsCode}.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed with status ${res.status}`);
  }

  const rawRows = await res.json();
  const books = Array.from({ length: 66 }, (_, bIdx) =>
    Array.from({ length: BOOKS[bIdx].chapters.length }, () => [])
  );

  for (const row of rawRows) {
    const bIdx = row.book - 1;
    const cIdx = row.chapter - 1;
    const vIdx = row.verse - 1;
    if (bIdx >= 0 && bIdx < 66 && books[bIdx][cIdx]) {
      books[bIdx][cIdx][vIdx] = sanitizeVerseText(row.text);
    }
  }

  await idbPut('fullBibles', {
    id,
    name: meta.name,
    books,
    downloadedAt: Date.now()
  });

  memoryBibles.set(id, books);
  return { ok: true, id, name: meta.name };
}

/**
 * Parses raw BibleHub commentary HTML into structured commentator blocks.
 */
function parseBibleHubCommentary(html) {
  if (!html) return [];
  const parts = html.split(/<div class="vheading2">/i);
  const commentaries = [];

  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const endHeader = chunk.indexOf('</div>');
    if (endHeader === -1) continue;

    const rawTitle = chunk.substring(0, endHeader);
    const title = rawTitle.replace(/<[^>]+>/g, '').trim();

    let bodyHtml = chunk.substring(endHeader + 6);
    const cutIdx = bodyHtml.search(/<div class="bot2"|<table|<div class="top_nav"/i);
    if (cutIdx > -1) {
      bodyHtml = bodyHtml.substring(0, cutIdx);
    }

    bodyHtml = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<div class="adsbygoogle"[\s\S]*?<\/div>/gi, '')
      .replace(/<ins[\s\S]*?<\/ins>/gi, '')
      .trim();

    const cleanText = bodyHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<p\s*\/?>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&quot;/gi, '"')
      .replace(/&ldquo;/gi, '“')
      .replace(/&rdquo;/gi, '”')
      .replace(/&lsquo;/gi, '‘')
      .replace(/&rsquo;/gi, '’')
      .replace(/&amp;/gi, '&')
      .replace(/&#8212;/g, '—')
      .replace(/&#8226;/g, '•')
      .replace(/\s+/g, ' ')
      .trim();

    let key = 'other';
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('henry')) key = 'matthew_henry';
    else if (lowerTitle.includes('calvin')) key = 'john_calvin';
    else if (lowerTitle.includes('gill')) key = 'john_gill';
    else if (lowerTitle.includes('geneva')) key = 'geneva_1599';
    else if (lowerTitle.includes('barnes')) key = 'barnes';
    else if (lowerTitle.includes('jamieson') || lowerTitle.includes('jfb')) key = 'jfb';
    else if (lowerTitle.includes('maclaren')) key = 'maclaren';
    else if (lowerTitle.includes('ellicott')) key = 'ellicott';
    else if (lowerTitle.includes('benson')) key = 'benson';
    else if (lowerTitle.includes('poole')) key = 'poole';

    if (title && cleanText.length > 20) {
      commentaries.push({
        title,
        key,
        text: cleanText
      });
    }
  }

  // Subtly promote Matthew Henry and John Calvin to appear first in commentary listings
  commentaries.sort((a, b) => {
    const rank = (k) => (k === 'matthew_henry' ? 1 : k === 'john_calvin' ? 2 : 3);
    return rank(a.key) - rank(b.key);
  });

  return commentaries;
}

/**
 * Parses John Calvin's dedicated chapter commentary HTML for a specific verse or verse range.
 */
function parseCalvinCommentary(html, verseNum) {
  if (!html) return null;
  const startIdx = html.indexOf('<div class="padleft">');
  const content = startIdx > -1 ? html.slice(startIdx) : html;

  // Match headers like <b>Romans 6:7-11</b> or <b>Romans 6:7</b>
  const sectionRegex = /<b>\s*(?:[1-3]?\s*[A-Za-z]+)\s+\d+:(\d+)(?:-(\d+))?\s*<\/b>/gi;
  let match;
  const sections = [];
  while ((match = sectionRegex.exec(content)) !== null) {
    const vStart = parseInt(match[1], 10);
    const vEnd = match[2] ? parseInt(match[2], 10) : vStart;
    sections.push({
      vStart,
      vEnd,
      header: match[0],
      index: match.index
    });
  }

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i];
    if (verseNum >= sec.vStart && verseNum <= sec.vEnd) {
      const nextIndex = (i + 1 < sections.length) ? sections[i + 1].index : content.indexOf('<div class="bot2">');
      const sectionHtml = content.slice(sec.index, nextIndex > -1 ? nextIndex : sec.index + 5000);
      const cleanText = sectionHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&quot;/gi, '"')
        .replace(/&ldquo;/gi, '“')
        .replace(/&rdquo;/gi, '”')
        .replace(/&lsquo;/gi, '‘')
        .replace(/&rsquo;/gi, '’')
        .replace(/&amp;/gi, '&')
        .replace(/&#8212;/g, '—')
        .replace(/&#8226;/g, '•')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanText.length > 30) {
        return {
          title: "Calvin's Commentaries",
          key: 'john_calvin',
          text: cleanText
        };
      }
    }
  }
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  (async () => {
    try {
      switch (message.type) {
        case 'GET_PASSAGE': {
          const result = await resolvePassage(
            message.parsedRef,
            message.translation,
            Boolean(message.includeFullChapter)
          );
          sendResponse(result);
          break;
        }

        case 'GET_CHAPTER': {
          const { bookId, chapter, translation } = message;
          const book = BOOK_BY_ID.get(bookId);
          if (!book) throw new Error('Invalid book ID');
          const chData = await getChapterVerses(translation, bookId, chapter);
          const verses = chData.verses.map((text, idx) => ({
            chapter,
            verse: idx + 1,
            text: text || ''
          })).filter(v => v.text.length > 0);

          sendResponse({
            ok: true,
            bookId,
            bookName: book.name,
            chapter,
            totalChapters: book.chapters.length,
            translation: chData.fallbackTranslation || translation,
            source: chData.source,
            verses
          });
          break;
        }

        case 'DOWNLOAD_TRANSLATION': {
          const res = await downloadFullTranslation(message.translation);
          sendResponse(res);
          break;
        }

        case 'DELETE_TRANSLATION': {
          const id = (message.translation || '').toUpperCase();
          memoryBibles.delete(id);
          await idbDelete('fullBibles', id);

          // Clear any in-memory and IDB cached chapters for this translation
          for (const key of memoryChapterCache.keys()) {
            if (key.startsWith(`${id}:`)) {
              memoryChapterCache.delete(key);
            }
          }
          try {
            const allChapterKeys = await idbGetAllKeys('chapterCache');
            for (const key of allChapterKeys) {
              if (String(key).startsWith(`${id}:`)) {
                await idbDelete('chapterCache', key);
              }
            }
          } catch (_) {}

          sendResponse({ ok: true, id });
          break;
        }

        case 'GET_OFFLINE_STATUS': {
          const downloadedIds = await idbGetAllKeys('fullBibles');
          const cachedChapterKeys = await idbGetAllKeys('chapterCache');
          sendResponse({
            ok: true,
            bundled: ['BSB'],
            downloaded: downloadedIds,
            cachedChaptersCount: cachedChapterKeys.length,
            maxCachedChapters: MAX_CACHED_CHAPTERS_IDB
          });
          break;
        }

        case 'CLEAR_CHAPTER_CACHE': {
          memoryChapterCache.clear();
          await idbClear('chapterCache');
          sendResponse({ ok: true });
          break;
        }

        case 'PRUNE_CHAPTER_CACHE': {
          const pruneResult = await pruneChapterCache();
          sendResponse({ ok: true, pruneResult });
          break;
        }

        case 'GET_COMMENTARY': {
          const { bookId, chapter, verseStart } = message;
          const book = BOOK_BY_ID.get(bookId);
          if (!book) throw new Error('Invalid book');
          const bookUrl = book.name.toLowerCase().replace(/\s+/g, '_');
          const vNum = verseStart || 1;
          const cacheKey = `COMM:${bookId}:${chapter}:${vNum}`;

          if (memoryCommentaryCache.has(cacheKey)) {
            sendResponse({
              ok: true,
              reference: `${book.name} ${chapter}:${vNum}`,
              commentaries: memoryCommentaryCache.get(cacheKey)
            });
            break;
          }

          const mainUrl = `https://biblehub.com/commentaries/${bookUrl}/${chapter}-${vNum}.htm`;
          const calvinUrl = `https://biblehub.com/commentaries/calvin/${bookUrl}/${chapter}.htm`;

          try {
            const [mainRes, calvinRes] = await Promise.all([
              fetch(mainUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }).catch(() => null),
              fetch(calvinUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }).catch(() => null)
            ]);

            let commentaries = [];
            if (mainRes && mainRes.ok) {
              const html = await mainRes.text();
              commentaries = parseBibleHubCommentary(html);
            }

            if (calvinRes && calvinRes.ok) {
              const calvinHtml = await calvinRes.text();
              const calvinBlock = parseCalvinCommentary(calvinHtml, vNum);
              if (calvinBlock && !commentaries.some(c => c.key === 'john_calvin')) {
                commentaries.push(calvinBlock);
              }
            }

            // Subtly promote Matthew Henry and John Calvin to appear first
            commentaries.sort((a, b) => {
              const rank = (k) => (k === 'matthew_henry' ? 1 : k === 'john_calvin' ? 2 : 3);
              return rank(a.key) - rank(b.key);
            });

            if (memoryCommentaryCache.size >= 30) {
              const oldest = memoryCommentaryCache.keys().next().value;
              memoryCommentaryCache.delete(oldest);
            }
            memoryCommentaryCache.set(cacheKey, commentaries);

            sendResponse({
              ok: true,
              reference: `${book.name} ${chapter}:${vNum}`,
              commentaries
            });
          } catch (err) {
            sendResponse({
              ok: false,
              error: err.message,
              reference: `${book.name} ${chapter}:${vNum}`,
              commentaries: []
            });
          }
          break;
        }

        case 'SET_BADGE_COUNT': {
          if (sender?.tab?.id) {
            const count = message.count || 0;
            const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
            chrome.action.setBadgeText({ tabId: sender.tab.id, text }).catch(() => {});
            chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: '#1e2952' }).catch(() => {});
          }
          sendResponse({ ok: true });
          break;
        }

        default:
          sendResponse({ ok: false, error: `Unknown message type: ${message.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();

  return true; // Keep message channel open for async response
});
