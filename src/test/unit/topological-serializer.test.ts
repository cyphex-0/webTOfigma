import { describe, it, expect } from 'vitest';
import type { SceneNode, PageCapture } from '../../shared/contracts/scene';
import {
  topologicallySortSceneNodes,
  convertSceneNodesToFigmaMessage,
  serializeSceneGraph
} from '../../core/figma/clipboard/serializer';
import { buildPageScene } from '../../core/scene/scene-builder';
import { deserializeFigmaMessage } from '../../core/figma/poc/kiwi-serializer';

describe('Topological Scene Serialization & Hierarchy Integrity', () => {
  it('topologically sorts inverted parent-child node arrays so parents always precede children', () => {
    // Child listed before parent in input array
    const leafNode: SceneNode = {
      id: 'leaf_node',
      parentId: 'container_node',
      childIds: [],
      name: 'Leaf Button Label',
      type: 'TEXT',
      visible: true,
      x: 10,
      y: 10,
      width: 80,
      height: 24,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: 'Click Me',
        fontSize: 14,
        fontWeight: 600,
        fontFamily: 'Inter',
        textAlign: 'CENTER'
      }
    };

    const containerNode: SceneNode = {
      id: 'container_node',
      parentId: 'root_frame',
      childIds: ['leaf_node'],
      name: 'Button Container',
      type: 'FRAME',
      visible: true,
      x: 100,
      y: 100,
      width: 120,
      height: 44,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.5, b: 0.9, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    const rootFrame: SceneNode = {
      id: 'root_frame',
      parentId: null,
      childIds: ['container_node'],
      name: 'Page Canvas Frame',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    // Deliberately reverse the array: leaf first, then container, then root
    const invertedNodes = [leafNode, containerNode, rootFrame];

    const sorted = topologicallySortSceneNodes(invertedNodes);

    expect(sorted).toHaveLength(3);
    expect(sorted[0]?.id).toBe('root_frame');
    expect(sorted[1]?.id).toBe('container_node');
    expect(sorted[2]?.id).toBe('leaf_node');
  });

  it('guarantees zero forward references in convertSceneNodesToFigmaMessage', async () => {
    const leafA: SceneNode = {
      id: 'leaf_a',
      parentId: 'middle_frame',
      childIds: [],
      name: 'Leaf A',
      type: 'RECTANGLE',
      visible: true,
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    const leafB: SceneNode = {
      id: 'leaf_b',
      parentId: 'middle_frame',
      childIds: [],
      name: 'Leaf B',
      type: 'RECTANGLE',
      visible: true,
      x: 70,
      y: 10,
      width: 50,
      height: 50,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    const middleFrame: SceneNode = {
      id: 'middle_frame',
      parentId: 'root_frame',
      childIds: ['leaf_a', 'leaf_b'],
      name: 'Middle Card',
      type: 'FRAME',
      visible: true,
      x: 20,
      y: 20,
      width: 200,
      height: 100,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    const rootFrame: SceneNode = {
      id: 'root_frame',
      parentId: null,
      childIds: ['middle_frame'],
      name: 'Root Artboard',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    // Provide shuffled order
    const shuffled = [leafB, rootFrame, leafA, middleFrame];

    const conversion = convertSceneNodesToFigmaMessage(shuffled);
    expect(conversion.message.nodeChanges).toHaveLength(4);

    // Verify zero forward references: parent.localID < child.localID
    for (const change of conversion.message.nodeChanges) {
      const parentLocalId = change.parentIndex.guid.localID;
      const myLocalId = change.guid.localID;
      if (parentLocalId !== 0) {
        expect(parentLocalId).toBeLessThan(myLocalId);
      }
    }

    // Verify binary round-trip
    const serialization = await serializeSceneGraph(shuffled);
    const deserialized = await deserializeFigmaMessage(serialization.binaryBuffer);
    expect(deserialized.nodeChanges).toHaveLength(4);
  });

  it('normalizes root HTML and BODY bounds in full-page mode so vertical content is never clipped', () => {
    const capture: PageCapture = {
      metadata: {
        schemaVersion: 1,
        pageIndex: 0,
        requestedUrl: 'https://example.com/dashboard',
        finalUrl: 'https://example.com/dashboard',
        title: 'Dashboard',
        readinessState: 'complete',
        capturedAt: Date.now(),
        viewport: {
          width: 1440,
          height: 900,
          devicePixelRatio: 1,
          scrollX: 0,
          scrollY: 0
        },
        documentDimensions: {
          width: 1440,
          height: 3200 // 3200px scroll height
        },
        captureMode: 'full-page'
      },
      nodes: [
        {
          nodeId: 'node_html',
          parentId: null,
          childIds: ['node_body'],
          sourceTag: 'HTML',
          classHints: [],
          textRuns: [],
          sourceRect: { x: 0, y: 0, width: 1440, height: 900 },
          documentRect: { x: 0, y: 0, width: 1440, height: 900 },
          visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
          stacking: { createsStackingContext: false, zIndex: 'auto' },
          computedStyle: {
            display: 'block',
            position: 'static',
            overflow: 'hidden', // Common CSS reset
            boxSizing: 'border-box',
            backgroundColor: 'transparent',
            color: '#000000',
            fontSize: '16px',
            fontFamily: 'Inter',
            fontWeight: '400',
            lineHeight: 'normal',
            letterSpacing: 'normal',
            textAlign: 'left',
            borderRadius: '0px',
            borderWidth: '0px',
            borderColor: 'transparent',
            borderStyle: 'none',
            boxShadow: 'none',
            transform: 'none',
            padding: '0px',
            margin: '0px'
          },
          layoutHints: { isFlexContainer: false, isGridContainer: false, isInline: false, isBlock: true },
          assetRefs: []
        },
        {
          nodeId: 'node_body',
          parentId: 'node_html',
          childIds: ['node_header'],
          sourceTag: 'BODY',
          classHints: ['dark-theme'],
          textRuns: [],
          sourceRect: { x: 0, y: 0, width: 1440, height: 900 },
          documentRect: { x: 0, y: 0, width: 1440, height: 900 },
          visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
          stacking: { createsStackingContext: false, zIndex: 'auto' },
          computedStyle: {
            display: 'block',
            position: 'static',
            overflow: 'visible',
            boxSizing: 'border-box',
            backgroundColor: 'rgb(14, 20, 30)', // Dark theme background
            color: '#ffffff',
            fontSize: '16px',
            fontFamily: 'Inter',
            fontWeight: '400',
            lineHeight: 'normal',
            letterSpacing: 'normal',
            textAlign: 'left',
            borderRadius: '0px',
            borderWidth: '0px',
            borderColor: 'transparent',
            borderStyle: 'none',
            boxShadow: 'none',
            transform: 'none',
            padding: '0px',
            margin: '0px'
          },
          layoutHints: { isFlexContainer: false, isGridContainer: false, isInline: false, isBlock: true },
          assetRefs: []
        },
        {
          nodeId: 'node_header',
          parentId: 'node_body',
          childIds: [],
          sourceTag: 'HEADER',
          classHints: [],
          textRuns: [],
          sourceRect: { x: 0, y: 0, width: 1440, height: 60 },
          documentRect: { x: 0, y: 0, width: 1440, height: 60 },
          visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
          stacking: { createsStackingContext: true, zIndex: 10 },
          computedStyle: {
            display: 'flex',
            position: 'fixed',
            overflow: 'visible',
            boxSizing: 'border-box',
            backgroundColor: 'transparent',
            color: '#ffffff',
            fontSize: '16px',
            fontFamily: 'Inter',
            fontWeight: '400',
            lineHeight: 'normal',
            letterSpacing: 'normal',
            textAlign: 'left',
            borderRadius: '0px',
            borderWidth: '0px',
            borderColor: 'transparent',
            borderStyle: 'none',
            boxShadow: 'none',
            transform: 'none',
            padding: '0px',
            margin: '0px'
          },
          layoutHints: { isFlexContainer: true, isGridContainer: false, isInline: false, isBlock: true },
          assetRefs: []
        }
      ],
      assetRefs: []
    };

    const scene = buildPageScene(capture);

    // Root page frame should have full document dimensions
    expect(scene.pageFrame.width).toBe(1440);
    expect(scene.pageFrame.height).toBe(3200);

    // Root page frame should inherit dark theme from BODY
    expect(scene.pageFrame.fills).toHaveLength(1);
    const firstFill = scene.pageFrame.fills[0];
    expect(firstFill).toBeDefined();
    expect(firstFill?.type).toBe('SOLID');
    if (firstFill?.type === 'SOLID' && firstFill.color) {
      expect(firstFill.color.r).toBeCloseTo(14 / 255, 1);
    }

    // HTML scene node should not clip content and should cover full height
    const htmlScene = scene.nodes.find((n) => n.id === 'scene_node_html');
    expect(htmlScene).toBeDefined();
    expect(htmlScene?.clipsContent).toBe(false);
    expect(htmlScene?.height).toBe(3200);

    // BODY scene node should not clip content and should cover full height
    const bodyScene = scene.nodes.find((n) => n.id === 'scene_node_body');
    expect(bodyScene).toBeDefined();
    expect(bodyScene?.clipsContent).toBe(false);
    expect(bodyScene?.height).toBe(3200);
  });
});
