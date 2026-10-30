/**
 * Ordered Rich Text Run Builder.
 * 
 * Extracts ordered typographic runs from mixed inline formatting
 * (<span>, <strong>, <em>, <a>, <code>), merging adjacent runs
 * with identical styles.
 */

import { TextRun } from '../../shared/contracts/source-node';
import { parseFontWeight } from './font-fallback-resolver';

export interface RunBuilderOptions {
  windowRef?: Window | undefined;
}

/**
 * Checks whether two TextRuns have identical typographic styling attributes.
 */
export function areRunsStyleEqual(a: TextRun, b: TextRun): boolean {
  return (
    a.fontFamily === b.fontFamily &&
    a.fontWeight === b.fontWeight &&
    a.fontStyle === b.fontStyle &&
    a.fontSize === b.fontSize &&
    a.lineHeight === b.lineHeight &&
    a.letterSpacing === b.letterSpacing &&
    a.color === b.color &&
    a.textDecoration === b.textDecoration &&
    a.textAlign === b.textAlign &&
    a.textTransform === b.textTransform
  );
}

/**
 * Parses a length string (e.g. "16px", "1.5rem") to numeric px value.
 */
function parsePx(val: string | undefined, defaultVal = 0): number {
  if (!val) return defaultVal;
  const num = parseFloat(val);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Extracts a single TextRun's typographic properties from an element's computed style.
 */
function extractRunStyle(
  style: CSSStyleDeclaration | Record<string, string>,
  text: string
): TextRun {
  const s = style as any;
  const fontFamily = (s.fontFamily || 'sans-serif').replace(/["']/g, '').split(',')[0]?.trim() ?? 'sans-serif';
  const fontSize = parsePx(s.fontSize, 16);

  let lineHeight = fontSize * 1.2; // fallback
  if (s.lineHeight && s.lineHeight !== 'normal') {
    lineHeight = parsePx(s.lineHeight, fontSize * 1.2);
  }

  const letterSpacing = parsePx(s.letterSpacing, 0);
  const fontWeight = parseFontWeight(s.fontWeight);

  let fontStyle: 'normal' | 'italic' | 'oblique' = 'normal';
  if (s.fontStyle === 'italic') fontStyle = 'italic';
  else if (s.fontStyle === 'oblique') fontStyle = 'oblique';

  let textAlign: 'left' | 'center' | 'right' | 'justify' = 'left';
  if (s.textAlign === 'center') textAlign = 'center';
  else if (s.textAlign === 'right') textAlign = 'right';
  else if (s.textAlign === 'justify') textAlign = 'justify';

  const textDecoration = (s.textDecorationLine || s.textDecoration || 'none').toLowerCase();
  const textTransform = (s.textTransform || 'none').toLowerCase();
  const color = s.color || '#000000';

  return {
    text,
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
}

/**
 * Traverses an element and builds an ordered sequence of TextRuns for all contained text.
 * Adjacent runs with identical styling are merged together.
 */
export function buildTextRuns(
  rootEl: Element,
  options: RunBuilderOptions = {}
): TextRun[] {
  const rawRuns: TextRun[] = [];
  const win = options.windowRef ?? (typeof window !== 'undefined' ? window : undefined);

  function walk(node: Node) {
    if (node.nodeType === 3) {
      // TEXT_NODE
      const text = node.textContent ?? '';
      if (!text || (!text.trim() && !text.includes('\n'))) return;

      const parentEl = node.parentElement;
      const style =
        parentEl && win && win.getComputedStyle
          ? win.getComputedStyle(parentEl)
          : ({} as any);

      rawRuns.push(extractRunStyle(style, text));
    } else if (node.nodeType === 1) {
      // ELEMENT_NODE
      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      if (tag === 'br') {
        const style = win && win.getComputedStyle ? win.getComputedStyle(el) : ({} as any);
        rawRuns.push(extractRunStyle(style, '\n'));
        return;
      }

      // Skip elements that hide text completely
      if (win && win.getComputedStyle) {
        const s = win.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return;
      }

      for (let i = 0; i < el.childNodes.length; i++) {
        const child = el.childNodes[i];
        if (child) walk(child);
      }
    }
  }

  walk(rootEl);

  // Merge consecutive runs with identical formatting
  const mergedRuns: TextRun[] = [];
  for (const run of rawRuns) {
    const last = mergedRuns[mergedRuns.length - 1];
    if (last && areRunsStyleEqual(last, run)) {
      last.text += run.text;
    } else {
      mergedRuns.push({ ...run });
    }
  }

  return mergedRuns;
}
