import { describe, it, expect } from 'vitest';
import {
  expandGridTracks,
  hasGridSpanning,
  translateGridToLayout
} from '../../core/layout/grid-translator';
import { NormalizedLayoutProps } from '../../core/layout/layout-analyzer';

describe('CSS Grid Recognition & Track Translator', () => {
  describe('expandGridTracks', () => {
    it('expands standard track lists', () => {
      expect(expandGridTracks('1fr 200px auto')).toEqual(['1fr', '200px', 'auto']);
    });

    it('expands repeat(N, track) syntax', () => {
      expect(expandGridTracks('repeat(3, 1fr)')).toEqual(['1fr', '1fr', '1fr']);
      expect(expandGridTracks('repeat(2, 100px) 1fr')).toEqual(['100px', '100px', '1fr']);
    });
  });

  describe('hasGridSpanning', () => {
    it('detects grid-column and grid-row spanning', () => {
      expect(hasGridSpanning({ gridColumn: 'span 2' })).toBe(true);
      expect(hasGridSpanning({ gridRow: '1 / span 3' })).toBe(true);
      expect(hasGridSpanning({ gridColumnEnd: 'span 2' })).toBe(true);
      expect(hasGridSpanning({ gridColumn: 'auto' })).toBe(false);
      expect(hasGridSpanning({})).toBe(false);
    });
  });

  describe('translateGridToLayout', () => {
    const baseGridProps: NormalizedLayoutProps = {
      display: 'grid',
      isFlex: false,
      isGrid: true,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'start',
      alignItems: 'start',
      alignContent: 'normal',
      gapRow: 12,
      gapColumn: 24,
      padding: { top: 16, right: 16, bottom: 16, left: 16 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      position: 'relative',
      boxSizing: 'border-box',
      width: 800,
      height: 400,
      gridTemplateColumns: '1fr',
      gridTemplateRows: 'repeat(4, auto)',
      hasAbsoluteChildren: false
    };

    it('translates 1-column grid to VERTICAL Auto Layout', () => {
      const res = translateGridToLayout(baseGridProps, []);
      expect(res.isQualified).toBe(true);
      expect(res.layoutConfig?.layoutMode).toBe('VERTICAL');
      expect(res.layoutConfig?.itemSpacing).toBe(12);
      expect(res.gridDimensions?.columns).toBe(1);
    });

    it('translates 1-row grid to HORIZONTAL Auto Layout', () => {
      const rowProps: NormalizedLayoutProps = {
        ...baseGridProps,
        gridTemplateColumns: 'repeat(3, 1fr)',
        gridTemplateRows: 'auto'
      };

      const res = translateGridToLayout(rowProps, []);
      expect(res.isQualified).toBe(true);
      expect(res.layoutConfig?.layoutMode).toBe('HORIZONTAL');
      expect(res.layoutConfig?.itemSpacing).toBe(24);
      expect(res.gridDimensions?.rows).toBe(1);
    });

    it('disqualifies grid with spanning children', () => {
      const res = translateGridToLayout(
        {
          ...baseGridProps,
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, auto)'
        },
        [{ gridColumn: 'span 2' }],
        'spanning_grid'
      );

      expect(res.isQualified).toBe(false);
      expect(res.fallbackReason?.includes('span')).toBe(true);
    });

    it('approximates regular multi-track grid with diagnostic', () => {
      const res = translateGridToLayout(
        {
          ...baseGridProps,
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, auto)'
        },
        [],
        'multi_grid'
      );

      expect(res.isQualified).toBe(true);
      expect(res.diagnostics.some((d) => d.code === 'GRID_NESTING_APPROXIMATED')).toBe(true);
    });
  });
});
