/**
 * Payload Estimator and Large-Image Texture Slicing Guard.
 * 
 * Inspects scene graphs before serialization:
 * - Computes total node counts, hierarchy depth, and asset bytes
 * - Detects oversized raster assets exceeding WebGL texture boundaries (4,096 / 8,192 px)
 * - Computes vertical image slicing geometry to prevent Figma WebGL context crashes
 * - Tags resulting sliced nodes with TEXTURE_SLICED_OVERSIZED in diagnostics
 * - Recommends batch partitioning when payloads exceed hardware budget tiers
 */

import type { SceneNode, FigmaSceneDocument } from '../../../shared/contracts/scene';
import type { ExportDiagnostic } from '../../../shared/contracts/diagnostics';
import {
  ExportBudgetProfile,
  getHardwareAdaptiveBudgetProfile
} from './compatibility-profile';

export interface ImageDimensionRecord {
  width: number;
  height: number;
  byteLength?: number | undefined;
}

export interface OversizedImageAsset {
  nodeId: string;
  imageRef: string;
  width: number;
  height: number;
  maxDimension: number;
  recommendedSliceCount: number;
}

export interface PayloadEstimationInput {
  document: FigmaSceneDocument & { allNodes?: readonly SceneNode[] | undefined };
  imageDimensions?: Record<string, ImageDimensionRecord> | undefined;
  budgetProfile?: ExportBudgetProfile | undefined;
}

export interface PayloadEstimationResult {
  totalNodes: number;
  maxHierarchyDepth: number;
  totalAssetBytes: number;
  estimatedBinaryBytes: number;
  estimatedHtmlLength: number;
  oversizedImages: OversizedImageAsset[];
  fitsInSingleBatch: boolean;
  recommendedBatchCount: number;
  warnings: string[];
}

/**
 * Estimates clipboard serialization cost and identifies oversized texture risks.
 */
export function estimatePayloadCost(input: PayloadEstimationInput): PayloadEstimationResult {
  const profile = input.budgetProfile ?? getHardwareAdaptiveBudgetProfile();
  const maxTextureDim = profile.maxTextureDimension;
  const imageDims = input.imageDimensions ?? {};

  const nodes = input.document.allNodes && input.document.allNodes.length > 0
    ? input.document.allNodes
    : [...input.document.pageFrames, ...input.document.sections];

  const nodesById = new Map<string, SceneNode>();
  for (const n of nodes) {
    nodesById.set(n.id, n);
  }

  // 1. Calculate max hierarchy depth
  let maxDepth = 1;
  for (const node of nodes) {
    let depth = 1;
    let curr = node;
    const visited = new Set<string>([curr.id]);

    while (curr.parentId !== null) {
      const parent = nodesById.get(curr.parentId);
      if (!parent || visited.has(parent.id)) break;
      visited.add(parent.id);
      depth++;
      curr = parent;
    }
    maxDepth = Math.max(maxDepth, depth);
  }

  // 2. Discover unique asset references & oversized images
  const assetRefs = new Set<string>();
  const oversizedImages: OversizedImageAsset[] = [];
  const warnings: string[] = [];

  for (const node of nodes) {
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageRef) {
        assetRefs.add(fill.imageRef);

        const imgDim = imageDims[fill.imageRef];
        const effectiveWidth = Math.max(node.width, imgDim?.width ?? 0);
        const effectiveHeight = Math.max(node.height, imgDim?.height ?? 0);

        if (effectiveHeight > maxTextureDim || effectiveWidth > maxTextureDim) {
          const dominantDim = Math.max(effectiveWidth, effectiveHeight);
          const sliceCount = Math.ceil(effectiveHeight / maxTextureDim);

          oversizedImages.push({
            nodeId: node.id,
            imageRef: fill.imageRef,
            width: effectiveWidth,
            height: effectiveHeight,
            maxDimension: dominantDim,
            recommendedSliceCount: Math.max(2, sliceCount)
          });

          warnings.push(
            `Node '${node.name}' (${node.id}) image height (${Math.round(effectiveHeight)}px) exceeds texture limit (${maxTextureDim}px). Slicing recommended.`
          );
        }
      }
    }
  }

  // 3. Compute total asset bytes
  let totalAssetBytes = 0;
  for (const ref of assetRefs) {
    totalAssetBytes += imageDims[ref]?.byteLength ?? 50 * 1024; // default 50KB estimate
  }

  // 4. Estimate binary and HTML string sizes
  const totalNodes = nodes.length;
  // Approx 60 bytes per node in compressed Kiwi + asset payload
  const estimatedBinaryBytes = totalNodes * 65 + totalAssetBytes;
  // Base64 expansion is ~1.33x + HTML tags
  const estimatedHtmlLength = Math.ceil(estimatedBinaryBytes * 1.34) + 500;

  // 5. Partition recommendations
  const totalPages = input.document.pageFrames.length;
  const countByPages = Math.ceil(totalPages / profile.maxPagesPerBatch);
  const countByNodes = Math.ceil(totalNodes / profile.maxNodesPerBatch);
  const countByAssets = Math.ceil(totalAssetBytes / profile.maxAssetBytesPerBatch);

  const recommendedBatchCount = Math.max(1, countByPages, countByNodes, countByAssets);
  const fitsInSingleBatch = recommendedBatchCount === 1 && oversizedImages.length === 0;

  if (!fitsInSingleBatch) {
    if (totalNodes > profile.maxNodesPerBatch) {
      warnings.push(
        `Total scene nodes (${totalNodes}) exceeds hardware batch budget (${profile.maxNodesPerBatch}).`
      );
    }
    if (totalAssetBytes > profile.maxAssetBytesPerBatch) {
      warnings.push(
        `Total asset payload (${Math.round(totalAssetBytes / 1024 / 1024)}MB) exceeds hardware batch budget (${Math.round(profile.maxAssetBytesPerBatch / 1024 / 1024)}MB).`
      );
    }
  }

  return {
    totalNodes,
    maxHierarchyDepth: maxDepth,
    totalAssetBytes,
    estimatedBinaryBytes,
    estimatedHtmlLength,
    oversizedImages,
    fitsInSingleBatch,
    recommendedBatchCount,
    warnings
  };
}

