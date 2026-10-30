/**
 * Style Property Support Matrix and Diagnostic Generator.
 * 
 * Formal matrix categorizing CSS style properties into:
 * - EXACT: 1:1 lossless translation to Figma scene models
 * - APPROXIMATED: Visually faithful approximation using vector primitives / matrices
 * - RASTER_FALLBACK: High-frequency or complex effects requiring rasterization fallback
 * - OMITTED: Non-renderable or unsupported CSS properties documented with diagnostics
 */

import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export type StyleSupportLevel = 'EXACT' | 'APPROXIMATED' | 'RASTER_FALLBACK' | 'OMITTED';

export interface StyleSupportRule {
  property: string;
  supportLevel: StyleSupportLevel;
  figmaMapping?: string | undefined;
  diagnosticCode?: string | undefined;
  approximationDescription?: string | undefined;
  recoveryAction?: string | undefined;
}

export const STYLE_SUPPORT_MATRIX: Record<string, StyleSupportRule> = {
  'background-color': {
    property: 'background-color',
    supportLevel: 'EXACT',
    figmaMapping: 'ScenePaint (SOLID)'
  },
  'color': {
    property: 'color',
    supportLevel: 'EXACT',
    figmaMapping: 'Text ScenePaint (SOLID)'
  },
  'linear-gradient': {
    property: 'linear-gradient',
    supportLevel: 'EXACT',
    figmaMapping: 'ScenePaint (GRADIENT_LINEAR) with 2x3 affine matrix'
  },
  'radial-gradient': {
    property: 'radial-gradient',
    supportLevel: 'EXACT',
    figmaMapping: 'ScenePaint (GRADIENT_RADIAL) with 2x3 affine matrix'
  },
  'conic-gradient': {
    property: 'conic-gradient',
    supportLevel: 'APPROXIMATED',
    figmaMapping: 'ScenePaint (GRADIENT_ANGULAR) with -90deg Cartesian offset affine matrix',
    diagnosticCode: 'CONIC_GRADIENT_AFFINE_MAPPED',
    approximationDescription: 'Conic gradient mapped via 2x3 affine transformation matrix.'
  },
  'repeating-linear-gradient': {
    property: 'repeating-linear-gradient',
    supportLevel: 'APPROXIMATED',
    figmaMapping: 'ScenePaint (GRADIENT_LINEAR) with expanded stop cycles',
    diagnosticCode: 'GRADIENT_REPEATING_RASTERIZED',
    approximationDescription: 'Stops replicated if total count <= 32; raster fallback if frequency causes explosion.',
    recoveryAction: 'Rasterized repeating gradient layer to preserve visual fidelity without stop explosion.'
  },
  'repeating-conic-gradient': {
    property: 'repeating-conic-gradient',
    supportLevel: 'APPROXIMATED',
    figmaMapping: 'ScenePaint (GRADIENT_ANGULAR) with expanded stop cycles',
    diagnosticCode: 'GRADIENT_REPEATING_RASTERIZED',
    approximationDescription: 'Angular stops replicated if total count <= 32; raster fallback if frequency causes explosion.',
    recoveryAction: 'Rasterized repeating conic gradient layer.'
  },
  'background-image-url': {
    property: 'background-image-url',
    supportLevel: 'EXACT',
    figmaMapping: 'ScenePaint (IMAGE) with imageRef'
  },
  'background-multi-layer': {
    property: 'background-multi-layer',
    supportLevel: 'APPROXIMATED',
    figmaMapping: 'Preserves multi-fill stack where supported; selects topmost fill when constrained',
    diagnosticCode: 'MULTI_BACKGROUND_APPROXIMATED',
    approximationDescription: 'Multi-layer background collapsed to topmost layer on single-fill adapters.',
    recoveryAction: 'Selected topmost visible fill layer.'
  },
  'border-uniform': {
    property: 'border-uniform',
    supportLevel: 'EXACT',
    figmaMapping: 'SceneStroke (INSIDE alignment)'
  },
  'border-asymmetric': {
    property: 'border-asymmetric',
    supportLevel: 'APPROXIMATED',
    figmaMapping: 'SceneStroke with strokeWeights { top, right, bottom, left }',
    diagnosticCode: 'MIXED_BORDER_STYLES',
    approximationDescription: 'Independent edge widths preserved in strokeWeights model.'
  },
  'border-style-3d': {
    property: 'border-style-3d',
    supportLevel: 'APPROXIMATED',
    figmaMapping: 'Solid SceneStroke',
    diagnosticCode: 'BORDER_STYLE_APPROXIMATED',
    approximationDescription: '3D border style (groove/ridge/inset/outset/double) rendered as solid stroke.',
    recoveryAction: 'Converted 3D border style to solid stroke.'
  },
  'border-radius-uniform': {
    property: 'border-radius-uniform',
    supportLevel: 'EXACT',
    figmaMapping: 'cornerRadius'
  },
  'border-radius-asymmetric': {
    property: 'border-radius-asymmetric',
    supportLevel: 'EXACT',
    figmaMapping: 'cornerRadii [tl, tr, br, bl]'
  },
  'outline': {
    property: 'outline',
    supportLevel: 'APPROXIMATED',
    figmaMapping: 'SceneStroke (OUTSIDE alignment)',
    diagnosticCode: 'OUTLINE_CONVERTED_TO_EFFECT',
    approximationDescription: 'CSS outline mapped to external stroke.',
    recoveryAction: 'Mapped outline to outer stroke.'
  },
  'box-shadow-outer': {
    property: 'box-shadow-outer',
    supportLevel: 'EXACT',
    figmaMapping: 'SceneEffect (DROP_SHADOW)'
  },
  'box-shadow-inner': {
    property: 'box-shadow-inner',
    supportLevel: 'EXACT',
    figmaMapping: 'SceneEffect (INNER_SHADOW)'
  },
  'filter-blur': {
    property: 'filter-blur',
    supportLevel: 'EXACT',
    figmaMapping: 'SceneEffect (LAYER_BLUR)'
  },
  'backdrop-filter-blur': {
    property: 'backdrop-filter-blur',
    supportLevel: 'EXACT',
    figmaMapping: 'SceneEffect (BACKGROUND_BLUR)'
  },
  'filter-complex': {
    property: 'filter-complex',
    supportLevel: 'OMITTED',
    diagnosticCode: 'UNSUPPORTED_FILTER_EFFECT',
    approximationDescription: 'Color filters (grayscale, sepia, contrast, hue-rotate) omitted from vector node.',
    recoveryAction: 'Omitted non-blur CSS filter effects to preserve vector editability.'
  },
  'opacity': {
    property: 'opacity',
    supportLevel: 'EXACT',
    figmaMapping: 'SceneNode.opacity'
  },
  'mix-blend-mode': {
    property: 'mix-blend-mode',
    supportLevel: 'EXACT',
    figmaMapping: 'Figma blendMode enum'
  }
};

