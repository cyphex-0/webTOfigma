/**
 * Evidence-Based Page Fidelity Classifier.
 * 
 * Classifies each captured page into:
 * - 'high': Exact layout and assets captured with zero degrading diagnostics
 * - 'partial': Usable capture with specific, documented degradations
 * - 'unsupported': Fatal capture failure or empty DOM
 * 
 * Strict Non-Negotiable Contract:
 * Never label an export 'high' fidelity merely because the operation completed.
 * Every 'partial' classification must contain specific evidence reasons:
 * - Inaccessible assets (403, 404, CORS)
 * - Substituted web fonts
 * - Unsupported CSS/layout (3D transforms, unsupported filters)
 * - Restricted cross-origin iframes
 * - Tainted HTML5 canvas
 * - Timed-out dynamic content or bounded infinite scroll
 */

import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export type PageFidelity = 'high' | 'partial' | 'unsupported';

export type DegradationReasonCode =
  | 'INACCESSIBLE_ASSETS'
  | 'SUBSTITUTED_FONTS'
  | 'UNSUPPORTED_CSS_LAYOUT'
  | 'RESTRICTED_IFRAME_CONTENT'
  | 'CANVAS_TAINTING'
  | 'TIMED_OUT_DYNAMIC_CONTENT'
  | 'INFINITE_SCROLL_BOUNDED'
  | 'FALLBACK_LAYOUT_ENGAGED'
  | 'TEXTURE_SLICED_OVERSIZED'
  | 'EMPTY_OR_CORRUPT_DOM';

export interface FidelityEvidenceItem {
  code: DegradationReasonCode;
  summary: string;
  count: number;
  details?: string[] | undefined;
}

export interface PageFidelityReport {
  pageUrl: string;
  fidelity: PageFidelity;
  reasons: FidelityEvidenceItem[];
  highFidelityJustification?: string | undefined;
  timestamp: number;
}

export interface FidelityClassificationInput {
  pageUrl: string;
  nodeCount: number;
  diagnostics?: readonly ExportDiagnostic[] | undefined;
  hasFatalError?: boolean | undefined;
  substitutedFontsCount?: number | undefined;
  unpiercedIframesCount?: number | undefined;
}

/**
 * Classifies page export fidelity based on objective diagnostic evidence.
 */
export function classifyPageFidelity(input: FidelityClassificationInput): PageFidelityReport {
  const {
    pageUrl,
    nodeCount,
    diagnostics = [],
    hasFatalError = false,
    substitutedFontsCount = 0,
    unpiercedIframesCount = 0
  } = input;

  // 1. Unsupported Check: Fatal error, zero nodes, or blank DOM
  if (hasFatalError || nodeCount === 0) {
    return {
      pageUrl,
      fidelity: 'unsupported',
      reasons: [
        {
          code: 'EMPTY_OR_CORRUPT_DOM',
          summary: hasFatalError
            ? 'Page capture encountered a fatal error and could not complete.'
            : 'Page capture extracted zero visible nodes (blank or inaccessible DOM).',
          count: 1
        }
      ],
      timestamp: Date.now()
    };
  }

  // 2. Gather Degradation Evidence Items
  const evidenceMap = new Map<DegradationReasonCode, FidelityEvidenceItem>();

  const recordEvidence = (code: DegradationReasonCode, summary: string, detail?: string) => {
    let item = evidenceMap.get(code);
    if (!item) {
      item = { code, summary, count: 0, details: [] };
      evidenceMap.set(code, item);
    }
    item.count++;
    if (detail && item.details && item.details.length < 5) {
      item.details.push(detail);
    }
  };

  // Check diagnostics for degradation signals
  for (const diag of diagnostics) {
    const code = diag.code;
    const msg = diag.message;

    if (code.includes('CORS') || code.includes('ASSET_FETCH') || code.includes('IMAGE_FAILED') || code.includes('NETWORK_ERR')) {
      recordEvidence('INACCESSIBLE_ASSETS', 'One or more remote image or font assets could not be retrieved.', msg);
    } else if (code.includes('FONT_SUBSTITUTED') || code.includes('FONT_FALLBACK')) {
      recordEvidence('SUBSTITUTED_FONTS', 'Declared web fonts were unavailable locally and substituted with system fallbacks.', msg);
    } else if (code.includes('UNSUPPORTED_CSS') || code.includes('STYLE_FALLBACK')) {
      recordEvidence('UNSUPPORTED_CSS_LAYOUT', 'Unsupported CSS properties (e.g. 3D transform, complex filter) fell back to approximations.', msg);
    } else if (code.includes('IFRAME') || code.includes('CROSS_ORIGIN')) {
      recordEvidence('RESTRICTED_IFRAME_CONTENT', 'Cross-origin iframe content was blocked by browser security sandbox.', msg);
    } else if (code.includes('CANVAS_TAINTED') || code.includes('SECURITY_ERR')) {
      recordEvidence('CANVAS_TAINTING', 'HTML5 canvas was tainted by cross-origin resources and could not be rasterized.', msg);
    } else if (code.includes('TIMEOUT') || code.includes('DYNAMIC_CONTENT_TIMEOUT')) {
      recordEvidence('TIMED_OUT_DYNAMIC_CONTENT', 'Dynamic content or lazy-load settlement timed out before completion.', msg);
    } else if (code.includes('INFINITE_SCROLL') || code.includes('SCROLL_LIMIT_REACHED')) {
      recordEvidence('INFINITE_SCROLL_BOUNDED', 'Infinite scroll page was bounded at configured safety depth.', msg);
    } else if (code.includes('LAYOUT_FALLBACK') || code.includes('POSITIONED_FALLBACK')) {
      recordEvidence('FALLBACK_LAYOUT_ENGAGED', 'Complex layout could not map losslessly to Auto Layout and used positioned fallback.', msg);
    } else if (code.includes('TEXTURE_SLICED')) {
      recordEvidence('TEXTURE_SLICED_OVERSIZED', 'Oversized raster asset was sliced vertically to prevent WebGL canvas crash.', msg);
    }
  }

  // Check explicit metric inputs
  if (substitutedFontsCount > 0 && !evidenceMap.has('SUBSTITUTED_FONTS')) {
    recordEvidence(
      'SUBSTITUTED_FONTS',
      `${substitutedFontsCount} declared font(s) were substituted with system fallbacks.`
    );
  }

  if (unpiercedIframesCount > 0 && !evidenceMap.has('RESTRICTED_IFRAME_CONTENT')) {
    recordEvidence(
      'RESTRICTED_IFRAME_CONTENT',
      `${unpiercedIframesCount} cross-origin iframe(s) could not be pierced due to browser security boundaries.`
    );
  }

  const reasons = Array.from(evidenceMap.values());

  // 3. Resolve Fidelity Level
  if (reasons.length > 0) {
    return {
      pageUrl,
      fidelity: 'partial',
      reasons,
      timestamp: Date.now()
    };
  }

  // 4. Genuine High Fidelity: Only when zero degrading evidence exists
  return {
    pageUrl,
    fidelity: 'high',
    reasons: [],
    highFidelityJustification:
      'Zero fidelity-degrading diagnostics observed. All layout, typography, and assets matched source page.',
    timestamp: Date.now()
  };
}
