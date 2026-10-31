# Mozilla Add-ons (AMO) Submission Package & Reviewer Guide

**Product:** Web-to-Figma Exporter  
**Target Platform:** Mozilla Add-ons (AMO)  
**Package Artifact:** `release/web-to-figma-exporter-firefox-v0.1.0.zip`  
**Manifest Version:** Manifest V3 (`background.scripts` / Event Page)  
**Gecko ID:** `web-to-figma-exporter@local`  
**Minimum Firefox Version:** `120.0`  
**Status:** **READY FOR SUBMISSION**  

---

## 1. AMO Listing Metadata

- **Name:** Web-to-Figma Exporter
- **Summary (Max 250 chars):**  
  Export web pages and multi-page websites directly to Figma via clipboard copy-and-paste. Fast, editable, and 100% local.
- **Description:** Complete user description matching Chrome Web Store listing.
- **Categories:** Web Development, Photos, Music & Media
- **Support Website:** `https://github.com/cyphex-0/webTOfigma/issues`
- **Privacy Policy URL:** `https://cyphex-0.github.io/webTOfigma/privacy-policy.html`

---

## 2. Gecko Manifest & Engine Verification

- **Background Script Structure:** Firefox MV3 does not require service workers; it utilizes non-persistent background event pages. The manifest defines:
  ```json
  "background": {
    "scripts": ["background.js"]
  }
  ```
- **Strict Min Version:** `120.0` ensures complete compatibility with Firefox's Manifest V3 implementation and modern Web APIs.
- **Zero eval() or Remote Scripts:** Verified via static analysis and automated package inspection.
- **Permissions:** `activeTab`, `storage` only.

---

## 3. Reviewer Testing Instructions

1. Load add-on via `about:debugging#/runtime/this-firefox` -> **Load Temporary Add-on...** -> select `manifest.json` inside the unzipped Firefox package.
2. Navigate to `https://example.com`.
3. Click the extension toolbar icon, select **Current Viewport**, and click **Start Export**.
4. When export finishes, click **Copy to Figma Clipboard**.
5. Switch to Figma and paste (`Ctrl+V` / `Cmd+V`) onto the canvas.
