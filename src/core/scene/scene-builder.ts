/**
 * Target-Independent Scene Builder Engine.
 * 
 * Orchestrates DOM semantics, geometry, typography, CSS visual styles,
 * and layout reconstruction into a single coherent PageScene graph.
 */

import {
  PageCapture,
  PageScene,
  SceneNode,
  ScenePaint,
  SceneBuilderOptions,
  FigmaSceneDocument
} from '../../shared/contracts/scene';
import { SourceNode } from '../../shared/contracts/source-node';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { generatePageFrameName } from './scene-naming';
import {
  mapSourceNodeToSceneNode,
  collapseStructuralWrappers
} from './node-mapper';
import { normalizeSceneGraph } from './scene-normalizer';
import { validatePageScene } from './scene-validation';
import { translateFlexboxToAutoLayout } from '../layout/flexbox-translator';
import { translateGridToLayout } from '../layout/grid-translator';
import { NormalizedLayoutProps, parseLengthPx } from '../layout/layout-analyzer';

export interface SceneBuildResult {
  scene: PageScene;
  diagnostics: ExportDiagnostic[];
}

/**
 * Builds a target-independent PageScene from a validated PageCapture snapshot.
 */
export function buildPageScene(
  capture: PageCapture,
  options: SceneBuilderOptions = {}
): PageScene {
  const diagnostics: ExportDiagnostic[] = [...(capture.diagnostics ?? [])];
  const sourceNodesById = new Map<string, SourceNode>();
  for (const node of capture.nodes) {
    sourceNodesById.set(node.nodeId, node);
  }

  // 1. Determine Page Frame Dimensions
  let frameWidth = capture.metadata.documentDimensions.width;
  let frameHeight = capture.metadata.documentDimensions.height;

  if (capture.metadata.captureMode === 'viewport') {
    frameWidth = capture.metadata.viewport.width;
    frameHeight = capture.metadata.viewport.height;
  } else if (capture.metadata.captureMode === 'selected-element') {
    const selectedRoot = capture.nodes[0];
    if (selectedRoot) {
      frameWidth = selectedRoot.documentRect.width;
      frameHeight = selectedRoot.documentRect.height;
    }
  }

  // 2. Build Top-Level Page Frame
  const pageFrameName = generatePageFrameName(
    capture.metadata.pageIndex,
    capture.metadata.title,
    capture.metadata.finalUrl || capture.metadata.requestedUrl
  );

  const pageFrameId = `scene_page_${capture.metadata.pageIndex}`;
  const rootFrame: SceneNode = {
    id: pageFrameId,
    sourceNodeId: 'root_page_frame',
    parentId: null,
    childIds: [],
    name: pageFrameName,
    type: 'FRAME',
    visible: true,
    x: 0,
    y: 0,
    width: Math.max(1, frameWidth),
    height: Math.max(1, frameHeight),
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: true
  };

  const allNodes = new Map<string, SceneNode>();
  allNodes.set(pageFrameId, rootFrame);

  // 3. Map all SourceNodes to SceneNodes
  for (const sourceNode of capture.nodes) {
    const mapping = mapSourceNodeToSceneNode(sourceNode, options);
    diagnostics.push(...mapping.diagnostics);

    allNodes.set(mapping.sceneNode.id, mapping.sceneNode);

    for (const synthChild of mapping.synthesizedChildren) {
      allNodes.set(synthChild.id, synthChild);
    }
  }

  // 4. Attach top-level root source nodes to rootFrame
  for (const sourceNode of capture.nodes) {
    const sceneId = `scene_${sourceNode.nodeId}`;
    if (!sourceNode.parentId || !sourceNodesById.has(sourceNode.parentId)) {
      const sceneNode = allNodes.get(sceneId);
      if (sceneNode) {
        sceneNode.parentId = rootFrame.id;
        if (!rootFrame.childIds.includes(sceneId)) {
          rootFrame.childIds.push(sceneId);
        }
      }
    }
  }

  // If first source node has background, inherit it on page frame
  const firstNode = capture.nodes[0];
  if (firstNode) {
    const firstScene = allNodes.get(`scene_${firstNode.nodeId}`);
    if (firstScene && firstScene.fills.length > 0) {
      rootFrame.fills = [...firstScene.fills];
    }
  }

  // 5. Reconstruct Layout Container Metadata
  for (const sourceNode of capture.nodes) {
    const sceneNode = allNodes.get(`scene_${sourceNode.nodeId}`);
    if (!sceneNode || sceneNode.type !== 'FRAME') continue;

    const childSourceNodes = sourceNode.childIds
      .map((cid) => sourceNodesById.get(cid))
      .filter((c): c is SourceNode => Boolean(c));

    attachLayoutMetadata(sceneNode, sourceNode, childSourceNodes, diagnostics);
  }

  // 6. Collapse Purely Structural Wrappers (if enabled)
  if (options.collapseStructuralWrappers !== false) {
    collapseStructuralWrappers(allNodes);
  }

  // 7. Rebase Coordinates to Parent-Relative & Sort Stacking Order
  const normResult = normalizeSceneGraph(rootFrame, allNodes, sourceNodesById);
  diagnostics.push(...normResult.diagnostics);

  // 8. Optional Visual Reference Snapshot Child
  if (options.includeVisualSnapshot && capture.assetRefs && capture.assetRefs.length > 0) {
    const snapshotId = `${rootFrame.id}_visual_snapshot`;
    const snapshotNode: SceneNode = {
      id: snapshotId,
      sourceNodeId: 'visual_snapshot',
      parentId: rootFrame.id,
      childIds: [],
      name: 'Visual Reference Snapshot',
      type: 'RECTANGLE',
      visible: false,
      x: 0,
      y: 0,
      width: rootFrame.width,
      height: rootFrame.height,
      rotation: 0,
      fills: [
        {
          type: 'IMAGE',
          imageRef: capture.assetRefs[0],
          opacity: 0.5,
          visible: true
        }
      ],
      strokes: [],
      effects: [],
      clipsContent: false
    };

    rootFrame.childIds.unshift(snapshotId); // Bottom-most layer
    allNodes.set(snapshotId, snapshotNode);
  }

  // 9. Build PageScene and Run Structural Validation
  const nodeList = Array.from(allNodes.values());
  const pageScene: PageScene = {
    metadata: {
      ...capture.metadata,
      totalNodes: nodeList.length
    },
    pageFrame: rootFrame,
    nodes: nodeList,
    diagnostics
  };

  const validation = validatePageScene(pageScene);
  diagnostics.push(...validation.diagnostics);

  if (!validation.isValid) {
    for (const err of validation.errors) {
      diagnostics.push({
        severity: 'error',
        code: 'SCENE_VALIDATION_ERROR',
        message: err,
        phase: 'scene-conversion',
        timestamp: Date.now()
      });
    }
  }

  return pageScene;
}

