# Web-to-Figma Exporter — Known Limitations & Technical Disclosures

This document registers all known technical limitations, environmental constraints, browser-specific security boundaries, and fallback behaviors for the Web-to-Figma Exporter extension (v0.1.0).

---

## 1. Browser Security Boundaries & Cross-Origin Restrictions

### 1.1 Cross-Origin Iframes
- **Limitation:** Web browsers strictly enforce the Same-Origin Policy (`cross-origin` iframes). A content script running in the top-level document cannot read or pierce into `iframe.contentDocument` if the iframe's origin differs from the parent page.
- **Extension Behavior:** When an inaccessible cross-origin iframe is encountered, the exporter records an `ExportDiagnostic` (`UNPIERCED_CROSS_ORIGIN_IFRAME`), calculates the outer iframe bounding rectangle, and replaces the element with a neutral placeholder container labeled with the iframe source URL.
- **Fidelity Impact:** The overall export fidelity is marked as `partial` with an explicit reason citing the inaccessible iframe.

### 1.2 Closed Shadow DOM
- **Limitation:** Elements attached with `{ mode: 'closed' }` via `Element.attachShadow()` return `element.shadowRoot === null` to external scripts.
- **Extension Behavior:** The DOM traversal engine records a diagnostic and captures only the light-DOM host and child elements. Open Shadow DOM (`{ mode: 'open' }`) is fully traversed and rendered.

### 1.3 Inaccessible / Authenticated Assets
- **Limitation:** Images, fonts, or stylesheets hosted behind strict CORS headers without `Access-Control-Allow-Origin: *` or requiring separate session credentials cannot be fetched via subresource calls.
- **Extension Behavior:** The asset pipeline captures the natural layout bounding box and records an `ASSET_DOWNLOAD_FAILED` diagnostic. The Figma node renders a labeled fallback placeholder preserving layout integrity.

---

## 2. Canvas & Dynamic WebGL Content

### 2.1 Tainted Canvas
- **Limitation:** When an HTML5 `<canvas>` element draws cross-origin images or video without CORS headers, the browser marks the canvas as tainted, causing calls to `canvas.toBlob()` or `canvas.toDataURL()` to throw a `SecurityError`.
- **Extension Behavior:** The exporter catches the security exception, records a `CANVAS_TAINTED` diagnostic, and renders a placeholder frame in Figma with dimensions matching the canvas node.
- **Fidelity Impact:** Export classified as `partial`.

### 2.2 Brave Shields Canvas Fingerprinting Protection (Farbling)
- **Limitation:** In Brave Browser with Shields active, canvas pixel readback may be slightly randomized ("farbled") by the browser engine as an anti-fingerprinting measure.
- **Extension Behavior:** Vector elements, typography, and standard images are unaffected. For direct canvas snapshots, slight pixel variations may be observed. The extension never requests users to disable Brave Shields globally.

---

## 3. CSS & Layout Approximation

### 3.1 Unsupported CSS Properties in Figma
- **Limitation:** Figma's rendering engine does not natively support certain CSS properties, including:
  - `backdrop-filter` (CSS backdrop blur is approximated using layer background blur).
  - Advanced CSS clip-paths (`polygon()`, `path()`) are rasterized or converted to rectangular clips.
  - CSS Grid with implicit auto-placement tracks and dense packing are converted to absolute-positioned child frames while strictly preserving computed geometric coordinates.
  - Complex multi-stop conical gradients are converted to raster fallbacks or linear approximations.
- **Extension Behavior:** Style translation records an `ExportDiagnostic` with code `UNSUPPORTED_CSS_STYLE` or `APPROXIMATED_CSS_EFFECT` and notes the fallback applied.

### 3.2 Typography & Font Matching
- **Limitation:** If a web page utilizes custom web fonts (WOFF/WOFF2) that are not installed on the user's operating system or activated in Figma, Figma will substitute a default system typeface upon text editing.
- **Extension Behavior:** The extension extracts font family stacks and applies intelligent fallback resolution (e.g. Google Fonts / standard system fonts: Inter, Roboto, Arial). When a substitution occurs, an `ExportDiagnostic` (`FONT_SUBSTITUTED`) is recorded.

---

## 4. Multi-Page Crawling & Route Restrictions

### 4.1 Login Walls & Private Dashboards
- **Limitation:** Multi-page automated crawling respects session boundaries and does not automate password entry or credential submission. Routes behind an unauthenticated redirect are marked as `AUTHENTICATION_REQUIRED`.
- **Extension Behavior:** The crawler records the login barrier, excludes the route from the crawl queue, and continues processing other selected public routes without halting the export.

### 4.2 Destructive Action Routes
- **Limitation:** URLs matching destructive patterns (e.g. `/logout`, `/delete`, `/remove`, `/revoke`, `/signout`) are filtered out by safety heuristics during route review to prevent accidental session termination or data loss.

### 4.3 Infinite Scrolling Pages
- **Limitation:** Pages with infinite dynamic loaders (infinite scroll) cannot settle to an absolute bottom.
- **Extension Behavior:** The scroll driver enforces a configurable safety cap (maximum scroll passes / height limit). When the cap is reached, scrolling terminates gracefully, and an `INFINITE_SCROLL_BOUNDED` diagnostic is attached to the export.

---

## 5. Clipboard & Payload Capacity

### 5.1 System Clipboard Limits
- **Limitation:** System clipboards and browser memory have finite buffer sizes (typically 100MB–250MB depending on OS and hardware).
- **Extension Behavior:** The clipboard estimator partitions multi-page exports exceeding 50MB into discrete sequential batches (e.g. Batch 1 of 3, Batch 2 of 3). Each batch contains complete, self-contained Figma frames that can be pasted into the active canvas sequentially without data loss.

### 5.2 Figma Clipboard MIME Compatibility
- **Limitation:** Figma reads clipboard data formatted as `application/x-figma` (compact binary Kiwi schema) or formatted HTML wrappers. If Figma's internal schema changes in a major desktop update, native Kiwi buffers may require format adaptation.
- **Extension Behavior:** The exporter includes dual-format clipboard adapters with strict schema verification and neutral browser adapters.
