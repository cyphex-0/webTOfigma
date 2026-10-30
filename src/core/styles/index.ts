/**
 * Target-Independent Style Translation Engine.
 * 
 * Provides unified style conversion from ComputedStyleSnapshot into
 * normalized ScenePaint fills, SceneStroke strokes, SceneEffect effects,
 * distinct corner radii, and layer opacity.
 */

import { ScenePaint, SceneStroke, SceneEffect } from '../../shared/contracts/scene';
import { ComputedStyleSnapshot } from '../../shared/contracts/source-node';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { ColorParseContext } from './color-parser';
import { convertBackgroundStyles } from './background-converter';
import { convertBorderStyles } from './border-converter';
import { convertEffectStyles } from './effect-converter';
import { auditComputedStyles } from './style-support-matrix';

export * from './color-parser';
export * from './gradient-parser';
export * from './background-converter';
export * from './border-converter';
export * from './shadow-parser';
export * from './effect-converter';
export * from './style-support-matrix';

export interface StyleTranslationOptions {
  nodeId?: string | undefined;
  maxFills?: number | undefined;
  colorContext?: ColorParseContext | undefined;
}

export interface TranslatedElementStyles {
  fills: ScenePaint[];
  strokes: SceneStroke[];
  effects: SceneEffect[];
  cornerRadii: [number, number, number, number];
  uniformCornerRadius?: number | undefined;
  strokeWeights: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  outlineStroke?: SceneStroke | undefined;
  opacity: number;
  blendMode?: string | undefined;
  diagnostics: ExportDiagnostic[];
}

/**
 * Translates a complete ComputedStyleSnapshot into normalized scene visual properties.
 */
export function translateElementStyles(
  snapshot: ComputedStyleSnapshot,
  options: StyleTranslationOptions = {}
): TranslatedElementStyles {
  const diagnostics: ExportDiagnostic[] = [];

  // 1. Audit against style support matrix
  const auditDiags = auditComputedStyles(snapshot as unknown as Record<string, string>, options.nodeId);
  diagnostics.push(...auditDiags);

  // 2. Convert Backgrounds (Color + Image Layers)
  const bgResult = convertBackgroundStyles(
    {
      backgroundColor: snapshot.backgroundColor,
      backgroundImage: snapshot.backgroundImage,
      backgroundSize: snapshot.backgroundSize,
      backgroundPosition: snapshot.backgroundPosition,
      backgroundRepeat: snapshot.backgroundRepeat
    },
    options
  );
  diagnostics.push(...bgResult.diagnostics);

  // 3. Convert Borders & Corner Radii
  const borderResult = convertBorderStyles(
    {
      borderWidth: snapshot.borderWidth,
      borderTopWidth: snapshot.borderTopWidth,
      borderRightWidth: snapshot.borderRightWidth,
      borderBottomWidth: snapshot.borderBottomWidth,
      borderLeftWidth: snapshot.borderLeftWidth,
      borderColor: snapshot.borderColor,
      borderTopColor: snapshot.borderTopColor,
      borderRightColor: snapshot.borderRightColor,
      borderBottomColor: snapshot.borderBottomColor,
      borderLeftColor: snapshot.borderLeftColor,
      borderStyle: snapshot.borderStyle,
      borderTopStyle: snapshot.borderTopStyle,
      borderRightStyle: snapshot.borderRightStyle,
      borderBottomStyle: snapshot.borderBottomStyle,
      borderLeftStyle: snapshot.borderLeftStyle,
      borderRadius: snapshot.borderRadius,
      borderTopLeftRadius: snapshot.borderTopLeftRadius,
      borderTopRightRadius: snapshot.borderTopRightRadius,
      borderBottomRightRadius: snapshot.borderBottomRightRadius,
      borderBottomLeftRadius: snapshot.borderBottomLeftRadius,
      outlineWidth: snapshot.outlineWidth,
      outlineStyle: snapshot.outlineStyle,
      outlineColor: snapshot.outlineColor,
      outlineOffset: snapshot.outlineOffset
    },
    options
  );
  diagnostics.push(...borderResult.diagnostics);

  // 4. Convert Effects (Shadows, Blurs, Opacity)
  const effectResult = convertEffectStyles(
    {
      boxShadow: snapshot.boxShadow,
      filter: snapshot.filter,
      backdropFilter: snapshot.backdropFilter,
      opacity: snapshot.opacity,
      mixBlendMode: snapshot.mixBlendMode
    },
    options
  );
  diagnostics.push(...effectResult.diagnostics);

  return {
    fills: bgResult.fills,
    strokes: borderResult.strokes,
    effects: effectResult.effects,
    cornerRadii: borderResult.cornerRadii,
    ...(borderResult.uniformCornerRadius !== undefined
      ? { uniformCornerRadius: borderResult.uniformCornerRadius }
      : {}),
    strokeWeights: borderResult.strokeWeights,
    ...(borderResult.outlineStroke ? { outlineStroke: borderResult.outlineStroke } : {}),
    opacity: effectResult.layerOpacity,
    ...(effectResult.blendMode ? { blendMode: effectResult.blendMode } : {}),
    diagnostics
  };
}
