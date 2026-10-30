import { describe, it, expect } from 'vitest';
import {
  mapPrimaryAxisAlign,
  mapCounterAxisAlign,
  translateFlexboxToAutoLayout
} from '../../core/layout/flexbox-translator';
import { NormalizedLayoutProps } from '../../core/layout/layout-analyzer';

describe('Flexbox to Auto Layout Translator', () => {
  describe('mapPrimaryAxisAlign', () => {
    it('maps standard alignments accurately', () => {
      expect(mapPrimaryAxisAlign('flex-start')).toEqual({ align: 'MIN', isApproximate: false });
      expect(mapPrimaryAxisAlign('start')).toEqual({ align: 'MIN', isApproximate: false });
      expect(mapPrimaryAxisAlign('center')).toEqual({ align: 'CENTER', isApproximate: false });
      expect(mapPrimaryAxisAlign('flex-end')).toEqual({ align: 'MAX', isApproximate: false });
      expect(mapPrimaryAxisAlign('space-between')).toEqual({ align: 'SPACE_BETWEEN', isApproximate: false });
    });

    it('approximates space-around and space-evenly', () => {
      const around = mapPrimaryAxisAlign('space-around');
      expect(around.align).toBe('SPACE_BETWEEN');
      expect(around.isApproximate).toBe(true);

      const evenly = mapPrimaryAxisAlign('space-evenly');
      expect(evenly.align).toBe('SPACE_BETWEEN');
      expect(evenly.isApproximate).toBe(true);
    });
  });

  describe('mapCounterAxisAlign', () => {
    it('maps cross axis alignments', () => {
      expect(mapCounterAxisAlign('flex-start')).toBe('MIN');
      expect(mapCounterAxisAlign('center')).toBe('CENTER');
      expect(mapCounterAxisAlign('flex-end')).toBe('MAX');
      expect(mapCounterAxisAlign('stretch')).toBe('MIN');
    });
  });

  describe('translateFlexboxToAutoLayout', () => {
    const baseProps: NormalizedLayoutProps = {
      display: 'flex',
      isFlex: true,
      isGrid: false,
      flexDirection: 'row',
      flexWrap: 'nowrap',
      justifyContent: 'space-between',
      alignItems: 'center',
      alignContent: 'normal',
      gapRow: 8,
      gapColumn: 16,
      padding: { top: 10, right: 15, bottom: 20, left: 25 },
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      position: 'relative',
      boxSizing: 'border-box',
      width: 600,
      height: 80,
      gridTemplateColumns: 'none',
      gridTemplateRows: 'none',
      hasAbsoluteChildren: false
    };

    it('translates horizontal flex container to HORIZONTAL Auto Layout', () => {
      const res = translateFlexboxToAutoLayout(baseProps, 'nav_bar');
      expect(res.config.layoutMode).toBe('HORIZONTAL');
      expect(res.config.primaryAxisAlign).toBe('SPACE_BETWEEN');
      expect(res.config.counterAxisAlign).toBe('CENTER');
      expect(res.config.itemSpacing).toBe(16); // column gap
      expect(res.config.padding).toEqual({ top: 10, right: 15, bottom: 20, left: 25 });
      expect(res.diagnostics).toHaveLength(0);
    });

    it('translates vertical flex container to VERTICAL Auto Layout', () => {
      const colProps: NormalizedLayoutProps = {
        ...baseProps,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start'
      };

      const res = translateFlexboxToAutoLayout(colProps, 'stack_list');
      expect(res.config.layoutMode).toBe('VERTICAL');
      expect(res.config.primaryAxisAlign).toBe('MIN');
      expect(res.config.counterAxisAlign).toBe('MIN');
      expect(res.config.itemSpacing).toBe(8); // row gap
    });

    it('emits diagnostic for space-evenly justification', () => {
      const evenlyProps: NormalizedLayoutProps = {
        ...baseProps,
        justifyContent: 'space-evenly'
      };

      const res = translateFlexboxToAutoLayout(evenlyProps, 'even_flex');
      expect(res.diagnostics.some((d) => d.code === 'SPACE_EVENLY_APPROXIMATED')).toBe(true);
      expect(res.diagnostics[0]?.nodeId).toBe('even_flex');
    });
  });
});
