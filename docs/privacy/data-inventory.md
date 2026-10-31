# Data Inventory & Processing Register

**Product:** Web-to-Figma Exporter  
**Version:** 0.1.0  
**Last Updated:** October 31, 2026  
**Publisher:** Web-to-Figma Open Source Project  
**Core Architecture:** Local-First, Zero-Backend Browser Extension  

---

## 1. Guiding Privacy Principles

1. **Explicit User Initiation Only:** The extension never inspects, accesses, or processes web page contents automatically or passively. All data processing occurs strictly in direct response to an explicit user export action (clicking "Export", picking an element, or initiating multi-page crawling).
2. **100% On-Device Processing:** All DOM extraction, CSS parsing, asset encoding, layout calculation, and Figma clipboard serialization occur strictly inside the user's local browser runtime.
3. **Zero Third-Party Telemetry:** Zero bytes of page data, user identifiers, usage statistics, crash traces, or network logs are transmitted to any developer-operated server, analytics platform, or cloud service.
4. **Sensitive Data Redaction by Design:** Form password fields, credit card inputs, authorization tokens, authentication cookies, session credentials, and browsing history are excluded from capture buffers.

---

## 2. Comprehensive Data Category Inventory

| Data Category | Purpose & Trigger | Collection Scope | Processing Location | Persistence Location | Retention & Expiration | Leaves Device? | Optional? | Excluded Sensitive Elements |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: | :---: | :--- |
| **Active Tab URL & Title** | Frame labeling and relative URL resolution. Triggered upon popup opening / capture start. | Active browser tab currently focused by user. | In-memory extension background / content script. | Local extension storage (`chrome.storage.local` / IndexedDB). | Expired after job completion or manual cache wipe. | **NO** | No | Internal browser URLs (`chrome://`, `about:`, `file:`) rejected. |
| **DOM Tree Structure & Text Nodes** | Reconstruction of layout hierarchy and editable Figma text layers. Triggered on capture start. | Elements within active viewport, full page, or selected component. | Local content script memory. | Local IndexedDB job store (chunked binary/JSON). | Automatically deleted per configured TTL (default 24h) or manual clear. | **NO** | No | `<input type="password">`, credit card fields, and hidden auth tokens redacted. |
| **Computed CSS Styles** | Translating web typography, colors, borders, shadows, and layout into Figma styles. | Computed style declarations for captured DOM nodes. | Local content script memory. | Discarded after scene generation. | Ephemeral (in-memory only). | **NO** | No | Unused or inherited default styles discarded. |
| **Image & Media Binaries** | Preserving visual raster content in Figma frames. Triggered during asset fetching. | Image URLs and CSS background images present on target page. | Content script / background fetch pipeline. | Local IndexedDB asset cache. | Cleared after clipboard copy or storage TTL expiration. | **NO** | Yes (can disable images) | Cross-origin authenticated images blocked by CORS; canvas tainted checks enforced. |
| **SVG Vector Data** | Rendering crisp vector shapes and icons in Figma. | Inline `<svg>` elements and referenced SVG icons. | Local SVG sanitizer (`svg-sanitizer.ts`). | Local IndexedDB job store. | Cleared after clipboard copy or storage TTL. | **NO** | Yes | All `<script>`, `onload`, `onclick`, and `<foreignObject>` tags sanitized. |
| **Canvas & WebGL Snapshots** | Preserving charts and dynamic graphics. | `<canvas>` elements within captured scope. | Content script canvas readback (`toBlob`). | Local IndexedDB job store. | Cleared after clipboard copy. | **NO** | Yes | Tainted canvas readback blocked; Brave anti-fingerprinting respected. |
| **Discovered Route URLs** | Multi-page crawl review and batch selection. Triggered in multi-page mode. | Same-origin anchors (`<a href>`) and `/sitemap.xml` entries. | Background crawl engine. | Local IndexedDB crawl state. | Cleared on job finish or user cancellation. | **NO** | Yes (Single-page mode does not crawl) | Destructive action routes (`/logout`, `/delete`) automatically filtered out. |
| **Extension Settings** | Storing user preferences (modes, viewports, theme, caps). Triggered when settings changed. | User-selected configuration keys. | `chrome.storage.sync` / `chrome.storage.local`. | Local browser extension storage. | Persists across sessions until uninstalled or reset. | **NO** | No | Contains zero credentials or personal identifiers. |
| **Export Diagnostics** | Reporting fidelity classifications, missing assets, and recovery actions. | Error codes, asset URLs, and layout fallback warnings. | Local UI state and IndexedDB job summary. | Local IndexedDB job summary. | Persists until job is cleared. | **NO** | No | Diagnostics contain zero passwords, auth headers, or raw payload text. |
| **Clipboard Payload** | Pasting into Figma canvas via `Ctrl+V` / `Cmd+V`. Triggered on "Copy to Figma Clipboard". | Compact binary Kiwi schema (`application/x-figma`) and HTML wrapper. | In-memory clipboard writer. | System clipboard buffer. | Managed by operating system clipboard lifecycle. | **NO** | No | Direct OS clipboard delivery; no cloud synchronization. |

---

## 3. Explicit Data Exclusions

The Web-to-Figma extension explicitly **DOES NOT** access, collect, or store:
- Password inputs, credit card numbers, CVVs, or social security numbers.
- HTTP request/response headers or authentication cookies (`document.cookie` is not read).
- `localStorage`, `sessionStorage`, or IndexedDB data of target websites.
- User browsing history, bookmarks, or tabs outside the active user-selected tab.
- Browser keystrokes or mouse activity outside the extension's interactive UI components.
- IP addresses, device serial numbers, or advertising identifiers.

---

## 4. Verification & Audit Trail
- Verified via automated privacy integration tests (`src/test/unit/privacy-telemetry.test.ts`).
- Network activity monitored via automated headless browsers with zero unexpected network calls recorded.
