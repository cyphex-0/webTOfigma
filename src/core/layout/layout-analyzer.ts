/**
 * Normalized Layout Analyzer and Decision Recorder.
 * 
 * Inspects computed display, flexbox, grid, sizing, padding, margins, and gaps,
 * determining whether a container safely qualifies for Auto Layout or must fall back
 * to a positioned frame.
 */

export type LayoutDecision =
  | 'auto-layout-exact'
  | 'auto-layout-approximate'
  | 'positioned-fallback';

export interface BoxEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface NormalizedLayoutProps {
  display: string;
  isFlex: boolean;
  isGrid: boolean;
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse';
  flexWrap: 'nowrap' | 'wrap' | 'wrap-reverse';
  justifyContent: string;
  alignItems: string;
  alignContent: string;
  gapRow: number;
  gapColumn: number;
  padding: BoxEdges;
  margin: BoxEdges;
  position: 'static' | 'relative' | 'absolute' | 'fixed' | 'sticky';
  boxSizing: 'content-box' | 'border-box';
  width: number;
  height: number;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  hasAbsoluteChildren: boolean;
}

/**
 * Parses CSS length string to positive finite number of pixels.
 */
export function parseLengthPx(val?: string | null): number {
  if (!val) return 0;
  const num = parseFloat(val);
  return Number.isFinite(num) ? Math.max(0, num) : 0;
}

/**
 * Extracts 4-edge values (top, right, bottom, left) from shorthand or individual properties.
 */
export function parseBoxEdges(prefix: 'padding' | 'margin', style: any): BoxEdges {
  const top = parseLengthPx(style[`${prefix}Top`]);
  const right = parseLengthPx(style[`${prefix}Right`]);
  const bottom = parseLengthPx(style[`${prefix}Bottom`]);
  const left = parseLengthPx(style[`${prefix}Left`]);

  if (top > 0 || right > 0 || bottom > 0 || left > 0) {
    return { top, right, bottom, left };
  }

  // Shorthand fallback
  const shorthand = style[prefix];
  if (typeof shorthand === 'string' && shorthand.trim()) {
    const parts = shorthand.trim().split(/\s+/).map(parseLengthPx);
    if (parts.length === 1) {
      const v = parts[0] ?? 0;
      return { top: v, right: v, bottom: v, left: v };
    }
    if (parts.length === 2) {
      const v0 = parts[0] ?? 0;
      const v1 = parts[1] ?? 0;
      return { top: v0, right: v1, bottom: v0, left: v1 };
    }
    if (parts.length === 3) {
      const v0 = parts[0] ?? 0;
      const v1 = parts[1] ?? 0;
      const v2 = parts[2] ?? 0;
      return { top: v0, right: v1, bottom: v2, left: v1 };
    }
    if (parts.length >= 4) {
      return {
        top: parts[0] ?? 0,
        right: parts[1] ?? 0,
        bottom: parts[2] ?? 0,
        left: parts[3] ?? 0
      };
    }
  }

  return { top: 0, right: 0, bottom: 0, left: 0 };
}

/**
 * Parses row-gap and column-gap.
 */
export function parseGaps(style: any): { gapRow: number; gapColumn: number } {
  let gapRow = parseLengthPx(style.rowGap);
  let gapColumn = parseLengthPx(style.columnGap);

  if (gapRow === 0 && gapColumn === 0 && style.gap) {
    const parts = style.gap.trim().split(/\s+/).map(parseLengthPx);
    gapRow = parts[0] ?? 0;
    gapColumn = parts[1] ?? parts[0] ?? 0;
  }

  return { gapRow, gapColumn };
}

/**
 * Normalizes container layout properties from computed style.
 */
