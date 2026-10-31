import { describe, it, expect } from 'vitest';
import { CanvasArranger } from '../../core/scene/canvas-arranger';
import { MultiPageSceneAssembler, RouteSceneInput } from '../../core/scene/multi-page-assembler';
import type { DiscoveredRoute } from '../../core/crawler/crawl-scope';
import type { PageScene, SceneNode } from '../../shared/contracts/scene';

describe('CanvasArranger 2D Grid Placement', () => {
  function createMockRoute(
    index: number,
    title: string,
    pathname: string,
    category: any = 'Main/Marketing'
  ): DiscoveredRoute {
    return {
      originalUrl: `https://example.com${pathname}`,
      canonicalUrl: `https://example.com${pathname}`,
      pathname,
      title,
      navigationLabel: title,
      category,
      depth: 1,
      paginationNumber: null,
      discoverySource: 'anchor',
      isDestructive: false,
      discoveryIndex: index - 1,
      isSelected: true
    };
  }

  function createMockPageScene(
    id: string,
    width: number,
    height: number
  ): PageScene {
    const rootFrame: SceneNode = {
      id: `frame_${id}`,
      parentId: null,
      childIds: [],
      name: `Frame ${id}`,
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width,
      height,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    return {
      metadata: {
        schemaVersion: 1,
        pageIndex: 1,
        requestedUrl: `https://example.com/${id}`,
        finalUrl: `https://example.com/${id}`,
        title: id,
        readinessState: 'complete',
        capturedAt: Date.now(),
        viewport: {
          width: Math.min(width, 1440),
          height: 900,
          devicePixelRatio: 1,
          scrollX: 0,
          scrollY: 0
        },
        documentDimensions: { width, height },
        captureMode: 'full-page',
        totalNodes: 1
      },
      pageFrame: rootFrame,
      nodes: [rootFrame],
      diagnostics: []
    };
  }

  function buildTestDocument(pageConfigs: Array<{ title: string; path: string; category?: any; width: number; height: number }>) {
    const inputs: RouteSceneInput[] = pageConfigs.map((cfg, i) => {
      const route = createMockRoute(i + 1, cfg.title, cfg.path, cfg.category);
      const scene = createMockPageScene(`p_${i + 1}`, cfg.width, cfg.height);
      return {
        route,
        status: 'completed' as const,
        pageScene: scene
      };
    });

    const assembler = new MultiPageSceneAssembler({ includeMetadataHeaders: true });
    return assembler.assemble(inputs).document;
  }

  it('arranges 2 pages of different heights with zero collisions', () => {
    const doc = buildTestDocument([
      { title: 'Home', path: '/', category: 'Main/Marketing', width: 1440, height: 1200 },
      { title: 'Pricing', path: '/pricing', category: 'Products/Services', width: 1440, height: 3500 }
    ]);

    const arranger = new CanvasArranger({
      includeSiteDirectory: true,
      useNativeSections: false
    });
    const result = arranger.arrange(doc);

    expect(result.hasCollisions).toBe(false);
    expect(result.collisions.length).toBe(0);
    expect(result.totalCanvasWidth).toBeGreaterThan(1400);
    expect(result.totalCanvasHeight).toBeGreaterThan(3000);
  });

  it('arranges 5 pages of mixed dimensions without overlap', () => {
    const doc = buildTestDocument([
      { title: 'Home', path: '/', category: 'Main/Marketing', width: 1440, height: 2000 },
      { title: 'About', path: '/about', category: 'Main/Marketing', width: 1440, height: 800 },
      { title: 'Pricing', path: '/pricing', category: 'Products/Services', width: 1440, height: 4200 },
      { title: 'Documentation', path: '/docs', category: 'Documentation/Help', width: 1440, height: 1500 },
      { title: 'Blog', path: '/blog', category: 'Blog/Articles', width: 1440, height: 1100 }
    ]);

    const arranger = new CanvasArranger({
      includeSiteDirectory: true,
      pageFrameGap: 180,
      categoryGap: 280
    });
    const result = arranger.arrange(doc);

    expect(result.hasCollisions).toBe(false);
    expect(result.collisions.length).toBe(0);
  });

  it('scales to 10 pages across categories with dynamic row wrapping', () => {
    const configs = Array.from({ length: 10 }, (_, i) => ({
      title: `Page ${i + 1}`,
      path: `/page-${i + 1}`,
      category: i < 5 ? 'Main/Marketing' : 'Products/Services',
      width: 1440,
      height: 800 + (i % 4) * 600 // heights from 800px to 2600px
    }));

    const doc = buildTestDocument(configs);
    const arranger = new CanvasArranger({
      maxPagesPerRow: 3, // Wrap every 3 pages
      pageFrameGap: 180
    });
    const result = arranger.arrange(doc);

    expect(result.hasCollisions).toBe(false);
    expect(result.collisions.length).toBe(0);
  });

  it('scales to 25 pages with mixed mobile and desktop widths without collision', () => {
    const configs = Array.from({ length: 25 }, (_, i) => ({
      title: `Route ${i + 1}`,
      path: `/route-${i + 1}`,
      category: i < 10 ? 'Main/Marketing' : i < 20 ? 'Products/Services' : 'Other/Unclassified',
      width: i % 3 === 0 ? 375 : 1440, // Mixed mobile (375px) and desktop (1440px)
      height: 600 + (i % 5) * 800 // heights from 600px to 3800px
    }));

    const doc = buildTestDocument(configs);
    const arranger = new CanvasArranger({
      maxPagesPerRow: 4,
      pageFrameGap: 180,
      categoryGap: 280
    });
    const result = arranger.arrange(doc);

    expect(result.hasCollisions).toBe(false);
    expect(result.collisions.length).toBe(0);
  });

  it('supports native Section nodes when requested', () => {
    const doc = buildTestDocument([
      { title: 'Home', path: '/', category: 'Main/Marketing', width: 1440, height: 1200 },
      { title: 'Features', path: '/features', category: 'Main/Marketing', width: 1440, height: 1500 }
    ]);

    const arranger = new CanvasArranger({
      useNativeSections: true,
      includeSiteDirectory: false
    });
    const result = arranger.arrange(doc);

    expect(result.hasCollisions).toBe(false);
    expect(result.document.sections.length).toBeGreaterThan(0);
    expect(result.document.sections[0]?.type).toBe('SECTION');
  });
});
