/**
 * Coordinate and Geometry Normalizer.
 * Standardizes conversions between viewport-space (client coordinates)
 * and document-space (full scrollable layout) in CSS pixels.
 */

import type { SourceRect } from '../../shared/contracts/source-node';

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

/**
 * Ensures all dimensions and coordinates are finite non-NaN numbers
 * and dimensions are non-negative.
 */
export function sanitizeRect(rect: Partial<SourceRect>): SourceRect {
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
