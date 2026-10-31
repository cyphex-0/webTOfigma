/**
 * Responsive Per-Route Variant Matrix Builder.
 * 
 * Organizes responsive variants (Desktop 1440, Tablet 768, Mobile 375)
 * in an ordered, predictable 2D layout:
 * - Pairs variants by route in dedicated horizontal rows
 * - Applies exact measured widths and heights (never assumed fixed sizes)
 * - Assigns clear, unambiguous variant names (e.g. "01 - Home - Desktop 1440")
 * - Enforces deterministic non-overlapping gaps between variants and routes
 * - Runs collision validation across bounding boxes to ensure clean canvas layout
 */

import type { SceneNode } from '../../shared/contracts/scene';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import {
  type ResponsiveBreakpoint,
  formatResponsiveVariantName
} from '../capture/responsive-profile';
import { checkCanvasCollisions } from './canvas-collision-check';

export interface RouteVariantCapture {
  breakpoint: ResponsiveBreakpoint;
  measuredWidth: number;
  measuredHeight: number;
  frame: SceneNode;
  descendantNodes?: SceneNode[] | undefined;
}

export interface RouteResponsiveGroup {
  routeIndex: number;
  routeTitle: string;
  originalUrl: string;
  canonicalUrl: string;
  variants: RouteVariantCapture[];
}

export interface ResponsiveMatrixOptions {
  variantHorizontalGap?: number | undefined; // default 160 px
  routeVerticalGap?: number | undefined; // default 240 px
  startX?: number | undefined; // default 0
  startY?: number | undefined; // default 0
  includeRouteHeader?: boolean | undefined; // default true
}

export interface ResponsiveMatrixResult {
  positionedFrames: SceneNode[];
  headerFrames: SceneNode[];
  allNodes: SceneNode[];
  totalWidth: number;
  totalHeight: number;
  rowCount: number;
  totalVariants: number;
  diagnostics: ExportDiagnostic[];
}

/**
 * Builds a visual route header frame above a responsive row.
 */
function createRouteRowHeader(
  group: RouteResponsiveGroup,
  x: number,
  y: number,
  rowWidth: number
): { headerFrame: SceneNode; headerNodes: SceneNode[] } {
  const headerId = `header_route_${group.routeIndex}`;
  const titleId = `title_route_${group.routeIndex}`;
  const metaId = `meta_route_${group.routeIndex}`;

  const paddedIndex = String(group.routeIndex).padStart(2, '0');
  const variantSummary = group.variants
    .map((v) => `${v.breakpoint.name} (${v.measuredWidth}px)`)
    .join(', ');

  const titleNode: SceneNode = {
    id: titleId,
    parentId: headerId,
    childIds: [],
    name: 'Route Title',
    type: 'TEXT',
    visible: true,
    x: 16,
    y: 12,
    width: Math.max(300, rowWidth - 32),
    height: 24,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.08, g: 0.12, b: 0.18, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: `Route ${paddedIndex}: ${group.routeTitle}`,
      fontSize: 16,
      fontWeight: 700,
      fontFamily: 'Inter',
      lineHeight: 24,
      textAlign: 'LEFT'
    }
  };

  const metaNode: SceneNode = {
    id: metaId,
    parentId: headerId,
    childIds: [],
    name: 'Route Meta',
    type: 'TEXT',
    visible: true,
    x: 16,
    y: 36,
    width: Math.max(300, rowWidth - 32),
    height: 18,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 0.4, g: 0.45, b: 0.55, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: false,
    textData: {
      text: `${group.canonicalUrl} • ${group.variants.length} variant(s): ${variantSummary}`,
      fontSize: 12,
      fontWeight: 400,
      fontFamily: 'Inter',
      lineHeight: 18,
      textAlign: 'LEFT'
    }
  };

  const headerFrame: SceneNode = {
    id: headerId,
    parentId: null,
    childIds: [titleId, metaId],
    name: `Header — Route ${paddedIndex}: ${group.routeTitle}`,
    type: 'FRAME',
    visible: true,
    x,
    y,
    width: Math.max(480, rowWidth),
    height: 64,
    rotation: 0,
    cornerRadius: 8,
    fills: [{ type: 'SOLID', color: { r: 0.96, g: 0.97, b: 0.99, a: 1 }, opacity: 1, visible: true }],
    strokes: [
      {
        color: { r: 0.88, g: 0.91, b: 0.95, a: 1 },
        weight: 1,
        align: 'INSIDE',
        visible: true
      }
    ],
    effects: [],
    clipsContent: true
  };

  return {
    headerFrame,
    headerNodes: [headerFrame, titleNode, metaNode]
  };
}

