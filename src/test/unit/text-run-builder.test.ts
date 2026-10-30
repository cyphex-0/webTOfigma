import { describe, it, expect, beforeEach } from 'vitest';
import { buildTextRuns, areRunsStyleEqual } from '../../core/typography/text-run-builder';
import { TextRun } from '../../shared/contracts/source-node';

describe('Ordered Rich Text Run Builder', () => {
  describe('areRunsStyleEqual', () => {
    const baseRun: TextRun = {
      text: 'Run 1',
      fontFamily: 'Inter',
      fontWeight: 400,
      fontStyle: 'normal',
      fontSize: 16,
      lineHeight: 24,
      letterSpacing: 0,
      color: '#000000',
      textDecoration: 'none',
      textAlign: 'left',
      textTransform: 'none'
    };

    it('returns true when formatting attributes match', () => {
      const otherRun = { ...baseRun, text: 'Run 2' };
      expect(areRunsStyleEqual(baseRun, otherRun)).toBe(true);
    });

    it('returns false when formatting differs', () => {
      expect(areRunsStyleEqual(baseRun, { ...baseRun, fontWeight: 700 })).toBe(false);
      expect(areRunsStyleEqual(baseRun, { ...baseRun, fontStyle: 'italic' })).toBe(false);
      expect(areRunsStyleEqual(baseRun, { ...baseRun, color: '#ff0000' })).toBe(false);
      expect(areRunsStyleEqual(baseRun, { ...baseRun, fontSize: 18 })).toBe(false);
    });
  });

  describe('buildTextRuns from DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
    });

    it('extracts a single run for uniform plain text', () => {
      const p = document.createElement('p');
      p.textContent = 'Simple plain text paragraph.';
      document.body.appendChild(p);

      const runs = buildTextRuns(p);
      expect(runs).toHaveLength(1);
      expect(runs[0]?.text).toBe('Simple plain text paragraph.');
    });

    it('extracts ordered runs for mixed inline formatting', () => {
      const p = document.createElement('p');
      p.innerHTML = 'Hello <strong>bold text</strong> and <em>italic text</em>!';
      document.body.appendChild(p);

      const runs = buildTextRuns(p);
      expect(runs.length).toBeGreaterThanOrEqual(3);
      expect(runs[0]?.text.includes('Hello')).toBe(true);
      expect(runs.some((r) => r.text.includes('bold text'))).toBe(true);
      expect(runs.some((r) => r.text.includes('italic text'))).toBe(true);
    });

    it('preserves line breaks from <br> elements', () => {
      const p = document.createElement('p');
      p.innerHTML = 'Line 1<br>Line 2';
      document.body.appendChild(p);

      const runs = buildTextRuns(p);
      const combined = runs.map((r) => r.text).join('');
      expect(combined).toBe('Line 1\nLine 2');
    });

    it('ignores text inside display:none elements', () => {
      const p = document.createElement('p');
      p.innerHTML = 'Visible <span style="display: none">Hidden</span> Text';
      document.body.appendChild(p);

      const runs = buildTextRuns(p);
      const combined = runs.map((r) => r.text).join('');
      expect(combined.includes('Hidden')).toBe(false);
    });
  });
});
