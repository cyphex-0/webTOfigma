import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FigmaClipboardAdapter } from '../../core/figma/clipboard/figma-clipboard-adapter';
import {
  prepareClipboardBatchItem,
  writePreparedBatchDirectly,
  ClipboardWriteError
} from '../../core/figma/clipboard/clipboard-writer';
import type { SceneNode, FigmaSceneDocument } from '../../shared/contracts/scene';
import type { StructuredPageMetadata } from '../../core/scene/page-metadata';

describe('FigmaClipboardAdapter & Zero-I/O Writer (Phase 20)', () => {
  let adapter: FigmaClipboardAdapter;

  beforeEach(() => {
    adapter = new FigmaClipboardAdapter({
      capabilitiesOverride: {
        deviceMemoryGb: 8,
        hardwareConcurrency: 8,
        maxTextureSize: 8192,
        detectedTier: 'standard'
      }
    });
  });

  describe('Capability Profile & Sizing', () => {
    it('returns standard capability profile and serializer version', () => {
      const profile = adapter.getCapabilityProfile();
      expect(profile.capabilities.detectedTier).toBe('standard');
      expect(profile.budgetProfile.maxPagesPerBatch).toBe(6);
      expect(profile.serializerVersion).toBe('1.0.0-kiwi-v15');
    });

    it('estimates size and detects batch count for large document', () => {
      const pageFrames: SceneNode[] = Array.from({ length: 8 }, (_, i) => ({
        id: `page_${i + 1}`,
        parentId: null,
        childIds: [],
        name: `Page ${i + 1}`,
        type: 'FRAME',
        visible: true,
        x: i * 1500,
        y: 0,
        width: 1440,
        height: 900,
        rotation: 0,
        fills: [],
        strokes: [],
        effects: [],
        clipsContent: true
      }));

      const doc: FigmaSceneDocument = {
        schemaVersion: 1,
        exportTitle: 'Multi Page App',
        sourceSite: 'example.com',
        exportedAt: Date.now(),
        pageFrames,
        sections: [],
        metadata: {
          totalNodes: 8,
          totalAssets: 0,
          totalPages: 8,
          devicePixelRatio: 1
        }
      };

      const estimation = adapter.estimateSize(doc);
      expect(estimation.totalNodes).toBe(8);
      // In standard tier, max 6 pages per batch -> 8 pages requires 2 batches
      expect(estimation.recommendedBatchCount).toBe(2);
      expect(estimation.fitsInSingleBatch).toBe(false);
    });
  });

  describe('Batch Partitioning & Advance Preparation', () => {
    it('partitions and prepares batches ahead of user interaction', async () => {
      const pageFrames: SceneNode[] = [
        {
          id: 'page_1',
          parentId: null,
          childIds: [],
          name: 'Home',
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
        }
      ];

      const pageMetadata: Record<string, StructuredPageMetadata> = {
        page_1: {
          routeIndex: 1,
          name: 'Home',
          title: 'Home Page',
          originalUrl: 'https://example.com/',
          canonicalUrl: 'https://example.com/',
          pathname: '/',
          batchId: 'batch_1',
          captureDimensions: { width: 1440, height: 900 },
          capturedAt: Date.now(),
          status: 'completed',
          warningCount: 0
        }
      };

      const doc: FigmaSceneDocument & {
        allNodes?: readonly SceneNode[];
        pageMetadata: Record<string, StructuredPageMetadata>;
      } = {
        schemaVersion: 1,
        exportTitle: 'Test Export',
        sourceSite: 'example.com',
        exportedAt: Date.now(),
        pageFrames,
        sections: [],
        allNodes: pageFrames,
        pageMetadata,
        metadata: {
          totalNodes: 1,
          totalAssets: 0,
          totalPages: 1,
          devicePixelRatio: 1
        }
      };

      const batches = adapter.partitionDocument(doc);
      expect(batches).toHaveLength(1);

      const batch = batches[0]!;
      const preparedResult = await adapter.prepareClipboardBatch(batch);

      expect(preparedResult.preparedBatch.batchId).toBe(batch.batchId);
      expect(preparedResult.preparedBatch.nodeCount).toBe(1);
      expect(preparedResult.preparedBatch.binaryBuffer.byteLength).toBeGreaterThan(50);
      expect(preparedResult.preparedBatch.htmlString).toContain('<!--(figmeta)');
      expect(preparedResult.preparedBatch.htmlString).toContain('<!--(figma)');
      expect(preparedResult.preparedBatch.plainText).toContain('Batch 1 of 1');
      expect(preparedResult.preparedBatch.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('Zero-I/O Clipboard Writing & Expiration', () => {
    const originalClipboard = navigator.clipboard;

    afterEach(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true
      });
    });

    it('writes prepared batch directly via navigator.clipboard.write', async () => {
      const mockWrite = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { write: mockWrite, writeText: vi.fn() },
        writable: true,
        configurable: true
      });

      const prepared = prepareClipboardBatchItem({
        batchId: 'batch_test',
        batchIndex: 1,
        totalBatches: 1,
        nodeCount: 5,
        binaryBuffer: new Uint8Array([102, 105, 103, 45, 107, 105, 119, 105, 15, 0, 0, 0, 0, 0, 0, 0])
      });

      const result = await adapter.writePreparedBatch(prepared);
      expect(result.success).toBe(true);
      expect(result.instructions).toContain('Ctrl+V');
      expect(mockWrite).toHaveBeenCalledTimes(1);
    });

    it('rejects expired payloads with PAYLOAD_EXPIRED error', async () => {
      const prepared = prepareClipboardBatchItem({
        batchId: 'batch_expired',
        batchIndex: 1,
        totalBatches: 1,
        nodeCount: 1,
        binaryBuffer: new Uint8Array([1, 2, 3, 4]),
        ttlMs: -1000 // Already expired
      });

      await expect(writePreparedBatchDirectly(prepared)).rejects.toThrow(ClipboardWriteError);
      await expect(writePreparedBatchDirectly(prepared)).rejects.toThrow(/expired/);
    });

    it('handles permission denied errors cleanly', async () => {
      const mockWrite = vi.fn().mockRejectedValue(new Error('NotAllowedError: Permission denied'));
      Object.defineProperty(navigator, 'clipboard', {
        value: { write: mockWrite },
        writable: true,
        configurable: true
      });

      const prepared = prepareClipboardBatchItem({
        batchId: 'batch_denied',
        batchIndex: 1,
        totalBatches: 1,
        nodeCount: 1,
        binaryBuffer: new Uint8Array([1, 2, 3, 4])
      });

      await expect(adapter.writePreparedBatch(prepared)).rejects.toThrow(ClipboardWriteError);
    });
  });

  describe('Wire Compatibility & Self-Check Diagnostics', () => {
    it('validates genuine fig-kiwi payload compatibility', async () => {
      const testPayload = await adapter.createPasteTestPayload();
      const validation = await adapter.validateCompatibility({
        binary: testPayload.binaryBuffer
      });

      expect(validation.compatible).toBe(true);
      expect(validation.wireVersion).toBe(15);
      expect(validation.nodeCount).toBe(2);
    });

    it('rejects corrupt binary with invalid magic header', async () => {
      const corrupt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const validation = await adapter.validateCompatibility({ binary: corrupt });
      expect(validation.compatible).toBe(false);
      expect(validation.reason).toContain('Invalid magic header');
    });

    it('exports diagnostic JSON with explicit non-.fig disclaimer', () => {
      const batch = {
        batchId: 'batch_diag',
        batchIndex: 1,
        totalBatches: 2,
        status: 'ready' as const,
        pageFrames: [{ id: 'p1', name: 'Pricing', width: 1440, height: 900 } as SceneNode],
        metadata: [],
        nodes: [{ id: 'p1', name: 'Pricing', width: 1440, height: 900 } as SceneNode],
        estimatedBytes: 1500
      };

      const json = adapter.exportBatchDiagnosticJson(batch);
      const parsed = JSON.parse(json);

      expect(parsed.format).toBe('web-to-figma-diagnostics-v1');
      expect(parsed.warning).toContain('cannot be opened directly by Figma desktop as a .fig file');
      expect(parsed.batchId).toBe('batch_diag');
    });
  });
});
