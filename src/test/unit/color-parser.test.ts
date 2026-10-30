import { describe, it, expect } from 'vitest';
import {
  parseCssColor,
  parseHexColor,
  parseRgbColor,
  parseHslColor,
  hslToRgb,
  colorToHex,
  colorToRgbaString,
  colorEquals
} from '../../core/styles/color-parser';

describe('CSS Color Parser & Normalization', () => {
  describe('Hex Colors', () => {
    it('parses 3-digit hex correctly', () => {
      const red = parseHexColor('#f00');
      expect(red).toEqual({ r: 1, g: 0, b: 0, a: 1 });

      const cyan = parseHexColor('#0ff');
      expect(cyan).toEqual({ r: 0, g: 1, b: 1, a: 1 });
    });

    it('parses 4-digit hex with alpha correctly', () => {
      const halfRed = parseHexColor('#f008');
      expect(halfRed?.r).toBe(1);
      expect(halfRed?.g).toBe(0);
      expect(halfRed?.b).toBe(0);
      expect(halfRed?.a).toBeCloseTo(8 / 15, 2);
    });

    it('parses 6-digit hex correctly', () => {
      const slate = parseHexColor('#1e293b');
      expect(slate).toBeDefined();
      expect(slate?.r).toBeCloseTo(30 / 255, 3);
      expect(slate?.g).toBeCloseTo(41 / 255, 3);
      expect(slate?.b).toBeCloseTo(59 / 255, 3);
      expect(slate?.a).toBe(1);
    });

    it('parses 8-digit hex with alpha correctly', () => {
      const slateHalfAlpha = parseHexColor('#1e293b80');
      expect(slateHalfAlpha).toBeDefined();
      expect(slateHalfAlpha?.a).toBeCloseTo(128 / 255, 3);
    });

    it('returns null for invalid hex values', () => {
      expect(parseHexColor('#xyz')).toBeNull();
      expect(parseHexColor('#12')).toBeNull();
      expect(parseHexColor('#12345')).toBeNull();
      expect(parseHexColor('')).toBeNull();
    });
  });

  describe('RGB and RGBA Colors', () => {
    it('parses legacy comma-separated rgb() and rgba()', () => {
      const rgb = parseRgbColor('rgb(255, 128, 0)');
      expect(rgb?.r).toBe(1);
      expect(rgb?.g).toBeCloseTo(128 / 255, 3);
      expect(rgb?.b).toBe(0);
      expect(rgb?.a).toBe(1);

      const rgba = parseRgbColor('rgba(255, 128, 0, 0.5)');
      expect(rgba?.a).toBe(0.5);
    });

    it('parses percentages in rgb()', () => {
      const rgbPct = parseRgbColor('rgb(100%, 50%, 0%)');
      expect(rgbPct?.r).toBe(1);
      expect(rgbPct?.g).toBe(0.5);
      expect(rgbPct?.b).toBe(0);
      expect(rgbPct?.a).toBe(1);
    });

    it('parses modern space/slash syntax rgb(r g b / a)', () => {
      const modernRgba = parseRgbColor('rgb(255 128 0 / 0.75)');
      expect(modernRgba?.r).toBe(1);
      expect(modernRgba?.g).toBeCloseTo(128 / 255, 3);
      expect(modernRgba?.b).toBe(0);
      expect(modernRgba?.a).toBe(0.75);

      const modernPctAlpha = parseRgbColor('rgba(0 255 128 / 50%)');
      expect(modernPctAlpha?.a).toBe(0.5);
    });
  });

  describe('HSL and HSLA Colors', () => {
    it('converts basic HSL values accurately', () => {
      // Pure Red: 0deg, 100%, 50%
      expect(hslToRgb(0, 1, 0.5)).toEqual({ r: 1, g: 0, b: 0 });
      // Pure Green: 120deg, 100%, 50%
      expect(hslToRgb(120, 1, 0.5)).toEqual({ r: 0, g: 1, b: 0 });
      // Pure Blue: 240deg, 100%, 50%
      expect(hslToRgb(240, 1, 0.5)).toEqual({ r: 0, g: 0, b: 1 });
      // White: 0deg, 0%, 100%
      expect(hslToRgb(0, 0, 1)).toEqual({ r: 1, g: 1, b: 1 });
      // Black: 0deg, 0%, 0%
      expect(hslToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('parses legacy comma-separated hsl() and hsla()', () => {
      const hsl = parseHslColor('hsl(120, 100%, 50%)');
      expect(hsl).toEqual({ r: 0, g: 1, b: 0, a: 1 });

      const hsla = parseHslColor('hsla(240, 100%, 50%, 0.4)');
      expect(hsla).toEqual({ r: 0, g: 0, b: 1, a: 0.4 });
    });

    it('handles angle units (deg, rad, grad, turn)', () => {
      // 0.5turn = 180deg (cyan)
      const turnColor = parseHslColor('hsl(0.5turn 100% 50%)');
      expect(turnColor?.r).toBe(0);
      expect(turnColor?.g).toBe(1);
      expect(turnColor?.b).toBe(1);

      // 200grad = 180deg
      const gradColor = parseHslColor('hsl(200grad 100% 50%)');
      expect(gradColor?.r).toBe(0);
      expect(gradColor?.g).toBe(1);
      expect(gradColor?.b).toBe(1);

      // PI rad = 180deg
      const radColor = parseHslColor(`hsl(${Math.PI}rad 100% 50%)`);
      expect(radColor?.r).toBe(0);
      expect(radColor?.g).toBe(1);
      expect(radColor?.b).toBe(1);
    });

    it('parses modern space/slash syntax hsl(h s l / a)', () => {
      const modernHsla = parseHslColor('hsl(300deg 100% 50% / 80%)');
      expect(modernHsla?.r).toBe(1);
      expect(modernHsla?.g).toBe(0);
      expect(modernHsla?.b).toBe(1);
      expect(modernHsla?.a).toBe(0.8);
    });
  });

  describe('Master parseCssColor Integration', () => {
    it('parses named colors and transparent', () => {
      expect(parseCssColor('transparent')).toEqual({ r: 0, g: 0, b: 0, a: 0 });
      expect(parseCssColor('black')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
      expect(parseCssColor('white')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
      expect(parseCssColor('red')).toEqual({ r: 1, g: 0, b: 0, a: 1 });

      const rebecca = parseCssColor('rebeccapurple');
      expect(rebecca).toBeDefined();
      expect(rebecca?.r).toBeCloseTo(0.4, 2);
    });

    it('handles currentcolor and contextual fallback', () => {
      expect(parseCssColor('currentcolor')).toEqual({ r: 0, g: 0, b: 0, a: 1 });

      const ctxColor = { r: 0.2, g: 0.4, b: 0.8, a: 0.9 };
      expect(parseCssColor('currentColor', { currentColor: ctxColor })).toEqual(ctxColor);
    });

    it('resolves CSS variables through context or fallback', () => {
      const ctx = {
        cssVariables: {
          '--primary': '#3b82f6',
          '--accent': 'rgb(236, 72, 153)'
        }
      };

      const resolved = parseCssColor('var(--primary)', ctx);
      expect(resolved?.r).toBeCloseTo(59 / 255, 3);
      expect(resolved?.g).toBeCloseTo(130 / 255, 3);
      expect(resolved?.b).toBeCloseTo(246 / 255, 3);

      const fallback = parseCssColor('var(--missing, #10b981)', ctx);
      expect(fallback?.r).toBeCloseTo(16 / 255, 3);
    });

    it('parses color(srgb ...) functions', () => {
      const srgb = parseCssColor('color(srgb 0.2 0.4 0.6 / 0.8)');
      expect(srgb).toEqual({ r: 0.2, g: 0.4, b: 0.6, a: 0.8 });
    });

    it('returns null for unparseable strings', () => {
      expect(parseCssColor('')).toBeNull();
      expect(parseCssColor('not-a-color')).toBeNull();
    });
  });

  describe('Formatting & Equality Helpers', () => {
    it('converts NormalizedColor to hex strings', () => {
      expect(colorToHex({ r: 1, g: 0, b: 0, a: 1 })).toBe('#ff0000');
      expect(colorToHex({ r: 1, g: 0, b: 0, a: 0.5 }, true)).toBe('#ff000080');
      expect(colorToHex({ r: 0, g: 1, b: 0, a: 0.5 })).toBe('#00ff0080');
    });

    it('converts NormalizedColor to rgba string', () => {
      expect(colorToRgbaString({ r: 1, g: 0.5, b: 0, a: 0.75 })).toBe('rgba(255, 128, 0, 0.75)');
    });

    it('checks color equality with tolerance', () => {
      const c1 = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
      const c2 = { r: 0.501, g: 0.499, b: 0.5, a: 1 };
      const c3 = { r: 0.6, g: 0.5, b: 0.5, a: 1 };

      expect(colorEquals(c1, c2)).toBe(true);
      expect(colorEquals(c1, c3)).toBe(false);
    });
  });
});
