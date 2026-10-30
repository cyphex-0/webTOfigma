import { describe, it, expect, beforeEach, vi } from 'vitest';
import { captureFullPage } from '../../core/capture/full-page-capture';

describe('Full-Page Capture Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <header id="sticky_header" style="position: sticky; top: 0; width: 1440px; height: 60px; background-color: #ffffff;">
        <h1 style="width: 200px; height: 30px;">Acme Cloud</h1>
      </header>
      <main id="main_top" style="width: 1440px; height: 800px; background-color: #f8fafc;">
        <p style="width: 300px; height: 20px;">Top Section</p>
      </main>
      <section id="deep_section" style="margin-top: 1000px; width: 1440px; height: 800px; background-color: #ffffff;">
        <p style="width: 300px; height: 20px;">Deep Content</p>
      </section>
    `;

    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 3000,
      configurable: true
    });
    Object.defineProperty(document.documentElement, 'scrollWidth', {
      value: 1440,
      configurable: true
    });

    window.scrollTo = vi.fn();
    window.scrollBy = vi.fn();
  });

  it('captures full vertical page dimensions and restores original scroll position', async () => {
    Object.defineProperty(window, 'scrollY', { value: 150, configurable: true });
    Object.defineProperty(window, 'scrollX', { value: 0, configurable: true });

    const result = await captureFullPage({
      windowRef: window,
      documentRef: document,
      scrollOptions: {
        settleDelayMs: 2,
        maxSteps: 5
      }
    });

    expect(result.capture.metadata.captureMode).toBe('full-page');
    expect(result.capture.metadata.documentDimensions.height).toBe(3000);
    expect(result.capture.metadata.documentDimensions.width).toBe(1440);

    // Verify window.scrollTo was called to restore original scroll (150)
    expect(window.scrollTo).toHaveBeenCalledWith(0, 150);

    const nodeTags = result.capture.nodes.map((n) => n.sourceTag.toLowerCase());
    expect(nodeTags).toContain('header');
    expect(nodeTags).toContain('main');
    expect(nodeTags).toContain('section');
  });

  it('restores original scroll offset even when aborted', async () => {
    Object.defineProperty(window, 'scrollY', { value: 300, configurable: true });

    const controller = new AbortController();
    controller.abort();

    await captureFullPage({
      windowRef: window,
      documentRef: document,
      signal: controller.signal
    });

    expect(window.scrollTo).toHaveBeenCalledWith(0, 300);
  });
});