/**
 * Builds a multi-page FigmaSceneDocument from an array of PageScenes.
 */
export function buildFigmaSceneDocument(
  scenes: PageScene[],
  options: { exportTitle?: string; sourceSite?: string } = {}
): FigmaSceneDocument {
  const pageFrames = scenes.map((s) => s.pageFrame);
  let totalNodes = 0;
  for (const scene of scenes) {
    totalNodes += scene.nodes.length;
  }

  const firstScene = scenes[0];
  const sourceSite =
    options.sourceSite ??
    (firstScene?.metadata.finalUrl
      ? extractOriginSafely(firstScene.metadata.finalUrl)
      : 'Web Export');

  const exportTitle =
    options.exportTitle ??
    (firstScene?.metadata.title || 'Web to Figma Export');

  return {
    schemaVersion: 1,
    exportTitle,
    sourceSite,
    exportedAt: Date.now(),
    pageFrames,
    sections: [],
    metadata: {
      totalNodes,
      totalAssets: 0,
      totalPages: scenes.length,
      devicePixelRatio: firstScene?.metadata.viewport.devicePixelRatio ?? 1
    }
  };
}

/**
 * Attaches layout metadata (Auto Layout flex/grid) to a container node.
 */
function attachLayoutMetadata(
  sceneNode: SceneNode,
  sourceNode: SourceNode,
  childNodes: SourceNode[],
  diagnostics: ExportDiagnostic[]
): void {
  const style = sourceNode.computedStyle;
  const isFlex = sourceNode.layoutHints.isFlexContainer;
  const isGrid = sourceNode.layoutHints.isGridContainer;

  if (!isFlex && !isGrid) return;

  const gapPx = parseLengthPx(style.gap);
  const padding = parseBoxEdges(style.padding);

  const normalized: NormalizedLayoutProps = {
    display: isFlex ? 'flex' : 'grid',
    isFlex,
    isGrid,
    flexDirection: (style.flexDirection || 'row').toLowerCase() as any,
    flexWrap: 'nowrap',
    justifyContent: (style.justifyContent || 'flex-start').toLowerCase(),
    alignItems: (style.alignItems || 'stretch').toLowerCase(),
    alignContent: 'normal',
    gapRow: gapPx,
    gapColumn: gapPx,
    padding,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    position: (style.position || 'static').toLowerCase() as any,
    boxSizing: 'border-box',
    width: sceneNode.width,
    height: sceneNode.height,
    gridTemplateColumns: style.gridTemplateColumns || 'none',
    gridTemplateRows: style.gridTemplateRows || 'none',
    hasAbsoluteChildren: childNodes.some(
      (c) => c.computedStyle.position === 'absolute' || c.computedStyle.position === 'fixed'
    )
  };

  if (isFlex) {
    const flexRes = translateFlexboxToAutoLayout(normalized, sceneNode.id);
    diagnostics.push(...flexRes.diagnostics);
    sceneNode.layoutMetadata = {
      layoutMode: flexRes.config.layoutMode,
      primaryAxisAlign: flexRes.config.primaryAxisAlign,
      counterAxisAlign: flexRes.config.counterAxisAlign,
      itemSpacing: flexRes.config.itemSpacing,
      padding: flexRes.config.padding,
      decisionRecord: 'auto-layout-exact'
    };
  } else if (isGrid) {
    const gridRes = translateGridToLayout(
      normalized,
      childNodes.map((c) => c.computedStyle),
      sceneNode.id
    );
    diagnostics.push(...gridRes.diagnostics);
    if (gridRes.isQualified && gridRes.layoutConfig) {
      sceneNode.layoutMetadata = {
        layoutMode: gridRes.layoutConfig.layoutMode,
        primaryAxisAlign: gridRes.layoutConfig.primaryAxisAlign,
        counterAxisAlign: gridRes.layoutConfig.counterAxisAlign,
        itemSpacing: gridRes.layoutConfig.itemSpacing,
        padding: gridRes.layoutConfig.padding,
        decisionRecord: 'auto-layout-approximate'
      };
    }
  }
}

function parseBoxEdges(val?: string): { top: number; right: number; bottom: number; left: number } {
  if (!val) return { top: 0, right: 0, bottom: 0, left: 0 };
  const parts = val.trim().split(/\s+/).map((p) => parseFloat(p) || 0);
  if (parts.length === 1) {
    const v = parts[0]!;
    return { top: v, right: v, bottom: v, left: v };
  }
  if (parts.length === 2) {
    const v = parts[0]!;
    const h = parts[1]!;
    return { top: v, right: h, bottom: v, left: h };
  }
  if (parts.length === 3) {
    return { top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[1]! };
  }
  if (parts.length >= 4) {
    return { top: parts[0]!, right: parts[1]!, bottom: parts[2]!, left: parts[3]! };
  }
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

function extractOriginSafely(rawUrl: string): string {
  try {
    return new URL(rawUrl).origin;
  } catch {
    return rawUrl;
  }
}