export function normalizeContainerLayout(
  el: Element,
  style: any,
  children: Element[] = []
): NormalizedLayoutProps {
  const display = (style.display || 'block').toLowerCase();
  const isFlex = display === 'flex' || display === 'inline-flex';
  const isGrid = display === 'grid' || display === 'inline-grid';

  const flexDirection = (style.flexDirection || 'row').toLowerCase() as any;
  const flexWrap = (style.flexWrap || 'nowrap').toLowerCase() as any;
  const justifyContent = (style.justifyContent || 'flex-start').toLowerCase();
  const alignItems = (style.alignItems || 'stretch').toLowerCase();
  const alignContent = (style.alignContent || 'normal').toLowerCase();

  const { gapRow, gapColumn } = parseGaps(style);
  const padding = parseBoxEdges('padding', style);
  const margin = parseBoxEdges('margin', style);

  const position = (style.position || 'static').toLowerCase() as any;
  const boxSizing = (style.boxSizing || 'content-box').toLowerCase() as any;

  const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: 0, height: 0 };
  const width = rect.width || parseLengthPx(style.width);
  const height = rect.height || parseLengthPx(style.height);

  const gridTemplateColumns = style.gridTemplateColumns || 'none';
  const gridTemplateRows = style.gridTemplateRows || 'none';

  // Check if any direct child has absolute or fixed positioning
  let hasAbsoluteChildren = false;
  const win = typeof window !== 'undefined' ? window : undefined;

  for (const child of children) {
    if (win && win.getComputedStyle) {
      const cs = win.getComputedStyle(child);
      const pos = (cs.position || 'static').toLowerCase();
      if (pos === 'absolute' || pos === 'fixed') {
        hasAbsoluteChildren = true;
        break;
      }
    }
  }

  return {
    display,
    isFlex,
    isGrid,
    flexDirection: ['row', 'row-reverse', 'column', 'column-reverse'].includes(flexDirection)
      ? flexDirection
      : 'row',
    flexWrap: ['nowrap', 'wrap', 'wrap-reverse'].includes(flexWrap) ? flexWrap : 'nowrap',
    justifyContent,
    alignItems,
    alignContent,
    gapRow,
    gapColumn,
    padding,
    margin,
    position,
    boxSizing,
    width,
    height,
    gridTemplateColumns,
    gridTemplateRows,
    hasAbsoluteChildren
  };
}

/**
 * Determines whether a container qualifies for Auto Layout or must fall back to a positioned frame.
 */
export function determineLayoutDecision(
  props: NormalizedLayoutProps,
  childCount: number
): { decision: LayoutDecision; reason?: string } {
  // Empty or single-item containers can trivially map
  if (childCount === 0) {
    return { decision: 'auto-layout-exact' };
  }

  // Disqualifier: absolute or fixed children
  if (props.hasAbsoluteChildren) {
    return {
      decision: 'positioned-fallback',
      reason: 'Contains absolute or fixed positioned children'
    };
  }

  // 1. Flexbox analysis
  if (props.isFlex) {
    // Multi-line flex-wrap cannot be represented accurately in standard Auto Layout
    if (props.flexWrap === 'wrap' || props.flexWrap === 'wrap-reverse') {
      return {
        decision: 'positioned-fallback',
        reason: 'flex-wrap: wrap produces multi-row line breaks requiring positioned frames'
      };
    }

    if (props.justifyContent === 'space-around' || props.justifyContent === 'space-evenly') {
      return {
        decision: 'auto-layout-approximate',
        reason: `justify-content: ${props.justifyContent} approximated to space-between`
      };
    }

    return { decision: 'auto-layout-exact' };
  }

  // 2. CSS Grid analysis
  if (props.isGrid) {
    const colTracks = props.gridTemplateColumns.trim().split(/\s+/).filter(Boolean);
    const rowTracks = props.gridTemplateRows.trim().split(/\s+/).filter(Boolean);

    // 1D Grid with 1 column -> vertical Auto Layout
    if (colTracks.length === 1 && colTracks[0] !== 'none') {
      return { decision: 'auto-layout-exact' };
    }

    // 1D Grid with 1 row -> horizontal Auto Layout
    if (rowTracks.length === 1 && rowTracks[0] !== 'none') {
      return { decision: 'auto-layout-exact' };
    }

    // Multi-dimensional regular grids can be approximated by nested rows
    if (colTracks.length > 1 && rowTracks.length > 1) {
      return {
        decision: 'auto-layout-approximate',
        reason: `Multi-track CSS grid (${colTracks.length}x${rowTracks.length}) mapped to nested structure`
      };
    }

    // Other grids fall back
    return {
      decision: 'positioned-fallback',
      reason: 'Irregular or implicit track CSS grid'
    };
  }

  // Default block layout without flex or grid falls back to positioned frame
  return {
    decision: 'positioned-fallback',
    reason: 'Standard block flow layout'
  };
}
