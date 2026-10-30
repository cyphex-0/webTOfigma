/**
 * Pseudo-Element Synthesis Engine (::before and ::after).
 * Inspects computed pseudo-element styles and synthesizes virtual SourceNodes
 * when content or visual styling is present, seamlessly incorporating them into the node tree.
 */

import type { SourceNode, SourceRect, ComputedStyleSnapshot } from '../../shared/contracts/source-node';
import {
  parseFontSize,
  parseFontWeight,
  parseFontStyle,
  parseLineHeight,
  parseLetterSpacing,
  parseTextAlign
} from './text-extractor';
import { normalizeRect } from './geometry';

/**
 * Strips wrapping quotes from CSS content property (e.g. '"★"' -> '★').
 */
export function cleanPseudoContent(rawContent?: string | null): string {
  if (!rawContent || rawContent === 'none' || rawContent === 'normal') return '';
  const trimmed = rawContent.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Extracts synthetic SourceNode instances for visually meaningful ::before and ::after pseudo-elements.
 */
export function extractPseudoElements(
  el: Element,
  parentId: string,
  idGenerator: () => string,
  parentRect: SourceRect,
  parentDocRect: SourceRect
): SourceNode[] {
  if (typeof window === 'undefined' || !window.getComputedStyle) return [];

  const pseudoTypes: Array<'::before' | '::after'> = ['::before', '::after'];
  const syntheticNodes: SourceNode[] = [];

  for (const pseudoType of pseudoTypes) {
    try {
      const style = window.getComputedStyle(el, pseudoType);
      const rawContent = style.content;
      const display = (style.display || '').toLowerCase();

      // If display is none, pseudo-element does not render
      if (display === 'none') continue;

      const cleanedText = cleanPseudoContent(rawContent);
      const hasBg = style.backgroundColor && style.backgroundColor !== 'transparent' && style.backgroundColor !== 'rgba(0, 0, 0, 0)';
      const hasBorder = style.borderWidth && parseFloat(style.borderWidth) > 0 && style.borderStyle !== 'none';
      const widthVal = parseFloat(style.width || '0');
      const heightVal = parseFloat(style.height || '0');
      const hasDimensions = Number.isFinite(widthVal) && widthVal > 0 && Number.isFinite(heightVal) && heightVal > 0;

      // Skip if content is none/empty and there is no visual background, border, or explicit dimensions
      if (!cleanedText && !hasBg && !hasBorder && !hasDimensions) {
        continue;
      }

      // Compute pseudo geometry relative to parent box
      const pseudoWidth = hasDimensions ? widthVal : parentRect.width;
      const pseudoHeight = hasDimensions ? heightVal : parentRect.height;
      const pseudoRect: SourceRect = normalizeRect(
        parentRect.x,
        parentRect.y,
        pseudoWidth,
        pseudoHeight
      );
      const pseudoDocRect: SourceRect = normalizeRect(
        parentDocRect.x,
        parentDocRect.y,
        pseudoWidth,
        pseudoHeight
      );

      const fontSize = parseFontSize(style.fontSize);
      const fontWeight = parseFontWeight(style.fontWeight);
      const fontStyle = parseFontStyle(style.fontStyle);
      const lineHeight = parseLineHeight(style.lineHeight, fontSize);
      const letterSpacing = parseLetterSpacing(style.letterSpacing);
      const textAlign = parseTextAlign(style.textAlign);
      const fontFamily = (style.fontFamily || 'sans-serif').replace(/["']/g, '');
      const color = style.color || '#000000';

      const textRuns = cleanedText
        ? [
            {
              text: cleanedText,
              fontFamily,
              fontWeight,
              fontStyle,
              fontSize,
              lineHeight,
              letterSpacing,
              color,
              textDecoration: style.textDecoration || 'none',
              textAlign,
              textTransform: style.textTransform || 'none'
            }
          ]
        : [];

      const computedStyle: ComputedStyleSnapshot = {
        display: style.display || 'inline',
        position: style.position || 'static',
        overflow: style.overflow || 'visible',
        boxSizing: style.boxSizing || 'content-box',
        backgroundColor: style.backgroundColor || 'transparent',
        color,
        fontSize: style.fontSize || '16px',
        fontFamily,
        fontWeight: String(fontWeight),
        lineHeight: String(lineHeight),
        letterSpacing: String(letterSpacing),
        textAlign,
        borderRadius: style.borderRadius || '0px',
        borderWidth: style.borderWidth || '0px',
        borderColor: style.borderColor || 'transparent',
        borderStyle: style.borderStyle || 'none',
        boxShadow: style.boxShadow || 'none',
        transform: style.transform || 'none',
        padding: style.padding || '0px',
        margin: style.margin || '0px'
      };

      const rawOpacity = parseFloat(style.opacity || '1');
      const opacity = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(1, rawOpacity)) : 1;

      const syntheticNode: SourceNode = {
        nodeId: idGenerator(),
        parentId,
        childIds: [],
        sourceTag: pseudoType,
        classHints: [],
        textRuns,
        sourceRect: pseudoRect,
        documentRect: pseudoDocRect,
        visibility: {
          isVisible: true,
          isClipped: false,
          isOffscreen: false,
          opacity
        },
        stacking: {
          createsStackingContext: false,
          zIndex: 'auto'
        },
        computedStyle,
        layoutHints: {
          isFlexContainer: display.includes('flex'),
          isGridContainer: display.includes('grid'),
          isInline: display.startsWith('inline'),
          isBlock: display === 'block'
        },
        assetRefs: []
      };

      syntheticNodes.push(syntheticNode);
    } catch {
      // If getComputedStyle fails for pseudo-element, ignore gracefully
    }
  }

  return syntheticNodes;
}
