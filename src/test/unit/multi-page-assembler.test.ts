import { describe, it, expect } from 'vitest';
import { MultiPageSceneAssembler, RouteSceneInput } from '../../core/scene/multi-page-assembler';
import type { DiscoveredRoute } from '../../core/crawler/crawl-scope';
import type { PageScene, SceneNode } from '../../shared/contracts/scene';

describe('MultiPageSceneAssembler', () => {
  function createMockRoute(
    index: number,
    title: string,
    pathname: string,
    category?: any
  ): DiscoveredRoute {
    return {
      originalUrl: `https://example.com${pathname}`,
      canonicalUrl: `https://example.com${pathname}`,
      pathname,
      title,
      navigationLabel: title,
      category: category ?? 'Main/Marketing',
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
    width: number = 1440,
    height: number = 2400
  ): PageScene {
    const rootFrame: SceneNode = {
      id: `frame_${id}`,
      parentId: null,
      childIds: [`text_${id}`, `btn_${id}`],
      name: 'Initial Frame',
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

    const textNode: SceneNode = {
      id: `text_${id}`,
      parentId: `frame_${id}`,
      childIds: [],
      name: 'Heading - H1',
      type: 'TEXT',
      visible: true,
      x: 40,
      y: 60,
      width: 600,
      height: 48,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: 'Welcome',
        fontSize: 32,
        fontWeight: 700,
        fontFamily: 'Inter',
        textAlign: 'LEFT',
        textAutoResize: 'HEIGHT'
      }
    };

    const btnNode: SceneNode = {
      id: `btn_${id}`,
      parentId: `frame_${id}`,
      childIds: [],
      // Simulate utility class dump from DOM
      name: 'flex items-center justify-center p-3 bg-blue-600 rounded-lg text-white font-semibold',
      type: 'FRAME',
      visible: true,
      x: 40,
      y: 130,
      width: 160,
      height: 44,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
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
          width: 1440,
          height: 900,
          devicePixelRatio: 1,
          scrollX: 0,
          scrollY: 0
        },
        documentDimensions: { width, height },
        captureMode: 'full-page',
        totalNodes: 3
      },
      pageFrame: rootFrame,
      nodes: [rootFrame, textNode, btnNode],
      diagnostics: []
    };
  }

  it('assembles routes in reviewed order even if scenes arrive out-of-order', () => {
    const route1 = createMockRoute(1, 'Home', '/');
    const route2 = createMockRoute(2, 'About', '/about');
    const route3 = createMockRoute(3, 'Contact', '/contact');

    // Simulate completion out-of-order: Route 3 finishes first, then Route 1, then Route 2
    const scene1 = createMockPageScene('home');
    const scene2 = createMockPageScene('about');
    const scene3 = createMockPageScene('contact');

    // Passing in reviewed route sequence [route1, route2, route3]
    const inputs: RouteSceneInput[] = [
      { route: route1, status: 'completed', pageScene: scene1 },
      { route: route2, status: 'completed', pageScene: scene2 },
      { route: route3, status: 'completed', pageScene: scene3 }
    ];

    const assembler = new MultiPageSceneAssembler();
    const result = assembler.assemble(inputs);

    expect(result.isValid).toBe(true);
    expect(result.summary.successfulPages).toBe(3);

    // Verify ordering matches reviewed route order
    expect(result.document.pageFrames[0]?.name).toBe('01 - Home - /');
    expect(result.document.pageFrames[1]?.name).toBe('02 - About - /about');
    expect(result.document.pageFrames[2]?.name).toBe('03 - Contact - /contact');
  });

  it('disambiguates duplicate titles using path and index', () => {
    const route1 = createMockRoute(1, 'Features', '/product/features');
    const route2 = createMockRoute(2, 'Features', '/enterprise/features');

    const scene1 = createMockPageScene('prod_feat');
    const scene2 = createMockPageScene('ent_feat');

    const inputs: RouteSceneInput[] = [
      { route: route1, status: 'completed', pageScene: scene1 },
      { route: route2, status: 'completed', pageScene: scene2 }
    ];

    const assembler = new MultiPageSceneAssembler();
    const result = assembler.assemble(inputs);

    expect(result.document.pageFrames[0]?.name).toBe('01 - Features - /product/features');
    expect(result.document.pageFrames[1]?.name).toBe('02 - Features - /enterprise/features');
  });

  it('retains successful pages when individual pages fail without shifting numbering', () => {
    const route1 = createMockRoute(1, 'Dashboard', '/dashboard');
    const route2 = createMockRoute(2, 'Secret Settings', '/settings/admin'); // Fails (403)
    const route3 = createMockRoute(3, 'Analytics', '/analytics'); // Succeeded

    const scene1 = createMockPageScene('dash');
    const scene3 = createMockPageScene('analytics');

    const inputs: RouteSceneInput[] = [
      { route: route1, status: 'completed', pageScene: scene1 },
      {
        route: route2,
        status: 'redirected_to_auth',
        failureReason: 'Redirected to SSO login'
      },
      { route: route3, status: 'completed', pageScene: scene3 }
    ];

    const assembler = new MultiPageSceneAssembler();
    const result = assembler.assemble(inputs);

    expect(result.summary.totalRoutes).toBe(3);
    expect(result.summary.successfulPages).toBe(2);
    expect(result.summary.redirectedPages).toBe(1);
    expect(result.summary.failedPages).toBe(0);

    // By default, no blank placeholder is created
    expect(result.document.pageFrames.length).toBe(2);

    // CRITICAL: Route 3 must RETAIN index 03, NOT shift down to 02!
    expect(result.document.pageFrames[0]?.name).toBe('01 - Dashboard - /dashboard');
    expect(result.document.pageFrames[1]?.name).toBe('03 - Analytics - /analytics');

    // Diagnostic must be present for route 2
    expect(result.diagnostics.some((d) => d.message.includes('Secret Settings'))).toBe(true);
  });

  it('creates placeholder frames only when explicitly requested', () => {
    const route1 = createMockRoute(1, 'Billing', '/billing');
    const inputs: RouteSceneInput[] = [
      {
        route: route1,
        status: 'failed',
        failureReason: '500 Server Error'
      }
    ];

    // Default: no placeholder
    const defaultAssembler = new MultiPageSceneAssembler({ includeFailedPlaceholders: false });
    const defaultResult = defaultAssembler.assemble(inputs);
    expect(defaultResult.document.pageFrames.length).toBe(0);

    // Explicit opt-in: creates placeholder
    const placeholderAssembler = new MultiPageSceneAssembler({ includeFailedPlaceholders: true });
    const placeholderResult = placeholderAssembler.assemble(inputs);
    expect(placeholderResult.document.pageFrames.length).toBe(1);
    expect(placeholderResult.document.pageFrames[0]?.name).toBe('01 - Billing - /billing');
  });

  it('guarantees metadata headers do not change visual page content dimensions', () => {
    const route = createMockRoute(1, 'Landing', '/');
    const scene = createMockPageScene('landing', 1440, 4800); // 4800px tall page

    const inputs: RouteSceneInput[] = [{ route, status: 'completed', pageScene: scene }];

    const assembler = new MultiPageSceneAssembler({ includeMetadataHeaders: true });
    const result = assembler.assemble(inputs);

    const pageFrame = result.document.pageFrames[0]!;
    // Page frame height MUST be exactly 4800px!
    expect(pageFrame.height).toBe(4800);
    expect(pageFrame.width).toBe(1440);

    // Header frame exists outside the page frame
    const header = result.document.allNodes.find((n) => n.name.startsWith('Header —'));
    expect(header).toBeDefined();
    expect(header?.parentId).toBeNull();
    // Header is positioned above pageFrame (negative y)
    expect(header?.y).toBeLessThan(pageFrame.y);
  });

  it('sanitizes internal layer names and cleans up class-name dumps', () => {
    const route = createMockRoute(1, 'Pricing', '/pricing');
    const scene = createMockPageScene('pricing');

    const inputs: RouteSceneInput[] = [{ route, status: 'completed', pageScene: scene }];

    const assembler = new MultiPageSceneAssembler();
    const result = assembler.assemble(inputs);

    // btnNode had name 'flex items-center justify-center p-3 bg-blue-600 rounded-lg text-white font-semibold'
    // Assembler must sanitize it to 'Container' or a semantic fallback
    const btnInDoc = result.document.allNodes.find((n) => n.id === 'btn_pricing');
    expect(btnInDoc).toBeDefined();
    expect(btnInDoc?.name).toBe('Container');
  });
});