export interface SlicedImageResult {
  containerNode: SceneNode;
  sliceNodes: SceneNode[];
  diagnostic: ExportDiagnostic;
}

/**
 * Slices an oversized image node vertically into seamless contiguous sub-frames.
 * Prevents Figma's WebGL canvas engine context loss from exceeding max texture dimensions.
 */
export function sliceOversizedImageNode(
  node: SceneNode,
  maxTextureDimension: number = 4096
): SlicedImageResult | null {
  const imageFill = node.fills.find((f) => f.type === 'IMAGE' && f.imageRef);
  if (!imageFill || !imageFill.imageRef || node.height <= maxTextureDimension) {
    return null;
  }

  const sliceHeight = maxTextureDimension;
  const sliceCount = Math.ceil(node.height / sliceHeight);
  const sliceNodes: SceneNode[] = [];
  const childIds: string[] = [];

  for (let i = 0; i < sliceCount; i++) {
    const currentY = i * sliceHeight;
    const currentHeight = Math.min(sliceHeight, node.height - currentY);
    const sliceId = `${node.id}_slice_${i + 1}`;
    childIds.push(sliceId);

    const sliceNode: SceneNode = {
      id: sliceId,
      parentId: node.id,
      childIds: [],
      name: `${node.name} (Slice ${i + 1} of ${sliceCount})`,
      type: 'RECTANGLE',
      visible: true,
      x: 0,
      y: currentY,
      width: node.width,
      height: currentHeight,
      rotation: 0,
      fills: [imageFill],
      strokes: [],
      effects: [],
      clipsContent: true
    };

    sliceNodes.push(sliceNode);
  }

  // Convert parent node to a container frame with clipsContent: true and no background
  const containerNode: SceneNode = {
    ...node,
    type: 'FRAME',
    childIds,
    fills: [], // Remove direct fill; children render slices
    clipsContent: true
  };

  const diagnostic: ExportDiagnostic = {
    severity: 'info',
    code: 'TEXTURE_SLICED_OVERSIZED',
    message: `Image node '${node.name}' (${Math.round(node.height)}px tall) exceeded WebGL texture limit (${maxTextureDimension}px). Sliced vertically into ${sliceCount} seamless sub-frames.`,
    phase: 'scene-conversion',
    nodeId: node.id,
    timestamp: Date.now()
  };

  return {
    containerNode,
    sliceNodes,
    diagnostic
  };
}
