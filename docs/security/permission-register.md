# Extension Permission-to-Feature Register

## Overview
Web-to-Figma follows the principle of least privilege. It requests only the minimum set of permissions necessary to capture user-selected pages, isolate content scripts, and persist local export settings.

---

## Shipped Permissions Matrix

| Permission | Scope | Feature Requiring It | When Requested | User-Facing Explanation | Test Verification |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `activeTab` | Standard Permission | Capturing current active tab DOM and styles | On user click of the extension action / popup | "Captures the webpage currently active in your frontmost browser window upon user request." | `src/test/unit/permission-manager.test.ts` |
| `storage` | Standard Permission | Persisting export settings, profiles, and transient job logs | Extension install / initialization | "Saves your exporter preferences, capture profiles, and local history on your device." | `src/test/unit/settings-store.test.ts`, `src/test/unit/capture-storage.test.ts` |
| `scripting` | Standard Permission | Injecting the capture engine and interactive Minibar | When starting an export on an injectable web tab | "Instruments the target page to read computed styles and DOM geometry for Figma conversion." | `src/test/unit/minibar-injection.test.ts` |
| `alarms` | Standard Permission | Periodic cleanup of expired temporary capture jobs | Background service worker lifecycle | "Automatically purges temporary capture buffers and old caches after expiration." | `src/test/unit/tab-manager.test.ts`, `src/test/unit/storage-cleanup.test.ts` |
| `clipboardWrite` | Optional / Standard | Writing Figma scene payloads to system clipboard | When user clicks 'Copy to Figma' | "Copies generated vector layers directly to your clipboard so you can paste into Figma." | `src/test/unit/figma-clipboard-adapter.test.ts` |

---

## Prohibited & Avoided Permissions

The following broad or invasive permissions are explicitly **NOT requested**:
- **`cookies`**: Never requested. Web-to-Figma does not access session cookies or auth tokens.
- **`history`**: Never requested. Route discovery inspects only in-page hyperlinks and sitemaps.
- **`webRequest`**: Never requested. Network observation is limited to standard browser fetch during asset downloads.
- **`debugger`**: Never requested. Emulation is measured via window dimensions rather than invasive DevTools instrumentation.
- **`<all_urls>` / Broad Host Permissions**: Never requested by default. Tab access is scoped to the user-activated `activeTab`.
