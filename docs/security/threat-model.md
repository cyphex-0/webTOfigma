# Web-to-Figma Extension Security Threat Model

## Overview
Web-to-Figma is a local-first browser extension (Manifest V3) that captures web page DOM structures, styles, and assets, translating them into vector scene graphs for direct clipboard export to Figma. Because the extension interacts directly with untrusted web content and processes binary payloads, it employs a defense-in-depth security model.

---

## Threat Matrix & Mitigations

### 1. Malicious Page DOM (Deceptive Nodes / Deep Nesting)
- **Threat**: Malicious websites craft cyclic DOM references or deeply nested trees (> 1000 levels) to cause call-stack overflow or out-of-memory crashes.
- **Mitigation**: Bounded iterative DOM traversal (`DOMWalker`) with explicit depth caps (`maxHierarchyDepth`), cycle detection via visited `WeakSet`, and total node count budgeting.
- **Residual Risk**: Ultra-large pages are bounded and marked partial.

### 2. Hostile Text and URLs (XSS, `javascript:` Protocols)
- **Threat**: Pages embedding `javascript:`, `data:`, or `file:` protocols in links or image sources, or injecting script strings into element texts.
- **Mitigation**: Strict URL scheme validator (`validateTargetUrl`) allowing only `http:` and `https:`. All extracted text is encoded as pure string text properties; extension UI never calls `innerHTML` with page-derived content.
- **Residual Risk**: None; unexecutable in Figma Kiwi text layers.

### 3. SVG Script and Event Payloads
- **Threat**: Embedded `<script>`, `onload`, `onclick`, or `<foreignObject>` tags inside vector SVG illustrations.
- **Mitigation**: Multi-tier SVG allowlist sanitizer (`src/core/assets/svg-sanitizer.ts`) stripping all script tags, event handlers, foreign objects, and dangerous entity declarations.
- **Residual Risk**: Unsupported complex SVG filters are stripped with diagnostics.

### 4. CSS-Based Resource Abuse
- **Threat**: Hostile CSS containing infinite recursion, recursive `@import`, or heavy animations.
- **Mitigation**: Compute only static computed styles (`window.getComputedStyle`). External stylesheet imports are not fetched independently; CSS animations are not executed.
- **Residual Risk**: None.

### 5. Oversized or Decompression-Bomb Assets
- **Threat**: Decompression bombs or ultra-tall raster images crashing Figma WebGL canvas or browser memory.
- **Mitigation**: WebGL MAX_TEXTURE_SIZE probing and automatic vertical texture slicing (`sliceOversizedImageNode`). Asset download size caps (max 8MB-32MB per hardware tier).
- **Residual Risk**: Extremely large assets are sliced into seamless sub-frames.

### 6. Malformed Image and Vector Data
- **Threat**: Malformed PNG/JPEG headers or corrupt SVG data causing decoder crashes.
- **Mitigation**: Validation of image content headers, fallback to placeholder bounding boxes on decoder failure.
- **Residual Risk**: Corrupt images logged as `ASSET_FETCH_FAILED`.

### 7. Compromised Dependencies & Supply Chain
- **Threat**: Malicious third-party npm package modifications or transitive vulnerabilities.
- **Mitigation**: Exact lockfile pinning (`package-lock.json`), zero unnecessary runtime dependencies, automated audit CI, strict CSP prohibiting remote code or `eval()`.
- **Residual Risk**: Maintained through scheduled dependency audits.

### 8. Prototype Pollution
- **Threat**: Malicious properties like `__proto__` injected via JSON or object deserialization.
- **Mitigation**: Strict TypeScript domain schemas validated via Zod; use of `Map` data structures rather than bare objects for dynamic keys.
- **Residual Risk**: None.

### 9. Message Spoofing Across Extension Boundaries
- **Threat**: Unauthorized external web pages sending runtime messages to the background script.
- **Mitigation**: MV3 message listener verifies `sender.id === chrome.runtime.id` and validates envelope types (`isValidMessageEnvelope`). No `externally_connectable` permissions enabled.
- **Residual Risk**: None.

### 10. Extension UI Injection (DOM Clobbering)
- **Threat**: In-page Minibar or Popup DOM manipulated by host page scripts.
- **Mitigation**: Minibar is isolated inside a closed Shadow Root (`mode: 'closed'`); Popup runs in an isolated extension page context with zero direct host script access.
- **Residual Risk**: None.

### 11. Clipboard Payload Corruption
- **Threat**: Third-party page scripts attempting to overwrite or intercept clipboard contents during copy.
- **Mitigation**: Advance preparation of all blobs; direct synchronous write inside transient user activation click handler. Baseline `text/html` and `text/plain` MIME types.
- **Residual Risk**: Standard OS clipboard access policies apply.

### 12. Accidental Capture of Sensitive Form Fields
- **Threat**: Passwords, API tokens, or credit card numbers typed on web forms captured in scene nodes.
- **Mitigation**: Sensitive field detection (`isSensitiveField`) masking all password fields, credential autocomplete attributes, and secret tokens with uniform `••••••••`.
- **Residual Risk**: Users should export logged-out views where appropriate.

---

## Architecture Summary
- **Zero Remote Telemetry**: No page DOM, URL list, text, images, or scene graph is sent to any developer-controlled server.
- **Local-First Execution**: All extraction, styling, serialization, and clipboard operations occur 100% locally on the user's machine.
