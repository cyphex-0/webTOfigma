/**
 * Fidelity-Preserving Positioned Frame Fallback Generator.
 * 
 * When Auto Layout cannot guarantee 1:1 visual fidelity (due to wrapping,
 * complex grids, absolute overlays, or ambiguous margins), this generator
 * builds a positioned frame with exact measured local geometry and z-order.
 */

import { LocalRect, rebaseChildCoordinates } from './positioning-translator';

export interface PositionedChild {
  id: string;
  globalRect: { x: number; y: number; width: number; height: number };
  zIndex?: number | 'auto' | undefined;
}

export interface PositionedNodeGeometry {
  id: string;
  localRect: LocalRect;
  zIndex: number | 'auto';
}

export interface PositionedFrameLayout {
  layoutMode: 'NONE';
  children: PositionedNodeGeometry[];
}

/**
 * Builds a positioned frame layout for children relative to the parent bounding frame.
 */
export function buildPositionedFrameLayout(
  parentRect: { x: number; y: number; width: number; height: number },
  children: PositionedChild[]
): PositionedFrameLayout {
  const positionedChildren: PositionedNodeGeometry[] = children.map((child) => ({
    id: child.id,
    localRect: rebaseChildCoordinates(child.globalRect, parentRect),
    zIndex: child.zIndex ?? 'auto'
  }));

  // Preserve sibling stacking order: stable sort by z-index if numeric
  positionedChildren.sort((a, b) => {
    const za = typeof a.zIndex === 'number' ? a.zIndex : 0;
    const zb = typeof b.zIndex === 'number' ? b.zIndex : 0;
    return za - zb;
  });

  return {
    layoutMode: 'NONE',
    children: positionedChildren
  };
}