/**
 * Arranges responsive variants into an ordered 2D matrix on a single Figma canvas.
 */
export function buildResponsiveMatrix(
  groups: readonly RouteResponsiveGroup[],
  options: ResponsiveMatrixOptions = {}
): ResponsiveMatrixResult {
  const variantGap = options.variantHorizontalGap ?? 160;
  const routeGap = options.routeVerticalGap ?? 240;
  const startX = options.startX ?? 0;
  const startY = options.startY ?? 0;
  const includeHeader = options.includeRouteHeader ?? true;

  const positionedFrames: SceneNode[] = [];
  const headerFrames: SceneNode[] = [];
  const allNodes: SceneNode[] = [];
  const diagnostics: ExportDiagnostic[] = [];

  let currentY = startY;
  let maxMatrixWidth = 0;
  let totalVariants = 0;

  for (const group of groups) {
    if (group.variants.length === 0) continue;

    // 1. Calculate row width for header sizing
    let expectedRowWidth = 0;
    for (let i = 0; i < group.variants.length; i++) {
      const v = group.variants[i]!;
      expectedRowWidth += v.frame.width;
      if (i < group.variants.length - 1) {
        expectedRowWidth += variantGap;
      }
    }

    // 2. Add visual Route Row Header if requested
    let headerHeightOffset = 0;
    if (includeHeader) {
      const { headerFrame, headerNodes } = createRouteRowHeader(
        group,
        startX,
        currentY,
        expectedRowWidth
      );
      headerFrames.push(headerFrame);
      for (const hn of headerNodes) {
        allNodes.push(hn);
      }
      headerHeightOffset = headerFrame.height + 40; // 40px gap between header and frames
    }

    // 3. Place variant frames horizontally
    let currentX = startX;
    let rowMaxHeight = 0;

    for (const v of group.variants) {
      const variantName = formatResponsiveVariantName(
        group.routeIndex,
        group.routeTitle,
        v.breakpoint,
        v.measuredWidth
      );

      const placedFrame: SceneNode = {
        ...v.frame,
        name: variantName,
        x: currentX,
        y: currentY + headerHeightOffset,
        width: v.measuredWidth,
        height: v.measuredHeight
      };

      positionedFrames.push(placedFrame);
      allNodes.push(placedFrame);

      // Add child/descendant nodes if provided
      if (v.descendantNodes) {
        for (const child of v.descendantNodes) {
          allNodes.push(child);
        }
      }

      currentX += v.measuredWidth + variantGap;
      rowMaxHeight = Math.max(rowMaxHeight, v.measuredHeight);
      totalVariants++;
    }

    const rowTotalWidth = currentX - variantGap - startX;
    maxMatrixWidth = Math.max(maxMatrixWidth, rowTotalWidth, expectedRowWidth);

    // Advance to next row
    currentY += headerHeightOffset + rowMaxHeight + routeGap;
  }

  const totalHeight = currentY > startY ? currentY - routeGap - startY : 0;

  // 4. Validate collisions across all placed top-level frames (headers + page frames)
  const topLevelFrames = [...headerFrames, ...positionedFrames];
  const collisions = checkCanvasCollisions(topLevelFrames);

  if (collisions.hasCollisions) {
    for (const col of collisions.collisions) {
      diagnostics.push({
        severity: 'error',
        code: 'RESPONSIVE_MATRIX_COLLISION',
        message: `Collision detected in responsive matrix between frame '${col.nodeA.name}' and '${col.nodeB.name}' (overlap: ${Math.round(col.intersection.width)}x${Math.round(col.intersection.height)}px).`,
        phase: 'scene-conversion',
        nodeId: col.nodeA.id,
        timestamp: Date.now()
      });
    }
  }

  return {
    positionedFrames,
    headerFrames,
    allNodes,
    totalWidth: maxMatrixWidth,
    totalHeight,
    rowCount: groups.length,
    totalVariants,
    diagnostics
  };
}
