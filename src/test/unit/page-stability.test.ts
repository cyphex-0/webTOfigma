import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  waitForImagesReady,
  waitForFontsReady,
  waitForDOMSettled,
  waitForPageStability
} from '../../core/capture/page-stability';

describe('Page Stability & Resource Readiness Waiter', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('waitForImagesReady', () => {
    it('returns immediately when images are already complete', async () => {
      document.body.innerHTML = `
        <img id="img1" src="data:image/png;base64,iVBORw0KGgo=" />
      `;
      const img = document.getElementById('img1') as HTMLImageElement;
      Object.defineProperty(img, 'complete', { value: true, configurable: true });

      const res = await waitForImagesReady(document.body, 500);
      expect(res.loaded).toBe(1);
      expect(res.failed).toBe(0);
      expect(res.total).toBe(1);
    });

    it('waits for pending image load event', async () => {
      document.body.innerHTML = `
        <img id="img_pending" src="https://example.com/photo.jpg" />
      `;
      const img = document.getElementById('img_pending') as HTMLImageElement;
      Object.defineProperty(img, 'complete', { value: false, configurable: true });

      // Trigger load event after 10ms
      setTimeout(() => {
        img.dispatchEvent(new Event('load'));
      }, 10);

      const res = await waitForImagesReady(document.body, 500);
      expect(res.loaded).toBe(1);
      expect(res.failed).toBe(0);
    });

    it('handles image error gracefully without hanging', async () => {
      document.body.innerHTML = `
        <img id="img_broken" src="https://example.com/broken.jpg" />
      `;
      const img = document.getElementById('img_broken') as HTMLImageElement;
      Object.defineProperty(img, 'complete', { value: false, configurable: true });

      setTimeout(() => {
        img.dispatchEvent(new Event('error'));
      }, 10);

      const res = await waitForImagesReady(document.body, 500);
      expect(res.failed).toBe(1);
    });
  });

  describe('waitForFontsReady', () => {
    it('resolves true when document.fonts.ready resolves', async () => {
      Object.defineProperty(document, 'fonts', {
        value: {
          ready: Promise.resolve()
        },
        configurable: true
      });

      const ready = await waitForFontsReady(document, 500);
      expect(ready).toBe(true);
    });

    it('returns true when document.fonts API is not available', async () => {
      Object.defineProperty(document, 'fonts', {
        value: undefined,
        configurable: true
      });

      const ready = await waitForFontsReady(document, 500);
      expect(ready).toBe(true);
    });
  });

  describe('waitForDOMSettled', () => {
    it('resolves after idle window when mutations stop', async () => {
      const container = document.createElement('div');
      document.body.appendChild(container);

      // Trigger a mutation
      setTimeout(() => {
        const child = document.createElement('span');
        child.textContent = 'Loaded';
        container.appendChild(child);
      }, 5);

      const settled = await waitForDOMSettled(container, 30, 200);
      expect(settled).toBe(true);
    });
  });

  describe('waitForPageStability Aggregation', () => {
    it('aggregates stability checks and returns clean report', async () => {
      document.body.innerHTML = `
        <div>
          <h1>Content</h1>
          <img id="img_ready" src="https://example.com/pic.png" />
        </div>
      `;
      const img = document.getElementById('img_ready') as HTMLImageElement;
      Object.defineProperty(img, 'complete', { value: true, configurable: true });

      const report = await waitForPageStability(document.body, {
        maxWaitMs: 300,
        domIdleTimeoutMs: 20
      });

      expect(report.imagesLoaded).toBe(1);
      expect(report.imagesFailed).toBe(0);
      expect(report.fontsReady).toBe(true);
      expect(report.domSettled).toBe(true);
      expect(report.diagnostics).toHaveLength(0);
    });
  });
});
