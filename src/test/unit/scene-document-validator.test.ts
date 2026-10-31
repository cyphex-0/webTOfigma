import { describe, it, expect } from 'vitest';
import { validateSceneDocument } from '../../core/scene/scene-document-validator';
import type { FigmaSceneDocument, SceneNode } from '../../shared/contracts/scene';

describe('SceneDocumentValidator', () => {
  function createSampleDocument(): FigmaSceneDocument & { allNodes: SceneNode[] } {
    const rootFrame: SceneNode = {
      id: 'frame_1',
      parentId: null,
      childIds: ['child_1', 'child_2'],
      name: '01 - Home - /',
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

    const child1: SceneNode = {
      id: 'child_1',
      parentId: 'frame_1',
      childIds: [],
      name: 'Heading - H1',
      type: 'TEXT',
      visible: true,
      x: 20,
      y: 40,
      width: 400,
      height: 48,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    const child2: SceneNode = {
      id: 'child_2',
      parentId: 'frame_1',
      childIds: [],
      name: 'Hero Image',
      type: 'RECTANGLE',
      visible: true,
      x: 20,
      y: 100,
      width: 600,
      height: 400,
      rotation: 0,
      fills: [
        {
          type: 'IMAGE',
          imageRef: 'asset_hash_hero',
          opacity: 1,
          visible: true
        }
      ],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    return {
      schemaVersion: 1,
      exportTitle: 'Test Export',
      sourceSite: 'https://example.com',
      exportedAt: Date.now(),
      pageFrames: [rootFrame],
      sections: [],
      metadata: {
        totalNodes: 3,
        totalAssets: 1,
        totalPages: 1,
        devicePixelRatio: 1
      },
      allNodes: [rootFrame, child1, child2]
    };
  }

  it('passes validation on a valid document', () => {
    const doc = createSampleDocument();
    const result = validateSceneDocument(doc, {
      knownAssetRefs: ['asset_hash_hero']
    });

    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.stats.totalNodes).toBe(3);
    expect(result.stats.totalAssets).toBe(1);
  });

  it('detects duplicate node IDs across the document', () => {
    const doc = createSampleDocument();
    // Inject duplicate ID
    doc.allNodes.push({
      ...doc.allNodes[1]!,
      name: 'Duplicate Node'
    });

    const result = validateSceneDocument(doc);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate node ID detected'))).toBe(true);
  });

  it('detects circular parent hierarchies', () => {
    const doc = createSampleDocument();
    const parent = doc.allNodes[0]!;
    const child = doc.allNodes[1]!;

    // Create cycle: parent points to child, child points to parent
    parent.parentId = child.id;
    child.childIds = [parent.id];

    const result = validateSceneDocument(doc);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Circular parent hierarchy detected'))).toBe(true);
  });

  it('flags unresolvable asset references', () => {
    const doc = createSampleDocument();
    const result = validateSceneDocument(doc, {
      knownAssetRefs: ['different_asset_hash'] // Missing 'asset_hash_hero'
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('asset_hash_hero'))).toBe(true);
  });

  it('flags negative or non-finite dimensions', () => {
    const doc = createSampleDocument();
    doc.allNodes[1]!.width = -100;
    doc.allNodes[2]!.height = NaN;

    const result = validateSceneDocument(doc);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('invalid width'))).toBe(true);
    expect(result.errors.some((e) => e.includes('invalid height'))).toBe(true);
  });

  it('enforces node budget caps', () => {
    const doc = createSampleDocument();
    const result = validateSceneDocument(doc, {
      maxTotalNodes: 2 // Document has 3 nodes
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Total scene node budget exceeded'))).toBe(true);
  });
});
