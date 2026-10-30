import { describe, it, expect } from 'vitest';
import {
  parseBoxEdges,
  parseGaps,
  normalizeContainerLayout,
  determineLayoutDecision,
  NormalizedLayoutProps
} from '../../core/layout/layout-analyzer';

describe('Layout Analyzer and Decision Recorder', () => {
  describe('parseBoxEdges', () => {
    it('parses individual edge properties', () => {
      const edges = parseBoxEdges('padding', {
        paddingTop: '10px',
        paddingRight: '20px',
        paddingBottom: '30px',
        paddingLeft: '40px'
      });
      expect(edges).toEqual({ top: 10, right: 20, bottom: 30, left: 40 });
    });

    it('parses 2-value and 4-value shorthand syntax', () => {
      const twoVals = parseBoxEdges('margin', { margin: '16px 24px' });
      expect(twoVals).toEqual({ top: 16, right: 24, bottom: 16, left: 24 });

      const fourVals = parseBoxEdges('padding', { padding: '8px 12px 16px 20px' });
      expect(fourVals).toEqual({ top: 8, right: 12, bottom: 16, left: 20 });
    });
  });

  describe('parseGaps', () => {
    it('extracts row and column gaps', () => {
      const gaps = parseGaps({ rowGap: '12px', columnGap: '16px' });
      expect(gaps).toEqual({ gapRow: 12, gapColumn: 16 });

      const shorthand = parseGaps({ gap: '20px 30px' });
      expect(shorthand).toEqual({ gapRow: 20, gapColumn: 30 });
    });
  });

  describe('determineLayoutDecision', () => {
    const baseFlexProps: NormalizedLayoutProps = {
      display: 'flex',
      isFlex: true,
      isGrid: false,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'flex-start',
      alignItems: 'center',
      alignContent: 'normal',
      gapRow: 0,
      gapColumn: 16,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      position: 'relative',
      boxSizing: 'border-box',
      width: 400,
      height: 100,
      gridTemplateColumns: 'none',
      gridTemplateRows: 'none',
      hasAbsoluteChildren: false
    };

    it('approves clean flexbox container as auto-layout-exact', () => {
      const res = determineLayoutDecision(baseFlexProps, 3);
      expect(res.decision).toBe('auto-layout-exact');
    });

    it('approximates flexbox with space-around/space-evenly', () => {
      const res = determineLayoutDecision(
        { ...baseFlexProps, justifyContent: 'space-evenly' },
        3
      );
      expect(res.decision).toBe('auto-layout-approximate');
      expect(res.reason?.includes('space-evenly')).toBe(true);
    });

    it('disqualifies flexbox with flex-wrap: wrap into positioned-fallback', () => {
      const res = determineLayoutDecision(
        { ...baseFlexProps, flexWrap: 'wrap' },
        4
      );
      expect(res.decision).toBe('positioned-fallback');
      expect(res.reason?.includes('flex-wrap: wrap')).toBe(true);
    });

    it('disqualifies container with absolute children into positioned-fallback', () => {
      const res = determineLayoutDecision(
        { ...baseFlexProps, hasAbsoluteChildren: true },
        2
      );
      expect(res.decision).toBe('positioned-fallback');
      expect(res.reason?.includes('absolute')).toBe(true);
    });

    it('approves single column 1D grid as auto-layout-exact', () => {
      const gridProps: NormalizedLayoutProps = {
        ...baseFlexProps,
        display: 'grid',
        isFlex: false,
        isGrid: true,
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'repeat(3, auto)'
      };
      const res = determineLayoutDecision(gridProps, 3);
      expect(res.decision).toBe('auto-layout-exact');
    });

    it('falls back for standard block flow layout', () => {
      const blockProps: NormalizedLayoutProps = {
        ...baseFlexProps,
        display: 'block',
        isFlex: false,
        isGrid: false
      };
      const res = determineLayoutDecision(blockProps, 2);
      expect(res.decision).toBe('positioned-fallback');
    });
  });
});
