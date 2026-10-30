import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeLineHeight,
  determineTextSizingMode,
  analyzeTextLayout,
  measureElementTextLines
} from '../../core/typography/text-layout';

describe('Text Layout Analyzer & Geometry Sizing', () => {
  describe('normalizeLineHeight', () => {
    it('preserves "normal" as distinct AUTO unit', () => {
      expect(normalizeLineHeight('normal', 16)).toEqual({ unit: 'AUTO' });
      expect(normalizeLineHeight(undefined, 16)).toEqual({ unit: 'AUTO' });
      expect(normalizeLineHeight('', 16)).toEqual({ unit: 'AUTO' });
    });

    it('parses pixel line heights accurately', () => {
      expect(normalizeLineHeight('24px', 16)).toEqual({ unit: 'PIXELS', value: 24 });
      expect(normalizeLineHeight('32.5px', 20)).toEqual({ unit: 'PIXELS', value: 32.5 });
    });

    it('parses percentages and unitless multipliers', () => {
      expect(normalizeLineHeight('150%', 16)).toEqual({ unit: 'PERCENT', value: 150 });
      expect(normalizeLineHeight('1.25', 16)).toEqual({ unit: 'PERCENT', value: 125 });
    });
  });

  describe('determineTextSizingMode', () => {
    it('sets WIDTH_AND_HEIGHT for single line short or nowrap labels', () => {
      const mode = determineTextSizingMode({
        isSingleLine: true,
        whiteSpace: 'nowrap',
        measuredWidth: 120,
        measuredHeight: 24
      });
      expect(mode).toBe('WIDTH_AND_HEIGHT');
    });

    it('sets HEIGHT for multi-line wrapping paragraphs', () => {
      const mode = determineTextSizingMode({
        isSingleLine: false,
        whiteSpace: 'normal',
        measuredWidth: 400,
        measuredHeight: 120
      });
      expect(mode).toBe('HEIGHT');
    });
  });

  describe('measureElementTextLines & analyzeTextLayout', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('measures lines and extracts safe dimensions for an element', () => {
      const p = document.createElement('p');
      p.textContent = 'Sample line of text.';
      document.body.appendChild(p);

      const lines = measureElementTextLines(p);
      expect(lines).toBeDefined();
      expect(lines.length).toBeGreaterThanOrEqual(1);

      const analysis = analyzeTextLayout(p, {
        fontSize: '16px',
        lineHeight: '24px',
        whiteSpace: 'normal'
      });

      expect(analysis.lineCount).toBeGreaterThanOrEqual(1);
      expect(analysis.normalizedLineHeight).toEqual({ unit: 'PIXELS', value: 24 });
      expect(analysis.safeWidth).toBeGreaterThanOrEqual(0);
      expect(analysis.safeHeight).toBeGreaterThanOrEqual(0);
      expect(analysis.clipsText).toBe(false);
    });
  });
});
