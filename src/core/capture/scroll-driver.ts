/**
 * Progressive Scroll Driver and Custom Container Discovery Engine.
 * 
 * Drives incremental vertical scrolling to hydrate lazy-loaded DOM elements,
 * images, and intersection-observer content.
 * Discovers custom non-default scroll containers, detects virtual-scroll engines,
 * prevents infinite scroll traps, and supports responsive cancellation.
 */

import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface ScrollDriverOptions {
  windowRef?: Window | undefined;
  documentRef?: Document | undefined;
  stepFraction?: number | undefined;
  customStepSizePx?: number | undefined;
  settleDelayMs?: number | undefined;
  maxSteps?: number | undefined;
  maxDocumentHeight?: number | undefined;
  maxDurationMs?: number | undefined;
  stableStepThreshold?: number | undefined;
  signal?: AbortSignal | undefined;
  onStepProgress?: ((currentStep: number, totalHeight: number, currentOffset: number) => void) | undefined;
}

export interface ScrollDriverResult {
  totalSteps: number;
  finalScrollHeight: number;
  isInfiniteScrollCapped: boolean;
  isTimeCapped: boolean;
  customContainerUsed: boolean;
  customContainerSelector?: string | undefined;
  virtualScrollDetected: boolean;
  diagnostics: ExportDiagnostic[];
}

export interface DiscoveredScrollTarget {
  target: Element | Window;
  isCustom: boolean;
  selector?: string | undefined;
}

/**
 * Discovers the active scrolling container, distinguishing window scrolling
 * from custom viewport-level scroll containers (#root, #__next, main, etc.).
 */
export function discoverScrollContainer(
  doc: Document,
  win: Window
): DiscoveredScrollTarget {
  const scrollingEl = doc.scrollingElement || doc.documentElement;
  const innerHeight = win.innerHeight;

  // 1. If document.scrollingElement is already scrollable, use window
  if (scrollingEl.scrollHeight > innerHeight + 16) {
    return { target: win, isCustom: false };
  }

  // 2. Inspect common custom container candidates
  const candidates = [
    'main',
    '#root',
    '#__next',
    '#app',
    '[data-scroll-container]',
    'body > div',
    'body > div > div'
  ];

  for (const selector of candidates) {
    try {
      const el = doc.querySelector(selector);
      if (!el) continue;

      const cs = win.getComputedStyle(el);
      const overflowY = (cs.overflowY || '').toLowerCase();
      const isScrollable = overflowY === 'auto' || overflowY === 'scroll';

      if (isScrollable && el.scrollHeight > el.clientHeight + 80) {
        return { target: el, isCustom: true, selector };
      }
    } catch {
      // Ignore selector errors
    }
  }

  return { target: win, isCustom: false };
}

/**
 * Checks whether an element appears to be driven by a virtual scroll engine
 * (e.g. GSAP ScrollTrigger, Locomotive Scroll) using CSS transform translations.
 */
export function isVirtualScrollEnginePresent(doc: Document, win: Window): boolean {
  const candidates = ['#root', '#__next', 'main', '[data-scroll-container]', 'body > div'];

  for (const selector of candidates) {
    try {
      const el = doc.querySelector(selector);
      if (!el) continue;

      const cs = win.getComputedStyle(el);
      const transform = cs.transform || '';
      if (
        transform.includes('matrix') ||
        transform.includes('translate3d') ||
        transform.includes('translateY')
      ) {
        return true;
      }
    } catch {
      // Ignore selector errors
    }
  }

  return false;
}

/**
 * Executes bounded, progressive vertical scrolling to hydrate lazy content.
 */
