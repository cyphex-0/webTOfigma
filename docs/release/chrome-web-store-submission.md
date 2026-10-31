# Chrome Web Store Submission Package & Reviewer Guide

**Product:** Web-to-Figma Exporter  
**Target Platform:** Chrome Web Store (Chromium Package)  
**Package Artifact:** `release/web-to-figma-exporter-chromium-v0.1.0.zip`  
**Manifest Version:** Manifest V3 (`background.service_worker`)  
**Status:** **READY FOR SUBMISSION**  

---

## 1. Store Listing Metadata

- **Extension Name:** Web-to-Figma Exporter
- **Short Description (Max 132 chars):**  
  Export web pages and multi-page websites directly to Figma via clipboard copy-and-paste. Fast, editable, and 100% local.
- **Detailed Description:**
  ```text
  Web-to-Figma Exporter is a local-first browser extension that converts any web page, component, or full website directly into clean, editable Figma canvas layers.

  Copy your capture to the clipboard and press Ctrl+V (or Cmd+V on macOS) directly in Figma — no extra plugins or accounts required.

  ✨ KEY FEATURES:
  • Current Viewport Export: Instantly captures the visible area without scroll displacement.
  • Full Page Capture: Traverses the entire vertical layout, dynamically settling lazy-loaded images, and restoring scroll position.
  • Selected Element Picker: Interactive element highlighter to export individual buttons, hero cards, or navbars in isolation.
  • Multi-Page Website Discovery: Discovers same-origin routes and XML sitemaps, offering an interactive review panel with category and Odd/Even pagination filters.
  • Production Vector Scene Graph: Preserves editable typography, Auto Layout flexbox direction, vector icons, SVG paths, shadows, and rounded borders.
  • Responsive Matrix Export: Generates multi-viewport variant frames (Mobile, Tablet, Desktop) side-by-side.
  • Automated Design System Tokens: Extracts global color palettes, typography scales, spacing tokens, and component signatures into a dedicated board.

  🔒 100% LOCAL & PRIVATE:
  • All DOM extraction, CSS analysis, and Kiwi binary clipboard serialization execute entirely on your computer.
  • Zero external analytics, telemetry, tracking, or cloud servers.
  • Form passwords, authentication tokens, and credit card numbers are automatically redacted from capture buffers.

  COMPATIBILITY:
  Compatible with Google Chrome, Microsoft Edge, Brave Browser, and Figma Web / Desktop. Web-to-Figma Exporter is an independent open-source tool and is not affiliated with or endorsed by Figma, Inc.
  ```
- **Category:** Developer Tools / Productivity
- **Language:** English (United States)
- **Support Contact:** `https://github.com/cyphex-0/webTOfigma/issues`
- **Privacy Policy URL:** `https://cyphex-0.github.io/webTOfigma/privacy-policy.html`

---

## 2. Permission Justifications for Store Dashboard

| Declared Permission | Justification for Reviewer |
| :--- | :--- |
| **`activeTab`** | Required to read the DOM structure, computed CSS styles, and visual assets of the web page the user explicitly requests to export. Temporary access is triggered only when the user opens the extension popup or activates the in-page minibar. |
| **`storage`** | Used to persist user configuration (default export mode, responsive viewport sizes, UI theme) and cache temporary capture progress chunks locally in IndexedDB. |

---

## 3. Data Usage & Privacy Declarations

- **Single Purpose Compliance:** Converts user-selected web pages and sites into editable Figma canvas layers via clipboard copy-and-paste.
- **Data Collection:**
  - **Website Content:** Checked **YES** (DOM layout, text content, and images are read exclusively on-device to generate Figma vectors).
  - **Personal Information:** **NO**
  - **Financial / Authentication / Health Data:** **NO**
  - **Web History / Activity:** **NO**
- **Data Transmission:** The extension **does not transfer user data to external servers**. Capture data remains strictly in local memory and is copied directly to the OS clipboard.

---

## 4. Reviewer Test Instructions

To verify the extension during Chrome Web Store review:

1. **Installation:**
   - Unzip `web-to-figma-exporter-chromium-v0.1.0.zip` or load `dist/chromium` as an unpacked extension via `chrome://extensions` with Developer Mode enabled.
2. **Step 1 — Single Page Capture:**
   - Navigate to any public website (e.g. `https://example.com` or `https://news.ycombinator.com`).
   - Click the **Web-to-Figma** extension toolbar icon.
   - Select **Current Viewport** mode and click **Start Export**.
   - After capture completes, click **Copy to Figma Clipboard**.
3. **Step 2 — Paste into Figma:**
   - Open any Figma canvas in your browser (`https://www.figma.com`) or Figma Desktop.
   - Click anywhere on the canvas to set focus, then press `Ctrl+V` (Windows) or `Cmd+V` (macOS).
   - Verify that native Figma frames appear with editable text layers and styled rectangles.
4. **Step 3 — Element Picker:**
   - Open popup, select **Selected Element**, hover over any element on the page, and click to export.
5. **Step 4 — Multi-Page Review:**
   - Open popup, select **Multi-Page Website**, click **Discover Pages**, review the route list, and test Odd/Even filters.
