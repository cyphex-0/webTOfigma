import { describe, it, expect } from 'vitest';
import {
  estimatePayloadCost,
  sliceOversizedImageNode
} from '../../core/figma/clipboard/payload-estimator';
import { BUDGET_PROFILES } from '../../core/figma/clipboard/compatibility-profile';
import type { FigmaSceneDocument, SceneNode } from '../../shared/contracts/scene';

describe('PayloadEstimator & Texture Slicing Guard', () => {
  function createSampleDoc(nodes: SceneNode[]): FigmaSceneDocument & { allNodes: SceneNode[] } {
    return {
      schemaVersion: 1,
      exportTitle: 'Test Document',
      sourceSite: 'https://example.com',
      exportedAt: Date.now(),
      pageFrames: nodes.filter((n) => n.parentId === null),
      sections: [],
      metadata: {
        totalNodes: nodes.length,
        totalAssets: 1,
        totalPages: 1,
        devicePixelRatio: 1
      },
      allNodes: nodes
    };
  }

  it('calculates total nodes, depth, and fits in single batch for small documents', () => {
    const root: SceneNode = {
      id: 'root',
      parentId: null,
      childIds: ['child_1'],
      name: '01 - Home - /',
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

    const child: SceneNode = {
      id: 'child_1',
      parentId: 'root',
      childIds: [],
      name: 'Heading',
      type: 'TEXT',
      visible: true,
      x: 40,
      y: 40,
      width: 400,
      height: 48,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    const doc = createSampleDoc([root, child]);
    const estimate = estimatePayloadCost({
      document: doc,
      budgetProfile: BUDGET_PROFILES.standard
    });

    expect(estimate.totalNodes).toBe(2);
    expect(estimate.maxHierarchyDepth).toBe(2);
    expect(estimate.fitsInSingleBatch).toBe(true);
    expect(estimate.recommendedBatchCount).toBe(1);
    expect(estimate.oversizedImages.length).toBe(0);
  });

  it('detects oversized image assets exceeding max texture boundaries', () => {
    const root: SceneNode = {
      id: 'root',
      parentId: null,
      childIds: ['hero_image'],
      name: '01 - Long Page - /',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 10000,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    // 9,000px tall image
    const imageNode: SceneNode = {
      id: 'hero_image',
      parentId: 'root',
      childIds: [],
      name: 'Full Page Infographic',
      type: 'RECTANGLE',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 9000,
      rotation: 0,
      fills: [
        {
          type: 'IMAGE',
          imageRef: 'asset_hash_huge',
          opacity: 1,
          visible: true
        }
      ],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    const doc = createSampleDoc([root, imageNode]);
    const estimate = estimatePayloadCost({
      document: doc,
      budgetProfile: BUDGET_PROFILES.standard // maxTextureDimension: 8192
    });

    expect(estimate.oversizedImages.length).toBe(1);
    expect(estimate.oversizedImages[0]?.nodeId).toBe('hero_image');
    expect(estimate.oversizedImages[0]?.height).toBe(9000);
    expect(estimate.fitsInSingleBatch).toBe(false); // Flagged because of texture risk
  });

  it('slices an oversized image into contiguous sub-frames with TEXTURE_SLICED_OVERSIZED diagnostic', () => {
    const hugeImage: SceneNode = {
      id: 'infographic',
      parentId: 'parent_frame',
      childIds: [],
      name: 'Annual Report Poster',
      type: 'RECTANGLE',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 10000,
      rotation: 0,
      fills: [
        {
          type: 'IMAGE',
          imageRef: 'asset_poster',
          opacity: 1,
          visible: true
        }
      ],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    const result = sliceOversizedImageNode(hugeImage, 4096);
    expect(result).not.toBeNull();

    // 10,000px sliced into 4,096px chunks -> 3 slices (4096, 4096, 1808)
    expect(result?.sliceNodes.length).toBe(3);
    expect(result?.containerNode.type).toBe('FRAME');
    expect(result?.containerNode.childIds.length).toBe(3);

    expect(result?.sliceNodes[0]?.height).toBe(4096);
    expect(result?.sliceNodes[0]?.y).toBe(0);

    expect(result?.sliceNodes[1]?.height).toBe(4096);
    expect(result?.sliceNodes[1]?.y).toBe(4096);

    expect(result?.sliceNodes[2]?.height).toBe(1808);
    expect(result?.sliceNodes[2]?.y).toBe(8192);

    expect(result?.diagnostic.code).toBe('TEXTURE_SLICED_OVERSIZED');
    expect(result?.diagnostic.severity).toBe('info');
  });
});
