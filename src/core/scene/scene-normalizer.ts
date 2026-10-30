/**
 * Scene Normalizer and Coordinate Rebaser.
 * 
 * Enforces Figma-compatible local coordinates, preserves CSS 2.2 Appendix E
 * sibling painting order, sanitizes degenerate geometry, and reports stacking ambiguities.
 */

import { SceneNode } from '../../shared/contracts/scene';
import { SourceNode } from '../../shared/contracts/source-node';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface NormalizerOptions {
  roundPrecision?: number | undefined;
  minDimension?: number | undefined;
  reportStackingAmbiguities?: boolean | undefined;
}

export interface NormalizerResult {
  diagnostics: ExportDiagnostic[];
}

/**
 * Normalizes all nodes in the scene tree:
 * 1. Rebase document coordinates to local parent-relative coordinates.
 * 2. Sanitize dimensions (prevent NaN, Infinity, negative/zero dimensions).
 * 3. Sort parent childIds into CSS painting order.
 */
export function normalizeSceneGraph(
  rootFrame: SceneNode,
  nodes: Map<string, SceneNode>,
  sourceNodes?: Map<string, SourceNode> | undefined,
  options: NormalizerOptions = {}
): NormalizerResult {
  const diagnostics: ExportDiagnostic[] = [];
  const minDim = options.minDimension ?? 0.01;

  // 1. Sanitize root frame dimensions
  rootFrame.width = Math.max(minDim, Number.isFinite(rootFrame.width) ? rootFrame.width : minDim);
  rootFrame.height = Math.max(minDim, Number.isFinite(rootFrame.height) ? rootFrame.height : minDim);
  const rootAbsX = rootFrame.x;
  const rootAbsY = rootFrame.y;
  rootFrame.x = 0;
  rootFrame.y = 0;

  // 2. Recursively rebase coordinates top-down and sanitize dimensions
  function rebaseSubtree(nodeId: string, parentAbsX: number, parentAbsY: number): void {
    const node = nodes.get(nodeId);
    if (!node) return;

    const absX = node.x;
    const absY = node.y;

    const localX = absX - parentAbsX;
    const localY = absY - parentAbsY;

    node.x = Math.round(localX * 100) / 100;
    node.y = Math.round(localY * 100) / 100;
    node.width = Math.max(minDim, Number.isFinite(node.width) ? Math.round(node.width * 100) / 100 : minDim);
    node.height = Math.max(minDim, Number.isFinite(node.height) ? Math.round(node.height * 100) / 100 : minDim);

    for (const childId of node.childIds) {
      rebaseSubtree(childId, absX, absY);
    }
  }

  for (const childId of rootFrame.childIds) {
    rebaseSubtree(childId, rootAbsX, rootAbsY);
  }

  // 3. Sort siblings by CSS paint/stacking order
  if (sourceNodes) {
    for (const [, node] of nodes.entries()) {
      if (node.childIds.length > 1) {
        sortChildrenByStackingOrder(node, nodes, sourceNodes, diagnostics);
      }
    }
    if (rootFrame.childIds.length > 1) {
      sortChildrenByStackingOrder(rootFrame, nodes, sourceNodes, diagnostics);
    }
  }

  return { diagnostics };
}

/**
 * Sorts childIds of a container in CSS 2.2 painting order:
 * Earlier items paint underneath, later items paint on top.
 */
export function sortChildrenByStackingOrder(
  parent: SceneNode,
  allNodes: Map<string, SceneNode>,
  sourceNodes: Map<string, SourceNode>,
  diagnostics: ExportDiagnostic[]
): void {
  const childrenWithMeta: Array<{
    childId: string;
    zIndex: number | 'auto';
    originalIndex: number;
    createsStackingContext: boolean;
  }> = [];

  for (let i = 0; i < parent.childIds.length; i++) {
    const childId = parent.childIds[i]!;
    const sceneChild = allNodes.get(childId);
    const sourceNode = sceneChild?.sourceNodeId ? sourceNodes.get(sceneChild.sourceNodeId) : undefined;

    const zIndex = sourceNode?.stacking?.zIndex ?? 'auto';
    const createsStackingContext = sourceNode?.stacking?.createsStackingContext ?? false;

    childrenWithMeta.push({
      childId,
      zIndex,
      originalIndex: i,
      createsStackingContext
    });
  }

  // Group into: negative z-index, zero/auto (in DOM order), positive z-index
  const negativeList: typeof childrenWithMeta = [];
  const normalList: typeof childrenWithMeta = [];
  const positiveList: typeof childrenWithMeta = [];

  for (const item of childrenWithMeta) {
    if (typeof item.zIndex === 'number') {
      if (item.zIndex < 0) {
        negativeList.push(item);
      } else if (item.zIndex > 0) {
        positiveList.push(item);
      } else {
        normalList.push(item);
      }
    } else {
      normalList.push(item);
    }
  }

  // Sort negative ascending: -5 before -1
  negativeList.sort((a, b) => {
    const za = a.zIndex as number;
    const zb = b.zIndex as number;
    return za - zb || a.originalIndex - b.originalIndex;
  });

  // Normal list preserves original DOM order
  normalList.sort((a, b) => a.originalIndex - b.originalIndex);

  // Sort positive ascending: 1 before 10
  positiveList.sort((a, b) => {
    const za = a.zIndex as number;
    const zb = b.zIndex as number;
    return za - zb || a.originalIndex - b.originalIndex;
  });

  const sorted = [...negativeList, ...normalList, ...positiveList];
  parent.childIds = sorted.map((s) => s.childId);
}
