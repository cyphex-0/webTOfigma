# Web-to-Figma Exporter

Local-first cross-browser extension to capture websites and export them directly to Figma via clipboard copy-and-paste (`Ctrl+V` / `Cmd+V`).

Supported Desktop Browsers:
- **Google Chrome** (Manifest V3)
- **Microsoft Edge** (Manifest V3)
- **Brave** (Manifest V3)
- **Mozilla Firefox** (Gecko Manifest V3)

---

## 1. Prerequisites

- **Node.js:** v20.x LTS or higher (v24.x supported, see `.nvmrc`)
- **npm:** v10.x or higher

---

## 2. Setup & Installation

Clone the repository and install dependencies:

```bash
npm install
```

---

## 3. Development & Building

### Build All Browser Targets
```bash
npm run build:all
```
This produces two clean extension builds in `dist/`:
- `dist/chromium/` (for Chrome, Edge, and Brave)
- `dist/firefox/` (for Mozilla Firefox)

### Build Specific Target
```bash
npm run build:chromium
npm run build:firefox
```

### Type Checking & Unit Tests
```bash
npm run typecheck
npm run test:unit
```

---

## 4. Loading the Extension in Browsers

### Chromium (Google Chrome, Microsoft Edge, Brave)
1. Open the extensions manager:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the `dist/chromium` directory from this project.
5. The **Web-to-Figma Exporter** icon will appear in your browser toolbar. Click it to open the popup.

### Mozilla Firefox
1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select the `dist/firefox/manifest.json` file.
4. The extension will load into Firefox. Click the toolbar icon to view the popup.

---

## 5. Security & Privacy Model

- **100% Local Processing:** All DOM extraction, CSS analysis, and clipboard serialization happen locally on your machine.
- **Zero Telemetry:** No user analytics, crash reporting, or external tracking endpoints.
- **Least-Privilege Permissions:** Phase 0 requests only `activeTab` and `storage`.
