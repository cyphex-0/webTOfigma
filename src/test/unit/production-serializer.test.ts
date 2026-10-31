import { describe, it, expect } from 'vitest';
import {
  serializeSceneGraph,
  convertSceneNodesToFigmaMessage,
  SERIALIZER_VERSION
} from '../../core/figma/clipboard/serializer';
import { deserializeFigmaMessage, FIGMA_MAGIC_HEADER, FIGMA_WIRE_VERSION } from '../..//core/figma/poc/kiwi-serializer';
import type { SceneNode } from '../../shared/contracts/scene';

describe('Production Kiwi Scene Serializer (Phase 20)', () => {
  it('identifies serializer version consistently', () => {
    expect(SERIALIZER_VERSION).toBe('1.0.0-kiwi-v15');
  });

  describe('Proven Node Types Serialization', () => {
    it('serializes FRAME with full Auto Layout, padding, fills, strokes, and cornerRadius', async () => {
      const frameNode: SceneNode = {
        id: 'frame_1',
        parentId: null,
        childIds: ['btn_1'],
        name: 'AutoLayout Navbar',
        type: 'FRAME',
        visible: true,
        x: 0,
        y: 0,
        width: 1200,
        height: 80,
        rotation: 0,
        cornerRadius: 8,
        fills: [
          {
            type: 'SOLID',
            color: { r: 1, g: 1, b: 1, a: 1 },
            opacity: 1,
            visible: true
          }
        ],
        strokes: [
          {
            color: { r: 0.9, g: 0.9, b: 0.9, a: 1 },
            weight: 1,
            align: 'INSIDE',
            visible: true
          }
        ],
        effects: [],
        clipsContent: true,
        layoutMetadata: {
          layoutMode: 'HORIZONTAL',
          primaryAxisAlign: 'SPACE_BETWEEN',
          counterAxisAlign: 'CENTER',
          itemSpacing: 16,
          padding: { top: 12, right: 24, bottom: 12, left: 24 }
        }
      };

      const conversion = convertSceneNodesToFigmaMessage([frameNode]);
      expect(conversion.message.nodeChanges).toHaveLength(1);

      const change = conversion.message.nodeChanges[0]!;
      expect(change.type).toBe('FRAME');
      expect(change.name).toBe('AutoLayout Navbar');
      expect(change.layoutMode).toBe(1); // HORIZONTAL
      expect(change.primaryAxisAlignItems).toBe(3); // SPACE_BETWEEN
      expect(change.counterAxisAlignItems).toBe(1); // CENTER
      expect(change.itemSpacing).toBe(16);
      expect(change.paddingTop).toBe(12);
      expect(change.paddingRight).toBe(24);
      expect(change.paddingBottom).toBe(12);
      expect(change.paddingLeft).toBe(24);
      expect(change.cornerRadius).toBe(8);
      expect(change.clipsContent).toBe(true);
      expect(change.fillPaints).toHaveLength(1);
      expect(change.strokePaints).toHaveLength(1);
      expect(change.strokeWeight).toBe(1);
    });

    it('serializes SECTION node or falls back to FRAME when requested', () => {
      const sectionNode: SceneNode = {
        id: 'sec_1',
        parentId: null,
        childIds: [],
        name: 'Marketing Routes',
        type: 'SECTION',
        visible: true,
        x: 0,
        y: 0,
        width: 3000,
        height: 2000,
        rotation: 0,
        fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.96, b: 0.98, a: 1 }, opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const withSections = convertSceneNodesToFigmaMessage([sectionNode], { preserveSections: true });
      expect(withSections.message.nodeChanges[0]?.type).toBe('SECTION');

      const fallbackFrame = convertSceneNodesToFigmaMessage([sectionNode], { preserveSections: false });
      expect(fallbackFrame.message.nodeChanges[0]?.type).toBe('FRAME');
    });

    it('serializes RECTANGLE node with fills and cornerRadius', () => {
      const rectNode: SceneNode = {
        id: 'rect_1',
        parentId: null,
        childIds: [],
        name: 'Card Background',
        type: 'RECTANGLE',
        visible: true,
        x: 20,
        y: 40,
        width: 380,
        height: 220,
        rotation: 0,
        cornerRadius: 16,
        fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 0.9 }, opacity: 0.9, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const conversion = convertSceneNodesToFigmaMessage([rectNode]);
      const change = conversion.message.nodeChanges[0]!;
      expect(change.type).toBe('RECTANGLE');
      expect(change.cornerRadius).toBe(16);
      expect(change.transform.m02).toBe(20);
      expect(change.transform.m12).toBe(40);
    });

    it('serializes TEXT node with typography, font family, line height, and alignment', () => {
      const textNode: SceneNode = {
        id: 'text_1',
        parentId: null,
        childIds: [],
        name: 'Hero Title',
        type: 'TEXT',
        visible: true,
        x: 10,
        y: 10,
        width: 400,
        height: 48,
        rotation: 0,
        fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false,
        textData: {
          text: 'Design Systems at Scale',
          fontSize: 32,
          fontWeight: 700,
          fontFamily: 'Roboto',
          resolvedFont: 'Inter',
          lineHeight: 40,
          letterSpacing: -0.5,
          textAlign: 'CENTER'
        }
      };

      const conversion = convertSceneNodesToFigmaMessage([textNode]);
      const change = conversion.message.nodeChanges[0]!;
      expect(change.type).toBe('TEXT');
      expect(change.rawText).toBe('Design Systems at Scale');
      expect(change.fontSize).toBe(32);
      expect(change.fontWeight).toBe(700);
      expect(change.fontFamily).toBe('Inter');
      expect(change.lineHeight).toBe(40);
      expect(change.letterSpacing).toBe(-0.5);
      expect(change.textAlignHorizontal).toBe(1); // CENTER
    });

    it('serializes IMAGE node to proven RECTANGLE representation with IMAGE paint', () => {
      const imageNode: SceneNode = {
        id: 'img_1',
        parentId: null,
        childIds: [],
        name: 'Hero Banner',
        type: 'IMAGE',
        visible: true,
        x: 0,
        y: 0,
        width: 800,
        height: 400,
        rotation: 0,
        fills: [{ type: 'IMAGE', imageRef: 'asset_hero_123', opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const conversion = convertSceneNodesToFigmaMessage([imageNode]);
      const change = conversion.message.nodeChanges[0]!;
      expect(change.type).toBe('RECTANGLE');
      expect(change.fillPaints?.[0]?.type).toBe('IMAGE');
    });

    it('serializes VECTOR and GROUP nodes faithfully', () => {
      const vectorNode: SceneNode = {
        id: 'vec_1',
        parentId: null,
        childIds: [],
        name: 'Icon Arrow',
        type: 'VECTOR',
        visible: true,
        x: 0,
        y: 0,
        width: 24,
        height: 24,
        rotation: 0,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const groupNode: SceneNode = {
        id: 'grp_1',
        parentId: null,
        childIds: ['vec_1'],
        name: 'Button Icons Group',
        type: 'GROUP',
        visible: true,
        x: 0,
        y: 0,
        width: 24,
        height: 24,
        rotation: 0,
        fills: [],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const conversion = convertSceneNodesToFigmaMessage([groupNode, vectorNode]);
      expect(conversion.message.nodeChanges[0]?.type).toBe('GROUP');
      expect(conversion.message.nodeChanges[1]?.type).toBe('VECTOR');
    });

    it('emits fallback and diagnostic for unknown or unsupported node types', () => {
      const unsupportedNode = {
        id: 'custom_1',
        parentId: null,
        childIds: [],
        name: 'Custom 3D Mesh',
        type: 'CUSTOM_3D_CANVAS' as unknown as SceneNode['type'],
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        fills: [],
        strokes: [],
        effects: [],
        clipsContent: false
      } as SceneNode;

      const conversion = convertSceneNodesToFigmaMessage([unsupportedNode]);
      expect(conversion.message.nodeChanges[0]?.type).toBe('FRAME');
      expect(conversion.diagnostics).toHaveLength(1);
      expect(conversion.diagnostics[0]?.code).toBe('UNSUPPORTED_NODE_TYPE_FALLBACK');
    });
  });

  describe('Texture Slicing Guard and Asset Deduplication', () => {
    it('slices vertically oversized images exceeding max texture dimension', () => {
      const tallImage: SceneNode = {
        id: 'tall_img',
        parentId: null,
        childIds: [],
        name: 'Tall Full Page Scroll',
        type: 'IMAGE',
        visible: true,
        x: 0,
        y: 0,
        width: 1200,
        height: 9000,
        rotation: 0,
        fills: [{ type: 'IMAGE', imageRef: 'big_scroll_hash', opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const conversion = convertSceneNodesToFigmaMessage([tallImage], { maxTextureDimension: 4096 });
      // 9000px / 4096px = 3 slices + 1 container frame = 4 total nodes
      expect(conversion.stats.slicedNodes).toBe(1);
      expect(conversion.message.nodeChanges).toHaveLength(4);

      const container = conversion.message.nodeChanges[0]!;
      expect(container.type).toBe('FRAME');
      expect(container.clipsContent).toBe(true);

      const slice1 = conversion.message.nodeChanges[1]!;
      expect(slice1.size.y).toBe(4096);
      expect(slice1.parentIndex.guid).toEqual(container.guid);

      const slice3 = conversion.message.nodeChanges[3]!;
      expect(slice3.size.y).toBe(808); // 9000 - 8192

      expect(conversion.diagnostics.some((d) => d.code === 'TEXTURE_SLICED_OVERSIZED')).toBe(true);
    });

    it('tracks deduplicated image references', () => {
      const img1: SceneNode = {
        id: 'img1',
        parentId: null,
        childIds: [],
        name: 'Logo 1',
        type: 'IMAGE',
        visible: true,
        x: 0,
        y: 0,
        width: 100,
        height: 50,
        rotation: 0,
        fills: [{ type: 'IMAGE', imageRef: 'shared_logo_123', opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const img2: SceneNode = {
        id: 'img2',
        parentId: null,
        childIds: [],
        name: 'Logo 2',
        type: 'IMAGE',
        visible: true,
        x: 150,
        y: 0,
        width: 100,
        height: 50,
        rotation: 0,
        fills: [{ type: 'IMAGE', imageRef: 'shared_logo_123', opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const conversion = convertSceneNodesToFigmaMessage([img1, img2], { deduplicateImages: true });
      expect(conversion.stats.deduplicatedImages).toBe(1);
    });
  });

  describe('Full End-to-End Kiwi Binary Roundtrip', () => {
    it('serializes a complete multi-level scene into "fig-kiwi" binary buffer and deserializes correctly', async () => {
      const pageFrame: SceneNode = {
        id: 'page_home',
        parentId: null,
        childIds: ['header_1'],
        name: 'Page: Home',
        type: 'FRAME',
        visible: true,
        x: 0,
        y: 0,
        width: 1440,
        height: 1080,
        rotation: 0,
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: true
      };

      const headerFrame: SceneNode = {
        id: 'header_1',
        parentId: 'page_home',
        childIds: ['title_1'],
        name: 'Header Container',
        type: 'FRAME',
        visible: true,
        x: 40,
        y: 40,
        width: 1360,
        height: 80,
        rotation: 0,
        fills: [{ type: 'SOLID', color: { r: 0.95, g: 0.95, b: 0.95, a: 1 }, opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: true,
        layoutMetadata: {
          layoutMode: 'HORIZONTAL',
          primaryAxisAlign: 'MIN',
          counterAxisAlign: 'CENTER',
          itemSpacing: 12
        }
      };

      const titleText: SceneNode = {
        id: 'title_1',
        parentId: 'header_1',
        childIds: [],
        name: 'Page Title',
        type: 'TEXT',
        visible: true,
        x: 20,
        y: 20,
        width: 300,
        height: 32,
        rotation: 0,
        fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false,
        textData: {
          text: 'Welcome to Web-to-Figma',
          fontSize: 24,
          fontWeight: 600,
          fontFamily: 'Inter',
          lineHeight: 32,
          letterSpacing: 0,
          textAlign: 'LEFT'
        }
      };

      const result = await serializeSceneGraph([pageFrame, headerFrame, titleText]);

      expect(result.version).toBe('1.0.0-kiwi-v15');
      expect(result.binaryBuffer).toBeInstanceOf(Uint8Array);
      expect(result.binaryBuffer.byteLength).toBeGreaterThan(100);

      // Verify header magic and version
      const magic = new TextDecoder().decode(result.binaryBuffer.subarray(0, 8));
      expect(magic).toBe(FIGMA_MAGIC_HEADER);
      const view = new DataView(result.binaryBuffer.buffer, result.binaryBuffer.byteOffset, result.binaryBuffer.byteLength);
      expect(view.getUint32(8, true)).toBe(FIGMA_WIRE_VERSION);

      // Deserialize and verify hierarchy
      const deserialized = await deserializeFigmaMessage(result.binaryBuffer);
      expect(deserialized.nodeChanges).toHaveLength(3);

      const rootChange = deserialized.nodeChanges[0]!;
      expect(rootChange.name).toBe('Page: Home');
      expect(rootChange.parentIndex.guid).toEqual({ sessionID: 0, localID: 0 });

      const headerChange = deserialized.nodeChanges[1]!;
      expect(headerChange.name).toBe('Header Container');
      expect(headerChange.parentIndex.guid).toEqual(rootChange.guid);
      expect(headerChange.layoutMode).toBe(1);

      const titleChange = deserialized.nodeChanges[2]!;
      expect(titleChange.name).toBe('Page Title');
      expect(titleChange.rawText).toBe('Welcome to Web-to-Figma');
      expect(titleChange.parentIndex.guid).toEqual(headerChange.guid);
    });
  });
});
