/**
 * CSS Border and Corner Radius Converter.
 * 
 * Translates independent 4-side borders (top, right, bottom, left),
 * distinct 4-corner radii without collapsing, and outlines.
 */

import { SceneStroke } from '../../shared/contracts/scene';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { parseCssColor, ColorParseContext, NormalizedColor } from './color-parser';

export interface BorderConverterOptions {
  nodeId?: string | undefined;
  colorContext?: ColorParseContext | undefined;
}

export interface ConvertedBorders {
  strokes: SceneStroke[];
  strokeWeights: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  cornerRadii: [number, number, number, number]; // [tl, tr, br, bl]
  uniformCornerRadius?: number | undefined;
  outlineStroke?: SceneStroke | undefined;
  diagnostics: ExportDiagnostic[];
}

/**
 * Parses a length string in px, thin/medium/thick, or numeric value.
 */
export function parseLengthPx(val: string | undefined, allowNegative = false): number {
  if (!val) return 0;
  const clean = val.trim().toLowerCase();
  if (clean === 'thin') return 1;
  if (clean === 'medium') return 3;
  if (clean === 'thick') return 5;
  if (clean.endsWith('px')) {
    const num = parseFloat(clean.slice(0, -2));
    if (isNaN(num)) return 0;
    return allowNegative ? num : Math.max(0, num);
  }
  const num = parseFloat(clean);
  if (isNaN(num)) return 0;
  return allowNegative ? num : Math.max(0, num);
}

/**
 * Parses shorthand or individual corner radii into distinct [tl, tr, br, bl].
 * Never collapses mixed values into an average.
 */
export function parseCornerRadii(styles: {
  borderRadius?: string | undefined;
  borderTopLeftRadius?: string | undefined;
  borderTopRightRadius?: string | undefined;
  borderBottomRightRadius?: string | undefined;
  borderBottomLeftRadius?: string | undefined;
}): {
  cornerRadii: [number, number, number, number];
  uniformCornerRadius?: number | undefined;
} {
  let tl = 0;
  let tr = 0;
  let br = 0;
  let bl = 0;

  // 1. Parse shorthand if present
  const rawRadius = styles.borderRadius?.trim();
  if (rawRadius) {
    // If slash syntax present (horizontal / vertical), take horizontal
    const horizontalPart = rawRadius.split('/')[0]?.trim() ?? '';
    const parts = horizontalPart.split(/\s+/).filter(Boolean).map(parseLengthPx);

    if (parts.length === 1) {
      const v = parts[0] ?? 0;
      tl = tr = br = bl = v;
    } else if (parts.length === 2) {
      const v0 = parts[0] ?? 0;
      const v1 = parts[1] ?? 0;
      tl = br = v0;
      tr = bl = v1;
    } else if (parts.length === 3) {
      const v0 = parts[0] ?? 0;
      const v1 = parts[1] ?? 0;
      const v2 = parts[2] ?? 0;
      tl = v0;
      tr = bl = v1;
      br = v2;
    } else if (parts.length >= 4) {
      tl = parts[0] ?? 0;
      tr = parts[1] ?? 0;
      br = parts[2] ?? 0;
      bl = parts[3] ?? 0;
    }
  }

  // 2. Individual properties override shorthand
  if (styles.borderTopLeftRadius) tl = parseLengthPx(styles.borderTopLeftRadius);
  if (styles.borderTopRightRadius) tr = parseLengthPx(styles.borderTopRightRadius);
  if (styles.borderBottomRightRadius) br = parseLengthPx(styles.borderBottomRightRadius);
  if (styles.borderBottomLeftRadius) bl = parseLengthPx(styles.borderBottomLeftRadius);

  const cornerRadii: [number, number, number, number] = [tl, tr, br, bl];
  const isUniform = tl === tr && tr === br && br === bl;

  return {
    cornerRadii,
    ...(isUniform && tl > 0 ? { uniformCornerRadius: tl } : {})
  };
}

/**
 * Normalizes CSS border style keyword.
 */
function normalizeBorderStyle(style: string | undefined): string {
  if (!style) return 'none';
  const clean = style.trim().toLowerCase();
  return clean;
}

