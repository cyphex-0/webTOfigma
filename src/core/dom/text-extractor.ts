/**
 * Typography and Direct Text Run Extraction Engine.
 * Extracts direct text content without duplicating descendant text, normalizes whitespace
 * based on CSS white-space rules, and produces validated TextRun contracts.
 */

import type { TextRun } from '../../shared/contracts/source-node';

/**
 * Normalizes CSS font-weight to an integer between 100 and 900.
 */
export function parseFontWeight(val?: string | null): number {
  if (!val) return 400;
  const str = val.trim().toLowerCase();
  if (str === 'normal') return 400;
  if (str === 'bold') return 700;
  if (str === 'lighter') return 300;
  if (str === 'bolder') return 800;

  const num = parseInt(str, 10);
  if (Number.isFinite(num)) {
    return Math.max(100, Math.min(900, Math.round(num / 100) * 100));
  }
  return 400;
}

/**
 * Normalizes CSS font-size to a positive finite number of CSS pixels.
 */
export function parseFontSize(val?: string | null): number {
  if (!val) return 16;
  const num = parseFloat(val);
  return Number.isFinite(num) && num > 0 ? num : 16;
}

/**
 * Normalizes CSS line-height in pixels.
 */
export function parseLineHeight(val?: string | null, fontSize = 16): number {
  if (!val || val === 'normal') {
    return Math.round(fontSize * 1.2 * 100) / 100;
  }
  const num = parseFloat(val);
  if (!Number.isFinite(num) || num <= 0) {
    return Math.round(fontSize * 1.2 * 100) / 100;
  }
  // If unitless multiplier (e.g. "1.5")
  if (!val.endsWith('px') && !val.endsWith('rem') && !val.endsWith('em') && num <= 5) {
    return Math.round(fontSize * num * 100) / 100;
  }
  return num;
}

/**
 * Normalizes CSS letter-spacing in pixels.
 */
export function parseLetterSpacing(val?: string | null): number {
  if (!val || val === 'normal') return 0;
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Normalizes CSS font-style to 'normal' | 'italic' | 'oblique'.
 */
export function parseFontStyle(val?: string | null): 'normal' | 'italic' | 'oblique' {
  if (!val) return 'normal';
  const str = val.trim().toLowerCase();
  if (str === 'italic') return 'italic';
  if (str === 'oblique') return 'oblique';
  return 'normal';
}

/**
 * Normalizes CSS text-align to 'left' | 'center' | 'right' | 'justify'.
 */
export function parseTextAlign(val?: string | null): 'left' | 'center' | 'right' | 'justify' {
  if (!val) return 'left';
  const str = val.trim().toLowerCase();
  if (str === 'center') return 'center';
  if (str === 'right' || str === 'end') return 'right';
  if (str === 'justify') return 'justify';
  return 'left';
}

/**
 * Normalizes whitespace in raw text according to the CSS white-space rule.
 */
export function normalizeWhitespace(text: string, whiteSpace = 'normal'): string {
  const ws = whiteSpace.toLowerCase();
  if (ws === 'pre' || ws === 'pre-wrap') {
    return text;
  }
  if (ws === 'pre-line') {
    // Collapse sequences of whitespace into single space, but preserve newlines
    return text.replace(/[^\S\r\n]+/g, ' ');
  }
  // 'normal' or 'nowrap': collapse all whitespace including newlines
  return text.replace(/\s+/g, ' ');
}

/**
 * Extracts ONLY direct text nodes belonging immediately to this element,
 * preventing duplicate text aggregation from child elements.
 */
export function extractDirectText(
  el: Element,
  style?: CSSStyleDeclaration | Record<string, string>
): string {
  const childNodes = el.childNodes;
  if (!childNodes || childNodes.length === 0) return '';

  const whiteSpace = style ? (style as any).whiteSpace || style.whiteSpace || 'normal' : 'normal';
  const pieces: string[] = [];

  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    if (node && node.nodeType === 3) {
      // Node.TEXT_NODE === 3
      const val = node.nodeValue;
      if (val) {
        pieces.push(val);
      }
    }
  }

  if (pieces.length === 0) return '';

  const rawJoined = pieces.join('');
  const normalized = normalizeWhitespace(rawJoined, whiteSpace);
  return normalized.trim();
}

/**
 * Extracts structured typography runs for an element.
 */
export function extractTextRuns(
  el: Element,
  style: CSSStyleDeclaration | Record<string, string>
): TextRun[] {
  const directText = extractDirectText(el, style);
  if (!directText) return [];

  const fontSize = parseFontSize(style.fontSize);
  const fontWeight = parseFontWeight(style.fontWeight);
  const fontStyle = parseFontStyle(style.fontStyle);
  const lineHeight = parseLineHeight(style.lineHeight, fontSize);
  const letterSpacing = parseLetterSpacing(style.letterSpacing);
  const textAlign = parseTextAlign(style.textAlign);
  const fontFamily = (style.fontFamily || 'sans-serif').replace(/["']/g, '');
  const color = style.color || '#000000';
  const textDecoration = (style as any).textDecorationLine || style.textDecoration || 'none';
  const textTransform = style.textTransform || 'none';

  const run: TextRun = {
    text: directText,
    fontFamily,
    fontWeight,
    fontStyle,
    fontSize,
    lineHeight,
    letterSpacing,
    color,
    textDecoration,
    textAlign,
    textTransform
  };

  return [run];
}
