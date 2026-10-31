import { describe, it, expect } from 'vitest';
import {
  areBoxesIntersecting,
  computeBoxIntersection,
  checkCanvasCollisions,
  CanvasBox
} from '../../core/scene/canvas-collision-check';

describe('CanvasCollisionCheck', () => {
  it('detects no collisions when boxes are separated by gap', () => {
    const boxA: CanvasBox = { id: 'a', name: 'Box A', x: 0, y: 0, width: 1000, height: 800 };
    const boxB: CanvasBox = { id: 'b', name: 'Box B', x: 1200, y: 0, width: 1000, height: 800 }; // 200px gap
    const boxC: CanvasBox = { id: 'c', name: 'Box C', x: 0, y: 1000, width: 1000, height: 800 }; // 200px gap below

    expect(areBoxesIntersecting(boxA, boxB)).toBe(false);
    expect(areBoxesIntersecting(boxA, boxC)).toBe(false);

    const result = checkCanvasCollisions([boxA, boxB, boxC]);
    expect(result.hasCollisions).toBe(false);
    expect(result.collisions.length).toBe(0);
    expect(result.checkedCount).toBe(3);
  });

  it('detects overlapping bounding boxes and reports intersection geometry', () => {
    const boxA: CanvasBox = { id: 'a', name: 'Box A', x: 0, y: 0, width: 500, height: 500 };
    const boxB: CanvasBox = { id: 'b', name: 'Box B', x: 400, y: 400, width: 500, height: 500 }; // Overlaps [400..500] in x and y

    expect(areBoxesIntersecting(boxA, boxB)).toBe(true);

    const intersection = computeBoxIntersection(boxA, boxB);
    expect(intersection).not.toBeNull();
    expect(intersection?.x).toBe(400);
    expect(intersection?.y).toBe(400);
    expect(intersection?.width).toBe(100);
    expect(intersection?.height).toBe(100);
    expect(intersection?.area).toBe(10000);

    const result = checkCanvasCollisions([boxA, boxB]);
    expect(result.hasCollisions).toBe(true);
    expect(result.collisions.length).toBe(1);
    expect(result.collisions[0]?.nodeA.id).toBe('a');
    expect(result.collisions[0]?.nodeB.id).toBe('b');
    expect(result.collisions[0]?.overlapArea).toBe(10000);
  });

  it('tolerates touching edges without treating them as overlapping collision', () => {
    const boxA: CanvasBox = { id: 'a', name: 'Box A', x: 0, y: 0, width: 200, height: 200 };
    const boxB: CanvasBox = { id: 'b', name: 'Box B', x: 200, y: 0, width: 200, height: 200 }; // Touches exactly at x=200

    expect(areBoxesIntersecting(boxA, boxB)).toBe(false);
    expect(computeBoxIntersection(boxA, boxB)).toBeNull();

    const result = checkCanvasCollisions([boxA, boxB]);
    expect(result.hasCollisions).toBe(false);
  });
});
