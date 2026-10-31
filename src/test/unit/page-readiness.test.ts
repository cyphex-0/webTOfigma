import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { waitForPageReadiness } from '../../core/crawler/page-readiness';

describe('PageReadiness Evaluator', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.title = 'Test Readiness Page';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('evaluates immediately ready page when DOM is complete and images settled', async () => {
    document.body.innerHTML = '<h1>Immediate Page</h1>';

    const res = await waitForPageReadiness({
      doc: document,
      win: window,
      maxWaitMs: 1000,
      domQuietSettleMs: 50
    });

    expect(res.isReady).toBe(true);
    expect(res.domReady).toBe(true);
    expect(res.imagesSettled).toBe(true);
    expect(res.documentTitle).toBe('Test Readiness Page');
  });

  it('awaits pending images to complete loading', async () => {
    const img = document.createElement('img');
    img.src = 'https://example.com/banner.png';
    Object.defineProperty(img, 'complete', { value: false, writable: true, configurable: true });
    document.body.appendChild(img);

    // Simulate image loading after 40ms
    setTimeout(() => {
      Object.defineProperty(img, 'complete', { value: true, configurable: true });
      img.dispatchEvent(new Event('load'));
    }, 40);

    const res = await waitForPageReadiness({
      doc: document,
      win: window,
      maxWaitMs: 1000,
      domQuietSettleMs: 30
    });

    expect(res.isReady).toBe(true);
    expect(res.imagesSettled).toBe(true);
  });

  it('does not hang indefinitely when images fail or hang', async () => {
    const brokenImg = document.createElement('img');
    brokenImg.src = 'https://example.com/broken.jpg';
    Object.defineProperty(brokenImg, 'complete', { value: false, configurable: true });
    document.body.appendChild(brokenImg);

    // Never triggers load or complete, but maxImagesWaitMs is 50ms
    const res = await waitForPageReadiness({
      doc: document,
      win: window,
      maxImagesWaitMs: 50,
      maxWaitMs: 500,
      domQuietSettleMs: 20
    });

    expect(res.isReady).toBe(true);
    expect(res.imagesSettled).toBe(true);
  });

  it('debounces visual DOM mutations until stability window settles', async () => {
    let mutationsCount = 0;
    const interval = setInterval(() => {
      if (mutationsCount < 2) {
        const p = document.createElement('p');
        p.textContent = `Mutation ${mutationsCount++}`;
        document.body.appendChild(p);
      } else {
        clearInterval(interval);
      }
    }, 20);

    const res = await waitForPageReadiness({
      doc: document,
      win: window,
      maxWaitMs: 1000,
      domQuietSettleMs: 50
    });

    expect(res.isReady).toBe(true);
    expect(res.stabilitySettled).toBe(true);
  });

  it('safely bounds execution by maxWaitMs even under continuous mutations', async () => {
    // Generate unending mutations
    const interval = setInterval(() => {
      const span = document.createElement('span');
      document.body.appendChild(span);
    }, 10);

    const res = await waitForPageReadiness({
      doc: document,
      win: window,
      maxWaitMs: 120,
      domQuietSettleMs: 100
    });

    clearInterval(interval);
    expect(res.isReady).toBe(true);
    expect(res.elapsedMs).toBeLessThanOrEqual(400);
  });
});
