import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DOMWalker } from '../../core/dom/dom-walker';
import { AssetStore } from '../../core/assets/asset-store';
import { sanitizeSvgMarkup } from '../../core/assets/svg-sanitizer';
import { captureCanvasSnapshot } from '../../core/assets/canvas-snapshot';

describe('Asset Pipeline End-to-End: Discovery, Deduplication & Security', () => {
  let fixtureContainer: HTMLDivElement;
  let assetStore: AssetStore;

  beforeEach(() => {
    document.body.innerHTML = '';
    fixtureContainer = document.createElement('div');
    fixtureContainer.id = 'asset-fixture-container';
    document.body.appendChild(fixtureContainer);

    assetStore = new AssetStore();
  });

  afterEach(() => {
    assetStore.clear();
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('discovers assets across multi-card layout and deduplicates identical images to 1 record', async () => {
    // 5 cards sharing identical company logo
    const logoUrl = 'https://example.com/shared-logo.png';
    const fakeLogoBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x30, // 48
      0x00, 0x00, 0x00, 0x30, // 48
      0x08, 0x06, 0x00, 0x00, 0x00
    ]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'image/png' }),
      arrayBuffer: () => Promise.resolve(fakeLogoBytes.buffer)
    } as any);

    for (let i = 1; i <= 5; i++) {
      const card = document.createElement('div');
      card.className = 'card';
      const img = document.createElement('img');
      img.setAttribute('src', logoUrl);
      img.setAttribute('alt', `Partner ${i}`);
      card.appendChild(img);
      fixtureContainer.appendChild(card);
    }

    // Run DOMWalker on fixture container
    const walker = new DOMWalker();
    const result = walker.walk(fixtureContainer);

    const imgNodes = result.nodes.filter((n) => n.sourceTag === 'img');
    expect(imgNodes).toHaveLength(5);

    // Verify all 5 img nodes point to the logo URL
    for (const imgNode of imgNodes) {
      expect(imgNode.assetRefs).toContain(logoUrl);
    }

    // Process all asset refs through the AssetStore
    const registeredAssets: Array<NonNullable<Awaited<ReturnType<typeof assetStore.fetchAndRegister>>>> = [];
    for (const imgNode of imgNodes) {
      for (const ref of imgNode.assetRefs) {
        const record = await assetStore.fetchAndRegister(ref, 'image-bitmap');
        if (record) registeredAssets.push(record);
      }
    }

    expect(registeredAssets).toHaveLength(5);
    // Crucial check: Deduplication must ensure only 1 canonical AssetRecord exists in store!
    expect(assetStore.getAllAssets()).toHaveLength(1);
    expect(registeredAssets.every((r) => r.assetId === registeredAssets[0]?.assetId)).toBe(true);
  });

  it('discovers CSS background-image layers and inline SVG markup', () => {
    const heroSection = document.createElement('section');
    heroSection.className = 'hero';
    heroSection.style.backgroundImage = 'url("https://example.com/hero-banner.jpg")';

    const svgIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgIcon.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M5 12h14');
    svgIcon.appendChild(path);
    heroSection.appendChild(svgIcon);

    fixtureContainer.appendChild(heroSection);

    const walker = new DOMWalker();
    const result = walker.walk(fixtureContainer);

    const heroNode = result.nodes.find((n) => n.classHints.includes('hero'));
    expect(heroNode?.assetRefs).toContain('https://example.com/hero-banner.jpg');

    const svgNode = result.nodes.find((n) => n.sourceTag === 'svg');
    expect(svgNode?.assetRefs.length).toBeGreaterThanOrEqual(1);

    // Sanitize SVG
    const sanitized = sanitizeSvgMarkup(svgIcon.outerHTML);
    expect(sanitized.isSafe).toBe(true);
    expect(sanitized.vectorData?.paths[0]?.d).toBe('M5 12h14');
  });

  it('traps cross-origin canvas security errors without crashing the pipeline', () => {
    const taintedCanvas = document.createElement('canvas');
    taintedCanvas.width = 200;
    taintedCanvas.height = 150;
    fixtureContainer.appendChild(taintedCanvas);

    vi.spyOn(taintedCanvas, 'toDataURL').mockImplementation(() => {
      const err = new Error('Tainted canvases may not be exported.');
      err.name = 'SecurityError';
      throw err;
    });

    const snapshot = captureCanvasSnapshot(taintedCanvas);
    expect(snapshot.captured).toBe(false);
    expect(snapshot.isTainted).toBe(true);
    expect(snapshot.diagnostics.some((d) => d.code === 'CANVAS_TAINTED_CROSS_ORIGIN')).toBe(true);
  });
});
