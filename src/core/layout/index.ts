/**
 * Master Layout Reconstruction Coordinator.
 * 
 * Orchestrates Flexbox recognition, CSS Grid mapping, sizing mode derivation,
 * and fidelity-preserving positioned frame fallbacks.
 */

import { SceneLayoutMetadata } from '../../shared/contracts/scene';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import {
  normalizeContainerLayout,
  determineLayoutDecision,
  NormalizedLayoutProps,
  LayoutDecision
} from './layout-analyzer';
import { translateFlexboxToAutoLayout } from './flexbox-translator';
import { translateGridToLayout } from './grid-translator';
import { translateChildSizing, FigmaSizingMode } from './sizing-translator';
import { buildPositionedFrameLayout, PositionedChild, PositionedNodeGeometry } from './layout-fallback';
import { createLayoutFallbackDiagnostic } from './layout-diagnostics';

export * from './layout-analyzer';
export * from './flexbox-translator';
export * from './grid-translator';
export * from './sizing-translator';
export * from './positioning-translator';
export * from './layout-fallback';
export * from './layout-diagnostics';

export interface ChildLayoutInput {
  id: string;
  element: Element;
  globalRect: { x: number; y: number; width: number; height: number };
  style: any;
  hasChildren: boolean;
  isText: boolean;
  zIndex?: number | 'auto' | undefined;
}

export interface ReconstructedLayoutResult {
  decision: LayoutDecision;
  layoutMetadata: SceneLayoutMetadata;
  childrenSizing: Map<string, { horizontal: FigmaSizingMode; vertical: FigmaSizingMode }>;
  positionedChildren?: PositionedNodeGeometry[] | undefined;
  diagnostics: ExportDiagnostic[];
}

/**
 * Reconstructs the layout configuration for a container and its children.
 */
export function reconstructContainerLayout(
  containerEl: Element,
  containerStyle: any,
  children: ChildLayoutInput[],
  options: { nodeId?: string | undefined } = {}
): ReconstructedLayoutResult {
  const diagnostics: ExportDiagnostic[] = [];
  const childElements = children.map((c) => c.element);

  // 1. Normalize container layout properties
  const normalizedProps: NormalizedLayoutProps = normalizeContainerLayout(
    containerEl,
    containerStyle,
    childElements
  );

  // 2. Determine layout decision
  const decisionResult = determineLayoutDecision(normalizedProps, children.length);
  let decision: LayoutDecision = decisionResult.decision;

  let layoutMetadata: SceneLayoutMetadata;
  let positionedChildren: PositionedNodeGeometry[] | undefined = undefined;

  const getParentRect = () => {
    const rect = containerEl.getBoundingClientRect
      ? containerEl.getBoundingClientRect()
      : { left: 0, top: 0, width: normalizedProps.width, height: normalizedProps.height };
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width || normalizedProps.width,
      height: rect.height || normalizedProps.height
    };
  };

  if (decision === 'auto-layout-exact' || decision === 'auto-layout-approximate') {
    if (normalizedProps.isFlex) {
      const flexResult = translateFlexboxToAutoLayout(normalizedProps, options.nodeId);
      diagnostics.push(...flexResult.diagnostics);

      layoutMetadata = {
        layoutMode: flexResult.config.layoutMode,
        primaryAxisAlign: flexResult.config.primaryAxisAlign,
        counterAxisAlign: flexResult.config.counterAxisAlign,
        itemSpacing: flexResult.config.itemSpacing,
        padding: flexResult.config.padding,
        decisionRecord: decision
      };
    } else if (normalizedProps.isGrid) {
      const gridResult = translateGridToLayout(
        normalizedProps,
        children.map((c) => c.style),
        options.nodeId
      );
      diagnostics.push(...gridResult.diagnostics);

      if (gridResult.isQualified && gridResult.layoutConfig) {
        layoutMetadata = {
          layoutMode: gridResult.layoutConfig.layoutMode,
          primaryAxisAlign: gridResult.layoutConfig.primaryAxisAlign,
          counterAxisAlign: gridResult.layoutConfig.counterAxisAlign,
          itemSpacing: gridResult.layoutConfig.itemSpacing,
          padding: gridResult.layoutConfig.padding,
          decisionRecord: decision
        };
      } else {
        // Grid disqualified -> fallback
        decision = 'positioned-fallback';
        const fallbackDiags = createLayoutFallbackDiagnostic({
          reason: gridResult.fallbackReason ?? 'CSS Grid requiring positioned fallback',
          nodeId: options.nodeId
        });
        diagnostics.push(fallbackDiags);

        const parentRect = getParentRect();
        const positioned = buildPositionedFrameLayout(parentRect, children);
        positionedChildren = positioned.children;

        layoutMetadata = {
          layoutMode: 'NONE',
          decisionRecord: 'positioned-fallback'
        };
      }
    } else {
      layoutMetadata = {
        layoutMode: 'NONE',
        decisionRecord: 'auto-layout-exact'
      };
    }
  } else {
    // Positioned-frame fallback
    const fallbackDiag = createLayoutFallbackDiagnostic({
      reason: decisionResult.reason ?? 'Unsupported layout features',
      nodeId: options.nodeId
    });
    diagnostics.push(fallbackDiag);

    const parentRect = getParentRect();
    const positioned = buildPositionedFrameLayout(parentRect, children);
    positionedChildren = positioned.children;

    layoutMetadata = {
      layoutMode: 'NONE',
      decisionRecord: 'positioned-fallback'
    };
  }

  // 3. Derive sizing modes for all children
  const childrenSizing = new Map<string, { horizontal: FigmaSizingMode; vertical: FigmaSizingMode }>();
  for (const child of children) {
    const sizing = translateChildSizing({
      style: child.style,
      hasChildren: child.hasChildren,
      isText: child.isText,
      parentLayoutMode: layoutMetadata.layoutMode
    });
    childrenSizing.set(child.id, sizing);
  }

  return {
    decision,
    layoutMetadata,
    childrenSizing,
    ...(positionedChildren ? { positionedChildren } : {}),
    diagnostics
  };
}