/**
 * Master Border and Corner Radius Converter.
 */
export function convertBorderStyles(
  styles: {
    borderWidth?: string | undefined;
    borderTopWidth?: string | undefined;
    borderRightWidth?: string | undefined;
    borderBottomWidth?: string | undefined;
    borderLeftWidth?: string | undefined;
    borderColor?: string | undefined;
    borderTopColor?: string | undefined;
    borderRightColor?: string | undefined;
    borderBottomColor?: string | undefined;
    borderLeftColor?: string | undefined;
    borderStyle?: string | undefined;
    borderTopStyle?: string | undefined;
    borderRightStyle?: string | undefined;
    borderBottomStyle?: string | undefined;
    borderLeftStyle?: string | undefined;
    borderRadius?: string | undefined;
    borderTopLeftRadius?: string | undefined;
    borderTopRightRadius?: string | undefined;
    borderBottomRightRadius?: string | undefined;
    borderBottomLeftRadius?: string | undefined;
    outlineWidth?: string | undefined;
    outlineStyle?: string | undefined;
    outlineColor?: string | undefined;
    outlineOffset?: string | undefined;
  },
  options: BorderConverterOptions = {}
): ConvertedBorders {
  const diagnostics: ExportDiagnostic[] = [];

  // 1. Extract 4-Corner Radii
  const { cornerRadii, uniformCornerRadius } = parseCornerRadii(styles);

  // 2. Extract 4-Edge Widths
  const defaultWidth = parseLengthPx(styles.borderWidth);
  const topWidth = styles.borderTopWidth ? parseLengthPx(styles.borderTopWidth) : defaultWidth;
  const rightWidth = styles.borderRightWidth ? parseLengthPx(styles.borderRightWidth) : defaultWidth;
  const bottomWidth = styles.borderBottomWidth ? parseLengthPx(styles.borderBottomWidth) : defaultWidth;
  const leftWidth = styles.borderLeftWidth ? parseLengthPx(styles.borderLeftWidth) : defaultWidth;

  // 3. Extract 4-Edge Styles
  const defaultStyle = normalizeBorderStyle(styles.borderStyle);
  const topStyle = styles.borderTopStyle ? normalizeBorderStyle(styles.borderTopStyle) : defaultStyle;
  const rightStyle = styles.borderRightStyle ? normalizeBorderStyle(styles.borderRightStyle) : defaultStyle;
  const bottomStyle = styles.borderBottomStyle ? normalizeBorderStyle(styles.borderBottomStyle) : defaultStyle;
  const leftStyle = styles.borderLeftStyle ? normalizeBorderStyle(styles.borderLeftStyle) : defaultStyle;

  // 4. Extract 4-Edge Colors
  const defaultColor = parseCssColor(styles.borderColor ?? '#000000', options.colorContext) ?? { r: 0, g: 0, b: 0, a: 1 };
  const topColor = styles.borderTopColor ? parseCssColor(styles.borderTopColor, options.colorContext) ?? defaultColor : defaultColor;
  const rightColor = styles.borderRightColor ? parseCssColor(styles.borderRightColor, options.colorContext) ?? defaultColor : defaultColor;
  const bottomColor = styles.borderBottomColor ? parseCssColor(styles.borderBottomColor, options.colorContext) ?? defaultColor : defaultColor;
  const leftColor = styles.borderLeftColor ? parseCssColor(styles.borderLeftColor, options.colorContext) ?? defaultColor : defaultColor;

  // Adjust widths based on style (none/hidden have 0 effective width)
  const effTopWidth = topStyle === 'none' || topStyle === 'hidden' ? 0 : topWidth;
  const effRightWidth = rightStyle === 'none' || rightStyle === 'hidden' ? 0 : rightWidth;
  const effBottomWidth = bottomStyle === 'none' || bottomStyle === 'hidden' ? 0 : bottomWidth;
  const effLeftWidth = leftStyle === 'none' || leftStyle === 'hidden' ? 0 : leftWidth;

  const strokeWeights = {
    top: effTopWidth,
    right: effRightWidth,
    bottom: effBottomWidth,
    left: effLeftWidth
  };

  const hasAnyBorder = effTopWidth > 0 || effRightWidth > 0 || effBottomWidth > 0 || effLeftWidth > 0;
  const strokes: SceneStroke[] = [];

  if (hasAnyBorder) {
    const isUniformWidth = effTopWidth === effRightWidth && effRightWidth === effBottomWidth && effBottomWidth === effLeftWidth;
    const isUniformStyle = topStyle === rightStyle && rightStyle === bottomStyle && bottomStyle === leftStyle;
    const isUniformColor =
      topColor.r === rightColor.r && topColor.g === rightColor.g && topColor.b === rightColor.b && topColor.a === rightColor.a &&
      topColor.r === bottomColor.r && topColor.g === bottomColor.g && topColor.b === bottomColor.b && topColor.a === bottomColor.a &&
      topColor.r === leftColor.r && topColor.g === leftColor.g && topColor.b === leftColor.b && topColor.a === leftColor.a;

    // Check for complex border styles needing approximation
    const complexStyles = ['groove', 'ridge', 'inset', 'outset', 'double'];
    if (complexStyles.includes(topStyle) || complexStyles.includes(rightStyle) || complexStyles.includes(bottomStyle) || complexStyles.includes(leftStyle)) {
      diagnostics.push({
        severity: 'info',
        code: 'BORDER_STYLE_APPROXIMATED',
        message: `CSS 3D border style approximated to solid stroke.`,
        phase: 'style-resolution',
        recoveryAction: 'Converted 3D border style to solid stroke.',
        ...(options.nodeId ? { nodeId: options.nodeId } : {}),
        timestamp: Date.now()
      });
    }

    if (!isUniformWidth || !isUniformColor) {
      diagnostics.push({
        severity: 'info',
        code: 'MIXED_BORDER_STYLES',
        message: `Node has asymmetric borders (widths: ${effTopWidth}px / ${effRightWidth}px / ${effBottomWidth}px / ${effLeftWidth}px). Independent stroke weights captured.`,
        phase: 'style-resolution',
        ...(options.nodeId ? { nodeId: options.nodeId } : {}),
        timestamp: Date.now()
      });
    }

    // Select primary stroke properties (prioritizing non-zero edges)
    const primaryWeight = Math.max(effTopWidth, effRightWidth, effBottomWidth, effLeftWidth);
    let primaryColor: NormalizedColor = topColor;
    if (effTopWidth === 0) {
      if (effRightWidth > 0) primaryColor = rightColor;
      else if (effBottomWidth > 0) primaryColor = bottomColor;
      else if (effLeftWidth > 0) primaryColor = leftColor;
    }

    strokes.push({
      weight: primaryWeight,
      color: primaryColor,
      align: 'INSIDE',
      visible: true
    });
  }

  // 5. Outline Handling
  let outlineStroke: SceneStroke | undefined = undefined;
  const outlineW = parseLengthPx(styles.outlineWidth);
  const outlineS = normalizeBorderStyle(styles.outlineStyle);
  if (outlineW > 0 && outlineS !== 'none' && outlineS !== 'hidden') {
    const oColor = parseCssColor(styles.outlineColor ?? '#000000', options.colorContext) ?? { r: 0, g: 0, b: 0, a: 1 };
    outlineStroke = {
      weight: outlineW,
      color: oColor,
      align: 'OUTSIDE',
      visible: true
    };

    diagnostics.push({
      severity: 'info',
      code: 'OUTLINE_CONVERTED_TO_EFFECT',
      message: `CSS outline (${outlineW}px ${outlineS}) converted to external stroke.`,
      phase: 'style-resolution',
      recoveryAction: 'Mapped outline to outer stroke.',
      ...(options.nodeId ? { nodeId: options.nodeId } : {}),
      timestamp: Date.now()
    });
  }

  return {
    strokes,
    strokeWeights,
    cornerRadii,
    ...(uniformCornerRadius !== undefined ? { uniformCornerRadius } : {}),
    ...(outlineStroke ? { outlineStroke } : {}),
    diagnostics
  };
}
