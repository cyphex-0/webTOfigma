# Privacy Policy for Web-to-Figma Exporter

**Effective Date:** October 31, 2026  
**Version:** 1.0.0  
**Publisher:** Web-to-Figma Open Source Project  
**Hosted Location:** `https://cyphex-0.github.io/webTOfigma/privacy-policy.html`  
**Contact:** `privacy@webtofigma.local` (or GitHub Issues at `https://github.com/cyphex-0/webTOfigma`)

---

## 1. Introduction

The **Web-to-Figma Exporter** browser extension ("Web-to-Figma", "the Extension", "we", "us") is designed with a fundamental **local-first, privacy-by-design** architecture. 

Our core commitment to our users is clear and absolute: **We do not collect, transmit, store, monetize, or sell your personal information, browsing history, or captured website content.** All processing required to transform a web page into a Figma design occurs entirely on your local computer within your browser.

---

## 2. What Data We Access and Why

When you explicitly initiate an export action, the Extension accesses only the web content necessary to produce your design:

1. **Active Web Page Content:**
   - **DOM Structure & Text:** HTML element hierarchy and text nodes are read to recreate layout frames and editable text layers in Figma.
   - **Styles & Layout:** Computed CSS properties (typography, colors, borders, shadows, spacing, flexbox/grid dimensions) are analyzed to construct high-fidelity Figma components.
   - **Images & SVG Vectors:** Visual assets and vectors referenced on the page are downloaded locally to be packaged into Figma image fills and vector layers.
2. **URLs & Sitemaps (Multi-Page Mode Only):**
   - In multi-page website mode, the Extension extracts same-origin hyperlinks and optionally inspects `sitemap.xml` solely to present an interactive route selection list for you to review and approve.
3. **Local Extension Preferences:**
   - Your preferred default export mode, capture viewport dimensions, and interface theme are stored locally in your browser's extension storage (`chrome.storage.local` or `browser.storage.local`).

---

## 3. What We Never Collect or Process

The Extension strictly excludes sensitive data:
- **No Credentials or Form Secrets:** Password fields (`<input type="password">`), payment inputs (credit cards, CVVs), and hidden authentication tokens are automatically masked and excluded from capture buffers.
- **No Cookies or Session Storage:** We do not read `document.cookie`, `localStorage`, `sessionStorage`, or browser history.
- **No Inactive Tab Tracking:** The Extension does not monitor what tabs you open or track your web browsing activity.
- **No Third-Party Telemetry:** We do not embed Google Analytics, Mixpanel, Sentry, or any third-party analytics or crash reporting SDKs.

---

## 4. Where Your Data is Processed and Stored

- **100% On-Device:** All DOM walking, style conversion, and binary Kiwi serialization execute directly in your browser's local sandbox memory.
- **Temporary Local Storage:** During multi-page captures, intermediate data is stored in a private local IndexedDB database on your machine.
- **Automated Deletion:** Temporary capture data automatically expires and is purged from local storage after 24 hours. You can also manually delete all stored capture snapshots and asset caches at any time by clicking **Clear All Storage** in the Extension Options page.
- **Clipboard Delivery:** When you click **Copy to Figma Clipboard**, the generated payload is placed onto your operating system's local clipboard buffer. The data is only transmitted into Figma when you manually paste it (`Ctrl+V` or `Cmd+V`) into your active Figma canvas.

---

## 5. Sharing and Third-Party Disclosure

**We do not share, transmit, disclose, or sell any user data to third parties.**

The only network requests the Extension ever initiates are standard HTTP `GET` requests sent directly to the original website you are capturing (for instance, to download an image or CSS background referenced on that page). No data is sent to the developer, publisher, or any external service.

---

## 6. Permissions and Least Privilege

The Extension requests the minimum permissions required to perform its functions:
- **`activeTab`:** Grants temporary access to the currently focused page only when you click the extension icon.
- **`storage`:** Stores your local preferences and temporary capture jobs locally on your computer.
- **`clipboardWrite`:** Allows writing the generated Figma scene payload to your system clipboard upon your explicit button click.

We deliberately do not request broad permissions like `<all_urls>`, `webRequest`, `cookies`, `debugger`, or `history`.

---

## 7. User Control & Rights

You maintain complete control over your data:
- You choose which pages, viewports, and elements to capture.
- You can review and filter multi-page routes before initiating a crawl.
- You can cancel any capture in progress immediately with zero residual processing.
- You can clear all cached snapshots with a single click in Extension Options.
- Uninstalling the Extension completely removes all stored preferences and cached assets from your computer.

---

## 8. Changes to this Privacy Policy

If we ever make material changes to how the Extension handles data, we will increment the policy version number and date, update the extension release notes, and prompt users with an in-product disclosure.

---

## 9. Contact Us

If you have questions, feedback, or concerns regarding this Privacy Policy or the security of Web-to-Figma, please open an issue on GitHub:
- **GitHub Repository:** `https://github.com/cyphex-0/webTOfigma`
- **Security Contact:** `security@webtofigma.local`
