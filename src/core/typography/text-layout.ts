/**
 * Text Layout Analyzer and Geometry Sizing Modes.
 * 
 * Uses Range.getClientRects() for per-line geometry measurements,
 * normalizes computed line heights (AUTO, PIXELS, PERCENT),
 * and calculates safe Figma textAutoResize sizing modes.
 */

export type TextAutoResize = 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT';

export interface TextLineMeasurement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedLineHeight {
  unit: 'PIXELS' | 'PERCENT' | 'AUTO';
  value?: number | undefined;
}

export interface TextLayoutAnalysis {
  lineCount: number;
  lineRects: TextLineMeasurement[];
  isSingleLine: boolean;
  autoResize: TextAutoResize;
  normalizedLineHeight: NormalizedLineHeight;
  measuredWidth: number;
  measuredHeight: number;
  safeWidth: number;
  safeHeight: number;
  clipsText: boolean;
}

/**
 * Normalizes CSS line-height into Figma-compatible units.
 * Preserves 'normal' as distinct AUTO unit rather than guessing.
 */
export function normalizeLineHeight(
  lineHeightStr: string | undefined,
  fontSizePx: number
): NormalizedLineHeight {
  if (!lineHeightStr || lineHeightStr === 'normal') {
    return { unit: 'AUTO' };
  }

  const clean = lineHeightStr.trim().toLowerCase();
  if (clean.endsWith('px')) {
    const px = parseFloat(clean.slice(0, -2));
    return isNaN(px) ? { unit: 'AUTO' } : { unit: 'PIXELS', value: px };
  }
  if (clean.endsWith('%')) {
    const pct = parseFloat(clean.slice(0, -1));
    return isNaN(pct) ? { unit: 'AUTO' } : { unit: 'PERCENT', value: pct };
  }

  // Unitless number (e.g. "1.5")
  const num = parseFloat(clean);
  if (!isNaN(num)) {
    return { unit: 'PERCENT', value: num * 100 };
  }

  return { unit: 'AUTO' };
}

/**
 * Measures per-line client rects for an element using DOM Range.
 */
export function measureElementTextLines(
  el: Element,
  windowRef?: Window | undefined
): TextLineMeasurement[] {
  const win = windowRef ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = win?.document ?? el.ownerDocument;

  if (!doc || typeof doc.createRange !== 'function') {
    const rect = el.getBoundingClientRect();
    return [{ x: rect.left, y: rect.top, width: rect.width, height: rect.height }];
  }

  try {
    const range = doc.createRange();
    range.selectNodeContents(el);
    const rectList = range.getClientRects();

    if (rectList && rectList.length > 0) {
      const lineRects: TextLineMeasurement[] = [];
      for (let i = 0; i < rectList.length; i++) {
        const r = rectList[i];
        if (r && (r.width > 0 || r.height > 0)) {
          lineRects.push({
            x: r.left,
            y: r.top,
            width: r.width,
            height: r.height
          });
        }
      }
      if (lineRects.length > 0) return lineRects;
    }
  } catch {
    // Fall back to element bounding rect
  }

  const rect = el.getBoundingClientRect();
  return [{ x: rect.left, y: rect.top, width: rect.width, height: rect.height }];
}

/**
 * Determines Figma textAutoResize mode from layout constraints.
 */
export function determineTextSizingMode(params: {
  isSingleLine: boolean;
  whiteSpace?: string | undefined;
  overflow?: string | undefined;
  measuredWidth: number;
  measuredHeight: number;
  containerHeight?: number | undefined;
}): TextAutoResize {
  const ws = (params.whiteSpace || 'normal').toLowerCase();
  const isNowrap = ws === 'nowrap';

  // 1. Single-line labels with no-wrap or short width auto-resize in both dimensions
  if (params.isSingleLine && (isNowrap || params.measuredWidth < 200)) {
    return 'WIDTH_AND_HEIGHT';
  }

  // 2. Multi-line wrapping text: fixed width, auto height to prevent clipping
  return 'HEIGHT';
}

/**
 * Master Text Layout Analyzer.
 */
export function analyzeTextLayout(
  el: Element,
  style: CSSStyleDeclaration | Record<string, string>,
  options: { windowRef?: Window | undefined } = {}
): TextLayoutAnalysis {
  const s = style as any;
  const fontSizePx = parseFloat(s.fontSize || '16') || 16;
  const normalizedLineHeight = normalizeLineHeight(s.lineHeight, fontSizePx);

  const lineRects = measureElementTextLines(el, options.windowRef);
  const lineCount = Math.max(1, lineRects.length);
  const isSingleLine = lineCount <= 1;

  const bounding = el.getBoundingClientRect();
  const measuredWidth = bounding.width;
  const measuredHeight = bounding.height;

  const autoResize = determineTextSizingMode({
    isSingleLine,
    whiteSpace: s.whiteSpace,
    overflow: s.overflow,
    measuredWidth,
    measuredHeight
  });

  // Calculate safe expanded dimensions
  const totalLineHeight = lineRects.reduce((sum, r) => sum + r.height, 0);
  const safeHeight = Math.max(measuredHeight, totalLineHeight);
  const clipsText = measuredHeight < totalLineHeight - 1 && s.overflow === 'hidden';

  return {
    lineCount,
    lineRects,
    isSingleLine,
    autoResize,
    normalizedLineHeight,
    measuredWidth,
    measuredHeight,
    safeWidth: measuredWidth,
    safeHeight,
    clipsText
  };
}
