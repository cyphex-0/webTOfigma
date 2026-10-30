/**
 * Unified Typography Coordination Engine.
 * 
 * Provides end-to-end typography extraction, variable font quantization,
 * fallback resolution, rich text runs, layout geometry, and diagnostics.
 */

import { SceneTextData } from '../../shared/contracts/scene';
import { TextRun } from '../../shared/contracts/source-node';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import {
  resolveTypographyFont,
  ResolvedFont,
  FontResolverOptions
} from './font-fallback-resolver';
import {
  extractDirectElementText,
  getSemanticTextLayerName,
  hasDirectText
} from './text-extractor';
import { buildTextRuns } from './text-run-builder';
import {
  analyzeTextLayout,
  TextLayoutAnalysis
} from './text-layout';
import {
  createFontSubstitutedDiagnostic,
  createTextClippedDiagnostic,
  createLineClampDiagnostic,
  createRtlTextDiagnostic,
  createWeightQuantizedDiagnostic
} from './typography-diagnostics';

export * from './font-fallback-resolver';
export * from './text-extractor';
export * from './text-run-builder';
export * from './text-layout';
export * from './typography-diagnostics';

export interface TypographyExtractionOptions {
  nodeId?: string | undefined;
  windowRef?: Window | undefined;
  fontResolverOptions?: FontResolverOptions | undefined;
}

export interface ExtractedTypographyResult {
  hasText: boolean;
  semanticName: string;
  directText: string;
  textRuns: TextRun[];
  resolvedFont: ResolvedFont;
  layout: TextLayoutAnalysis;
  sceneTextData: SceneTextData;
  diagnostics: ExportDiagnostic[];
}

/**
 * Extracts comprehensive typography data and diagnostics for an element.
 */
export function extractElementTypography(
  el: Element,
  style: CSSStyleDeclaration | Record<string, string>,
  options: TypographyExtractionOptions = {}
): ExtractedTypographyResult {
  const s = style as any;
  const diagnostics: ExportDiagnostic[] = [];
  const nodeId = options.nodeId;

  // 1. Semantic layer naming
  const semanticName = getSemanticTextLayerName(el);

  // 2. Direct text content & presence
  const directText = extractDirectElementText(el, s.whiteSpace);
  const hasText = directText.length > 0 || hasDirectText(el);

  // 3. Rich text runs
  const textRuns = buildTextRuns(el, { windowRef: options.windowRef });

  // 4. Font resolution & variable font quantization
  const resolvedFont = resolveTypographyFont(
    s.fontFamily,
    s.fontWeight,
    s.fontStyle,
    s.fontVariationSettings,
    options.fontResolverOptions
  );

  if (resolvedFont.isSubstituted) {
    diagnostics.push(
      createFontSubstitutedDiagnostic({
        sourceFamily: resolvedFont.sourceFamily,
        resolvedFamily: resolvedFont.resolvedFamily,
        nodeId
      })
    );
  }

  if (resolvedFont.sourceWeight !== resolvedFont.quantizedWeight) {
    diagnostics.push(
      createWeightQuantizedDiagnostic({
        family: resolvedFont.resolvedFamily,
        sourceWeight: resolvedFont.sourceWeight,
        quantizedWeight: resolvedFont.quantizedWeight,
        nodeId
      })
    );
  }

  // 5. Layout analysis & line measurements
  const layout = analyzeTextLayout(el, style, { windowRef: options.windowRef });

  if (layout.clipsText) {
    diagnostics.push(
      createTextClippedDiagnostic({
        measuredHeight: layout.measuredHeight,
        safeHeight: layout.safeHeight,
        nodeId
      })
    );
  }

  // 6. Check line clamp
  const lineClamp = s.webkitLineClamp || s.lineClamp;
  if (lineClamp && lineClamp !== 'none') {
    const num = parseInt(lineClamp, 10);
    if (!isNaN(num) && num > 0) {
      diagnostics.push(
        createLineClampDiagnostic({
          maxLines: num,
          nodeId
        })
      );
    }
  }

  // 7. Check RTL text
  const direction = (s.direction || el.getAttribute('dir') || 'ltr').toLowerCase();
  if (direction === 'rtl') {
    diagnostics.push(
      createRtlTextDiagnostic({
        direction: 'rtl',
        nodeId
      })
    );
  }

  // 8. Text transform and decoration
  const textTransform = (s.textTransform || 'none').toLowerCase();
  let textCase: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' = 'ORIGINAL';
  if (textTransform === 'uppercase') textCase = 'UPPER';
  else if (textTransform === 'lowercase') textCase = 'LOWER';
  else if (textTransform === 'capitalize') textCase = 'TITLE';

  const textDec = (s.textDecorationLine || s.textDecoration || 'none').toLowerCase();
  let textDecoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH' = 'NONE';
  if (textDec.includes('underline')) textDecoration = 'UNDERLINE';
  else if (textDec.includes('line-through')) textDecoration = 'STRIKETHROUGH';

  // Text alignment
  let textAlign: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED' = 'LEFT';
  const ta = (s.textAlign || 'left').toLowerCase();
  if (ta === 'center') textAlign = 'CENTER';
  else if (ta === 'right') textAlign = 'RIGHT';
  else if (ta === 'justify') textAlign = 'JUSTIFIED';

  const fontSize = parseFloat(s.fontSize || '16') || 16;
  const letterSpacingPx = parseFloat(s.letterSpacing || '0') || 0;

  // Final SceneTextData
  const sceneTextData: SceneTextData = {
    text: directText.length > 0 ? directText : (el.textContent?.trim() ?? ''),
    fontSize,
    fontWeight: resolvedFont.quantizedWeight,
    fontFamily: resolvedFont.resolvedFamily,
    fontStyle: resolvedFont.fontStyle,
    lineHeight: layout.normalizedLineHeight,
    letterSpacing: { unit: 'PIXELS', value: letterSpacingPx },
    textAlign,
    textAutoResize: layout.autoResize,
    textCase,
    textDecoration,
    sourceFont: resolvedFont.sourceFamily,
    resolvedFont: resolvedFont.resolvedFamily,
    ...(Object.keys(resolvedFont.variationAxes).length > 0
      ? { rawVariationSettings: resolvedFont.variationAxes }
      : {})
  };

  return {
    hasText,
    semanticName,
    directText,
    textRuns,
    resolvedFont,
    layout,
    sceneTextData,
    diagnostics
  };
}
