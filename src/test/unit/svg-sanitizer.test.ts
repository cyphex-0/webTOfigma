import { describe, it, expect } from 'vitest';
import {
  sanitizeSvgMarkup,
  parseViewBox,
  shapeToPathD
} from '../../core/assets/svg-sanitizer';

describe('Strict SVG XML Parser, Sanitizer & Vector Extractor', () => {
  describe('parseViewBox', () => {
    it('parses space-separated and comma-separated viewBox strings', () => {
      expect(parseViewBox('0 0 100 100')).toEqual({ x: 0, y: 0, width: 100, height: 100 });
      expect(parseViewBox('-10, -20, 300, 400')).toEqual({ x: -10, y: -20, width: 300, height: 400 });
      expect(parseViewBox('invalid')).toBeNull();
      expect(parseViewBox('')).toBeNull();
    });
  });

  describe('shapeToPathD', () => {
    it('converts rect, circle, line, and polygon elements to path d commands', () => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '10');
      rect.setAttribute('y', '20');
      rect.setAttribute('width', '50');
      rect.setAttribute('height', '40');
      expect(shapeToPathD(rect)).toBe('M 10 20 H 60 V 60 H 10 Z');

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '50');
      circle.setAttribute('cy', '50');
      circle.setAttribute('r', '25');
      expect(shapeToPathD(circle)).toBe('M 25 50 A 25 25 0 1 0 75 50 A 25 25 0 1 0 25 50 Z');

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('x2', '100');
      line.setAttribute('y2', '200');
      expect(shapeToPathD(line)).toBe('M 0 0 L 100 200');
    });
  });

  describe('sanitizeSvgMarkup', () => {
    it('parses safe SVG and extracts clean vector path data', () => {
      const safeSvg = `
        <svg viewBox="0 0 24 24" width="24" height="24">
          <path d="M12 2L2 22h20L12 2z" fill="#ff0000" stroke="#000000" stroke-width="2" />
        </svg>
      `;

      const result = sanitizeSvgMarkup(safeSvg);
      expect(result.isSafe).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(result.vectorData?.viewBox).toEqual({ x: 0, y: 0, width: 24, height: 24 });
      expect(result.vectorData?.paths.length).toBe(1);
      expect(result.vectorData?.paths[0]?.d).toBe('M12 2L2 22h20L12 2z');
      expect(result.vectorData?.paths[0]?.fill).toBe('#ff0000');
      expect(result.vectorData?.paths[0]?.stroke).toBe('#000000');
      expect(result.vectorData?.paths[0]?.strokeWidth).toBe(2);
    });

    it('strips malicious script tags from SVG', () => {
      const maliciousSvg = `
        <svg viewBox="0 0 100 100">
          <script type="text/javascript">alert('pwned');</script>
          <path d="M0 0h10v10H0z" />
        </svg>
      `;

      const result = sanitizeSvgMarkup(maliciousSvg);
      expect(result.isSafe).toBe(true);
      expect(result.sanitizedSvg).not.toContain('<script');
      expect(result.sanitizedSvg).not.toContain('alert');
      expect(result.diagnostics).toContain('SVG_STRIPPED_TAG: <script>');
      expect(result.vectorData?.paths.length).toBe(1);
    });

    it('strips foreignObject and inline event handlers', () => {
      const payload = `
        <svg viewBox="0 0 100 100">
          <foreignObject width="100" height="100">
            <iframe src="http://evil.com"></iframe>
          </foreignObject>
          <circle cx="50" cy="50" r="40" onclick="alert(1)" onload="evil()" onerror="steal()" />
        </svg>
      `;

      const result = sanitizeSvgMarkup(payload);
      expect(result.isSafe).toBe(true);
      expect(result.sanitizedSvg).not.toContain('foreignObject');
      expect(result.sanitizedSvg).not.toContain('onclick');
      expect(result.sanitizedSvg).not.toContain('onload');
      expect(result.sanitizedSvg).not.toContain('onerror');
      expect(result.diagnostics).toContain('SVG_STRIPPED_TAG: <foreignobject>');
      expect(result.diagnostics).toContain('SVG_STRIPPED_EVENT_HANDLER: onclick');
    });

    it('strips javascript: URLs in href and xlink:href attributes', () => {
      const payload = `
        <svg viewBox="0 0 100 100">
          <a href="javascript:alert(document.cookie)">
            <rect width="50" height="50" />
          </a>
        </svg>
      `;

      const result = sanitizeSvgMarkup(payload);
      expect(result.isSafe).toBe(true);
      expect(result.sanitizedSvg).not.toContain('javascript:');
      expect(result.diagnostics.some((d) => d.includes('SVG_STRIPPED_DANGEROUS_HREF'))).toBe(true);
    });

    it('flags unsupported complex SVG filters for fallback', () => {
      const filterSvg = `
        <svg viewBox="0 0 100 100">
          <filter id="turb">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" />
          </filter>
          <rect width="100" height="100" filter="url(#turb)" />
        </svg>
      `;

      const result = sanitizeSvgMarkup(filterSvg);
      expect(result.isSafe).toBe(true);
      expect(result.hasUnsupportedFeatures).toBe(true);
      expect(result.diagnostics).toContain('SVG_UNSUPPORTED_FILTER: <feturbulence>');
    });

    it('handles empty or malformed XML markup gracefully', () => {
      expect(sanitizeSvgMarkup('').isSafe).toBe(false);
      expect(sanitizeSvgMarkup('not an svg').isSafe).toBe(false);
    });
  });
});
