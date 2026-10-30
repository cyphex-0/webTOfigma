/**
 * Page Stability, Image Readiness, and Font Loading Waiter.
 * 
 * Provides bounded waiting for dynamic page rendering:
 * - Image readiness via complete flag and bounded event listeners.
 * - Font readiness via document.fonts.ready with timeout fallback.
 * - DOM mutation settling via MutationObserver debouncing.
 * - Prevents hung promises on failed or blocked resources.
 */

import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface StabilityOptions {
  imageTimeoutMs?: number | undefined;
  fontTimeoutMs?: number | undefined;
  domIdleTimeoutMs?: number | undefined;
  maxWaitMs?: number | undefined;
}

export interface StabilityReport {
  imagesLoaded: number;
  imagesFailed: number;
  fontsReady: boolean;
  domSettled: boolean;
  durationMs: number;
  diagnostics: ExportDiagnostic[];
}

/**
 * Waits for all <img> elements inside a container to complete loading,
 * racing against a bounded timeout.
 */
export async function waitForImagesReady(
  container: Element | Document,
  timeoutMs = 2000
): Promise<{ loaded: number; failed: number; total: number }> {
  const images = Array.from(container.querySelectorAll('img'));
  const pendingImages = images.filter((img) => !img.complete && img.src);

  if (pendingImages.length === 0) {
    return { loaded: images.length, failed: 0, total: images.length };
  }

  let loadedCount = images.length - pendingImages.length;
  let failedCount = 0;

  const waitPromise = Promise.all(
    pendingImages.map(
      (img) =>
        new Promise<void>((resolve) => {
          let resolved = false;
          const onDone = (success: boolean) => {
            if (resolved) return;
            resolved = true;
            if (success) loadedCount++;
            else failedCount++;
            img.removeEventListener('load', onLoad);
            img.removeEventListener('error', onError);
            resolve();
          };
          const onLoad = () => onDone(true);
          const onError = () => onDone(false);

          img.addEventListener('load', onLoad);
          img.addEventListener('error', onError);
        })
    )
  );

  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));

  await Promise.race([waitPromise, timeoutPromise]);

  return {
    loaded: loadedCount,
    failed: failedCount,
    total: images.length
  };
}

/**
 * Waits for document fonts to finish loading with a bounded timeout.
 */
export async function waitForFontsReady(
  doc: Document,
  timeoutMs = 1500
): Promise<boolean> {
  const fonts = (doc as any).fonts;
  if (!fonts || typeof fonts.ready !== 'object' || typeof fonts.ready.then !== 'function') {
    return true; // Document.fonts not supported, proceed immediately
  }

  let isReady = false;
  const readyPromise = fonts.ready.then(() => {
    isReady = true;
  });

  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));

  await Promise.race([readyPromise, timeoutPromise]);
  return isReady;
}

/**
 * Waits for DOM mutations to cease (settle) for an idle period or until maxWaitMs expires.
 */
export async function waitForDOMSettled(
  container: Element | Document,
  idleTimeoutMs = 100,
  maxWaitMs = 1000
): Promise<boolean> {
  if (typeof MutationObserver === 'undefined') {
    return true;
  }

  const targetNode = container instanceof Document ? container.documentElement : container;
  if (!targetNode) return true;

  return new Promise<boolean>((resolve) => {
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let maxTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      observer.disconnect();
      if (idleTimer) clearTimeout(idleTimer);
      if (maxTimer) clearTimeout(maxTimer);
    };

    const resetIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        cleanup();
        resolve(true);
      }, idleTimeoutMs);
    };

    const observer = new MutationObserver(() => {
      resetIdle();
    });

    observer.observe(targetNode, {
      childList: true,
      subtree: true,
      attributes: true
    });

    // Initial idle start
    resetIdle();

    // Absolute deadline
    maxTimer = setTimeout(() => {
      cleanup();
      resolve(false);
    }, maxWaitMs);
  });
}

/**
 * Orchestrates page stability checks (images, fonts, mutations) with bounded execution.
 */
export async function waitForPageStability(
  container: Element | Document,
  options: StabilityOptions = {}
): Promise<StabilityReport> {
  const start = Date.now();
  const diagnostics: ExportDiagnostic[] = [];

  const doc = container instanceof Document ? container : container.ownerDocument;
  const imageTimeout = options.imageTimeoutMs ?? 2000;
  const fontTimeout = options.fontTimeoutMs ?? 1500;
  const domIdleTimeout = options.domIdleTimeoutMs ?? 80;
  const maxWait = options.maxWaitMs ?? 2500;

  // Run in parallel with overall deadline
  const [imageResult, fontsReady, domSettled] = await Promise.all([
    waitForImagesReady(container, imageTimeout),
    waitForFontsReady(doc, fontTimeout),
    waitForDOMSettled(container, domIdleTimeout, maxWait)
  ]);

  if (imageResult.failed > 0) {
    diagnostics.push({
      severity: 'warning',
      code: 'IMAGES_FAILED_TO_LOAD',
      message: `${imageResult.failed} out of ${imageResult.total} images failed to complete loading within timeout.`,
      phase: 'dom-extraction',
      timestamp: Date.now()
    });
  }

  if (!fontsReady) {
    diagnostics.push({
      severity: 'info',
      code: 'FONTS_READY_TIMEOUT',
      message: 'document.fonts.ready timed out; proceeding with currently resolved fonts.',
      phase: 'dom-extraction',
      timestamp: Date.now()
    });
  }

  return {
    imagesLoaded: imageResult.loaded,
    imagesFailed: imageResult.failed,
    fontsReady,
    domSettled,
    durationMs: Date.now() - start,
    diagnostics
  };
}
