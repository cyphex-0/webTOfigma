import { describe, it, expect } from 'vitest';
import {
  parseFontVariationSettings,
  quantizeFontWeight,
  parseFontWeight,
  buildFigmaStyleName,
  resolveFontFamily,
  resolveTypographyFont
} from '../../core/typography/font-fallback-resolver';

describe('Font Fallback Resolver & Variable Font Quantization', () => {
  describe('parseFontVariationSettings', () => {
    it('parses empty or normal variation strings gracefully', () => {
      expect(parseFontVariationSettings(undefined).axes).toEqual({});
      expect(parseFontVariationSettings('normal').axes).toEqual({});
      expect(parseFontVariationSettings('none').axes).toEqual({});
    });

    it('parses multiple registered and custom font axes', () => {
      const res = parseFontVariationSettings("'wght' 465, 'wdth' 85, 'slnt' -10, 'ital' 1");
      expect(res.axes['wght']).toBe(465);
      expect(res.axes['wdth']).toBe(85);
      expect(res.axes['slnt']).toBe(-10);
      expect(res.axes['ital']).toBe(1);
    });

    it('supports double-quoted variation settings', () => {
      const res = parseFontVariationSettings('"wght" 550, "opsz" 14.5');
      expect(res.axes['wght']).toBe(550);
      expect(res.axes['opsz']).toBe(14.5);
    });
  });

  describe('quantizeFontWeight', () => {
    it('quantizes continuous weight to nearest discrete 100-step standard', () => {
      expect(quantizeFontWeight(465)).toBe(500);
      expect(quantizeFontWeight(342)).toBe(300);
      expect(quantizeFontWeight(700)).toBe(700);
      expect(quantizeFontWeight(649)).toBe(600);
      expect(quantizeFontWeight(650)).toBe(700);
    });

    it('clamps out-of-range weights to 100..900', () => {
      expect(quantizeFontWeight(50)).toBe(100);
      expect(quantizeFontWeight(1200)).toBe(900);
      expect(quantizeFontWeight(-10)).toBe(400); // invalid fallback
    });

    it('parses CSS keywords correctly', () => {
      expect(parseFontWeight('normal')).toBe(400);
      expect(parseFontWeight('bold')).toBe(700);
      expect(parseFontWeight('bolder')).toBe(800);
      expect(parseFontWeight('lighter')).toBe(300);
      expect(parseFontWeight('600')).toBe(600);
    });
  });

  describe('buildFigmaStyleName', () => {
    it('builds standard Figma style names', () => {
      expect(buildFigmaStyleName(400, 'normal')).toBe('Regular');
      expect(buildFigmaStyleName(400, 'italic')).toBe('Italic');
      expect(buildFigmaStyleName(700, 'normal')).toBe('Bold');
      expect(buildFigmaStyleName(700, 'italic')).toBe('Bold Italic');
      expect(buildFigmaStyleName(600, 'normal')).toBe('Semi Bold');
    });

    it('incorporates width stretch tokens', () => {
      expect(buildFigmaStyleName(500, 'normal', 80)).toBe('Condensed Medium');
      expect(buildFigmaStyleName(700, 'italic', 70)).toBe('Ultra Condensed Bold Italic');
    });
  });

  describe('resolveFontFamily', () => {
    it('recognizes standard Figma-safe families without substitution', () => {
      const res = resolveFontFamily('Inter, sans-serif');
      expect(res.resolvedFamily).toBe('Inter');
      expect(res.isSubstituted).toBe(false);

      const resRoboto = resolveFontFamily('Roboto, Arial');
      expect(resRoboto.resolvedFamily).toBe('Roboto');
      expect(resRoboto.isSubstituted).toBe(false);
    });

    it('maps generic CSS families to safe defaults', () => {
      expect(resolveFontFamily('sans-serif').resolvedFamily).toBe('Inter');
      expect(resolveFontFamily('serif').resolvedFamily).toBe('Georgia');
      expect(resolveFontFamily('monospace').resolvedFamily).toBe('Courier New');
    });

    it('falls back to default family when web font is unknown', () => {
      const res = resolveFontFamily('CustomCorporateBrandFont, sans-serif');
      expect(res.resolvedFamily).toBe('Inter');
      expect(res.isSubstituted).toBe(true);
      expect(res.sourceFamily).toBe('CustomCorporateBrandFont');
    });

    it('respects custom user mappings', () => {
      const res = resolveFontFamily('CustomBrandFont', {
        customMappings: {
          CustomBrandFont: 'Roboto'
        }
      });
      expect(res.resolvedFamily).toBe('Roboto');
      expect(res.isSubstituted).toBe(true);
    });
  });

  describe('resolveTypographyFont', () => {
    it('performs full font resolution with variable font wght quantization', () => {
      const res = resolveTypographyFont(
        'Uncut Sans, sans-serif',
        '400',
        'normal',
        "'wght' 580, 'wdth' 90"
      );

      expect(res.resolvedFamily).toBe('Inter');
      expect(res.isSubstituted).toBe(true);
      expect(res.sourceWeight).toBe(580);
      expect(res.quantizedWeight).toBe(600); // 580 -> 600
      expect(res.figmaStyleName).toBe('Semi Condensed Semi Bold');
      expect(res.variationAxes['wght']).toBe(580);
    });
  });
});
