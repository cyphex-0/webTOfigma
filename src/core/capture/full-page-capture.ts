/**
 * Full-Page Capture Engine.
 * 
 * Orchestrates vertical page capture:
 * 1. Records initial scroll position.
 * 2. Drives incremental vertical scrolling to hydrate lazy content and images.
 * 3. Waits for bounded page stability.
 * 4. Resets scroll to top before final coherent DOM geometry extraction.
 * 5. Applies single-instance fixed and sticky element deduplication.
 * 6. Always restores original user scroll offset upon completion or cancellation.
 */

import { PageCapture } from '../../shared/contracts/scene';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { DOMWalker, DOMWalkerOptions } from '../dom/dom-walker';
import { driveProgressiveScroll, ScrollDriverOptions } from './scroll-driver';
import { waitForPageStability, StabilityOptions } from './page-stability';
import { applyFixedStickyPolicy, FixedStickyPolicyOptions } from './fixed-sticky-policy';

export interface FullPageCaptureOptions extends DOMWalkerOptions {
  windowRef?: Window | undefined;
  documentRef?: Document | undefined;
  scrollOptions?: ScrollDriverOptions | undefined;
  stabilityOptions?: StabilityOptions | undefined;
  fixedStickyOptions?: FixedStickyPolicyOptions | undefined;
  signal?: AbortSignal | undefined;
  onScrollProgress?: ((step: number, totalHeight: number, currentOffset: number) => void) | undefined;
}

export interface FullPageCaptureResult {
  capture: PageCapture;
  diagnostics: ExportDiagnostic[];
  isPartial: boolean;
}

/**
 * Captures the full vertical document, driving progressive scroll and hydrating lazy content.
 */
export async function captureFullPage(
  options: FullPageCaptureOptions = {}
): Promise<FullPageCaptureResult> {
  const win = options.windowRef ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = options.documentRef ?? (typeof document !== 'undefined' ? document : undefined);

  if (!win || !doc) {
    throw new Error('captureFullPage requires an active DOM environment with window and document');
  }

  const diagnostics: ExportDiagnostic[] = [];
  let isPartial = false;

  // 1. Preflight: Record original user scroll offset
  const originalScrollX = win.scrollX || win.pageXOffset || 0;
  const originalScrollY = win.scrollY || win.pageYOffset || 0;

  try {
    // 2. Progressive scroll driving to hydrate lazy content
    const scrollResult = await driveProgressiveScroll({
      windowRef: win,
      documentRef: doc,
      signal: options.signal,
      onStepProgress: options.onScrollProgress,
      ...options.scrollOptions
    });
    diagnostics.push(...scrollResult.diagnostics);

    if (scrollResult.isInfiniteScrollCapped || scrollResult.isTimeCapped) {
      isPartial = true;
    }

    // 3. Wait for final resource stability
    const stability = await waitForPageStability(doc.documentElement, options.stabilityOptions);
    diagnostics.push(...stability.diagnostics);

    // 4. Return to top of page before final geometry extraction
    try {
      if (typeof win.scrollTo === 'function') {
        win.scrollTo(0, 0);
      }
      if (doc.scrollingElement) {
        doc.scrollingElement.scrollTop = 0;
      }
    } catch {
      // Ignore scroll-to errors
    }

    // Short pause for fixed/sticky headers to settle into top-of-page state
    await new Promise((resolve) => setTimeout(resolve, 50));

    // 5. Coherent DOM Snapshot Extraction
    const walker = new DOMWalker({
      ...options,
      captureMode: 'full-page',
      maxNodeCount: options.maxNodeCount ?? 5000,
      resolvePaintOrder: true
    });

    const walkResult = walker.walk(options.rootElement ?? doc.documentElement);
    diagnostics.push(...walkResult.diagnostics);

    // 6. Apply Fixed & Sticky Single-Instance Policy
    const policyResult = applyFixedStickyPolicy(walkResult.nodes, options.fixedStickyOptions);
    diagnostics.push(...policyResult.diagnostics);

    // 7. Measure Full Document Dimensions
    const scrollingEl = doc.scrollingElement || doc.documentElement;
    const docWidth = Math.max(
      scrollingEl.scrollWidth,
      doc.body?.scrollWidth || 0,
      win.innerWidth || 1440
    );
    const docHeight = Math.max(
      scrollingEl.scrollHeight,
      doc.body?.scrollHeight || 0,
      win.innerHeight || 900
    );

    const capture: PageCapture = {
      metadata: {
        ...walkResult.metadata,
        captureMode: 'full-page',
        documentDimensions: {
          width: docWidth,
          height: docHeight
        }
      },
      nodes: policyResult.nodes,
      diagnostics
    };

    return {
      capture,
      diagnostics,
      isPartial
    };
  } finally {
    // 8. Always restore user's original scroll offset
    try {
      if (typeof win.scrollTo === 'function') {
        win.scrollTo(originalScrollX, originalScrollY);
      }
    } catch {
      // Ignore scroll restoration errors
    }
  }
}
