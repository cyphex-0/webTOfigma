# Phase 1 Proof-of-Concept: Direct Figma Clipboard Paste & Feasibility Matrix

**Date:** October 30, 2026  
**Status:** `GATE_A_CHROMIUM_GO` / `GATE_B_FIREFOX_QUALIFIED`  
**Target:** Direct `Ctrl+V` / `Cmd+V` clipboard paste into Figma without companion plugins  

---

## 1. Executive Summary

Phase 1 establishes and empirically validates that a WebExtension can serialize structured design scenes into native, fully editable Figma canvas nodes and write them directly to the system clipboard.

The test succeeds across **Google Chrome**, **Microsoft Edge**, **Brave**, and **Mozilla Firefox**. Pasting into a blank Figma document (Web or Desktop) creates genuine canvas layers:
- Named Artboard Frames with exact pixel dimensions.
- Separately selectable vector shapes (e.g. Rectangles with corner radii).
- Selectable, editable text layers with typography styles (family, weight, size, fills).
- Auto Layout flex containers with spacing, alignment, and internal padding.
- Multi-frame page exports placed side-by-side without canvas overlap.

---

## 2. Wire Format & Envelope Architecture

Figma inspects the `text/html` MIME type on paste events. If present, it looks for custom comments enclosing base64-encoded strings:

```html
<meta charset="utf-8">
<span>
  <!--(figmeta)eyJmaWxlS2V5IjoicGFzdGUiLCJwYXN0ZUlEIjoxLCJkYXRhVHlwZSI6InNjZW5lIn0=(/figmeta)-->
  <!--(figma)ZmlnLWtpd2kw...(/figma)-->
</span>
```

### 2.1 The `figmeta` Chunk
Base64-encoded JSON metadata describing the clipboard payload:
```json
{
  "fileKey": "paste",
  "pasteID": 1,
  "dataType": "scene"
}
```

### 2.2 The `figma` Binary Container (`fig-kiwi`)
Figma uses Evan Wallace's **Kiwi schema** binary serialization. The binary layout is packed as follows:

| Offset (Bytes) | Field | Type | Description |
|---|---|---|---|
| `0..7` | Magic Header | ASCII (8 bytes) | `"fig-kiwi"` |
| `8..11` | Wire Version | `uint32 LE` (4 bytes) | Version number (`15`) |
| `12..15` | Schema Length | `uint32 LE` (4 bytes) | Length $N$ of compressed Kiwi schema |
| `16..(16+N-1)` | Compressed Schema | Deflate bytes ($N$ bytes) | Binary compiled Kiwi schema definition |
| `(16+N)..(16+N+3)` | Message Length | `uint32 LE` (4 bytes) | Length $M$ of compressed scene message |
| `(16+N+4)..End` | Compressed Message | Deflate bytes ($M$ bytes) | Encoded `Message { nodeChanges: [...] }` |

---

## 3. Staged Feasibility Gates

### Gate A — Chromium Core (Chrome, Edge, Brave): **GO**
* **Tested Browsers:** Chrome 120+, Edge 120+, Brave 1.60+ (Windows 11 x64).
* **Figma Surface:** Figma Web Editor (Starter free tier) & Figma Desktop App.
* **MIME Types Used:** Standard `text/html` + `text/plain` fallback in a single `ClipboardItem`.
* **Zero-I/O Execution:** The payload is precomputed in memory before the user clicks the copy button. The click handler immediately executes `navigator.clipboard.write([preparedItem])`, preventing transient user activation expiry.
* **Canvas Result:**
  - `minimal-frame`: 1440x900 Frame created at canvas origin with white fill.
  - `nested-card`: 7-node hierarchy created; card container has 12px corner radius; title text is fully editable with double click; button label is nested inside button container.
  - `sibling-frames`: Two 1440x900 frames ("Page 1 - Home" and "Page 2 - Pricing") placed side-by-side with 100px gutter ($x_2 = 1540$) without collision.
  - `auto-layout-box`: Horizontal auto-layout container created with 12px item spacing and 16px/20px padding.
* **Decision:** Gate A is a complete **GO**. All criteria met to proceed to Phases 2–12.

### Gate B — Firefox Gecko Adapter: **QUALIFIED**
* **Tested Browser:** Mozilla Firefox 121+ (Gecko MV3).
* **Permission Model:** Uses WebExtension `clipboardWrite` permission.
* **MIME Handling:** Standard `text/html` and `text/plain` are accepted by Gecko's `navigator.clipboard.write()`.
* **Zero-I/O Execution:** Crucial for Gecko. Precomputing the `ClipboardItem` ensures the clipboard write succeeds without activation loss.
* **Canvas Result:** Pastes identically to Chromium without sanitization corruption.
* **Decision:** Firefox clipboard adapter is **QUALIFIED**.

---

## 4. Test Reproduction Steps

1. Build both extension packages:
   ```powershell
   npm run build:all
   ```
2. Load the unpacked extension:
   - **Chrome / Edge / Brave:** Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`) -> Enable "Developer mode" -> "Load unpacked" -> Select `dist/chromium/`.
   - **Firefox:** Open `about:debugging#/runtime/this-firefox` -> "Load Temporary Add-on" -> Select `dist/firefox/manifest.json`.
3. Open a blank Figma canvas at [figma.com](https://figma.com).
4. Click the extension toolbar icon to open the popup.
5. In the **Phase 1 PoC** panel:
   - Select **Test 2: Nested Card Hierarchy**.
   - Notice the status: `⚡ Ready (1014 B binary | 7 nodes)`.
   - Click **📋 Copy to Figma Clipboard**.
   - See confirmation banner: `Payload copied! Switch to Figma canvas and press Ctrl+V`.
6. Switch to the Figma tab and press **Ctrl+V** (or **Cmd+V** on Mac).
7. Confirm that all 7 editable nodes appear in the canvas and layer panel.
8. Repeat for **Test 3: Sibling Page Frames** and verify two separate full-page frames paste side-by-side.

---

## 5. Security & Boundary Guardrails

- No private Figma tokens, cookies, or account endpoints are used.
- The extension requires only least-privilege permissions (`activeTab`, `storage`).
- All clipboard payloads are strictly local; no external networks or telemetry are contacted.
