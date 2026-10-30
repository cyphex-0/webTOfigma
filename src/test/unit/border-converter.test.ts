import { describe, it, expect } from 'vitest';
import {
  parseLengthPx,
  parseCornerRadii,
  convertBorderStyles
} from '../../core/styles/border-converter';

describe('CSS Border & Corner Radius Converter', () => {
  describe('parseLengthPx', () => {
    it('parses pixel values and keywords', () => {
      expect(parseLengthPx('12px')).toBe(12);
      expect(parseLengthPx('2.5px')).toBe(2.5);
      expect(parseLengthPx('thin')).toBe(1);
      expect(parseLengthPx('medium')).toBe(3);
      expect(parseLengthPx('thick')).toBe(5);
      expect(parseLengthPx('0px')).toBe(0);
      expect(parseLengthPx(undefined)).toBe(0);
    });
  });

  describe('parseCornerRadii', () => {
    it('parses single uniform border radius', () => {
      const res = parseCornerRadii({ borderRadius: '16px' });
      expect(res.cornerRadii).toEqual([16, 16, 16, 16]);
      expect(res.uniformCornerRadius).toBe(16);
    });

    it('parses 2-value border radius (top/bottom, left/right)', () => {
      const res = parseCornerRadii({ borderRadius: '10px 20px' });
      expect(res.cornerRadii).toEqual([10, 20, 10, 20]);
      expect(res.uniformCornerRadius).toBeUndefined();
    });

    it('parses 3-value border radius (top, left/right, bottom)', () => {
      const res = parseCornerRadii({ borderRadius: '10px 20px 30px' });
      expect(res.cornerRadii).toEqual([10, 20, 30, 20]);
      expect(res.uniformCornerRadius).toBeUndefined();
    });

    it('parses 4-value border radius (tl, tr, br, bl)', () => {
      const res = parseCornerRadii({ borderRadius: '10px 20px 30px 40px' });
      expect(res.cornerRadii).toEqual([10, 20, 30, 40]);
      expect(res.uniformCornerRadius).toBeUndefined();
    });

    it('allows individual corner properties to override shorthand without averaging', () => {
      const res = parseCornerRadii({
        borderRadius: '8px',
        borderTopLeftRadius: '24px'
      });
      expect(res.cornerRadii).toEqual([24, 8, 8, 8]);
      expect(res.uniformCornerRadius).toBeUndefined();
    });
  });

  describe('convertBorderStyles', () => {
    it('converts uniform 4-side solid border into SceneStroke', () => {
      const res = convertBorderStyles({
        borderWidth: '2px',
        borderStyle: 'solid',
        borderColor: '#3b82f6'
      });

      expect(res.strokes).toHaveLength(1);
      const stroke = res.strokes[0];
      expect(stroke?.weight).toBe(2);
      expect(stroke?.align).toBe('INSIDE');
      expect(stroke?.color.b).toBeCloseTo(246 / 255, 3);
      expect(res.strokeWeights).toEqual({ top: 2, right: 2, bottom: 2, left: 2 });
      expect(res.diagnostics).toHaveLength(0);
    });

    it('handles independent border widths per edge without crashing', () => {
      const res = convertBorderStyles(
        {
          borderTopWidth: '0px',
          borderRightWidth: '0px',
          borderBottomWidth: '4px',
          borderLeftWidth: '0px',
          borderBottomStyle: 'solid',
          borderBottomColor: '#10b981'
        },
        { nodeId: 'card_node' }
      );

      expect(res.strokes).toHaveLength(1);
      expect(res.strokes[0]?.weight).toBe(4);
      expect(res.strokeWeights).toEqual({ top: 0, right: 0, bottom: 4, left: 0 });
      expect(res.diagnostics.some((d) => d.code === 'MIXED_BORDER_STYLES')).toBe(true);
    });

    it('emits diagnostic for complex 3D border styles', () => {
      const res = convertBorderStyles({
        borderWidth: '2px',
        borderStyle: 'groove',
        borderColor: '#888'
      });

      expect(res.diagnostics.some((d) => d.code === 'BORDER_STYLE_APPROXIMATED')).toBe(true);
    });

    it('converts outline to external stroke and emits diagnostic', () => {
      const res = convertBorderStyles({
        outlineWidth: '3px',
        outlineStyle: 'dashed',
        outlineColor: '#ef4444'
      });

      expect(res.outlineStroke).toBeDefined();
      expect(res.outlineStroke?.weight).toBe(3);
      expect(res.outlineStroke?.align).toBe('OUTSIDE');
      expect(res.outlineStroke?.color.r).toBeCloseTo(239 / 255, 2);
      expect(res.diagnostics.some((d) => d.code === 'OUTLINE_CONVERTED_TO_EFFECT')).toBe(true);
    });
  });
});
