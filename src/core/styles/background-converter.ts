/**
 * CSS Background Converter.
 * 
 * Translates CSS background-color, background-image (gradients and URLs),
 * background-size, and background-position into normalized ScenePaint fills.
 * Respects CSS layer stacking order and handles multi-layer fallbacks.
 */

import { ScenePaint } from '../../shared/contracts/scene';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { parseCssColor, ColorParseContext } from './color-parser';
import { parseCssGradient, splitCssArgs } from './gradient-parser';

export interface BackgroundConverterOptions {
  nodeId?: string | undefined;
  maxFills?: number | undefined;
  colorContext?: ColorParseContext | undefined;
}

export interface ConvertedBackgrounds {
  fills: ScenePaint[];
  diagnostics: ExportDiagnostic[];
}

/**
 * Extracts clean URL from a CSS url(...) string.
 */
export function extractCssUrl(urlStr: string): string | null {
  const match = urlStr.trim().match(/^url\((?:['"]?)(.*?)(?:['"]?)\)$/i);
  return match && match[1] ? match[1].trim() : null;
}

/**
 * Converts CSS background properties into an array of ScenePaint fills.
 */
export function convertBackgroundStyles(
  styles: {
    backgroundColor?: string | undefined;
    backgroundImage?: string | undefined;
    backgroundSize?: string | undefined;
    backgroundPosition?: string | undefined;
    backgroundRepeat?: string | undefined;
  },
  options: BackgroundConverterOptions = {}
): ConvertedBackgrounds {
  const fills: ScenePaint[] = [];
  const diagnostics: ExportDiagnostic[] = [];
  const maxFills = options.maxFills ?? Infinity;

  // 1. Convert Solid Background Color (bottom-most CSS layer)
  const rawBgColor = styles.backgroundColor?.trim();
  if (rawBgColor && rawBgColor !== 'transparent' && rawBgColor !== 'none') {
    const parsedColor = parseCssColor(rawBgColor, options.colorContext);
    if (parsedColor && parsedColor.a > 0) {
      fills.push({
        type: 'SOLID',
        color: parsedColor,
        opacity: parsedColor.a,
        visible: true
      });
    }
  }

  // 2. Convert Background Image Layers
  const rawBgImage = styles.backgroundImage?.trim();
  if (rawBgImage && rawBgImage !== 'none') {
    // In CSS, background-image can have multiple layers separated by commas:
    // "url('top.png'), linear-gradient(...)"
    // The first declared layer is the TOP-most rendered layer.
    // In Figma, paints are typically ordered from bottom to top, so we reverse
    // the CSS image layer order before pushing onto the fills stack.
    const rawLayers = splitCssArgs(rawBgImage);
    const imageFills: ScenePaint[] = [];

    // Parse sizes & positions if comma-separated
    const sizes = styles.backgroundSize ? splitCssArgs(styles.backgroundSize) : [];
    const positions = styles.backgroundPosition ? splitCssArgs(styles.backgroundPosition) : [];
    const repeats = styles.backgroundRepeat ? splitCssArgs(styles.backgroundRepeat) : [];

    for (let i = 0; i < rawLayers.length; i++) {
      const layer = rawLayers[i]?.trim();
      if (!layer || layer === 'none') continue;

      const size = sizes[i] ?? sizes[0] ?? 'auto';
      const pos = positions[i] ?? positions[0] ?? '0% 0%';
      const repeat = repeats[i] ?? repeats[0] ?? 'repeat';

      // Check if layer is a gradient
      const gradient = parseCssGradient(layer);
      if (gradient) {
        if (gradient.diagnostic) {
          diagnostics.push({
            ...gradient.diagnostic,
            ...(options.nodeId ? { nodeId: options.nodeId } : {})
          });
        }

        imageFills.push({
          type: gradient.type,
          gradientStops: gradient.stops,
          gradientTransform: gradient.transform,
          opacity: 1,
          visible: true
        });
        continue;
      }

      // Check if layer is a URL
      const url = extractCssUrl(layer);
      if (url) {
        imageFills.push({
          type: 'IMAGE',
          imageRef: url,
          opacity: 1,
          visible: true
        });
        continue;
      }

      // Unrecognized background image layer
      diagnostics.push({
        severity: 'info',
        code: 'UNRECOGNIZED_BACKGROUND_LAYER',
        message: `Could not parse background image layer: "${layer.slice(0, 50)}..."`,
        phase: 'style-resolution',
        ...(options.nodeId ? { nodeId: options.nodeId } : {}),
        timestamp: Date.now()
      });
    }

    // In CSS: layer[0] is on top, layer[N-1] is on bottom.
    // In Figma: fills[0] is bottom, fills[last] is top.
    // Therefore, reverse imageFills so layer[0] is last (top).
    for (let i = imageFills.length - 1; i >= 0; i--) {
      const fill = imageFills[i];
      if (fill) {
        fills.push(fill);
      }
    }
  }

  // 3. Handle maxFills constraint (e.g. single-fill adapter)
  if (fills.length > maxFills) {
    // Keep the topmost fill (the last element in fills)
    const topFill = fills[fills.length - 1];
    diagnostics.push({
      severity: 'info',
      code: 'MULTI_BACKGROUND_APPROXIMATED',
      message: `Multiple background layers (${fills.length}) detected. Preserved topmost layer for target compatibility.`,
      phase: 'style-resolution',
      recoveryAction: 'Selected topmost visible fill layer.',
      ...(options.nodeId ? { nodeId: options.nodeId } : {}),
      timestamp: Date.now()
    });

    return {
      fills: topFill ? [topFill] : [],
      diagnostics
    };
  }

  return {
    fills,
    diagnostics
  };
}
