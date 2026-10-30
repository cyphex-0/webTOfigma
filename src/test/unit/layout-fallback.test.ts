import { describe, it, expect } from 'vitest';
import {
  rebaseChildCoordinates,
  collapseVerticalMargins,
  reconcileMarginsWithGap
} from '../../core/layout/positioning-translator';
import { buildPositionedFrameLayout } from '../../core/layout/layout-fallback';

describe('Positioning & Layout Fallback Generator', () => {
  describe('rebaseChildCoordinates', () => {
    it('rebases global coordinates into parent-relative coordinates', () => {
      const parent = { x: 100, y: 200 };
      const child = { x: 150, y: 280, width: 200, height: 50 };

      const local = rebaseChildCoordinates(child, parent);
      expect(local).toEqual({ x: 50, y: 80, width: 200, height: 50 });
    });
  });

  describe('collapseVerticalMargins', () => {
    it('collapses adjoining positive margins to the larger margin', () => {
      expect(collapseVerticalMargins(16, 24)).toBe(24);
      expect(collapseVerticalMargins(32, 12)).toBe(32);
    });

    it('sums positive and negative margins', () => {
      expect(collapseVerticalMargins(20, -5)).toBe(15);
      expect(collapseVerticalMargins(-10, -20)).toBe(-20);
    });
  });

  describe('reconcileMarginsWithGap', () => {
    it('uses gap when margin is smaller', () => {
      const res = reconcileMarginsWithGap(10, 16);
      expect(res.effectiveGap).toBe(16);
      expect(res.wasAdjusted).toBe(false);
    });

    it('adjusts gap when margin dominates', () => {
      const res = reconcileMarginsWithGap(24, 16);
      expect(res.effectiveGap).toBe(24);
      expect(res.wasAdjusted).toBe(true);
    });
  });

  describe('buildPositionedFrameLayout', () => {
    it('builds positioned frame with local coordinates and sorted z-index', () => {
      const parentRect = { x: 200, y: 300, width: 800, height: 600 };
      const children = [
        { id: 'c1', globalRect: { x: 250, y: 350, width: 300, height: 100 }, zIndex: 2 },
        { id: 'c2', globalRect: { x: 200, y: 300, width: 800, height: 50 }, zIndex: 1 },
        { id: 'c3', globalRect: { x: 400, y: 500, width: 150, height: 80 }, zIndex: 'auto' as const }
      ];

      const layout = buildPositionedFrameLayout(parentRect, children);
      expect(layout.layoutMode).toBe('NONE');
      expect(layout.children).toHaveLength(3);

      // Verify c2 (zIndex 1) or c3 (zIndex 0) sorted before c1 (zIndex 2)
      expect(layout.children[2]?.id).toBe('c1');
      expect(layout.children[2]?.localRect).toEqual({ x: 50, y: 50, width: 300, height: 100 });
    });
  });
});
