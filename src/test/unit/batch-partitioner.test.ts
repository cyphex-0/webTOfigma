import { describe, it, expect } from 'vitest';
import {
  partitionSceneDocument,
  markBatchCopied,
  markBatchFailed
} from '../../core/figma/clipboard/batch-partitioner';
import { BUDGET_PROFILES } from '../../core/figma/clipboard/compatibility-profile';
import type { FigmaSceneDocument, SceneNode } from '../../shared/contracts/scene';
import type { StructuredPageMetadata } from '../../core/scene/page-metadata';

describe('BatchPartitioner', () => {
  function createPageWithNodes(id: string, childCount: number): { page: SceneNode; children: SceneNode[] } {
    const childIds = Array.from({ length: childCount }, (_, i) => `${id}_child_${i}`);
    const page: SceneNode = {
      id: `frame_${id}`,
      parentId: null,
      childIds,
      name: `Page ${id}`,
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 1000,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    const children: SceneNode[] = childIds.map((cid) => ({
      id: cid,
      parentId: page.id,
      childIds: [],
      name: 'Layer',
      type: 'RECTANGLE',
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
    }));

    return { page, children };
  }

  function createMockDoc(pagesWithNodes: Array<{ page: SceneNode; children: SceneNode[] }>): FigmaSceneDocument & {
    allNodes: SceneNode[];
    pageMetadata: Record<string, StructuredPageMetadata>;
  } {
    const pageFrames = pagesWithNodes.map((p) => p.page);
    const allNodes: SceneNode[] = [];
    const pageMetadata: Record<string, StructuredPageMetadata> = {};

    pagesWithNodes.forEach((p, idx) => {
      allNodes.push(p.page, ...p.children);
      pageMetadata[p.page.id] = {
        routeIndex: idx + 1,
        name: p.page.name,
        title: p.page.name,
        originalUrl: `https://example.com/page-${idx + 1}`,
        canonicalUrl: `https://example.com/page-${idx + 1}`,
        pathname: `/page-${idx + 1}`,
        batchId: 'batch_test',
        captureDimensions: { width: 1440, height: 1000 },
        capturedAt: Date.now(),
        status: 'completed',
        warningCount: 0
      };
    });

    return {
      schemaVersion: 1,
      exportTitle: 'Test Document',
      sourceSite: 'https://example.com',
      exportedAt: Date.now(),
      pageFrames,
      sections: [],
      metadata: {
        totalNodes: allNodes.length,
        totalAssets: 0,
        totalPages: pageFrames.length,
        devicePixelRatio: 1
      },
      allNodes,
      pageMetadata
    };
  }

  it('keeps small documents in a single batch', () => {
    const doc = createMockDoc([
      createPageWithNodes('home', 5),
      createPageWithNodes('about', 5)
    ]);

    const batches = partitionSceneDocument(doc, {
      budgetProfile: BUDGET_PROFILES.standard
    });

    expect(batches.length).toBe(1);
    expect(batches[0]?.batchIndex).toBe(1);
    expect(batches[0]?.totalBatches).toBe(1);
    expect(batches[0]?.pageFrames.length).toBe(2);
    expect(batches[0]?.status).toBe('preparing');
  });

  it('partitions into multiple batches when exceeding page limit', () => {
    // Standard tier maxPagesPerBatch is 6
    const pages = Array.from({ length: 8 }, (_, i) => createPageWithNodes(`p${i + 1}`, 2));
    const doc = createMockDoc(pages);

    const batches = partitionSceneDocument(doc, {
      budgetProfile: BUDGET_PROFILES.standard // max 6 pages
    });

    // 8 pages with max 6 per batch -> 2 batches (6 and 2)
    expect(batches.length).toBe(2);
    expect(batches[0]?.batchIndex).toBe(1);
    expect(batches[0]?.totalBatches).toBe(2);
    expect(batches[0]?.pageFrames.length).toBe(6);

    expect(batches[1]?.batchIndex).toBe(2);
    expect(batches[1]?.totalBatches).toBe(2);
    expect(batches[1]?.pageFrames.length).toBe(2);

    // Verify route ordering is preserved
    expect(batches[0]?.pageFrames[0]?.name).toBe('Page p1');
    expect(batches[1]?.pageFrames[0]?.name).toBe('Page p7');
  });

  it('partitions into multiple batches when exceeding node budget', () => {
    // Constrained tier maxNodesPerBatch is 800
    // Page 1 has 500 nodes, Page 2 has 500 nodes (total 1000 nodes > 800)
    const doc = createMockDoc([
      createPageWithNodes('heavy_1', 500),
      createPageWithNodes('heavy_2', 500)
    ]);

    const batches = partitionSceneDocument(doc, {
      budgetProfile: BUDGET_PROFILES.constrained // max 800 nodes
    });

    expect(batches.length).toBe(2);
    expect(batches[0]?.nodes.length).toBeGreaterThanOrEqual(501);
    expect(batches[1]?.nodes.length).toBeGreaterThanOrEqual(501);
  });

  it('supports atomic batch status updates and independent retries', () => {
    const doc = createMockDoc([createPageWithNodes('p1', 2)]);
    const batches = partitionSceneDocument(doc);
    const initialBatch = batches[0]!;

    expect(initialBatch.status).toBe('preparing');

    const copiedBatch = markBatchCopied(initialBatch);
    expect(copiedBatch.status).toBe('copied');
    expect(copiedBatch.copiedAt).toBeDefined();

    const failedBatch = markBatchFailed(initialBatch, 'Clipboard write denied');
    expect(failedBatch.status).toBe('failed');
    expect(failedBatch.error).toBe('Clipboard write denied');
  });
});
