# Web-to-Figma Extension Security Threat Model

**Product:** Web-to-Figma Exporter  
**Version:** 0.1.0  
**Last Updated:** October 31, 2026  
**Auditor:** Antigravity AI Engineering Suite  

---

## 1. Overview & Security Architecture

Web-to-Figma is a local-first browser extension (Manifest V3) that captures web page DOM structures, styles, and assets, translating them into vector scene graphs for direct clipboard export to Figma. Because the extension interacts directly with untrusted web content and processes binary payloads, it employs a defense-in-depth security model:

- **Isolated Execution Contexts:** Extension logic runs across isolated worlds (Content Script, Background Service Worker/Event Page, Extension Popup/Options).
- **Zero Remote Telemetry:** No page DOM, URL list, text, images, or scene graph is sent to any developer-controlled server.
- **Strict Content Security Policy (CSP):** Prohibits `unsafe-eval`, remote scripts, remote modules, and runtime code execution.
- **Schema Validation at Boundaries:** Every message crossing context boundaries is validated against strict Zod schemas.

---

## 2. Threat Matrix & Detailed Mitigations

### Threat 1: Malicious Page DOM (Deceptive Nodes / Deep Nesting)
- **Severity:** High
- **Exploit Preconditions:** Attacker creates an adversarial page with circular references, deep DOM recursion (> 1000 levels), or billions of empty nodes.
- **Impact:** Call-stack overflow, excessive memory consumption, or freezing of the browser tab.
- **Mitigation:** Bounded iterative traversal in `DOMWalker` (`src/core/dom/dom-walker.ts`). Enforces depth caps (`maxHierarchyDepth`), cycle detection via visited `WeakSet`, and node count budgets. Yields cooperatively to the event loop on large trees.
- **Test Reference:** `src/test/unit/dom-walker.test.ts`, `src/test/unit/job-cancellation.test.ts`
- **Residual Risk Owner:** Core DOM Team (large pages bounded gracefully and flagged as partial).

---

### Threat 2: Hostile Text & Script Injection (XSS, `javascript:` Schemes)
- **Severity:** Critical
- **Exploit Preconditions:** Web page includes hostile strings with HTML tags, `<script>` blocks, or `javascript:` links.
- **Impact:** Execution of malicious scripts in extension popup or minibar context.
- **Mitigation:** Strict URL scheme validator (`validateTargetUrl` in `src/core/security/url-security.ts`) permitting only `http:` and `https:`. All extracted text is encoded strictly as text runs; extension UI never uses `innerHTML` with page-derived content.
- **Test Reference:** `src/test/unit/url-security.test.ts`, `src/test/unit/text-extractor.test.ts`
- **Residual Risk Owner:** Security Architecture Team (Zero executable code reaches Figma Kiwi layers).

---

### Threat 3: SVG Script and Event Payloads
- **Severity:** High
- **Exploit Preconditions:** Attacker embeds `<script>`, `onload`, `onclick`, or `<foreignObject>` inside vector SVG graphics on the target page.
- **Impact:** Script execution upon SVG preview or DOM injection.
- **Mitigation:** Multi-tier allowlist SVG sanitizer (`src/core/assets/svg-sanitizer.ts`). Strips all `<script>`, `<foreignObject>`, and `on*` event handlers, and rejects dangerous entity definitions.
- **Test Reference:** `src/test/unit/svg-sanitizer.test.ts`
- **Residual Risk Owner:** Asset Pipeline Team (Unsupported complex SVG filters stripped with diagnostics).

---

### Threat 4: CSS-Based Resource Abuse & Reentrancy
- **Severity:** Medium
- **Exploit Preconditions:** Attacker crafts circular `@import` statements, infinite layout reflow loops, or adversarial CSS animations.
- **Impact:** High CPU utilization or infinite reflow in the active tab.
- **Mitigation:** The extension inspects only static computed styles (`window.getComputedStyle`). External stylesheet imports are not independently fetched; CSS keyframe animations and transitions are ignored.
- **Test Reference:** `src/test/unit/style-translation.test.ts`
- **Residual Risk Owner:** Style Conversion Team (Resolved by reading static computed styles).

---

### Threat 5: Oversized or Decompression-Bomb Assets
- **Severity:** High
- **Exploit Preconditions:** Web page includes multi-gigapixel images or crafted PNG decompression bombs designed to exhaust memory.
- **Impact:** Out-of-memory crash of extension background worker or Figma WebGL canvas.
- **Mitigation:** Texture budget estimation (`src/core/figma/clipboard/payload-estimator.ts`) and WebGL texture size probing (`MAX_TEXTURE_SIZE`). Oversized raster images are sliced into safe sub-tiles (`sliceOversizedImageNode`). Hard file download limits (max 8MB–32MB depending on hardware tier).
- **Test Reference:** `src/test/unit/payload-estimator.test.ts`, `src/test/unit/production-serializer.test.ts`
- **Residual Risk Owner:** Clipboard Pipeline Team (Oversized assets sliced or downsampled with diagnostics).

---

