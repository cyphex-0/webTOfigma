# Web-to-Figma Exporter — Complete User Guide

Welcome to **Web-to-Figma Exporter**, a privacy-first browser extension that lets you capture web pages and multi-page sites and paste them directly into Figma as editable vector frames, text layers, and layout components using standard clipboard copy-and-paste (`Ctrl+V` / `Cmd+V`).

---

## 1. Installation

### Google Chrome, Microsoft Edge, and Brave
1. Download `web-to-figma-exporter-chromium-v0.1.0.zip` from our releases page and extract it to a local folder.
2. Open your browser's extension manager:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`
3. Turn on **Developer mode** (toggle in upper right or left corner).
4. Click **Load unpacked** and select the extracted folder (or `dist/chromium`).
5. Pin the extension icon to your browser toolbar.

### Mozilla Firefox
1. Download `web-to-figma-exporter-firefox-v0.1.0.zip` and extract it.
2. In Firefox, navigate to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on...** and select `manifest.json`.

---

## 2. Export Modes

Web-to-Figma offers four specialized export modes accessible directly from the popup or the in-page minibar:

### 2.1 Current Viewport
- **Best for:** Fast capture of the above-the-fold hero area, landing screens, or responsive UI components.
- **How it works:** Instantly captures all visible elements at your current screen size without scrolling. Original scroll position is completely untouched.

### 2.2 Full Page
- **Best for:** Complete marketing pages, articles, documentation, or long dashboards.
- **How it works:** An automated scroll driver traverses the entire document height, settles lazy-loaded images, pauses for dynamic assets, bounds infinite scroll loops, and restores your initial scroll position.

### 2.3 Selected Element
- **Best for:** Isolating a single button, modal dialog, navigation bar, or content card.
- **How it works:** Activates an interactive hover outline picker. Hover over any element to see its tag and bounding dimensions. Click to capture only that component and its nested children. Press `Esc` to cancel.

### 2.4 Multi-Page Website
- **Best for:** Whole site architecture exports, sitemap design conversions, and design-system extraction.
- **How it works:**
  1. Click **Discover Pages**. The extension crawls same-origin links and XML sitemaps.
  2. The **Route Review** panel opens, grouping pages by category (Marketing, Blog, Docs, Dashboard).
  3. Filter routes using search, Odd/Even pagination buttons, or custom regex.
  4. Click **Export Selected Routes**. The extension captures all selected routes, arranges them in a non-overlapping canvas grid, and generates a **Site Directory** and **Design System** token board.

---

## 3. Pasting Directly into Figma

Once capture and conversion complete, you are ready to bring the layout into Figma:

1. Click the blue **Copy to Figma Clipboard** button in the extension.
2. If the export exceeds 50MB (common for large multi-page sites), sequential batch buttons (**Copy Batch 1 of 3**, etc.) will appear. Click each batch sequentially.
3. Switch to your open Figma canvas tab in your browser (`figma.com`) or the Figma Desktop application.
4. Click anywhere on the Figma canvas to set focus.
5. Press `Ctrl+V` (Windows/Linux) or `Cmd+V` (macOS).
6. Your web layout will paste immediately as native Figma frames!

---

## 4. What is Editable in Figma?

- **Text Layers:** Text remains genuine, editable text layers using matching font families, weights, letter spacing, and line heights.
- **Auto Layout:** CSS Flexbox containers (`row`, `column`, `space-between`, `gap`) are converted to native Figma Auto Layout frames.
- **Vectors & Icons:** Inline SVGs and vector icons are translated into vector paths and boolean shapes.
- **Styles:** Solid colors, gradients, drop shadows, inner shadows, and corner radiuses are translated to Figma fill and stroke properties.

---

## 5. Privacy & Storage Management

- **Zero Telemetry:** The extension communicates exclusively with the website you are actively exporting. No page data, URLs, or images are ever transmitted to external servers.
- **Sensitive Data Masking:** Passwords, credit card numbers, and secret tokens are automatically replaced with `••••••••`.
- **Storage Deletion:** Temporary capture snapshots are stored locally in your browser's private IndexedDB database and automatically expire after 24 hours. To purge all stored data immediately, click **Options** in the popup footer and click **Clear All Storage**.
