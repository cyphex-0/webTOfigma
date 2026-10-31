# Browser Permission Disclosures & Feature Mapping

**Product:** Web-to-Figma Exporter  
**Version:** 0.1.0  
**Last Updated:** October 31, 2026  

---

## 1. Permission Justification Register

Every permission requested by the Web-to-Figma Exporter is governed by the principle of **least privilege**. This register maps every permission declared in `manifest.json` to its visible user feature, invocation trigger, user rationale, and automated verification test.

| Permission Name | Declared In | Shipped Feature Dependency | Invocation Trigger | User-Facing Rationale | Automated Verification Test |
| :--- | :---: | :--- | :--- | :--- | :--- |
| **`activeTab`** | Chromium & Firefox | Page DOM traversal, viewport capture, element picker, and minibar injection. | User clicks the extension toolbar icon or minibar action. | Accesses the currently active web page solely to extract DOM layout, typography, and assets upon user command. | `src/test/unit/manifest.test.ts`, `src/test/unit/permission-manager.test.ts` |
| **`storage`** | Chromium & Firefox | User preferences (mode, viewports, theme), capture profiles, and temporary job recovery. | Extension startup, options modification, and multi-page job progression. | Persists user settings across browser sessions and caches temporary capture chunks locally in IndexedDB. | `src/test/unit/settings-store.test.ts`, `src/test/unit/capture-storage.test.ts` |
| **`clipboardWrite`** | Chromium & Firefox (via standard Web API) | Direct `Ctrl+V` / `Cmd+V` paste into Figma canvas. | User clicks "Copy to Figma Clipboard" button. | Writes the serialized Kiwi binary or HTML clipboard payload directly to the operating system clipboard buffer. | `src/test/unit/figma-clipboard-adapter.test.ts`, `src/test/unit/production-serializer.test.ts` |

---

## 2. Explicitly Prohibited Broad Permissions

The following permissions are **strictly prohibited** from the Web-to-Figma codebase and manifests:

| Prohibited Permission | Risk Prevented | Why It Is Unnecessary |
| :--- | :--- | :--- |
| **`<all_urls>` / `*://*/*`** | Continuous silent access to every website visited by the user. | The extension uses `activeTab`, which grants temporary access strictly to the focused page when triggered. |
| **`cookies`** | Accidental interception of session cookies, authentication tokens, or tracker IDs. | The extension does not need or touch authentication cookies. |
| **`webRequest` / `webRequestBlocking`** | Passive network surveillance or modification of browser traffic. | Asset fetching is done via standard, unprivileged DOM subresource requests. |
| **`debugger`** | Broad DevTools protocol access and arbitrary process control. | All layout measurement uses native browser APIs (`getBoundingClientRect`, `getComputedStyle`). |
| **`history`** | Surveillance of user browsing habits and search history. | Only links discovered directly on the user-selected website are crawled. |
| **`management`** | Inspecting or altering other installed browser extensions. | Extension operates in strict isolation. |

---

## 3. Chrome Web Store & Edge Add-Ons Disclosure Answers

When prompted during store developer dashboard submission:
- **Single Purpose Description:** Converts web page layout, text, and assets into editable Figma scene components via clipboard copy and paste.
- **Permission Justifications:**
  - `activeTab`: Needed to inspect the DOM of the web page the user wants to export to Figma.
  - `storage`: Needed to store user export preferences, custom viewport profiles, and local job states.
- **Data Usage:**
  - **Website Content:** Yes (DOM structure, computed CSS styles, and page images are processed strictly on-device to produce Figma vectors).
  - **Personal Information:** No (No names, emails, addresses, or identifiers are collected).
  - **Financial & Payment Data:** No (Payment inputs are explicitly redacted from capture buffers).
  - **Health Information:** No.
  - **Authentication Info:** No (Passwords and login tokens are explicitly excluded).
  - **Web History:** No.
  - **User Activity:** No telemetry, analytics, or behavioral tracking.
