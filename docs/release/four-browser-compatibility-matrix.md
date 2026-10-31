# Four-Browser Production Compatibility Matrix

**Product:** Web-to-Figma Exporter  
**Version:** 0.1.0  
**Release Candidate Date:** October 31, 2026  
**Test Environment:** Windows 11 Enterprise (x64) / Modern Chromium & Gecko Engines  

---

## 1. Browser Qualification Summary

| Target Browser | Package Binary | Build Version Tested | Manifest Type | Clipboard Delivery | Status | Limitations / Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Google Chrome** | `dist/chromium/` | Version 131+ (Current Stable) | Manifest V3 (Service Worker) | Direct Clipboard API (`text/html` & `application/x-figma`) | **PASS** | Verified with unpacked extension load, service worker bootstrap, popup, and multi-page capture. |
| **Microsoft Edge** | `dist/chromium/` | Version 131+ (Current Stable) | Manifest V3 (Service Worker) | Direct Clipboard API (`text/html` & `application/x-figma`) | **PASS** | Tested on msedge.exe runtime with complete feature parity to Chrome. |
| **Brave Browser** | `dist/chromium/` | Current Stable (Chromium 131+) | Manifest V3 (Service Worker) | Direct Clipboard API | **PASS (Standard)** | Shields Standard active. Canvas fingerprint protection handled via safe readback tolerances; no global shields disable required. |
| **Mozilla Firefox** | `dist/firefox/` | Version 132+ (Current Stable) | Manifest V3 (Event Page Background) | Clipboard API via Background / Minibar | **PASS** | `browser_specific_settings.gecko.id: web-to-figma-exporter@local`. Clean background scripts bootstrap without service worker restrictions. |

---

## 2. Core Journey Verification Matrix

| Workflow / Capability | Chrome | Edge | Brave | Firefox | Test Evidence |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Unpacked Extension Installation** | ✓ | ✓ | ✓ | ✓ | Clean manifest parsing, icon validation, popup and options registration. |
| **Permission Minimization** | ✓ | ✓ | ✓ | ✓ | `activeTab`, `storage` only. Zero `<all_urls>`, `cookies`, `debugger`, or `webRequest`. |
| **Current Viewport Export** | ✓ | ✓ | ✓ | ✓ | Instant zero-scroll capture, computed geometry preservation, typography mapping. |
| **Full Page Capture** | ✓ | ✓ | ✓ | ✓ | Automated incremental scroll driver, dynamic lazy loading, scroll restoration. |
| **Selected Element Picker** | ✓ | ✓ | ✓ | ✓ | Canvas hover overlay, deep isolation, component-level Figma frame creation. |
| **Route Crawling & Discovery** | ✓ | ✓ | ✓ | ✓ | Same-origin anchor extraction, XML sitemap parsing, destructive route filtering. |
| **Route Review & Selection Filters** | ✓ | ✓ | ✓ | ✓ | Odd/Even pagination filters, category presets, inclusion/exclusion regex. |
| **Multi-Page Canvas Assembly** | ✓ | ✓ | ✓ | ✓ | Grid-based frame arrangement, non-overlapping canvas bounds, Directory board. |
| **Responsive Matrix Export** | ✓ | ✓ | ✓ | ✓ | Multi-viewport variant frames (Mobile, Tablet, Desktop) generated per route. |
| **Design System Extraction** | ✓ | ✓ | ✓ | ✓ | Color palettes, typography scale, spacing tokens, and component candidates. |
| **Direct Ctrl+V Figma Paste** | ✓ | ✓ | ✓ | ✓ | Verified against active Figma Web & Desktop canvas surfaces. |
| **Payload Partitioning (50MB Cap)** | ✓ | ✓ | ✓ | ✓ | Safe multi-batch copying with progress indicators and route preservation. |
| **Cancellation & Cleanup** | ✓ | ✓ | ✓ | ✓ | Cooperative AbortController yielding and IndexedDB TTL data cleanup. |

---

## 3. Package Checksums & Integrity

- **Chromium Package (`web-to-figma-exporter-chromium-v0.1.0.zip`):**
  - SHA-256: `e0b8580c06432db66b1e2d694789a29e0a3e650837ba22c79204b2ea63d1c629`
  - Target Audience: Google Chrome, Microsoft Edge, Brave Browser, Opera, Vivaldi.
- **Firefox Package (`web-to-figma-exporter-firefox-v0.1.0.zip`):**
  - SHA-256: `cbb2c7122792f4226d4922d617982a49596d75132f096e33932537eba84ba433`
  - Target Audience: Mozilla Firefox, Firefox Developer Edition, LibreWolf.

---

## 4. Operational Sign-Off
All four targeted browsers fulfill the P0/P1 workflow qualification gates defined in `implementation.md` Phase 23. Zero critical or high-severity regressions exist.
