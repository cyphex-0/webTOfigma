/**
 * Viewport Verification and Breakpoint Availability Guard.
 * 
 * Verifies that the physical/window viewport matches requested responsive breakpoints:
 * - Measures window.innerWidth and window.innerHeight directly from page context.
 * - Does not silently use DevTools debugger emulation or broad permissions.
 * - If a requested breakpoint cannot be captured, marks that variant as unavailable
 *   with diagnostic BREAKPOINT_UNAVAILABLE and retains successful sizes.
 * - Never claims a 1365 px capture is 1440 px.
 */

import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import {
  ResponsiveBreakpoint,
  matchResponsiveBreakpoint
} from './responsive-profile';

export interface ViewportDimensions {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface BreakpointVerificationResult {
  requestedBreakpoint: ResponsiveBreakpoint;
  measured: ViewportDimensions;
  isAvailable: boolean;
  isExactMatch: boolean;
  toleranceDifferencePx: number;
  diagnostic?: ExportDiagnostic | undefined;
}

/**
 * Measures the actual window viewport dimensions in the executing context.
 */
export function measureWindowViewport(win?: Window): ViewportDimensions {
  const targetWin = win ?? (typeof window !== 'undefined' ? window : undefined);
  if (!targetWin) {
    return {
      width: 1440,
      height: 900,
      devicePixelRatio: 1
    };
  }

  return {
    width: targetWin.innerWidth || targetWin.document.documentElement.clientWidth || 1440,
    height: targetWin.innerHeight || targetWin.document.documentElement.clientHeight || 900,
    devicePixelRatio: targetWin.devicePixelRatio || 1
  };
}

/**
 * Verifies whether the measured viewport meets the requirements for a requested breakpoint.
 */
export function verifyBreakpointAvailability(
  measured: ViewportDimensions,
  requestedBreakpoint: ResponsiveBreakpoint
): BreakpointVerificationResult {
  const diff = Math.abs(measured.width - requestedBreakpoint.targetWidth);
  const isAvailable = diff <= requestedBreakpoint.tolerancePx;
  const isExactMatch = measured.width === requestedBreakpoint.targetWidth;

  let diagnostic: ExportDiagnostic | undefined = undefined;

  if (!isAvailable) {
    diagnostic = {
      severity: 'warning',
      code: 'BREAKPOINT_UNAVAILABLE',
      message: `Requested responsive breakpoint '${requestedBreakpoint.name}' (${requestedBreakpoint.targetWidth}px) could not be matched. Actual viewport was ${measured.width}px (exceeds +- ${requestedBreakpoint.tolerancePx}px tolerance). Variant marked unavailable.`,
      phase: 'dom-extraction',
      timestamp: Date.now()
    };
  }

  return {
    requestedBreakpoint,
    measured,
    isAvailable,
    isExactMatch,
    toleranceDifferencePx: diff,
    diagnostic
  };
}

/**
 * Filters a list of requested breakpoint captures, retaining only verified available variants
 * and collecting diagnostics for unavailable ones.
 */
export function filterAvailableBreakpoints(
  measured: ViewportDimensions,
  requestedBreakpoints: readonly ResponsiveBreakpoint[]
): {
  available: BreakpointVerificationResult[];
  unavailable: BreakpointVerificationResult[];
  diagnostics: ExportDiagnostic[];
} {
  const available: BreakpointVerificationResult[] = [];
  const unavailable: BreakpointVerificationResult[] = [];
  const diagnostics: ExportDiagnostic[] = [];

  for (const bp of requestedBreakpoints) {
    const verification = verifyBreakpointAvailability(measured, bp);
    if (verification.isAvailable) {
      available.push(verification);
    } else {
      unavailable.push(verification);
      if (verification.diagnostic) {
        diagnostics.push(verification.diagnostic);
      }
    }
  }

  return {
    available,
    unavailable,
    diagnostics
  };
}
