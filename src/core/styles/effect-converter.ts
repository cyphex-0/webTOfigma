/**
 * CSS Effects Converter.
 * 
 * Maps box-shadow, filter blur, and backdrop-filter blur into SceneEffect items.
 * Separates node-level opacity and handles unsupported filter diagnostics.
 */

import { SceneEffect } from '../../shared/contracts/scene';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { parseBoxShadow, ParsedShadow } from './shadow-parser';
import { ColorParseContext, clamp01 } from './color-parser';
import { parseLengthPx } from './border-converter';

export interface EffectConverterOptions {
  nodeId?: string | undefined;
  colorContext?: ColorParseContext | undefined;
}

export interface ConvertedEffects {
  effects: SceneEffect[];
  layerOpacity: number; // 0..1
  blendMode?: string | undefined;
  diagnostics: ExportDiagnostic[];
}

/**
 * Extracts blur radius from CSS blur(Xpx) or similar filter function.
 */
function extractBlurRadius(filterStr: string): number | null {
  const match = filterStr.match(/blur\((.*?)\)/i);
  if (!match || !match[1]) return null;
  return parseLengthPx(match[1]);
}

/**
 * Identifies unsupported CSS filter functions (e.g. grayscale, sepia, hue-rotate).
 */
function findUnsupportedFilters(filterStr: string): string[] {
  const unsupportedList = [
    'grayscale',
    'sepia',
    'hue-rotate',
    'invert',
    'opacity',
    'brightness',
    'contrast',
    'saturate',
    'drop-shadow'
  ];

  const found: string[] = [];
  const lower = filterStr.toLowerCase();

  for (const fn of unsupportedList) {
    if (lower.includes(`${fn}(`)) {
      found.push(fn);
    }
  }

  return found;
}

/**
 * Master Effects Converter.
 */
export function convertEffectStyles(
  styles: {
    boxShadow?: string | undefined;
    filter?: string | undefined;
    backdropFilter?: string | undefined;
    opacity?: string | number | undefined;
    mixBlendMode?: string | undefined;
  },
  options: EffectConverterOptions = {}
): ConvertedEffects {
  const effects: SceneEffect[] = [];
  const diagnostics: ExportDiagnostic[] = [];

  // 1. Parse Box Shadows
  if (styles.boxShadow && styles.boxShadow !== 'none') {
    const parsedShadows: ParsedShadow[] = parseBoxShadow(styles.boxShadow, options.colorContext);

    for (const s of parsedShadows) {
      if (s.isInset) {
        effects.push({
          type: 'INNER_SHADOW',
          color: s.color,
          offset: { x: s.offsetX, y: s.offsetY },
          radius: s.blurRadius,
          spread: s.spreadRadius,
          visible: true
        });
      } else {
        effects.push({
          type: 'DROP_SHADOW',
          color: s.color,
          offset: { x: s.offsetX, y: s.offsetY },
          radius: s.blurRadius,
          spread: s.spreadRadius,
          visible: true
        });
      }
    }
  }

  // 2. Parse Layer Filter (blur)
  if (styles.filter && styles.filter !== 'none') {
    const blurPx = extractBlurRadius(styles.filter);
    if (blurPx !== null && blurPx > 0) {
      effects.push({
        type: 'LAYER_BLUR',
        radius: blurPx,
        visible: true
      });
    }

    const unsupported = findUnsupportedFilters(styles.filter);
    if (unsupported.length > 0) {
      diagnostics.push({
        severity: 'info',
        code: 'UNSUPPORTED_FILTER_EFFECT',
        message: `CSS filter functions [${unsupported.join(', ')}] cannot be directly mapped to vector scene effects.`,
        phase: 'style-resolution',
        recoveryAction: 'Omitted non-blur CSS filter effects to preserve vector editability.',
        ...(options.nodeId ? { nodeId: options.nodeId } : {}),
        timestamp: Date.now()
      });
    }
  }

  // 3. Parse Backdrop Filter (blur)
  if (styles.backdropFilter && styles.backdropFilter !== 'none') {
    const backdropBlurPx = extractBlurRadius(styles.backdropFilter);
    if (backdropBlurPx !== null && backdropBlurPx > 0) {
      effects.push({
        type: 'BACKGROUND_BLUR',
        radius: backdropBlurPx,
        visible: true
      });
    }

    const unsupportedBackdrop = findUnsupportedFilters(styles.backdropFilter);
    if (unsupportedBackdrop.length > 0) {
      diagnostics.push({
        severity: 'info',
        code: 'UNSUPPORTED_BACKDROP_FILTER',
        message: `Backdrop filter functions [${unsupportedBackdrop.join(', ')}] omitted.`,
        phase: 'style-resolution',
        ...(options.nodeId ? { nodeId: options.nodeId } : {}),
        timestamp: Date.now()
      });
    }
  }

  // 4. Node Layer Opacity (distinct from color alpha!)
  let layerOpacity = 1;
  if (styles.opacity !== undefined) {
    const num = typeof styles.opacity === 'number' ? styles.opacity : parseFloat(styles.opacity);
    if (!isNaN(num)) {
      layerOpacity = clamp01(num);
    }
  }

  // 5. Blend Mode
  let blendMode: string | undefined = undefined;
  if (styles.mixBlendMode && styles.mixBlendMode !== 'normal') {
    blendMode = styles.mixBlendMode.trim().toUpperCase().replace(/-/g, '_');
  }

  return {
    effects,
    layerOpacity,
    ...(blendMode ? { blendMode } : {}),
    diagnostics
  };
}
