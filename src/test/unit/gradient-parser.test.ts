import { describe, it, expect } from 'vitest';
import {
  splitCssArgs,
  parseGradientStops,
  parseLinearGradient,
  parseRadialGradient,
  parseConicGradient,
  parseCssGradient
} from '../../core/styles/gradient-parser';

describe('CSS Gradient Parser & Coordinate Normalization', () => {
  describe('splitCssArgs', () => {
    it('splits comma-separated args while respecting parentheses and quotes', () => {
      const input = 'rgba(255, 0, 0, 0.5) 0%, "some, string" 50%, #000 100%';
      const parts = splitCssArgs(input);
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe('rgba(255, 0, 0, 0.5) 0%');
      expect(parts[1]).toBe('"some, string" 50%');
      expect(parts[2]).toBe('#000 100%');
    });

    it('splits space-separated args cleanly', () => {
      const input = 'rgba(0, 0, 0, 1) 20% 50%';
      const parts = splitCssArgs(input, ' ');
      expect(parts).toEqual(['rgba(0, 0, 0, 1)', '20%', '50%']);
    });
  });

  describe('parseGradientStops', () => {
    it('distributes unpositioned stops evenly across 0 to 1', () => {
      const stops = parseGradientStops(['red', 'green', 'blue']);
      expect(stops).toHaveLength(3);
      expect(stops[0]?.position).toBe(0);
      expect(stops[1]?.position).toBe(0.5);
      expect(stops[2]?.position).toBe(1);
    });

    it('respects explicit percentages and handles dual stops', () => {
      const stops = parseGradientStops(['red 0% 25%', 'blue 75% 100%']);
      expect(stops).toHaveLength(4);
      expect(stops[0]?.position).toBe(0);
      expect(stops[1]?.position).toBe(0.25);
      expect(stops[2]?.position).toBe(0.75);
      expect(stops[3]?.position).toBe(1);
    });

    it('enforces monotonic non-decreasing stop positions', () => {
      const stops = parseGradientStops(['red 50%', 'blue 20%', 'green 90%']);
      expect(stops[0]?.position).toBe(0.5);
      expect(stops[1]?.position).toBe(0.5); // clamped to previous max
      expect(stops[2]?.position).toBe(0.9);
    });
  });

  describe('parseLinearGradient', () => {
    it('defaults to "to bottom" (180deg) when direction is omitted', () => {
      const grad = parseLinearGradient('red, blue');
      expect(grad.type).toBe('GRADIENT_LINEAR');
      expect(grad.isRepeating).toBe(false);
      expect(grad.stops).toHaveLength(2);

      // In 180deg (to bottom): vx = 0, vy = 1
      // x0 = 0.5, y0 = 0, dx = 0, dy = 1
      const [[a, b, tx], [c, d, ty]] = grad.transform;
      expect(a).toBeCloseTo(0, 2);
      expect(b).toBeCloseTo(-1, 2);
      expect(tx).toBeCloseTo(0.5, 2);
      expect(c).toBeCloseTo(1, 2);
      expect(d).toBeCloseTo(0, 2);
      expect(ty).toBeCloseTo(0, 2);
    });

    it('derives correct affine transform for "to right" (90deg)', () => {
      const grad = parseLinearGradient('to right, red 0%, blue 100%');
      // In 90deg (to right): vx = 1, vy = 0
      // x0 = 0, y0 = 0.5, dx = 1, dy = 0
      const [[a, b, tx], [c, d, ty]] = grad.transform;
      expect(a).toBeCloseTo(1, 2);
      expect(b).toBeCloseTo(0, 2);
      expect(tx).toBeCloseTo(0, 2);
      expect(c).toBeCloseTo(0, 2);
      expect(d).toBeCloseTo(1, 2);
      expect(ty).toBeCloseTo(0.5, 2);
    });

    it('parses angles in degrees, turns, and radians', () => {
      const gradDeg = parseLinearGradient('45deg, red, blue');
      expect(gradDeg.transform[0][0]).toBeGreaterThan(0);

      const gradTurn = parseLinearGradient('0.25turn, red, blue');
      expect(gradTurn.transform[0][0]).toBeCloseTo(1, 2);
    });
  });

  describe('parseRadialGradient', () => {
    it('parses standard radial gradient centered at (0.5, 0.5)', () => {
      const grad = parseRadialGradient('circle, red, blue');
      expect(grad.type).toBe('GRADIENT_RADIAL');
      expect(grad.isRepeating).toBe(false);

      const [[a, b, tx], [c, d, ty]] = grad.transform;
      expect(a).toBe(1);
      expect(b).toBe(0);
      expect(tx).toBe(0);
      expect(c).toBe(0);
      expect(d).toBe(1);
      expect(ty).toBe(0);
    });

    it('maps custom center position correctly (at top left)', () => {
      const grad = parseRadialGradient('circle at top left, red, blue');
      const [[a, b, tx], [c, d, ty]] = grad.transform;
      expect(a).toBe(1);
      expect(tx).toBeCloseTo(-0.5, 2); // 0 - 0.5
      expect(ty).toBeCloseTo(-0.5, 2); // 0 - 0.5
    });
  });

  describe('parseConicGradient', () => {
    it('converts CSS 0deg to Cartesian -90deg offset with (0.5, 0.5) center', () => {
      const grad = parseConicGradient('red, blue');
      expect(grad.type).toBe('GRADIENT_ANGULAR');

      // theta = 0 - 90 = -90 deg
      // cos(-90) = 0, sin(-90) = -1
      // transform: [[cos, -sin, cx], [sin, cos, cy]]
      // [[0, 1, 0.5], [-1, 0, 0.5]]
      const [[a, b, tx], [c, d, ty]] = grad.transform;
      expect(a).toBeCloseTo(0, 2);
      expect(b).toBeCloseTo(1, 2);
      expect(tx).toBeCloseTo(0.5, 2);
      expect(c).toBeCloseTo(-1, 2);
      expect(d).toBeCloseTo(0, 2);
      expect(ty).toBeCloseTo(0.5, 2);
    });

    it('converts CSS 90deg to Cartesian 0deg offset', () => {
      const grad = parseConicGradient('from 90deg at 20% 80%, red, blue');
      // theta = 90 - 90 = 0 deg
      // cos(0) = 1, sin(0) = 0
      // transform: [[1, 0, 0.2], [0, 1, 0.8]]
      const [[a, b, tx], [c, d, ty]] = grad.transform;
      expect(a).toBeCloseTo(1, 2);
      expect(b).toBeCloseTo(0, 2);
      expect(tx).toBeCloseTo(0.2, 2);
      expect(c).toBeCloseTo(0, 2);
      expect(d).toBeCloseTo(1, 2);
      expect(ty).toBeCloseTo(0.8, 2);
    });
  });

  describe('Repeating Gradients & Stop Explosion Guard', () => {
    it('replicates stops across [0, 1] when stop count <= 32', () => {
      // Period is 0.25 (4 cycles of 2 stops = 8 stops <= 32)
      const grad = parseCssGradient('repeating-linear-gradient(to right, red 0%, blue 25%)');
      expect(grad).toBeDefined();
      expect(grad?.isRepeating).toBe(true);
      expect(grad?.rasterFallbackRequired).toBeFalsy();
      expect(grad?.stops.length).toBeGreaterThan(2);
      expect(grad?.stops.length).toBeLessThanOrEqual(32);
    });

    it('emits diagnostic and triggers raster fallback when stops exceed 32', () => {
      // Period is 0.01 (100 cycles of 2 stops = 200 stops > 32)
      const grad = parseCssGradient('repeating-linear-gradient(to right, red 0%, blue 1%)');
      expect(grad).toBeDefined();
      expect(grad?.rasterFallbackRequired).toBe(true);
      expect(grad?.diagnostic).toBeDefined();
      expect(grad?.diagnostic?.code).toBe('GRADIENT_REPEATING_RASTERIZED');
      expect(grad?.diagnostic?.severity).toBe('warning');
    });
  });
});
