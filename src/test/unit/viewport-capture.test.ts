import { describe, it, expect, beforeEach } from 'vitest';
import {
  intersectsViewport,
  captureViewport
} from '../../core/capture/viewport-capture';

describe('Viewport Capture Engine', () => {
  describe('intersectsViewport', () => {
    it('returns true for fully enclosed rectangles', () => {
      expect(intersectsViewport({ x: 50, y: 50, width: 200, height: 100 }, 1440, 900)).toBe(true);
    });

    it('returns true for partially visible rectangles crossing viewport edges', () => {
      // Partially off top
      expect(intersectsViewport({ x: 50, y: -50, width: 200, height: 100 }, 1440, 900)).toBe(true);
      // Partially off bottom
      expect(intersectsViewport({ x: 50, y: 850, width: 200, height: 100 }, 1440, 900)).toBe(true);
      // Partially off left
      expect(intersectsViewport({ x: -100, y: 100, width: 200, height: 100 }, 1440, 900)).toBe(true);
      // Partially off right
      expect(intersectsViewport({ x: 1400, y: 100, width: 200, height: 100 }, 1440, 900)).toBe(true);
    });

    it('returns false for rectangles completely outside the viewport', () => {
      // Completely above
      expect(intersectsViewport({ x: 50, y: -200, width: 200, height: 100 }, 1440, 900)).toBe(false);
      // Completely below
      expect(intersectsViewport({ x: 50, y: 1200, width: 200, height: 100 }, 1440, 900)).toBe(false);
      // Completely to the left
      expect(intersectsViewport({ x: -300, y: 100, width: 200, height: 100 }, 1440, 900)).toBe(false);
      // Completely to the right
      expect(intersectsViewport({ x: 1600, y: 100, width: 200, height: 100 }, 1440, 900)).toBe(false);
    });

    it('returns false for degenerate zero-size rectangles', () => {
      expect(intersectsViewport({ x: 50, y: 50, width: 0, height: 100 }, 1440, 900)).toBe(false);
      expect(intersectsViewport({ x: 50, y: 50, width: 100, height: 0 }, 1440, 900)).toBe(false);
    });
  });

  describe('captureViewport Execution', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <header id="nav" style="position: fixed; top: 0; left: 0; width: 1440px; height: 60px;">
          <h1 style="width: 200px; height: 40px;">Acme Header</h1>
        </header>
        <main id="hero" style="margin-top: 60px; width: 1440px; height: 500px;">
          <p style="width: 300px; height: 24px;">Hero Content</p>
        </main>
        <section id="below_fold" style="margin-top: 1500px; width: 1440px; height: 600px;">
          <p style="width: 300px; height: 24px;">Deep Content</p>
        </section>
        <div id="cookie_banner" class="cookie-consent-bar" style="position: fixed; bottom: 0; width: 1440px; height: 80px;">
          <p style="width: 200px; height: 20px;">We use cookies</p>
        </div>
      `;
    });

    it('captures visible elements without modifying window scroll position', () => {
      const initialScroll = window.scrollY;
      const { capture, diagnostics } = captureViewport({
        windowRef: window,
        documentRef: document
      });

      expect(window.scrollY).toBe(initialScroll);
      expect(capture.metadata.captureMode).toBe('viewport');
      expect(capture.metadata.documentDimensions.width).toBe(window.innerWidth);
      expect(capture.metadata.documentDimensions.height).toBe(window.innerHeight);

      expect(diagnostics.some((d) => d.code === 'VIEWPORT_SCROLL_ALTERED')).toBe(false);

      const nodeTags = capture.nodes.map((n) => n.sourceTag.toLowerCase());
      expect(nodeTags).toContain('header');
      expect(nodeTags).toContain('h1');
      expect(nodeTags).toContain('main');
    });

    it('excludes cookie banner when excludeCookieBanners is enabled', () => {
      const { capture } = captureViewport({
        windowRef: window,
        documentRef: document,
        excludeCookieBanners: true
      });

      const hasCookieBanner = capture.nodes.some((n) =>
        n.classHints.some((c) => c.includes('cookie-consent'))
      );
      expect(hasCookieBanner).toBe(false);
    });
  });
});
