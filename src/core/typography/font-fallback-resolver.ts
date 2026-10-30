/**
 * Font Fallback Resolver and Variable Font Quantizer.
 * 
 * Parses CSS font-variation-settings axes ('wght', 'wdth', 'slnt', 'ital', 'opsz'),
 * quantizes continuous font weights into discrete standard weights (100–900),
 * and resolves font families against Figma-accessible standard fallbacks.
 */

export interface FontVariationSettings {
  raw: string;
  axes: Record<string, number>;
}

export interface ResolvedFont {
  sourceFamily: string;
  resolvedFamily: string;
  sourceWeight: number;
  quantizedWeight: number;
  fontStyle: 'normal' | 'italic' | 'oblique';
  figmaStyleName: string;
  isSubstituted: boolean;
  variationAxes: Record<string, number>;
}

export interface FontResolverOptions {
  defaultSansFallback?: string | undefined;
  defaultSerifFallback?: string | undefined;
  defaultMonoFallback?: string | undefined;
  customMappings?: Record<string, string> | undefined;
}

// Standard standard fonts generally present or supported out-of-the-box in Figma
const FIGMA_STANDARD_FAMILIES = new Set([
  'inter',
  'roboto',
  'arial',
  'helvetica',
  'helvetica neue',
  'times new roman',
  'georgia',
  'courier new',
  'segoe ui',
  'sf pro display',
  'sf pro text'
]);

/**
 * Standard discrete font weights mapped to Figma style names.
 */
export const DISCRETE_WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black'
};

/**
 * Parses CSS font-variation-settings into a structured dictionary of axes.
 * Example input: "'wght' 465, 'wdth' 85, 'slnt' -10"
 */
export function parseFontVariationSettings(settingsStr: string | undefined): FontVariationSettings {
  if (!settingsStr || settingsStr === 'normal' || settingsStr === 'none') {
    return { raw: '', axes: {} };
  }

  const axes: Record<string, number> = {};
  const clean = settingsStr.trim();
  // Regex matches 'axis' value or "axis" value
  const regex = /['"]([a-zA-Z0-9_]{4})['"]\s+(-?\d+(?:\.\d+)?)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(clean)) !== null) {
    const axisTag = match[1];
    const axisVal = match[2];
    if (axisTag && axisVal) {
      axes[axisTag] = parseFloat(axisVal);
    }
  }

  return { raw: clean, axes };
}

/**
 * Quantizes continuous font weight (e.g. 465 from variable font)
 * to nearest discrete standard weight (100, 200, ..., 900).
 */
export function quantizeFontWeight(rawWeight: number): number {
  if (isNaN(rawWeight) || rawWeight <= 0) return 400;

  // Round to nearest 100
  let quantized = Math.round(rawWeight / 100) * 100;
  if (quantized < 100) quantized = 100;
  if (quantized > 900) quantized = 900;

  return quantized;
}

/**
 * Parses CSS font-weight keywords (normal, bold, bolder, lighter) or numeric strings.
 */
export function parseFontWeight(weightStr: string | number | undefined): number {
  if (typeof weightStr === 'number') return quantizeFontWeight(weightStr);
  if (!weightStr) return 400;

  const clean = weightStr.toString().trim().toLowerCase();
  switch (clean) {
    case 'normal':
      return 400;
    case 'bold':
      return 700;
    case 'bolder':
      return 800;
    case 'lighter':
      return 300;
    default: {
      const num = parseFloat(clean);
      return isNaN(num) ? 400 : quantizeFontWeight(num);
    }
  }
}

/**
 * Maps 'wdth' percentage to font stretch style token.
 */
export function mapFontWidthToStretch(widthPct: number | undefined): string {
  if (widthPct === undefined || isNaN(widthPct)) return '';
  if (widthPct < 75) return 'Ultra Condensed';
  if (widthPct <= 87.5) return 'Condensed';
  if (widthPct < 95) return 'Semi Condensed';
  if (widthPct <= 105) return '';
  if (widthPct <= 125) return 'Expanded';
  return 'Ultra Expanded';
}

/**
 * Constructs a Figma-compatible font style name (e.g. 'Bold Italic', 'Regular', 'Condensed Medium').
 */
export function buildFigmaStyleName(
  weight: number,
  fontStyle: 'normal' | 'italic' | 'oblique',
  widthPct?: number | undefined
): string {
  const discreteWeight = quantizeFontWeight(weight);
  const weightName = DISCRETE_WEIGHT_NAMES[discreteWeight] ?? 'Regular';
  const isItalic = fontStyle === 'italic' || fontStyle === 'oblique';
  const stretch = mapFontWidthToStretch(widthPct);

  const parts: string[] = [];
  if (stretch) parts.push(stretch);

  if (isItalic) {
    if (weightName === 'Regular') {
      parts.push('Italic');
    } else {
      parts.push(`${weightName} Italic`);
    }
  } else {
    parts.push(weightName);
  }

  return parts.join(' ').trim();
}

