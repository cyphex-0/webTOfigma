# Web-to-Figma Exporter

Local-first, privacy-respecting browser extension to capture web pages and multi-page websites and export them directly to Figma via clipboard copy-and-paste (`Ctrl+V` / `Cmd+V`).

Supported Desktop Browsers:
- **Google Chrome** (Manifest V3 — Service Worker)
- **Microsoft Edge** (Manifest V3 — Service Worker)
- **Brave Browser** (Manifest V3 — Shields Standard compatible)
- **Mozilla Firefox** (Manifest V3 — Gecko Event Page)

---

## 1. Prerequisites

- **Node.js:** v20.x LTS or higher (see `.nvmrc`)
- **npm:** v10.x or higher
- **Figma:** Figma Web in any modern browser or Figma Desktop App

---

## 2. Setup & Installation

Clone the repository and install dependencies using a clean lockfile installation:

```bash
npm ci
```

---

## 3. Development, Build, and Testing Scripts

| Command | Description |
| :--- | :--- |
| `npm run build:all` | Compiles production packages for both `dist/chromium/` and `dist/firefox/`. |
| `npm run build:chromium` | Compiles the Chromium extension package (`dist/chromium/`). |
| `npm run build:firefox` | Compiles the Mozilla Firefox extension package (`dist/firefox/`). |
| `npm run typecheck` | Strict TypeScript compilation check (`tsc --noEmit`). |
| `npm run lint` | Static security and syntax verification (eval, debugger, schema checks). |
| `npm run format:check` | Validates JSON formatting and package configuration integrity. |
| `npm run test:unit` | Executes full Vitest unit and integration test suites. |
| `npm run test:e2e:chrome` | Runs end-to-end qualification against Google Chrome binary. |
| `npm run test:e2e:edge` | Runs end-to-end qualification against Microsoft Edge binary. |
| `npm run test:e2e:brave` | Runs end-to-end qualification against Brave Browser binary. |
| `npm run test:e2e:firefox` | Runs end-to-end qualification against Mozilla Firefox binary. |
| `npm run test:all-browsers` | Runs multi-browser qualification across all four target browsers. |
| `npm run package` | Builds and creates verified release ZIP archives and SHA-256 checksums in `release/`. |

---

## 4. Loading the Extension in Browsers

### 4.1 Chromium-Based Browsers (Google Chrome, Microsoft Edge, Brave)

1. Build the extension:
   ```bash
   npm run build:chromium
   ```
2. Navigate to your browser's extension management page:
   - **Google Chrome:** `chrome://extensions`
   - **Microsoft Edge:** `edge://extensions`
   - **Brave Browser:** `brave://extensions`
3. Toggle on **Developer mode** in the upper right/left settings bar.
4. Click **Load unpacked** (or "Load temporary extension").
5. Select the `dist/chromium` folder inside this repository.
6. The extension is now loaded and ready. Pin the extension icon to your toolbar for convenient access.

> **Updating/Reloading:** After editing source code and running `npm run build:chromium`, return to the extension management tab and click the **Reload** (circular arrow) icon on the Web-to-Figma extension card.

### 4.2 Mozilla Firefox

1. Build the extension:
   ```bash
   npm run build:firefox
   ```
2. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...**.
4. In the file picker, select `dist/firefox/manifest.json`.
5. The extension will appear under **Temporary Extensions**.

> **Updating/Reloading:** Click **Reload** beneath the extension listing in `about:debugging` after rebuilding.

---

## 5. How to Use & Direct Figma Paste Workflow

1. **Open Target Page:** Navigate to any web page you want to capture in your browser.
2. **Launch Extension:** Click the Web-to-Figma toolbar icon or use the in-page minibar.
3. **Select Mode:**
   - **Current Viewport:** Instant non-scrolling capture of what is currently on screen.
   - **Full Page:** Automated scroll driver traverses the full document height, settles lazy images, and restores scroll position.
   - **Selected Element:** Click any element with the interactive outline picker to export an isolated component.
   - **Multi-Page Website:** Crawls same-origin links or XML sitemaps, presents an interactive route review panel with category and Odd/Even filters, and exports a structured canvas matrix.
4. **Copy to Clipboard:** When capture and layout conversion complete, click **Copy to Figma Clipboard**. For exports exceeding 50MB, sequential batching buttons will guide you through copying each section safely.
5. **Paste into Figma:** Switch to your open Figma canvas tab or desktop application, click on the canvas, and press `Ctrl+V` (Windows/Linux) or `Cmd+V` (macOS). The native Figma frames, editable text layers, vectors, and auto-layouts will paste instantly.

---

## 6. Architecture & Privacy Guarantees

- **100% Local-First:** All DOM extraction, CSS translation, and Kiwi clipboard serialization execute entirely inside your local browser runtime.
- **Zero Telemetry:** No user analytics, crash reporting, tracking scripts, or external phone-home requests.
- **Least-Privilege Permissions:** Manifest V3 declares only `activeTab` and `storage`.
- **Sensitive Data Redaction:** Automatically masks and excludes password inputs, authentication tokens, and credit card numbers from capture buffers.
- **Automated Storage Hygiene:** IndexedDB snapshots automatically expire via configurable TTL and can be cleared instantly via the Options page.

---

## 7. Documentation & References

- [Known Limitations & Technical Disclosures](docs/known-limitations.md)
- [Four-Browser Compatibility Matrix](docs/release/four-browser-compatibility-matrix.md)
- [Release Candidate Report](docs/release/release-candidate-report.md)
- [Software Bill of Materials (SBOM)](docs/release/dependency-inventory.md)
- [Security Threat Model](docs/security/threat-model.md)
- [Permission Register](docs/security/permission-register.md)
- [Changelog](CHANGELOG.md)
