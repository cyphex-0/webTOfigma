# Software Bill of Materials (SBOM) & Dependency Inventory

**Product:** Web-to-Figma Exporter  
**Version:** 0.1.0  
**License:** MIT  
**Date:** October 31, 2026  

---

## 1. Runtime Production Dependencies

The extension is architected as a local-first, zero-backend browser extension. All runtime code is bundled directly into the distribution packages (`dist/chromium/` and `dist/firefox/`). No dynamic scripts or third-party CDNs are loaded at runtime.

| Package Name | Bundled Version | License | Direct Purpose | Vulnerabilities (npm audit) |
| :--- | :---: | :---: | :--- | :---: |
| **`kiwi-schema`** | `^0.5.0` | MIT | High-performance binary serializer for Figma Kiwi schema clipboards | 0 |
| **`react`** | `^18.3.1` | MIT | Declarative UI components for popup and options panels | 0 |
| **`react-dom`** | `^18.3.1` | MIT | DOM renderer for React UI within extension pages | 0 |
| **`webextension-polyfill`** | `^0.12.0` | MPL-2.0 | Standardized Promise-based browser.* API abstraction | 0 |
| **`zod`** | `^3.23.8` | MIT | Strict runtime schema validation across extension messaging boundaries | 0 |

---

## 2. Development & Tooling Dependencies

| Package Name | Version | License | Purpose |
| :--- | :---: | :---: | :--- |
| **`@testing-library/react`** | `^16.3.3` | MIT | React component testing harness |
| **`@testing-library/dom`** | `^10.4.2` | MIT | DOM testing assertions |
| **`@types/node`** | `^20.17.10` | MIT | TypeScript type definitions for Node.js build tooling |
| **`@types/react`** | `^18.3.12` | MIT | TypeScript type definitions for React |
| **`@types/react-dom`** | `^18.3.1` | MIT | TypeScript type definitions for React DOM |
| **`@types/webextension-polyfill`** | `^0.12.1` | MIT | TypeScript definitions for browser polyfill |
| **`@vitejs/plugin-react`** | `^4.3.4` | MIT | Fast React compilation plugin for Vite |
| **`jsdom`** | `^25.0.1` | MIT | In-memory DOM implementation for unit testing |
| **`typescript`** | `^5.6.3` | Apache-2.0 | Strict static type checker |
| **`vite`** | `^5.4.11` | MIT | Production bundler for MV3 extension targets |
| **`vitest`** | `^2.1.8` | MIT | High-performance unit and integration test runner |

---

## 3. Supply Chain & Vulnerability Audit Results

- **`npm audit` Status:** 0 vulnerabilities (0 critical, 0 high, 0 moderate, 0 low).
- **Lockfile Enforcement:** All builds reproducible via `package-lock.json` (`npm ci`).
- **External Network Access:** None. No runtime phone-home, no telemetry, no tracking scripts.
- **CSP Compliance:** Zero `eval()`, zero `new Function()`, zero remote script execution.
