import { describe, it, expect } from 'vitest';
import {
  isTextVisible,
  getSemanticTextLayerName,
  extractDirectElementText,
  hasDirectText
} from '../../core/typography/text-extractor';

describe('Visible Text Extractor & Semantic Layer Naming', () => {
  describe('isTextVisible', () => {
    it('detects hidden text accurately', () => {
      expect(isTextVisible({ display: 'none' })).toBe(false);
      expect(isTextVisible({ visibility: 'hidden' })).toBe(false);
      expect(isTextVisible({ visibility: 'collapse' })).toBe(false);
      expect(isTextVisible({ fontSize: '0px' })).toBe(false);
      expect(isTextVisible({ display: 'block', fontSize: '16px' })).toBe(true);
    });
  });

  describe('getSemanticTextLayerName', () => {
    it('maps heading tags and aria-level roles', () => {
      const h1 = document.createElement('h1');
      expect(getSemanticTextLayerName(h1)).toBe('Heading — H1');

      const ariaH2 = document.createElement('div');
      ariaH2.setAttribute('role', 'heading');
      ariaH2.setAttribute('aria-level', '2');
      expect(getSemanticTextLayerName(ariaH2)).toBe('Heading — H2');
    });

    it('maps interactive and structural tags', () => {
      const btn = document.createElement('button');
      expect(getSemanticTextLayerName(btn)).toBe('Button Label');

      const link = document.createElement('a');
      expect(getSemanticTextLayerName(link)).toBe('Navigation Link');

      const code = document.createElement('code');
      expect(getSemanticTextLayerName(code)).toBe('Code Snippet');

      const p = document.createElement('p');
      expect(getSemanticTextLayerName(p)).toBe('Body Text');

      const div = document.createElement('div');
      expect(getSemanticTextLayerName(div)).toBe('Text');
    });
  });

  describe('extractDirectElementText & Duplicate Suppression', () => {
    it('extracts text from plain text node elements', () => {
      const p = document.createElement('p');
      p.textContent = '  Hello Figma  ';
      expect(extractDirectElementText(p)).toBe('Hello Figma');
    });

    it('synthesizes line breaks from <br> tags', () => {
      const p = document.createElement('p');
      p.innerHTML = 'Line 1<br>Line 2<br/>Line 3';
      expect(extractDirectElementText(p)).toBe('Line 1\nLine 2\nLine 3');
    });

    it('suppresses duplicate text from child elements', () => {
      const p = document.createElement('p');
      p.innerHTML = 'Welcome to <strong>WebToFigma</strong> exporter <em>fast</em>!';

      // Direct text extraction on parent should only return the parent text fragments,
      // avoiding duplicating "WebToFigma" and "fast" which will be extracted on their own nodes
      const directText = extractDirectElementText(p);
      expect(directText).toBe('Welcome to exporter !');
      expect(directText.includes('WebToFigma')).toBe(false);
    });

    it('preserves formatting in pre-formatted whitespace', () => {
      const pre = document.createElement('pre');
      pre.textContent = '  function test() {\n    return 42;\n  }';
      expect(extractDirectElementText(pre, 'pre')).toBe('  function test() {\n    return 42;\n  }');
    });

    it('checks direct text presence via hasDirectText', () => {
      const emptyDiv = document.createElement('div');
      expect(hasDirectText(emptyDiv)).toBe(false);

      const childOnlyDiv = document.createElement('div');
      childOnlyDiv.innerHTML = '<span>Nested</span>';
      expect(hasDirectText(childOnlyDiv)).toBe(false);

      const textDiv = document.createElement('div');
      textDiv.innerHTML = 'Direct text<span>Nested</span>';
      expect(hasDirectText(textDiv)).toBe(true);
    });
  });
});