/**
 * Returns the support rule for a given property key.
 */
export function getStyleSupport(key: string): StyleSupportRule | undefined {
  return STYLE_SUPPORT_MATRIX[key];
}

/**
 * Audits a node's computed styles against the support matrix and generates
 * structured ExportDiagnostic entries for any approximated, omitted, or rasterized styles.
 */
export function auditComputedStyles(
  styles: Record<string, string | undefined>,
  nodeId?: string
): ExportDiagnostic[] {
  const diagnostics: ExportDiagnostic[] = [];

  // Check complex 3D border styles
  const bStyle = (styles.borderStyle || '').toLowerCase();
  if (['groove', 'ridge', 'inset', 'outset', 'double'].some((s) => bStyle.includes(s))) {
    const rule = STYLE_SUPPORT_MATRIX['border-style-3d'];
    if (rule?.diagnosticCode) {
      diagnostics.push({
        severity: 'info',
        code: rule.diagnosticCode,
        message: rule.approximationDescription ?? '3D border style approximated.',
        phase: 'style-resolution',
        ...(rule.recoveryAction ? { recoveryAction: rule.recoveryAction } : {}),
        ...(nodeId ? { nodeId } : {}),
        timestamp: Date.now()
      });
    }
  }

  // Check complex filter effects
  const filter = (styles.filter || '').toLowerCase();
  if (filter && filter !== 'none') {
    const unsupportedKeywords = ['grayscale', 'sepia', 'hue-rotate', 'invert', 'contrast', 'brightness'];
    if (unsupportedKeywords.some((k) => filter.includes(k))) {
      const rule = STYLE_SUPPORT_MATRIX['filter-complex'];
      if (rule?.diagnosticCode) {
        diagnostics.push({
          severity: 'info',
          code: rule.diagnosticCode,
          message: rule.approximationDescription ?? 'Complex filter effect omitted.',
          phase: 'style-resolution',
          ...(rule.recoveryAction ? { recoveryAction: rule.recoveryAction } : {}),
          ...(nodeId ? { nodeId } : {}),
          timestamp: Date.now()
        });
      }
    }
  }

  return diagnostics;
}
