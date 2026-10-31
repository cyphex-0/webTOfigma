/**
 * Browser-Neutral Figma Clipboard Adapter.
 * 
 * Central coordinator for:
 * - Hardware capacity detection and adaptive budgeting
 * - Payload size estimation and WebGL texture slicing guards
 * - Multi-page batch partitioning with route preservation
 * - Advance payload preparation for zero-I/O clipboard writes
 * - Clipboard write execution and retry orchestration
 * - Self-check paste test frame creation
 * - Diagnostics JSON export (defensively labeled as JSON, never .fig)
 */

import type { SceneNode, FigmaSceneDocument } from '../../../shared/contracts/scene';
import type { ExportDiagnostic } from '../../../shared/contracts/diagnostics';
import type { StructuredPageMetadata } from '../../scene/page-metadata';
import {
  detectHardwareCapabilities,
  getHardwareAdaptiveBudgetProfile,
  type HardwareCapabilities,
  type ExportBudgetProfile
} from './compatibility-profile';
import {
  estimatePayloadCost,
  type ImageDimensionRecord,
  type PayloadEstimationResult
} from './payload-estimator';
import {
  partitionSceneDocument,
  type ClipboardBatch,
  type PartitionOptions
} from './batch-partitioner';
import {
  serializeSceneGraph,
  SERIALIZER_VERSION,
  type SceneSerializationOptions,
  type SerializationStats
} from './serializer';
import {
  prepareClipboardBatchItem,
  writePreparedBatchDirectly,
  type PreparedClipboardBatch,
  type ClipboardWriteConfirmation
} from './clipboard-writer';
import {
  FIGMA_MAGIC_HEADER,
  FIGMA_WIRE_VERSION,
  deserializeFigmaMessage
} from '../poc/kiwi-serializer';
import { parseFigmaClipboardHtml } from '../poc/clipboard-envelope';

export interface PreparedBatchResult {
  preparedBatch: PreparedClipboardBatch;
  diagnostics: ExportDiagnostic[];
  stats: SerializationStats;
}

export interface CompatibilityValidationResult {
  compatible: boolean;
  wireVersion: number | null;
  nodeCount: number | null;
  reason?: string | undefined;
}

export class FigmaClipboardAdapter {
  private readonly capabilities: HardwareCapabilities;
  private readonly budgetProfile: ExportBudgetProfile;

  constructor(options?: {
    capabilitiesOverride?: HardwareCapabilities | undefined;
    budgetProfileOverride?: ExportBudgetProfile | undefined;
  }) {
    this.capabilities = options?.capabilitiesOverride ?? detectHardwareCapabilities();
    this.budgetProfile = options?.budgetProfileOverride ?? getHardwareAdaptiveBudgetProfile(this.capabilities);
  }

  /**
   * Retrieves active hardware capabilities and adaptive budget profile.
   */
  getCapabilityProfile(): {
    capabilities: HardwareCapabilities;
    budgetProfile: ExportBudgetProfile;
    serializerVersion: string;
  } {
    return {
      capabilities: this.capabilities,
      budgetProfile: this.budgetProfile,
      serializerVersion: SERIALIZER_VERSION
    };
  }

  /**
   * Estimates serialization cost and identifies oversized texture risks.
   */
  estimateSize(
    document: FigmaSceneDocument & { allNodes?: readonly SceneNode[] | undefined },
    imageDimensions?: Record<string, ImageDimensionRecord> | undefined
  ): PayloadEstimationResult {
    return estimatePayloadCost({
      document,
      imageDimensions,
      budgetProfile: this.budgetProfile
    });
  }

  /**
   * Partitions a multi-page document into safe, ordered clipboard batches.
   */
  partitionDocument(
    document: FigmaSceneDocument & {
      allNodes?: readonly SceneNode[] | undefined;
      pageMetadata: Record<string, StructuredPageMetadata>;
    },
    options?: PartitionOptions | undefined
  ): ClipboardBatch[] {
    return partitionSceneDocument(document, {
      budgetProfile: options?.budgetProfile ?? this.budgetProfile,
      imageDimensions: options?.imageDimensions
    });
  }

  /**
   * Serializes an entire scene document or arbitrary node list to binary buffer.
   */
  async serializeDocument(
    nodes: readonly SceneNode[],
    options?: SceneSerializationOptions | undefined
  ) {
    return serializeSceneGraph(nodes, {
      maxTextureDimension: this.budgetProfile.maxTextureDimension,
      ...options
    });
  }

  /**
   * Precomputes binary buffer, HTML envelope, and ClipboardItem for a batch ahead of user click.
   */
  async prepareClipboardBatch(
    batch: ClipboardBatch,
    options?: SceneSerializationOptions | undefined
  ): Promise<PreparedBatchResult> {
    const serialization = await this.serializeDocument(batch.nodes, options);

    const preparedBatch = prepareClipboardBatchItem({
      batchId: batch.batchId,
      batchIndex: batch.batchIndex,
      totalBatches: batch.totalBatches,
      nodeCount: batch.nodes.length,
      binaryBuffer: serialization.binaryBuffer
    });

    return {
      preparedBatch,
      diagnostics: serialization.diagnostics,
      stats: serialization.stats
    };
  }

