/**
 * Positioning and Coordinate Normalizer.
 * 
 * Rebases global/document viewport coordinates into parent-relative local coordinates
 * and reconciles margins with padding and layout gaps to prevent double-counting.
 */

import { BoxEdges } from './layout-analyzer';

export interface LocalRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Rebases child coordinates relative to the parent frame origin.
 */
export function rebaseChildCoordinates(
  childRect: { x: number; y: number; width: number; height: number },
  parentOrigin: { x: number; y: number }
): LocalRect {
  return {
    x: Math.round((childRect.x - parentOrigin.x) * 100) / 100,
    y: Math.round((childRect.y - parentOrigin.y) * 100) / 100,
    width: Math.round(childRect.width * 100) / 100,
    height: Math.round(childRect.height * 100) / 100
  };
}

/**
 * Reconciles vertical margins between sibling elements to prevent double-counting.
 * Under standard CSS rules, vertical margins collapse to max(marginA, marginB).
 */
export function collapseVerticalMargins(marginA: number, marginB: number): number {
  if (marginA <= 0 && marginB <= 0) {
    return Math.min(marginA, marginB);
  }
  if (marginA >= 0 && marginB >= 0) {
    return Math.max(marginA, marginB);
  }
  // One positive, one negative
  return marginA + marginB;
}

/**
 * Adjusts layout gap spacing if conflicting child margins are detected.
 */
export function reconcileMarginsWithGap(
  marginEdge: number,
  gapPx: number
): { effectiveGap: number; wasAdjusted: boolean } {
  if (marginEdge <= 0 || gapPx <= 0) {
    return { effectiveGap: Math.max(marginEdge, gapPx), wasAdjusted: false };
  }

  // If margin exceeds gap, margin dominates
  if (marginEdge > gapPx) {
    return { effectiveGap: marginEdge, wasAdjusted: true };
  }

  return { effectiveGap: gapPx, wasAdjusted: false };
}
