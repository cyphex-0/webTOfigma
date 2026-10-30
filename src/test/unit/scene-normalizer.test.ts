import { describe, it, expect } from 'vitest';
import {
  normalizeSceneGraph,
  sortChildrenByStackingOrder
} from '../../core/scene/scene-normalizer';
import { SceneNode } from '../../shared/contracts/scene';
import { SourceNode } from '../../shared/contracts/source-node';

function createMockSceneNode(overrides: Partial<SceneNode> = {}): SceneNode {
  return {
    id: 'scene_node',
    parentId: null,
    childIds: [],
    name: 'Container',
    type: 'FRAME',
    visible: true,
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    rotation: 0,
    fills: [],
    strokes: [],
    effects: [],
    clipsContent: false,
    ...overrides
  };
}

describe('Scene Normalizer', () => {
  describe('Coordinate Rebasing', () => {
    it('rebases absolute document coordinates to parent-relative local coordinates', () => {
      // Root at (100, 200)
      const root = createMockSceneNode({
        id: 'scene_root',
        x: 100,
        y: 200,
        width: 1000,
        height: 800,
        childIds: ['scene_card']
      });

      // Child card at (150, 300)
      const card = createMockSceneNode({
        id: 'scene_card',
        parentId: 'scene_root',
        x: 150,
        y: 300,
        width: 400,
        height: 250,
        childIds: ['scene_btn']
      });

      // Grandchild button at (180, 340)
      const btn = createMockSceneNode({
        id: 'scene_btn',
        parentId: 'scene_card',
        x: 180,
        y: 340,
        width: 120,
        height: 40,
        childIds: []
      });

      const nodes = new Map<string, SceneNode>([
        ['scene_card', card],
        ['scene_btn', btn]
      ]);

      normalizeSceneGraph(root, nodes);

      // Root frame is rebased to (0, 0)
      expect(root.x).toBe(0);
      expect(root.y).toBe(0);

      // Card is rebased relative to root: (150 - 100, 300 - 200) = (50, 100)
      expect(card.x).toBe(50);
      expect(card.y).toBe(100);

      // Button is rebased relative to card: (180 - 150, 340 - 300) = (30, 40)
      expect(btn.x).toBe(30);
      expect(btn.y).toBe(40);
    });

    it('sanitizes degenerate, zero, or non-finite dimensions', () => {
      const root = createMockSceneNode({
        id: 'scene_root',
        width: 0,
        height: -50,
        childIds: ['scene_child']
      });

      const child = createMockSceneNode({
        id: 'scene_child',
        parentId: 'scene_root',
        width: NaN,
        height: 0
      });

      const nodes = new Map<string, SceneNode>([['scene_child', child]]);
      normalizeSceneGraph(root, nodes);

      expect(root.width).toBe(0.01);
      expect(root.height).toBe(0.01);
      expect(child.width).toBe(0.01);
      expect(child.height).toBe(0.01);
    });
  });

  describe('Z-Order & Stacking Sort', () => {
    it('sorts childIds in CSS 2.2 painting order (negative z-index, normal DOM, positive z-index)', () => {
      const parent = createMockSceneNode({
        id: 'scene_parent',
        childIds: ['child_positive', 'child_normal1', 'child_negative', 'child_normal2']
      });

      const allNodes = new Map<string, SceneNode>([
        ['child_positive', createMockSceneNode({ id: 'child_positive', sourceNodeId: 's_pos' })],
        ['child_normal1', createMockSceneNode({ id: 'child_normal1', sourceNodeId: 's_norm1' })],
        ['child_negative', createMockSceneNode({ id: 'child_negative', sourceNodeId: 's_neg' })],
        ['child_normal2', createMockSceneNode({ id: 'child_normal2', sourceNodeId: 's_norm2' })]
      ]);

      const sourceNodes = new Map<string, SourceNode>([
        [
          's_pos',
          {
            nodeId: 's_pos',
            stacking: { createsStackingContext: true, zIndex: 10 }
          } as unknown as SourceNode
        ],
        [
          's_norm1',
          {
            nodeId: 's_norm1',
            stacking: { createsStackingContext: false, zIndex: 'auto' }
          } as unknown as SourceNode
        ],
        [
          's_neg',
          {
            nodeId: 's_neg',
            stacking: { createsStackingContext: true, zIndex: -2 }
          } as unknown as SourceNode
        ],
        [
          's_norm2',
          {
            nodeId: 's_norm2',
            stacking: { createsStackingContext: false, zIndex: 0 }
          } as unknown as SourceNode
        ]
      ]);

      sortChildrenByStackingOrder(parent, allNodes, sourceNodes, []);

      // Expected order:
      // 1. Negative z-index: child_negative
      // 2. Normal DOM order: child_normal1, child_normal2
      // 3. Positive z-index: child_positive
      expect(parent.childIds).toEqual([
        'child_negative',
        'child_normal1',
        'child_normal2',
        'child_positive'
      ]);
    });
  });
});
