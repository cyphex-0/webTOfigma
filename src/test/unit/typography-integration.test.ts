import { describe, it, expect, beforeEach } from 'vitest';
import { extractElementTypography } from '../../core/typography/index';
import { DOMWalker } from '../../core/dom/dom-walker';

describe('Typography Extraction & Integration Fixtures', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Variable Fonts and Quantization', () => {
    it('quantizes variable font weight and captures rawVariationSettings', () => {
      const heading = document.createElement('h1');
      heading.textContent = 'Variable Weight Title';
      document.body.appendChild(heading);

      const result = extractElementTypography(
        heading,
        {
          fontFamily: 'Inter',
          fontWeight: '400',
          fontSize: '32px',
          fontVariationSettings: "'wght' 560, 'wdth' 95"
        },
        { nodeId: 'var_h1' }
      );

      expect(result.semanticName).toBe('Heading — H1');
      expect(result.resolvedFont.quantizedWeight).toBe(600); // 560 -> 600
      expect(result.sceneTextData.fontWeight).toBe(600);
      expect(result.sceneTextData.rawVariationSettings).toEqual({
        wght: 560,
        wdth: 95
      });
      expect(result.diagnostics.some((d) => d.code === 'FONT_WEIGHT_QUANTIZED')).toBe(true);
    });
  });

  describe('Missing Web Fonts & Fallback Resolution', () => {
    it('substitutes inaccessible web font with Inter and records diagnostic', () => {
      const p = document.createElement('p');
      p.textContent = 'Text with custom inaccessible font.';
      document.body.appendChild(p);

      const result = extractElementTypography(
        p,
        {
          fontFamily: 'CircularStd, "UnknownFont", sans-serif',
          fontWeight: '400',
          fontSize: '16px'
        },
        { nodeId: 'missing_font_p' }
      );

      expect(result.resolvedFont.resolvedFamily).toBe('Inter');
      expect(result.sceneTextData.resolvedFont).toBe('Inter');
      expect(result.sceneTextData.sourceFont).toBe('CircularStd');
      expect(result.diagnostics.some((d) => d.code === 'FONT_SUBSTITUTED')).toBe(true);
      const fontDiag = result.diagnostics.find((d) => d.code === 'FONT_SUBSTITUTED');
      expect(fontDiag?.nodeId).toBe('missing_font_p');
      expect(fontDiag?.severity).toBe('warning');
    });
  });

  describe('Emoji, Unicode and Ligatures', () => {
    it('preserves multi-byte Unicode emoji and programming ligatures intact', () => {
      const code = document.createElement('code');
      code.textContent = '✨ const fn = () => a !== b && x <= y; 🚀';
      document.body.appendChild(code);

      const result = extractElementTypography(
        code,
        {
          fontFamily: 'Fira Code, monospace',
          fontSize: '14px',
          fontWeight: '500'
        },
        { nodeId: 'code_ligatures' }
      );

      expect(result.semanticName).toBe('Code Snippet');
      expect(result.directText).toBe('✨ const fn = () => a !== b && x <= y; 🚀');
      expect(result.sceneTextData.text).toBe('✨ const fn = () => a !== b && x <= y; 🚀');
    });
  });

  describe('RTL Text & Line Clamp', () => {
    it('detects RTL Arabic text direction and line clamp', () => {
      const div = document.createElement('div');
      div.setAttribute('dir', 'rtl');
      div.textContent = 'مرحبا بكم في فيجما';
      document.body.appendChild(div);

      const result = extractElementTypography(
        div,
        {
          fontFamily: 'Arial, sans-serif',
          fontSize: '18px',
          direction: 'rtl',
          webkitLineClamp: '2'
        },
        { nodeId: 'rtl_div' }
      );

      expect(result.diagnostics.some((d) => d.code === 'RTL_TEXT_DETECTED')).toBe(true);
      expect(result.diagnostics.some((d) => d.code === 'LINE_CLAMP_DETECTED')).toBe(true);
    });
  });

  describe('Text Transform and Text Decoration', () => {
    it('maps uppercase transform and underline decoration', () => {
      const btn = document.createElement('button');
      btn.textContent = 'submit order';
      document.body.appendChild(btn);

      const result = extractElementTypography(
        btn,
        {
          fontFamily: 'Inter',
          fontSize: '14px',
          textTransform: 'uppercase',
          textDecorationLine: 'underline'
        },
        { nodeId: 'btn_1' }
      );

      expect(result.semanticName).toBe('Button Label');
      expect(result.sceneTextData.textCase).toBe('UPPER');
      expect(result.sceneTextData.textDecoration).toBe('UNDERLINE');
    });
  });

  describe('End-to-End DOM Walker Integration', () => {
    it('extracts semantic text layers, text runs, and font diagnostics during walk', () => {
      const article = document.createElement('article');
      article.innerHTML = `
        <h1 style="font-family: 'BrandFont'; font-size: 28px;">Main Title</h1>
        <p style="font-size: 16px;">This is a paragraph with <strong>bold text</strong>.</p>
      `;
      document.body.appendChild(article);

      const walker = new DOMWalker();
      const result = walker.walk(article);

      // Verify node hierarchy and naming
      const headingNode = result.nodes.find((n) => n.sourceTag === 'h1');
      expect(headingNode).toBeDefined();
      expect(headingNode?.name).toBe('Heading — H1');
      expect(headingNode?.textRuns.length).toBeGreaterThan(0);

      // Verify font substitution warning was captured
      expect(result.diagnostics.some((d) => d.code === 'FONT_SUBSTITUTED')).toBe(true);
    });
  });
});
