/**
 * Canvas Bounding Box Collision Validator.
 * 
 * Performs 2D Axis-Aligned Bounding Box (AABB) intersection tests across all
 * top-level boards, sections, and frames on the active Figma canvas:
 * - Detects any overlapping bounding boxes with sub-pixel precision
 * - Calculates intersection bounds and overlap surface area
 * - Enforces zero-collision safety constraint before clipboard packaging
 */

import type { SceneNode } from '../../shared/contracts/scene';

export interface CanvasBox {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CanvasCollision {
  nodeA: {
    id: string;
    name: string;
    bounds: CanvasBox;
  };
  nodeB: {
    id: string;
    name: string;
    bounds: CanvasBox;
  };
  overlapArea: number;
  intersection: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface CollisionCheckResult {
  hasCollisions: boolean;
  collisions: CanvasCollision[];
  checkedCount: number;
}

/**
 * Checks whether two 2D axis-aligned bounding boxes intersect with non-zero area.
 */
export function areBoxesIntersecting(a: CanvasBox, b: CanvasBox): boolean {
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapX > 0.001 && overlapY > 0.001;
}

/**
 * Calculates the exact intersection rectangle between two overlapping boxes.
 */
export function computeBoxIntersection(
  a: CanvasBox,
  b: CanvasBox
): { x: number; y: number; width: number; height: number; area: number } | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);

  const width = Math.max(0, right - x);
  const height = Math.max(0, bottom - y);

  if (width > 0.001 && height > 0.001) {
    return {
      x,
      y,
      width,
      height,
      area: width * height
    };
  }

  return null;
}

/**
 * Validates that no top-level canvas frames, sections, or boards overlap each other.
 */
export function checkCanvasCollisions(
  items: readonly (CanvasBox | SceneNode)[]
): CollisionCheckResult {
  const boxes: CanvasBox[] = items.map((item) => ({
    id: item.id,
    name: item.name,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height
  }));

  const collisions: CanvasCollision[] = [];
  const count = boxes.length;

  for (let i = 0; i < count; i++) {
    const boxA = boxes[i]!;
    for (let j = i + 1; j < count; j++) {
      const boxB = boxes[j]!;

      const intersection = computeBoxIntersection(boxA, boxB);
      if (intersection) {
        collisions.push({
          nodeA: {
            id: boxA.id,
            name: boxA.name,
            bounds: boxA
          },
          nodeB: {
            id: boxB.id,
            name: boxB.name,
            bounds: boxB
          },
          overlapArea: intersection.area,
          intersection: {
            x: intersection.x,
            y: intersection.y,
            width: intersection.width,
            height: intersection.height
          }
        });
      }
    }
  }

  return {
    hasCollisions: collisions.length > 0,
    collisions,
    checkedCount: count
  };
}
