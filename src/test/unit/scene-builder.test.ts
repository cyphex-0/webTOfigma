import { describe, it, expect } from 'vitest';
import { buildPageScene, buildFigmaSceneDocument } from '../../core/scene/scene-builder';
import { validatePageScene } from '../../core/scene/scene-validation';
import { landingPageMetadata, landingPageNodes } from '../fixtures/landing-page.fixture';
import { nestedFlexCardNodes } from '../fixtures/nested-flex-card.fixture';
import { PageCapture } from '../../shared/contracts/scene';

describe('SceneBuilder Engine', () => {
  describe('Full Page Scene Graph Construction', () => {
    it('builds a complete, valid PageScene from landing page fixtures', () => {
      const capture: PageCapture = {
        metadata: landingPageMetadata,
        nodes: landingPageNodes,
        assetRefs: ['asset_hash_hero', 'asset_hash_logo']
      };

      const scene = buildPageScene(capture);

      expect(scene.pageFrame).toBeDefined();
      expect(scene.pageFrame.name).toBe('01 — Acme SaaS — Modern Workflow Platform — /landing');
      expect(scene.pageFrame.width).toBe(1440);
      expect(scene.pageFrame.height).toBe(2400);
      expect(scene.pageFrame.type).toBe('FRAME');
      expect(scene.pageFrame.parentId).toBeNull();

      // Check validation
      const validation = validatePageScene(scene);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);

      // Verify separate native node types exist
      const nodeTypes = new Set(scene.nodes.map((n) => n.type));
      expect(nodeTypes.has('FRAME')).toBe(true);
      expect(nodeTypes.has('TEXT')).toBe(true);

      // Verify text node properties
      const textNodes = scene.nodes.filter((n) => n.type === 'TEXT');
      expect(textNodes.length).toBeGreaterThan(0);
      for (const t of textNodes) {
        expect(t.textData).toBeDefined();
        expect(typeof t.textData?.text).toBe('string');
        expect(t.textData?.fontSize).toBeGreaterThan(0);
      }
    });

    it('maps image and vector nodes into native IMAGE and VECTOR scene layers', () => {
      const capture: PageCapture = {
        metadata: landingPageMetadata,
        nodes: [
          ...landingPageNodes,
          {
            nodeId: 'img_hero',
            parentId: 'p0_n_0',
            childIds: [],
            sourceTag: 'IMG',
            semanticKind: 'image',
            classHints: ['rounded-lg'],
            textRuns: [],
            sourceRect: { x: 40, y: 300, width: 600, height: 400 },
            documentRect: { x: 40, y: 300, width: 600, height: 400 },
            visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
            stacking: { createsStackingContext: false, zIndex: 'auto' },
            computedStyle: {
              ...landingPageNodes[0]!.computedStyle,
              borderRadius: '8px'
            },
            layoutHints: { isFlexContainer: false, isGridContainer: false, isInline: false, isBlock: true },
            assetRefs: ['asset_hash_hero']
          },
          {
            nodeId: 'svg_icon',
            parentId: 'p0_n_0',
            childIds: [],
            sourceTag: 'SVG',
            semanticKind: 'vector',
            classHints: ['w-6', 'h-6'],
            textRuns: [],
            sourceRect: { x: 100, y: 100, width: 24, height: 24 },
            documentRect: { x: 100, y: 100, width: 24, height: 24 },
            visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
            stacking: { createsStackingContext: false, zIndex: 'auto' },
            computedStyle: {
              ...landingPageNodes[0]!.computedStyle
            },
            layoutHints: { isFlexContainer: false, isGridContainer: false, isInline: false, isBlock: true },
            assetRefs: []
          }
        ],
        assetRefs: ['asset_hash_hero']
      };

      const scene = buildPageScene(capture);
      const nodeTypes = new Set(scene.nodes.map((n) => n.type));
      expect(nodeTypes.has('IMAGE')).toBe(true);
      expect(nodeTypes.has('VECTOR')).toBe(true);

      const imgNode = scene.nodes.find((n) => n.type === 'IMAGE');
      expect(imgNode?.fills[0]?.type).toBe('IMAGE');
      expect(imgNode?.fills[0]?.imageRef).toBe('asset_hash_hero');

      const vecNode = scene.nodes.find((n) => n.type === 'VECTOR');
      expect(vecNode).toBeDefined();
    });

    it('adapts page frame dimensions according to captureMode', () => {
      // Viewport mode
      const viewportCapture: PageCapture = {
        metadata: {
          ...landingPageMetadata,
          captureMode: 'viewport'
        },
        nodes: landingPageNodes
      };

      const vpScene = buildPageScene(viewportCapture);
      expect(vpScene.pageFrame.width).toBe(1440);
      expect(vpScene.pageFrame.height).toBe(900); // Viewport height, not document 2400

      // Selected element mode
      const selectedCapture: PageCapture = {
        metadata: {
          ...landingPageMetadata,
          captureMode: 'selected-element'
        },
        nodes: [
          {
            ...landingPageNodes[0]!,
            documentRect: { x: 100, y: 150, width: 480, height: 320 }
          }
        ]
      };

      const selScene = buildPageScene(selectedCapture);
      expect(selScene.pageFrame.width).toBe(480);
      expect(selScene.pageFrame.height).toBe(320);
    });

    it('attaches Auto Layout metadata to Flexbox containers', () => {
      const capture: PageCapture = {
        metadata: {
          ...landingPageMetadata,
          documentDimensions: { width: 600, height: 400 }
        },
        nodes: nestedFlexCardNodes
      };

      const scene = buildPageScene(capture);
      const flexContainer = scene.nodes.find((n) => n.layoutMetadata?.layoutMode === 'HORIZONTAL' || n.layoutMetadata?.layoutMode === 'VERTICAL');

      expect(flexContainer).toBeDefined();
      expect(flexContainer?.layoutMetadata?.decisionRecord).toBe('auto-layout-exact');
    });

    it('attaches optional Visual Reference Snapshot when requested', () => {
      const capture: PageCapture = {
        metadata: landingPageMetadata,
        nodes: landingPageNodes,
        assetRefs: ['asset_hash_hero']
      };

      const scene = buildPageScene(capture, { includeVisualSnapshot: true });
      const snapshotChild = scene.nodes.find((n) => n.name === 'Visual Reference Snapshot');

      expect(snapshotChild).toBeDefined();
      expect(snapshotChild?.type).toBe('RECTANGLE');
      expect(snapshotChild?.fills[0]?.type).toBe('IMAGE');
      expect(snapshotChild?.fills[0]?.imageRef).toBe('asset_hash_hero');
    });

    it('produces 100% deterministic scene graph JSON on identical captures', () => {
      const capture: PageCapture = {
        metadata: landingPageMetadata,
        nodes: landingPageNodes,
        assetRefs: ['asset_hash_hero']
      };

      const scene1 = buildPageScene(capture);
      const scene2 = buildPageScene(capture);

      const json1 = JSON.stringify(scene1);
      const json2 = JSON.stringify(scene2);

      expect(json1).toBe(json2);
    });
  });

  describe('FigmaSceneDocument Multi-Page Assembly', () => {
    it('assembles multiple PageScenes into a unified FigmaSceneDocument', () => {
      const capture1: PageCapture = {
        metadata: { ...landingPageMetadata, pageIndex: 0, title: 'Home' },
        nodes: landingPageNodes
      };
      const capture2: PageCapture = {
        metadata: { ...landingPageMetadata, pageIndex: 1, title: 'Pricing', requestedUrl: 'https://example.com/pricing', finalUrl: 'https://example.com/pricing' },
        nodes: landingPageNodes
      };

      const scene1 = buildPageScene(capture1);
      const scene2 = buildPageScene(capture2);

      const doc = buildFigmaSceneDocument([scene1, scene2]);

      expect(doc.schemaVersion).toBe(1);
      expect(doc.pageFrames).toHaveLength(2);
      expect(doc.metadata.totalPages).toBe(2);
      expect(doc.metadata.totalNodes).toBe(scene1.nodes.length + scene2.nodes.length);
      expect(doc.pageFrames[0]?.name).toContain('01 — Home');
      expect(doc.pageFrames[1]?.name).toContain('02 — Pricing');
    });
  });
});
