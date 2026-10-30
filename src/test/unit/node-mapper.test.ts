import { describe, it, expect } from 'vitest';
import {
  determineSceneNodeType,
  mapSourceNodeToSceneNode,
  collapseStructuralWrappers
} from '../../core/scene/node-mapper';
import { SourceNode } from '../../shared/contracts/source-node';
import { SceneNode } from '../../shared/contracts/scene';

function createMockSourceNode(overrides: Partial<SourceNode> = {}): SourceNode {
  return {
    nodeId: 'node_1',
    parentId: null,
    childIds: [],
    sourceTag: 'div',
    classHints: [],
    textRuns: [],
    sourceRect: { x: 0, y: 0, width: 200, height: 100 },
    documentRect: { x: 0, y: 0, width: 200, height: 100 },
    visibility: { isVisible: true, isClipped: false, isOffscreen: false, opacity: 1 },
    stacking: { createsStackingContext: false, zIndex: 'auto' },
    computedStyle: {
      display: 'block',
      position: 'static',
      overflow: 'visible',
      boxSizing: 'border-box',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      color: 'rgb(0, 0, 0)',
      fontSize: '16px',
      fontFamily: 'Inter, sans-serif',
      fontWeight: '400',
      lineHeight: '24px',
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
    layoutHints: {
      isFlexContainer: false,
      isGridContainer: false,
      isInline: false,
      isBlock: true
    },
    assetRefs: [],
    ...overrides
  };
}

describe('Native Node Mapper', () => {
  describe('Node Type Classification', () => {
    it('classifies SVG elements as VECTOR', () => {
      const svgNode = createMockSourceNode({ sourceTag: 'svg' });
      expect(determineSceneNodeType(svgNode)).toBe('VECTOR');

      const pathNode = createMockSourceNode({ sourceTag: 'path' });
      expect(determineSceneNodeType(pathNode)).toBe('VECTOR');
    });

    it('classifies img and picture elements as IMAGE', () => {
      const imgNode = createMockSourceNode({ sourceTag: 'img' });
      expect(determineSceneNodeType(imgNode)).toBe('IMAGE');
    });

    it('classifies pure text elements as TEXT', () => {
      const textNode = createMockSourceNode({
        sourceTag: 'p',
        textRuns: [
          {
            text: 'Hello World',
            fontFamily: 'Inter',
            fontWeight: 400,
            fontStyle: 'normal',
            fontSize: 16,
            lineHeight: 24,
            letterSpacing: 0,
            color: 'rgb(33, 33, 33)',
            textDecoration: 'none',
            textAlign: 'left',
            textTransform: 'none'
          }
        ]
      });
      expect(determineSceneNodeType(textNode)).toBe('TEXT');
    });

    it('classifies styled button with text and background as FRAME', () => {
      const buttonNode = createMockSourceNode({
        sourceTag: 'button',
        semanticKind: 'button',
        computedStyle: {
          ...createMockSourceNode().computedStyle,
          backgroundColor: 'rgb(59, 130, 246)',
          borderWidth: '1px',
          borderStyle: 'solid'
        },
        textRuns: [
          {
            text: 'Submit Order',
            fontFamily: 'Inter',
            fontWeight: 600,
            fontStyle: 'normal',
            fontSize: 14,
            lineHeight: 20,
            letterSpacing: 0,
            color: 'rgb(255, 255, 255)',
            textDecoration: 'none',
            textAlign: 'center',
            textTransform: 'none'
          }
        ]
      });
      expect(determineSceneNodeType(buttonNode)).toBe('FRAME');
    });

    it('classifies empty styled box as RECTANGLE', () => {
      const boxNode = createMockSourceNode({
        sourceTag: 'div',
        computedStyle: {
          ...createMockSourceNode().computedStyle,
          backgroundColor: 'rgb(243, 244, 246)'
        }
      });
      expect(determineSceneNodeType(boxNode)).toBe('RECTANGLE');
    });
  });

  describe('Node Mapping & Style Translation', () => {
    it('maps TEXT node with textData and solid color fill', () => {
      const textNode = createMockSourceNode({
        sourceTag: 'h1',
        semanticKind: 'heading-1',
        textRuns: [
          {
            text: 'Headline Title',
            fontFamily: 'Inter',
            fontWeight: 700,
            fontStyle: 'normal',
            fontSize: 32,
            lineHeight: 40,
            letterSpacing: 0.5,
            color: 'rgb(17, 24, 39)',
            textDecoration: 'none',
            textAlign: 'left',
            textTransform: 'none'
          }
        ]
      });

      const { sceneNode, synthesizedChildren } = mapSourceNodeToSceneNode(textNode);
      expect(sceneNode.type).toBe('TEXT');
      expect(sceneNode.name).toBe('Heading — H1');
      expect(sceneNode.textData?.text).toBe('Headline Title');
      expect(sceneNode.textData?.fontSize).toBe(32);
      expect(sceneNode.textData?.fontWeight).toBe(700);
      expect(sceneNode.fills).toHaveLength(1);
      expect(sceneNode.fills[0]?.type).toBe('SOLID');
      expect(synthesizedChildren).toHaveLength(0);
    });

    it('maps styled button into FRAME and synthesizes child TEXT label', () => {
      const buttonNode = createMockSourceNode({
        nodeId: 'btn_1',
        sourceTag: 'button',
        semanticKind: 'button',
        computedStyle: {
          ...createMockSourceNode().computedStyle,
          backgroundColor: 'rgb(37, 99, 235)',
          borderRadius: '8px'
        },
        textRuns: [
          {
            text: 'Click Me',
            fontFamily: 'Inter',
            fontWeight: 500,
            fontStyle: 'normal',
            fontSize: 16,
            lineHeight: 24,
            letterSpacing: 0,
            color: 'rgb(255, 255, 255)',
            textDecoration: 'none',
            textAlign: 'center',
            textTransform: 'none'
          }
        ]
      });

      const { sceneNode, synthesizedChildren } = mapSourceNodeToSceneNode(buttonNode);
      expect(sceneNode.type).toBe('FRAME');
      expect(sceneNode.name).toBe('Button');
      expect(sceneNode.childIds).toContain('scene_btn_1_label');

      expect(synthesizedChildren).toHaveLength(1);
      const textChild = synthesizedChildren[0]!;
      expect(textChild.type).toBe('TEXT');
      expect(textChild.name).toBe('Button Label');
      expect(textChild.parentId).toBe('scene_btn_1');
      expect(textChild.textData?.text).toBe('Click Me');
    });

    it('maps IMAGE element with image fill', () => {
      const imgNode = createMockSourceNode({
        sourceTag: 'img',
        semanticKind: 'image',
        assetRefs: ['asset_hash_hero']
      });

      const { sceneNode } = mapSourceNodeToSceneNode(imgNode);
      expect(sceneNode.type).toBe('IMAGE');
      expect(sceneNode.fills[0]?.type).toBe('IMAGE');
      expect(sceneNode.fills[0]?.imageRef).toBe('asset_hash_hero');
    });
  });

  describe('Structural Wrapper Collapsing', () => {
    it('collapses unstyled single-child wrapper into parent', () => {
      const rootNode: SceneNode = {
        id: 'scene_root',
        parentId: null,
        childIds: ['scene_wrapper'],
        name: 'Section',
        type: 'FRAME',
        visible: true,
        x: 0,
        y: 0,
        width: 400,
        height: 200,
        rotation: 0,
        fills: [],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const wrapperNode: SceneNode = {
        id: 'scene_wrapper',
        parentId: 'scene_root',
        childIds: ['scene_child'],
        name: 'Container',
        type: 'FRAME',
        visible: true,
        x: 0,
        y: 0,
        width: 400,
        height: 200,
        rotation: 0,
        fills: [],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const childNode: SceneNode = {
        id: 'scene_child',
        parentId: 'scene_wrapper',
        childIds: [],
        name: 'Heading — H1',
        type: 'TEXT',
        visible: true,
        x: 0,
        y: 0,
        width: 400,
        height: 50,
        rotation: 0,
        fills: [],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const nodesMap = new Map<string, SceneNode>([
        ['scene_root', rootNode],
        ['scene_wrapper', wrapperNode],
        ['scene_child', childNode]
      ]);

      collapseStructuralWrappers(nodesMap);

      expect(nodesMap.has('scene_wrapper')).toBe(false);
      expect(rootNode.childIds).toEqual(['scene_child']);
      expect(childNode.parentId).toBe('scene_root');
    });

    it('does not collapse wrapper if it has visible background or borders', () => {
      const rootNode: SceneNode = {
        id: 'scene_root',
        parentId: null,
        childIds: ['scene_wrapper'],
        name: 'Section',
        type: 'FRAME',
        visible: true,
        x: 0,
        y: 0,
        width: 400,
        height: 200,
        rotation: 0,
        fills: [],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const styledWrapper: SceneNode = {
        id: 'scene_wrapper',
        parentId: 'scene_root',
        childIds: ['scene_child'],
        name: 'Container',
        type: 'FRAME',
        visible: true,
        x: 0,
        y: 0,
        width: 400,
        height: 200,
        rotation: 0,
        fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true }],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const childNode: SceneNode = {
        id: 'scene_child',
        parentId: 'scene_wrapper',
        childIds: [],
        name: 'Heading — H1',
        type: 'TEXT',
        visible: true,
        x: 0,
        y: 0,
        width: 400,
        height: 50,
        rotation: 0,
        fills: [],
        strokes: [],
        effects: [],
        clipsContent: false
      };

      const nodesMap = new Map<string, SceneNode>([
        ['scene_root', rootNode],
        ['scene_wrapper', styledWrapper],
        ['scene_child', childNode]
      ]);

      collapseStructuralWrappers(nodesMap);

      expect(nodesMap.has('scene_wrapper')).toBe(true);
      expect(styledWrapper.childIds).toEqual(['scene_child']);
      expect(childNode.parentId).toBe('scene_wrapper');
    });
  });
});
