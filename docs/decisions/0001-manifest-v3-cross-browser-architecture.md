# ADR 0001: Manifest V3 Cross-Browser Extension Architecture

- **Status:** Approved
- **Date:** 2026-10-30
- **Context:**
  The Web-to-Figma Exporter must target four mandatory desktop browsers: Google Chrome, Microsoft Edge, Brave, and Mozilla Firefox. Chrome, Edge, and Brave run on Chromium and mandate Manifest V3 with Service Worker backgrounds (`background.service_worker`). Firefox (Gecko) implements Manifest V3 but uses non-persistent background event scripts (`background.scripts`) and has distinct permission and packaging requirements.

- **Decision:**
  1. We maintain a single, shared TypeScript application codebase in `src/`.
  2. We maintain two declarative manifest templates in `manifests/`:
     - `manifests/manifest.chromium.json`
     - `manifests/manifest.firefox.json`
  3. We separate background entrypoints:
     - `src/background/chromium-entry.ts` for Chromium service worker
     - `src/background/firefox-entry.ts` for Firefox event page
     Both delegate directly to runtime-neutral handlers in `src/background/main.ts`.
  4. Extension APIs are normalized through `src/shared/browser/browser-api.ts` utilizing `webextension-polyfill` (`browser.*`). Direct un-abstracted `chrome.*` references in feature modules are prohibited.
  5. Content scripts are compiled as IIFE bundles rather than ES Modules to guarantee universal execution compatibility when injected via `browser.scripting.executeScript`.
  6. The build system outputs two separate build folders: `dist/chromium/` and `dist/firefox/`.

- **Consequences:**
  - Build scripts emit two clean artifacts per build.
  - Zero code duplication in UI, extraction, styles, or scene graph modules.
  - Maximum compliance with Chrome Web Store, Edge Add-ons, and Mozilla Add-ons (AMO) review standards.
