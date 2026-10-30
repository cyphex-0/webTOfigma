/**
 * Typography Diagnostics and Reporting.
 * 
 * Generates structured ExportDiagnostic entries for font substitutions,
 * variable font weight quantizations, text clipping expansions, line clamps,
 * and RTL text directions.
 */

import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

/**
 * Emits diagnostic when an inaccessible website font is substituted with a standard fallback.
 */
export function createFontSubstitutedDiagnostic(params: {
  sourceFamily: string;
  resolvedFamily: string;
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'warning',
    code: 'FONT_SUBSTITUTED',
    message: `Font "${params.sourceFamily}" is not guaranteed in Figma and was mapped to standard fallback "${params.resolvedFamily}".`,
    phase: 'style-resolution',
    recoveryAction: `Figma requires installed fonts. Ensure "${params.sourceFamily}" is available locally or map it in Settings.`,
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}

/**
 * Emits diagnostic when a container height is safely expanded to prevent text clipping.
 */
export function createTextClippedDiagnostic(params: {
  measuredHeight: number;
  safeHeight: number;
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'warning',
    code: 'TEXT_CLIPPED_BY_HEIGHT',
    message: `Fixed height (${Math.round(params.measuredHeight)}px) was expanded to safe height (${Math.round(params.safeHeight)}px) to prevent text clipping.`,
    phase: 'layout-computation',
    recoveryAction: 'Expanded text frame height to enclose all text lines without clipping.',
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}

/**
 * Emits diagnostic when CSS line clamp (-webkit-line-clamp) is detected.
 */
export function createLineClampDiagnostic(params: {
  maxLines: number;
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'info',
    code: 'LINE_CLAMP_DETECTED',
    message: `CSS line clamp (-webkit-line-clamp: ${params.maxLines} lines) detected. Text container truncated to visible lines.`,
    phase: 'layout-computation',
    recoveryAction: 'Applied fixed bounding box matching clamped line count.',
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}

/**
 * Emits diagnostic when RTL text or writing mode is detected.
 */
export function createRtlTextDiagnostic(params: {
  direction: string;
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'info',
    code: 'RTL_TEXT_DETECTED',
    message: `Right-to-left text direction (${params.direction}) detected. Preserving RTL reading order.`,
    phase: 'dom-extraction',
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}

/**
 * Emits diagnostic when a continuous variable font weight is quantized to a standard weight.
 */
export function createWeightQuantizedDiagnostic(params: {
  family: string;
  sourceWeight: number;
  quantizedWeight: number;
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'info',
    code: 'FONT_WEIGHT_QUANTIZED',
    message: `Variable font weight ${params.sourceWeight} in "${params.family}" quantized to standard style (${params.quantizedWeight}).`,
    phase: 'style-resolution',
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}
