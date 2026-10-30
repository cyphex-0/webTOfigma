import { describe, it, expect } from 'vitest';
import {
  extractCssUrl,
  convertBackgroundStyles
} from '../../core/styles/background-converter';

describe('CSS Background Converter', () => {
  describe('extractCssUrl', () => {
    it('extracts URL from various CSS url formats', () => {
      expect(extractCssUrl('url("https://example.com/img.png")')).toBe('https://example.com/img.png');
      expect(extractCssUrl("url('https://example.com/img.png')")).toBe('https://example.com/img.png');
      expect(extractCssUrl('url(https://example.com/img.png)')).toBe('https://example.com/img.png');
      expect(extractCssUrl('not-a-url')).toBeNull();
    });
  });

  describe('convertBackgroundStyles', () => {
    it('converts solid background color into ScenePaint', () => {
      const res = convertBackgroundStyles({
        backgroundColor: '#3b82f6'
      });
      expect(res.fills).toHaveLength(1);
      const fill = res.fills[0];
      expect(fill?.type).toBe('SOLID');
      expect(fill?.color?.b).toBeCloseTo(246 / 255, 3);
      expect(fill?.visible).toBe(true);
      expect(res.diagnostics).toHaveLength(0);
    });

    it('ignores transparent and zero-alpha background colors', () => {
      const resTransparent = convertBackgroundStyles({
        backgroundColor: 'transparent'
      });
      expect(resTransparent.fills).toHaveLength(0);

      const resZeroAlpha = convertBackgroundStyles({
        backgroundColor: 'rgba(0, 0, 0, 0)'
      });
      expect(resZeroAlpha.fills).toHaveLength(0);
    });

    it('converts single linear-gradient background image', () => {
      const res = convertBackgroundStyles({
        backgroundImage: 'linear-gradient(to right, red, blue)'
      });
      expect(res.fills).toHaveLength(1);
      const fill = res.fills[0];
      expect(fill?.type).toBe('GRADIENT_LINEAR');
      expect(fill?.gradientStops).toHaveLength(2);
      expect(fill?.gradientTransform).toBeDefined();
    });

    it('converts image URL background', () => {
      const res = convertBackgroundStyles({
        backgroundImage: 'url("https://example.com/bg.png")'
      });
      expect(res.fills).toHaveLength(1);
      const fill = res.fills[0];
      expect(fill?.type).toBe('IMAGE');
      expect(fill?.imageRef).toBe('https://example.com/bg.png');
    });

    it('stacks solid color and multiple background images in correct order', () => {
      // In CSS:
      // Layer 1 (top): url("top.png")
      // Layer 2 (middle): linear-gradient(...)
      // Layer 3 (bottom): backgroundColor: red
      const res = convertBackgroundStyles({
        backgroundColor: '#ff0000',
        backgroundImage: 'url("https://example.com/top.png"), linear-gradient(to bottom, #fff, #000)'
      });

      expect(res.fills).toHaveLength(3);
      // fills[0]: bottom solid color
      expect(res.fills[0]?.type).toBe('SOLID');
      // fills[1]: middle gradient
      expect(res.fills[1]?.type).toBe('GRADIENT_LINEAR');
      // fills[2]: top image
      expect(res.fills[2]?.type).toBe('IMAGE');
      expect(res.fills[2]?.imageRef).toBe('https://example.com/top.png');
    });

    it('approximates to topmost fill when maxFills is constrained to 1', () => {
      const res = convertBackgroundStyles(
        {
          backgroundColor: '#ff0000',
          backgroundImage: 'url("https://example.com/top.png")'
        },
        { maxFills: 1, nodeId: 'node_test' }
      );

      expect(res.fills).toHaveLength(1);
      expect(res.fills[0]?.type).toBe('IMAGE');
      expect(res.diagnostics).toHaveLength(1);
      expect(res.diagnostics[0]?.code).toBe('MULTI_BACKGROUND_APPROXIMATED');
      expect(res.diagnostics[0]?.nodeId).toBe('node_test');
    });

    it('propagates gradient diagnostics such as high-frequency repeating gradient', () => {
      const res = convertBackgroundStyles({
        backgroundImage: 'repeating-linear-gradient(to right, red 0%, blue 1%)'
      });
      expect(res.diagnostics.some((d) => d.code === 'GRADIENT_REPEATING_RASTERIZED')).toBe(true);
    });
  });
});
