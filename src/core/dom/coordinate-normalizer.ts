/**
 * Coordinate and Geometry Normalizer.
 * Standardizes conversions between viewport-space (client coordinates)
 * and document-space (full scrollable layout) in CSS pixels.
 */

import type { SourceNode, SourceRect } from '../../shared/contracts/source-node';

/**
 * Re-bases an extracted subtree of SourceNodes relative to the root node's top-left origin (0, 0).
 * Both viewport-space sourceRect and document-space documentRect are shifted so that
 * the root element begins at x: 0, y: 0.
 * Optionally synthesizes an ancestor background color if the root element's background is transparent.
 */
export function rebaseSubtreeCoordinates(
  nodes: SourceNode[],
  rootOrigin: SourceRect,
  options?: {
    includeAncestorBackground?: boolean | undefined;
    ancestorBackgroundColor?: string | undefined;
  }
): SourceNode[] {
  if (nodes.length === 0) return [];

  const originX = rootOrigin.x;
  const originY = rootOrigin.y;

  return nodes.map((node, index) => {
    const isRoot = index === 0;

    let computedStyle = node.computedStyle;
    if (
      isRoot &&
      options?.includeAncestorBackground &&
      options.ancestorBackgroundColor &&
      (!node.computedStyle.backgroundColor ||
        node.computedStyle.backgroundColor === 'transparent' ||
        node.computedStyle.backgroundColor === 'rgba(0, 0, 0, 0)')
    ) {
      computedStyle = {
        ...node.computedStyle,
        backgroundColor: options.ancestorBackgroundColor
      };
    }

    return {
      ...node,
      sourceRect: roundRect({
        x: node.sourceRect.x - originX,
        y: node.sourceRect.y - originY,
        width: node.sourceRect.width,
        height: node.sourceRect.height
      }),
      documentRect: roundRect({
        x: node.documentRect.x - originX,
        y: node.documentRect.y - originY,
        width: node.documentRect.width,
        height: node.documentRect.height
      }),
      computedStyle
    };
  });
}

/**
 * Converts viewport-space client rect (getBoundingClientRect) into document-space CSS coordinates
 * by applying page scroll offsets.
 */
export function toDocumentSpace(
  clientRect: SourceRect,
  scrollX: number,
  scrollY: number
): SourceRect {
  return {
    x: clientRect.x + scrollX,
    y: clientRect.y + scrollY,
    width: Math.max(0, clientRect.width),
    height: Math.max(0, clientRect.height)
  };
}

/**
 * Converts document-space coordinates back to viewport-space.
 */
export function toViewportSpace(
  documentRect: SourceRect,
  scrollX: number,
  scrollY: number
): SourceRect {
  return {
    x: documentRect.x - scrollX,
    y: documentRect.y - scrollY,
    width: Math.max(0, documentRect.width),
    height: Math.max(0, documentRect.height)
  };
}

export interface PartialRect {
  x?: number | undefined;
  y?: number | undefined;
  width?: number | undefined;
  height?: number | undefined;
}

/**
 * Ensures all dimensions and coordinates are finite non-NaN numbers
 * and dimensions are non-negative.
 */
export function sanitizeRect(rect: PartialRect): SourceRect {
  const sanitizeNum = (val: number | undefined, fallback = 0): number => {
    if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
      return fallback;
    }
    return val;
  };

  return {
    x: sanitizeNum(rect.x, 0),
    y: sanitizeNum(rect.y, 0),
    width: Math.max(0, sanitizeNum(rect.width, 0)),
    height: Math.max(0, sanitizeNum(rect.height, 0))
  };
}

/**
 * Rounds rect coordinates to fixed decimal precision to prevent float rounding noise.
 */
export function roundRect(rect: SourceRect, decimals = 2): SourceRect {
  const factor = Math.pow(10, decimals);
  return {
    x: Math.round(rect.x * factor) / factor,
    y: Math.round(rect.y * factor) / factor,
    width: Math.round(rect.width * factor) / factor,
    height: Math.round(rect.height * factor) / factor
  };
}
