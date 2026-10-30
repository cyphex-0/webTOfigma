/**
 * Viewport and Document Geometry Calculator.
 * Measures DOM elements in CSS pixels, distinguishing viewport-space rectangles (sourceRect)
 * from full-document space rectangles (documentRect) incorporating page scroll offsets,
 * and tracks fixed/sticky positioning behavior.
 */

import type { SourceRect } from '../../shared/contracts/source-node';

export interface ElementGeometryResult {
  sourceRect: SourceRect;
  documentRect: SourceRect;
  isFixedOrSticky: boolean;
  position: string;
}

/**
 * Rounds a number to 2 decimal places to avoid floating-point drift while
 * preserving fractional CSS pixel precision (e.g. 0.5px borders, flex layouts).
 */
export function roundToPrecision(val: number, precision = 2): number {
  if (!Number.isFinite(val)) return 0;
  const factor = Math.pow(10, precision);
  return Math.round(val * factor) / factor;
}

/**
 * Ensures all rectangle coordinates and dimensions are finite numbers with non-negative dimensions.
 */
export function normalizeRect(x: number, y: number, width: number, height: number): SourceRect {
  return {
    x: roundToPrecision(Number.isFinite(x) ? x : 0),
    y: roundToPrecision(Number.isFinite(y) ? y : 0),
    width: roundToPrecision(Math.max(0, Number.isFinite(width) ? width : 0)),
    height: roundToPrecision(Math.max(0, Number.isFinite(height) ? height : 0))
  };
}

/**
 * Measures an element's bounding box in viewport and document spaces.
 * 
 * @param el DOM Element to measure
 * @param scrollX Document horizontal scroll offset (e.g. window.scrollX)
 * @param scrollY Document vertical scroll offset (e.g. window.scrollY)
 * @param computedPosition Optional pre-computed CSS position string
 */
export function calculateGeometry(
  el: Element,
  scrollX = 0,
  scrollY = 0,
  computedPosition?: string
): ElementGeometryResult {
  const clientRect = el.getBoundingClientRect();
  const position =
    computedPosition ??
    (typeof window !== 'undefined' && window.getComputedStyle
      ? window.getComputedStyle(el).position
      : 'static');

  const isFixed = position === 'fixed';
  const isSticky = position === 'sticky';
  const isFixedOrSticky = isFixed || isSticky;

  const sourceRect = normalizeRect(
    clientRect.left,
    clientRect.top,
    clientRect.width,
    clientRect.height
  );

  // For ordinary in-flow or absolute elements, document coordinates incorporate current scroll offset.
  // For fixed elements, document coordinates at capture snapshot time reflect their current page position.
  const documentRect = normalizeRect(
    clientRect.left + scrollX,
    clientRect.top + scrollY,
    clientRect.width,
    clientRect.height
  );

  return {
    sourceRect,
    documentRect,
    isFixedOrSticky,
    position
  };
}
