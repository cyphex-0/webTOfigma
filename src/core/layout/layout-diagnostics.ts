/**
 * Layout Diagnostics and Reporting.
 * 
 * Generates structured ExportDiagnostic entries for layout fallbacks,
 * grid approximations, space-evenly mappings, and margin collapses.
 */

import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

/**
 * Emits diagnostic when Auto Layout is disqualified and positioned-frame fallback is applied.
 */
export function createLayoutFallbackDiagnostic(params: {
  reason: string;
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'info',
    code: 'LAYOUT_FALLBACK_APPLIED',
    message: `Positioned-frame fallback used for container. Reason: ${params.reason}.`,
    phase: 'layout-computation',
    recoveryAction: 'Preserved exact measured geometry and sibling stacking order.',
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}

/**
 * Emits diagnostic when a regular CSS Grid is converted to nested Auto Layout rows/columns.
 */
export function createGridApproximationDiagnostic(params: {
  detail: string;
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'info',
    code: 'GRID_NESTING_APPROXIMATED',
    message: `CSS Grid layout approximated: ${params.detail}.`,
    phase: 'layout-computation',
    recoveryAction: 'Mapped regular grid tracks into nested Auto Layout frames.',
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}

/**
 * Emits diagnostic when justify-content: space-around or space-evenly is approximated to space-between.
 */
export function createSpaceEvenlyDiagnostic(params: {
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'info',
    code: 'SPACE_EVENLY_APPROXIMATED',
    message: 'justify-content space-around/space-evenly approximated using space-between and padding.',
    phase: 'layout-computation',
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}

/**
 * Emits diagnostic when margin collapsing is detected and reconciled.
 */
export function createMarginCollapsedDiagnostic(params: {
  marginPx: number;
  nodeId?: string | undefined;
}): ExportDiagnostic {
  return {
    severity: 'info',
    code: 'MARGIN_COLLAPSED',
    message: `Vertical margin collapsing (${params.marginPx}px) normalized to avoid double-spacing.`,
    phase: 'layout-computation',
    ...(params.nodeId ? { nodeId: params.nodeId } : {}),
    timestamp: Date.now()
  };
}
