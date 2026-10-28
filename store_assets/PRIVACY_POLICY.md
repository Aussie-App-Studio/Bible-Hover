# Privacy Policy for Bible Hover Chrome Extension

**Last Updated:** October 28, 2026

Bible Hover ("we", "our", or "the extension") is committed to protecting your privacy. This Privacy Policy explains our practices regarding user information.

---

## 1. No Collection of Personal Information
Bible Hover does **not** collect, store, transmit, or sell any personally identifiable information (such as your name, email address, IP address, browsing history, or physical location).

---

## 2. Local Storage and Offline Data
All extension preferences (such as selected theme, font size, scripture font family, enabled translations, and preferred commentary modes) and downloaded offline Bibles are saved **exclusively on your local device** using Chrome's built-in `chrome.storage.local` and IndexedDB APIs. 

This data never leaves your computer and is never transmitted to any external server controlled by Bible Hover.

---

## 3. Network Requests & Third-Party APIs
Bible Hover is designed with an offline-first architecture. The Berean Standard Bible (BSB) is bundled directly with the extension and requires zero internet connectivity.

When you choose to view translations or resources that are not stored offline, the extension makes direct HTTPS requests to public scripture services:
- **Bolls Bible API** (`https://bolls.life/`)
- **BiblePortal API** (`https://api.bibleportal.com/`)
- **BibleHub** (`https://biblehub.com/`)

These requests only transmit the requested book, chapter, and verse query to fetch the biblical text. No personal identifiers, cookies, or user tracking tokens are included in these requests.

---

## 4. Webpage Content & Script Execution
Bible Hover scans webpage text locally on your device to recognize biblical scripture citations (such as "John 3:16" or "Romans 8:28") and attach hover preview cards. 

The contents of the webpages you visit are processed entirely in memory within your browser and are never logged, recorded, or sent to any server.

---

## 5. Changes to This Policy
If we update this Privacy Policy in the future, the revised version will be posted here with an updated "Last Updated" date.

---

## 6. Contact Us
If you have any questions or feedback regarding this Privacy Policy or Bible Hover, please open an issue on our GitHub repository or contact the developer via the Chrome Web Store support page.
