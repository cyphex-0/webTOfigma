/**
 * Sizing and Constraint Translator.
 * 
 * Maps computed widths, heights, flex-grow, flex-basis, and align-self
 * into Figma sizing modes: FIXED, HUG, and FILL, considering the parent layout mode.
 */

export type FigmaSizingMode = 'FIXED' | 'HUG' | 'FILL';

export interface ChildSizingInput {
  style: any;
  hasChildren: boolean;
  isText: boolean;
  parentLayoutMode: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
}

export interface SizingResult {
  horizontal: FigmaSizingMode;
  vertical: FigmaSizingMode;
}

/**
 * Checks if a CSS dimension string is an explicit pixel length (e.g. "200px").
 */
function isExplicitPixelLength(val: string | undefined): boolean {
  if (!val) return false;
  const clean = val.trim().toLowerCase();
  return clean.endsWith('px') && !isNaN(parseFloat(clean));
}

/**
 * Translates child styling within its parent layout context to Figma SizingResult.
 */
export function translateChildSizing(input: ChildSizingInput): SizingResult {
  const { style, hasChildren, isText, parentLayoutMode } = input;

  // In positioned frames (layoutMode: 'NONE'), sizing is always fixed to measured bounds
  if (parentLayoutMode === 'NONE') {
    return { horizontal: 'FIXED', vertical: 'FIXED' };
  }

  const flexGrow = parseFloat(style.flexGrow || '0') || 0;
  const flexBasis = (style.flexBasis || '').toLowerCase();
  const alignSelf = (style.alignSelf || 'auto').toLowerCase();
  const widthStr = (style.width || 'auto').toLowerCase();
  const heightStr = (style.height || 'auto').toLowerCase();

  let horizontal: FigmaSizingMode = 'FIXED';
  let vertical: FigmaSizingMode = 'FIXED';

  // 1. Horizontal Sizing Mode
  if (parentLayoutMode === 'HORIZONTAL') {
    // Primary axis for row flex
    if (flexGrow > 0 || flexBasis === '100%') {
      horizontal = 'FILL';
    } else if (isExplicitPixelLength(widthStr)) {
      horizontal = 'FIXED';
    } else if (widthStr === 'auto' || widthStr === 'max-content' || widthStr === 'fit-content' || isText || hasChildren) {
      horizontal = 'HUG';
    } else {
      horizontal = 'FIXED';
    }
  } else {
    // Counter axis for column flex
    if (alignSelf === 'stretch' || widthStr === '100%') {
      horizontal = 'FILL';
    } else if (isExplicitPixelLength(widthStr)) {
      horizontal = 'FIXED';
    } else if (widthStr === 'auto' || isText || hasChildren) {
      horizontal = 'HUG';
    } else {
      horizontal = 'FIXED';
    }
  }

  // 2. Vertical Sizing Mode
  if (parentLayoutMode === 'VERTICAL') {
    // Primary axis for column flex
    if (flexGrow > 0 || flexBasis === '100%') {
      vertical = 'FILL';
    } else if (isExplicitPixelLength(heightStr)) {
      vertical = 'FIXED';
    } else if (heightStr === 'auto' || isText || hasChildren) {
      vertical = 'HUG';
    } else {
      vertical = 'FIXED';
    }
  } else {
    // Counter axis for row flex
    if (alignSelf === 'stretch' || heightStr === '100%') {
      vertical = 'FILL';
    } else if (isExplicitPixelLength(heightStr)) {
      vertical = 'FIXED';
    } else if (heightStr === 'auto' || isText || hasChildren) {
      vertical = 'HUG';
    } else {
      vertical = 'FIXED';
    }
  }

  return { horizontal, vertical };
}
