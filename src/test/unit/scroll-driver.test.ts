import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  discoverScrollContainer,
  driveProgressiveScroll
} from '../../core/capture/scroll-driver';

describe('Progressive Scroll Driver & Container Discovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Mock scrollBy and scroll
    window.scrollBy = vi.fn();
    window.scrollTo = vi.fn();
  });

  describe('discoverScrollContainer', () => {
    it('discovers custom container when root scrollingElement is short and container has overflow-y: scroll', () => {
      document.body.innerHTML = `
        <div id="root" style="height: 600px; overflow-y: scroll;">
          <div style="height: 3000px;">Content</div>
        </div>
      `;

      const rootEl = document.getElementById('root')!;
      // Mock clientHeight and scrollHeight
      Object.defineProperty(rootEl, 'clientHeight', { value: 600, configurable: true });
      Object.defineProperty(rootEl, 'scrollHeight', { value: 3000, configurable: true });

      const discovered = discoverScrollContainer(document, window);
      expect(discovered.isCustom).toBe(true);
      expect(discovered.selector).toBe('#root');
      expect(discovered.target).toBe(rootEl);
    });

    it('uses standard window when document.scrollingElement is already tall', () => {
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: 4000,
        configurable: true
      });

      const discovered = discoverScrollContainer(document, window);
      expect(discovered.isCustom).toBe(false);
      expect(discovered.target).toBe(window);
    });
  });

  describe('driveProgressiveScroll Execution', () => {
    it('drives scrolling and stops when bottom is reached and stable', async () => {
      let currentOffset = 0;
      const totalHeight = 1800;

      Object.defineProperty(document.documentElement, 'scrollHeight', {
        value: totalHeight,
        configurable: true
      });

      window.scrollBy = vi.fn((_x: number | ScrollToOptions = 0, dy?: number) => {
        const delta = typeof _x === 'object' ? (_x.top ?? 0) : (dy ?? 0);
        currentOffset = Math.min(totalHeight, currentOffset + delta);
        Object.defineProperty(window, 'scrollY', { value: currentOffset, configurable: true });
      }) as any;

      const steps: number[] = [];
      const result = await driveProgressiveScroll({
        windowRef: window,
        documentRef: document,
        settleDelayMs: 5,
        maxSteps: 10,
        stableStepThreshold: 2,
        onStepProgress: (s) => steps.push(s)
      });

      expect(result.totalSteps).toBeGreaterThan(0);
      expect(window.scrollBy).toHaveBeenCalled();
      expect(result.isInfiniteScrollCapped).toBe(false);
    });

    it('halts and warns when maximum step limit is reached (infinite scroll trap protection)', async () => {
      // Simulate continuous infinite growth on every scroll
      let height = 1000;
      Object.defineProperty(document.documentElement, 'scrollHeight', {
        get: () => {
          height += 500;
          return height;
        },
        configurable: true
      });

      const result = await driveProgressiveScroll({
        windowRef: window,
        documentRef: document,
        settleDelayMs: 2,
        maxSteps: 4,
        maxDocumentHeight: 50000
      });

      expect(result.isInfiniteScrollCapped).toBe(true);
      expect(result.diagnostics.some((d) => d.code === 'INFINITE_SCROLL_HALTED')).toBe(true);
    });

    it('aborts promptly when AbortSignal is triggered', async () => {
      const controller = new AbortController();
      controller.abort();

      const result = await driveProgressiveScroll({
        windowRef: window,
        documentRef: document,
        signal: controller.signal
      });

      expect(result.totalSteps).toBe(0);
    });
  });
});
