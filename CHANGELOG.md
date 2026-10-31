# Changelog

All notable changes to the Web-to-Figma Exporter project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-10-31

### Added
- **Single-Page Export Modes:**
  - **Current Viewport:** Fast, non-destructive capture of the visible viewport preserving exact computed layout without scroll displacement.
  - **Full Page:** Automated incremental scroll driver with dynamic lazy-loading settling, infinite scroll bounding, and automatic scroll position restoration.
  - **Selected Element:** Interactive in-page element picker with high-contrast highlight overlay, breadcrumbs navigation, and isolated component extraction.
- **Multi-Page Website Crawling & Discovery:**
  - Automated same-origin link discovery from anchors and XML sitemaps (`sitemap.xml`, `sitemap_index.xml`).
  - Interactive **Route Review** panel with search, category filtering (Marketing, Blog, Docs, Dashboard), Odd/Even pagination filters, and custom regex inclusion/exclusion.
  - Destructive route protection (automatic exclusion of logout, delete, and account deactivation endpoints).
  - Background tab throttling resilience and cooperative yielding.
- **Canvas Assembly & Figma Organization:**
  - Structured, non-overlapping canvas arrangement for multi-page exports.
  - Automated **Site Directory** board with visual link tree and page inventory.
  - **Responsive Matrix Export:** Viewport variant generation (Mobile, Tablet, Desktop) per route.
  - **Design System Extraction:** Automated extraction of color palette tokens, typography scale, spacing tokens, and repeated component signatures.
- **Production Clipboard Pipeline:**
  - Native binary Kiwi schema serializer for verified Figma node types (`DOCUMENT`, `CANVAS`, `FRAME`, `RECTANGLE`, `TEXT`, `VECTOR`, `COMPONENT`, `INSTANCE`, `SECTION`).
  - Hardware-adaptive payload budget tiers with texture slicing guards (50MB safe batch threshold).
  - Multi-page batch partitioner for oversized payloads with copy sequence tracking.
  - Zero-I/O browser-neutral clipboard adapter supporting direct `Ctrl+V`/`Cmd+V` paste into Figma canvas.
- **Diagnostics, Privacy & Reliability:**
  - Evidence-based page fidelity classifier (`high`, `partial`, `unsupported`) with granular issue codes.
  - Dedicated Diagnostics & Recovery panel with actionable next steps for failed routes or missing assets.
  - Zero-telemetry architecture: 100% local processing with zero external phone-home requests.
  - Sensitive form data redaction (passwords, credit card numbers, authorization tokens).
  - Automated IndexedDB storage cleanup with configurable TTL expiration.
- **Cross-Browser Packaging:**
  - Manifest V3 dual packaging for Chromium (`background.service_worker`) and Firefox (`background.scripts`).
  - Multi-browser automated qualification runner (`test:all-browsers`).
  - Standalone release archives with SHA-256 integrity verification.