export async function driveProgressiveScroll(
  options: ScrollDriverOptions = {}
): Promise<ScrollDriverResult> {
  const win = options.windowRef ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = options.documentRef ?? (typeof document !== 'undefined' ? document : undefined);

  if (!win || !doc) {
    throw new Error('driveProgressiveScroll requires an active DOM environment with window and document');
  }

  const diagnostics: ExportDiagnostic[] = [];
  const maxSteps = options.maxSteps ?? 50;
  const maxDocHeight = options.maxDocumentHeight ?? 30000;
  const maxDuration = options.maxDurationMs ?? 30000;
  const settleDelay = options.settleDelayMs ?? 100;
  const stableThreshold = options.stableStepThreshold ?? 3;

  // 1. Discover Scroll Container
  const discovered = discoverScrollContainer(doc, win);
  const isCustomContainer = discovered.isCustom;
  const scrollTarget = discovered.target;

  if (isCustomContainer && discovered.selector) {
    diagnostics.push({
      severity: 'info',
      code: 'SCROLL_CONTAINER_NON_DEFAULT',
      message: `Detected and scrolling custom container '${discovered.selector}' instead of window.`,
      phase: 'dom-extraction',
      timestamp: Date.now()
    });
  }

  // 2. Check for Virtual Scroll Engines
  const virtualScrollDetected = isVirtualScrollEnginePresent(doc, win);
  if (virtualScrollDetected) {
    diagnostics.push({
      severity: 'info',
      code: 'VIRTUAL_SCROLL_DETECTED',
      message: 'Detected transform-based virtual scroll engine; dispatching synthetic wheel events.',
      phase: 'dom-extraction',
      timestamp: Date.now()
    });
  }

  // 3. Derive safe step size
  const viewportHeight = win.innerHeight || 900;
  const stepSize = options.customStepSizePx
    ? Math.max(50, options.customStepSizePx)
    : Math.min(2000, Math.max(100, Math.floor(viewportHeight * (options.stepFraction ?? 0.75))));

  const getScrollHeight = (): number => {
    if (isCustomContainer && scrollTarget instanceof Element) {
      return scrollTarget.scrollHeight;
    }
    const scrollingEl = doc.scrollingElement || doc.documentElement;
    return Math.max(scrollingEl.scrollHeight, doc.body?.scrollHeight || 0);
  };

  const getScrollOffset = (): number => {
    if (isCustomContainer && scrollTarget instanceof Element) {
      return scrollTarget.scrollTop;
    }
    return win.scrollY || win.pageYOffset || 0;
  };

  const performStep = (deltaY: number) => {
    if (isCustomContainer && scrollTarget instanceof Element) {
      scrollTarget.scrollTop += deltaY;
    } else {
      win.scrollBy(0, deltaY);
    }

    if (virtualScrollDetected && doc.body) {
      try {
        const wheelEv = new WheelEvent('wheel', {
          deltaY,
          bubbles: true,
          cancelable: true
        });
        doc.body.dispatchEvent(wheelEv);
      } catch {
        // Fallback in environments where WheelEvent is limited
      }
    }
  };

  const startTime = Date.now();
  let step = 0;
  let stableSteps = 0;
  let previousHeight = getScrollHeight();
  let isInfiniteScrollCapped = false;
  let isTimeCapped = false;

  // 4. Progressive Scroll Loop
  while (step < maxSteps) {
    if (options.signal?.aborted) {
      break;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= maxDuration) {
      isTimeCapped = true;
      diagnostics.push({
        severity: 'warning',
        code: 'SCROLL_TIMEOUT',
        message: `Progressive scrolling reached maximum duration limit of ${maxDuration}ms.`,
        phase: 'dom-extraction',
        timestamp: Date.now()
      });
      break;
    }

    step++;
    performStep(stepSize);

    // Wait settle delay
    if (settleDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, settleDelay));
    }

    const currentHeight = getScrollHeight();
    const currentOffset = getScrollOffset();

    if (options.onStepProgress) {
      options.onStepProgress(step, currentHeight, currentOffset);
    }

    // Check height cap
    if (currentHeight >= maxDocHeight) {
      isInfiniteScrollCapped = true;
      diagnostics.push({
        severity: 'warning',
        code: 'INFINITE_SCROLL_HALTED',
        message: `Page height (${currentHeight}px) reached maximum configured document height limit of ${maxDocHeight}px.`,
        phase: 'dom-extraction',
        timestamp: Date.now()
      });
      break;
    }

    // Check bottom reach and stability
    const isAtBottom = currentOffset + viewportHeight >= currentHeight - 16;
    if (isAtBottom) {
      if (currentHeight === previousHeight) {
        stableSteps++;
        if (stableSteps >= stableThreshold) {
          // Bottom reached and no new content appeared for configured threshold
          break;
        }
      } else {
        stableSteps = 0;
      }
    } else {
      stableSteps = 0;
    }

    previousHeight = currentHeight;
  }

  if (step >= maxSteps && !isInfiniteScrollCapped && !isTimeCapped) {
    isInfiniteScrollCapped = true;
    diagnostics.push({
      severity: 'warning',
      code: 'INFINITE_SCROLL_HALTED',
      message: `Progressive scrolling reached maximum step limit of ${maxSteps} steps.`,
      phase: 'dom-extraction',
      timestamp: Date.now()
    });
  }

  return {
    totalSteps: step,
    finalScrollHeight: getScrollHeight(),
    isInfiniteScrollCapped,
    isTimeCapped,
    customContainerUsed: isCustomContainer,
    ...(discovered.selector ? { customContainerSelector: discovered.selector } : {}),
    virtualScrollDetected,
    diagnostics
  };
}