### Threat 6: Malformed Image & Vector Data
- **Severity:** Medium
- **Exploit Preconditions:** Attacker serves corrupt JPEG/PNG headers or broken SVG syntax.
- **Impact:** Image decoder crash or clipboard serialization failure.
- **Mitigation:** Verification of image byte headers prior to decoding. If decoding fails, fallback to labeled rectangular placeholders preserving layout bounding boxes.
- **Test Reference:** `src/test/unit/asset-fetcher.test.ts`, `src/test/unit/asset-pipeline.test.ts`
- **Residual Risk Owner:** Asset Pipeline Team (Recorded as `ASSET_DOWNLOAD_FAILED` diagnostic).

---

### Threat 7: Supply Chain & Compromised Dependencies
- **Severity:** Critical
- **Exploit Preconditions:** Third-party npm package compromised or malicious dependency introduced.
- **Impact:** Unauthorized code execution within extension build.
- **Mitigation:** Strict lockfile pinning (`package-lock.json`), `npm ci` enforcement, zero non-essential runtime dependencies, automated `npm audit` scans, and strict CSP prohibiting dynamic `eval()` or remote script loading.
- **Test Reference:** `scripts/lint.mjs`, `src/test/unit/rc-qualification.test.ts`
- **Residual Risk Owner:** Release Engineering Team.

---

### Threat 8: Prototype Pollution
- **Severity:** High
- **Exploit Preconditions:** Attacker injects properties like `__proto__` or `constructor` via JSON or messaging payloads.
- **Impact:** Global Object prototype alteration in extension background or popup.
- **Mitigation:** Strict TypeScript domain contracts validated via Zod schemas (`src/shared/schemas/`). Dynamic key lookups utilize ES6 `Map` and `Set` objects rather than plain JavaScript objects.
- **Test Reference:** `src/test/unit/domain-schemas.test.ts`
- **Residual Risk Owner:** Core Architecture Team.

---

### Threat 9: Message Spoofing Across Extension Boundaries
- **Severity:** High
- **Exploit Preconditions:** Malicious webpage or external extension attempts to send messages to `chrome.runtime.onMessage`.
- **Impact:** Triggering unauthorized capture or corrupting extension settings.
- **Mitigation:** Message listeners verify `sender.id === chrome.runtime.id` and validate envelope structures. No `externally_connectable` permissions are declared in manifests.
- **Test Reference:** `src/test/unit/message-router.test.ts`, `src/test/unit/port-transport.test.ts`
- **Residual Risk Owner:** Background Service Team.

---

### Threat 10: Extension UI Injection & DOM Clobbering
- **Severity:** High
- **Exploit Preconditions:** Target page scripts attempt to locate and tamper with the in-page minibar DOM or hijack click events.
- **Impact:** Spoofing export status or phishing user actions.
- **Mitigation:** In-page minibar is hosted inside a closed Shadow DOM (`element.attachShadow({ mode: 'closed' })`). Extension popup executes in an isolated HTML document outside the host page DOM.
- **Test Reference:** `src/test/unit/minibar-injection.test.ts`, `src/test/unit/minibar-app.test.tsx`
- **Residual Risk Owner:** Content UI Team.

---

### Threat 11: Clipboard Payload Corruption & Hijacking
- **Severity:** Medium
- **Exploit Preconditions:** Third-party page script attempts to intercept or modify clipboard data during user copy.
- **Impact:** Malformed clipboard buffer or corrupted Figma scene graph.
- **Mitigation:** Clipboard writing executes synchronously inside a transient user activation click handler. All binary Kiwi schemas and HTML envelopes are pre-compiled and verified before the write operation.
- **Test Reference:** `src/test/unit/figma-clipboard-adapter.test.ts`
- **Residual Risk Owner:** Clipboard Pipeline Team.

---

### Threat 12: Accidental Capture of Sensitive Form Fields
- **Severity:** Critical
- **Exploit Preconditions:** User triggers capture on a page containing passwords, credit card inputs, or secret authentication tokens.
- **Impact:** Unintentional inclusion of personal secrets in exported Figma text layers.
- **Mitigation:** Automatic sensitive field detector (`isSensitiveField` in `src/core/security/content-sanitizer.ts`). Automatically redacts password fields, credit card numbers, CVVs, and auth tokens, replacing values with `••••••••`.
- **Test Reference:** `src/test/unit/content-sanitizer.test.ts`
- **Residual Risk Owner:** Privacy & Security Team.

---

### Threat 13: SSRF & Private Network Navigation Abuse
- **Severity:** High
- **Exploit Preconditions:** Attacker crafts hyperlinks directing the crawler to loopback interfaces (`127.0.0.1`, `localhost`) or cloud metadata endpoints (`169.254.169.254`).
- **Impact:** Internal network reconnaissance or unintended internal device access.
- **Mitigation:** Target URL validator rejects private IP ranges, loopback addresses, internal browser schemes, and non-HTTP protocols. Multi-page crawling is strictly constrained to same-origin URLs.
- **Test Reference:** `src/test/unit/url-security.test.ts`
- **Residual Risk Owner:** Crawler Team.

---

## 3. Threat Model Sign-Off

All 13 identified threat categories have technical mitigations in place, backed by automated unit and integration test suites. Residual risks are bounded and managed by designated engineering owners.
