# Microsoft Edge Add-ons Submission Package & Reviewer Guide

**Product:** Web-to-Figma Exporter  
**Target Platform:** Microsoft Edge Add-ons (Partner Center)  
**Package Artifact:** `release/web-to-figma-exporter-chromium-v0.1.0.zip`  
**Manifest Version:** Manifest V3 (`background.service_worker`)  
**Status:** **READY FOR SUBMISSION**  

---

## 1. Store Listing Metadata

- **Name:** Web-to-Figma Exporter
- **Short Description:** Export web pages and multi-page websites directly into Figma via clipboard paste. 100% local, editable vector frames.
- **Category:** Developer / Productivity
- **Support Contact:** `https://github.com/cyphex-0/webTOfigma/issues`
- **Privacy Policy URL:** `https://cyphex-0.github.io/webTOfigma/privacy-policy.html`

---

## 2. Partner Center Certification Disclosures

- **Host Permissions:** None declared (`<all_urls>` is not requested).
- **Core Permissions:**
  - `activeTab`: Grants access to the active webpage only upon explicit user interaction (popup click).
  - `storage`: Preserves user preferences and offline capture state in local IndexedDB.
- **Zero Third-Party Telemetry:** No analytics scripts, crash reporting endpoints, or advertising trackers.

---

## 3. Microsoft Edge Verification Evidence

- Tested on native Microsoft Edge build (`msedge.exe` v131+).
- Unpacked package load verified via `edge://extensions`.
- Direct clipboard write and Figma paste verified in Edge browsing context.