/**
 * Resolves a computed font-family chain against Figma-accessible standard fonts.
 */
export function resolveFontFamily(
  fontFamilyStr: string | undefined,
  options: FontResolverOptions = {}
): { resolvedFamily: string; isSubstituted: boolean; sourceFamily: string } {
  const defaultSans = options.defaultSansFallback ?? 'Inter';
  const defaultSerif = options.defaultSerifFallback ?? 'Georgia';
  const defaultMono = options.defaultMonoFallback ?? 'Courier New';

  if (!fontFamilyStr || !fontFamilyStr.trim()) {
    return { resolvedFamily: defaultSans, isSubstituted: true, sourceFamily: 'sans-serif' };
  }

  // Split comma-separated font stack
  const families = fontFamilyStr
    .split(',')
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);

  const firstSource = families[0] ?? 'sans-serif';

  for (const family of families) {
    const lower = family.toLowerCase();

    // Check custom mappings first
    if (options.customMappings && options.customMappings[family]) {
      return {
        resolvedFamily: options.customMappings[family]!,
        isSubstituted: options.customMappings[family]!.toLowerCase() !== lower,
        sourceFamily: firstSource
      };
    }

    // Check Figma standard families
    if (FIGMA_STANDARD_FAMILIES.has(lower)) {
      // Capitalize standard font
      const canonical =
        lower === 'inter'
          ? 'Inter'
          : lower === 'roboto'
            ? 'Roboto'
            : lower === 'arial'
              ? 'Arial'
              : lower === 'helvetica'
                ? 'Helvetica'
                : lower === 'times new roman'
                  ? 'Times New Roman'
                  : lower === 'georgia'
                    ? 'Georgia'
                    : lower === 'courier new'
                      ? 'Courier New'
                      : family;

      return {
        resolvedFamily: canonical,
        isSubstituted: family !== firstSource,
        sourceFamily: firstSource
      };
    }

    // Generic CSS categories
    if (lower === 'sans-serif' || lower === 'system-ui') {
      return { resolvedFamily: defaultSans, isSubstituted: family !== firstSource, sourceFamily: firstSource };
    }
    if (lower === 'serif') {
      return { resolvedFamily: defaultSerif, isSubstituted: true, sourceFamily: firstSource };
    }
    if (lower === 'monospace') {
      return { resolvedFamily: defaultMono, isSubstituted: true, sourceFamily: firstSource };
    }
  }

  // If no standard family matched, fallback to default sans
  return {
    resolvedFamily: defaultSans,
    isSubstituted: true,
    sourceFamily: firstSource
  };
}

/**
 * Master Font Resolver.
 * Resolves font family, quantizes weight, parses variable font settings,
 * and builds Figma-compatible font descriptor.
 */
export function resolveTypographyFont(
  fontFamily: string | undefined,
  fontWeight: string | number | undefined,
  fontStyle: string | undefined,
  fontVariationSettings?: string | undefined,
  options: FontResolverOptions = {}
): ResolvedFont {
  const { sourceFamily, resolvedFamily, isSubstituted } = resolveFontFamily(fontFamily, options);
  const variations = parseFontVariationSettings(fontVariationSettings);

  // If variation settings have 'wght', it overrides computed font-weight
  let rawWeight = parseFontWeight(fontWeight);
  if (variations.axes['wght'] !== undefined) {
    rawWeight = variations.axes['wght'];
  }

  const quantizedWeight = quantizeFontWeight(rawWeight);

  // Style (normal, italic, oblique)
  const normStyle: 'normal' | 'italic' | 'oblique' =
    fontStyle === 'italic' || (variations.axes['ital'] !== undefined && variations.axes['ital'] > 0.5)
      ? 'italic'
      : fontStyle === 'oblique' || (variations.axes['slnt'] !== undefined && variations.axes['slnt'] !== 0)
        ? 'oblique'
        : 'normal';

  const widthPct = variations.axes['wdth'];
  const figmaStyleName = buildFigmaStyleName(quantizedWeight, normStyle, widthPct);

  return {
    sourceFamily,
    resolvedFamily,
    sourceWeight: rawWeight,
    quantizedWeight,
    fontStyle: normStyle,
    figmaStyleName,
    isSubstituted,
    variationAxes: variations.axes
  };
}