  /**
   * Executes direct zero-I/O clipboard write of a precomputed batch payload.
   */
  async writePreparedBatch(
    preparedBatch: PreparedClipboardBatch
  ): Promise<ClipboardWriteConfirmation> {
    return writePreparedBatchDirectly(preparedBatch);
  }

  /**
   * Validates binary buffer or HTML envelope integrity against Figma Kiwi wire specification.
   */
  async validateCompatibility(payload: {
    binary?: Uint8Array | undefined;
    html?: string | undefined;
  }): Promise<CompatibilityValidationResult> {
    let binary = payload.binary;

    if (!binary && payload.html) {
      const parsed = parseFigmaClipboardHtml(payload.html);
      if (!parsed.binary) {
        return {
          compatible: false,
          wireVersion: null,
          nodeCount: null,
          reason: 'No binary figma payload could be extracted from HTML envelope.'
        };
      }
      binary = parsed.binary;
    }

    if (!binary || binary.byteLength < 16) {
      return {
        compatible: false,
        wireVersion: null,
        nodeCount: null,
        reason: 'Binary payload is missing or too short.'
      };
    }

    const magic = new TextDecoder().decode(binary.subarray(0, 8));
    if (magic !== FIGMA_MAGIC_HEADER) {
      return {
        compatible: false,
        wireVersion: null,
        nodeCount: null,
        reason: `Invalid magic header: expected '${FIGMA_MAGIC_HEADER}', got '${magic}'.`
      };
    }

    const view = new DataView(binary.buffer, binary.byteOffset, binary.byteLength);
    const wireVersion = view.getUint32(8, true);

    if (wireVersion !== FIGMA_WIRE_VERSION) {
      return {
        compatible: false,
        wireVersion,
        nodeCount: null,
        reason: `Unsupported wire version ${wireVersion} (expected ${FIGMA_WIRE_VERSION}).`
      };
    }

    try {
      const msg = await deserializeFigmaMessage(binary);
      return {
        compatible: true,
        wireVersion,
        nodeCount: msg.nodeChanges.length
      };
    } catch (err) {
      return {
        compatible: false,
        wireVersion,
        nodeCount: null,
        reason: `Kiwi message deserialization error: ${err instanceof Error ? err.message : String(err)}`
      };
    }
  }

  /**
   * Prepares a lightweight test frame so the user can verify their Figma paste pipeline.
   */
  async createPasteTestPayload(): Promise<PreparedClipboardBatch> {
    const testFrame: SceneNode = {
      id: 'web_to_figma_paste_test',
      parentId: null,
      childIds: ['test_label'],
      name: 'Web-to-Figma Test Paste Frame',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 320,
      height: 120,
      rotation: 0,
      cornerRadius: 8,
      fills: [{ type: 'SOLID', color: { r: 0.1, g: 0.5, b: 0.9, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    const testLabel: SceneNode = {
      id: 'test_label',
      parentId: 'web_to_figma_paste_test',
      childIds: [],
      name: 'Test Label',
      type: 'TEXT',
      visible: true,
      x: 16,
      y: 48,
      width: 288,
      height: 24,
      rotation: 0,
      fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
      strokes: [],
      effects: [],
      clipsContent: false,
      textData: {
        text: 'Web-to-Figma Test: Paste OK!',
        fontSize: 16,
        fontWeight: 600,
        fontFamily: 'Inter',
        textAlign: 'CENTER'
      }
    };

    const serialization = await this.serializeDocument([testFrame, testLabel]);
    return prepareClipboardBatchItem({
      batchId: 'paste_test_batch',
      batchIndex: 1,
      totalBatches: 1,
      nodeCount: 2,
      binaryBuffer: serialization.binaryBuffer
    });
  }

  /**
   * Exports batch diagnostics as structured JSON for debugging.
   * Note: This is diagnostic JSON for developer inspection, NOT a binary .fig file.
   */
  exportBatchDiagnosticJson(batch: ClipboardBatch): string {
    return JSON.stringify(
      {
        format: 'web-to-figma-diagnostics-v1',
        warning: 'This is diagnostic JSON for inspection. It cannot be opened directly by Figma desktop as a .fig file.',
        batchId: batch.batchId,
        batchIndex: batch.batchIndex,
        totalBatches: batch.totalBatches,
        status: batch.status,
        nodeCount: batch.nodes.length,
        estimatedBytes: batch.estimatedBytes,
        pageFrames: batch.pageFrames.map((f) => ({ id: f.id, name: f.name, width: f.width, height: f.height })),
        metadata: batch.metadata
      },
      null,
      2
    );
  }
}
