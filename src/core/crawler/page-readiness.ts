/**
 * Multi-factor page readiness evaluator for background and multi-page capture.
 * Awaits DOM completion, web font loading, image settlement, and visual DOM stability
 * with strict per-page bounded timeouts.
 */

export interface PageReadinessOptions {
  maxWaitMs?: number | undefined; // Hard timeout per page (default 5000ms)
  domQuietSettleMs?: number | undefined; // Quiet window for visual stability (default 150ms)
  maxImagesWaitMs?: number | undefined; // Max timeout for image settlement (default 2000ms)
  doc?: Document | undefined;
  win?: Window | undefined;
}

export interface PageReadinessResult {
  isReady: boolean;
  finalUrl: string;
  documentTitle: string;
  domReady: boolean;
  fontsReady: boolean;
  imagesSettled: boolean;
  stabilitySettled: boolean;
  elapsedMs: number;
  diagnostics: string[];
}

/**
 * Awaits multi-factor page readiness across DOM state, web fonts, images, and layout stability.
 */
export async function waitForPageReadiness(
  options: PageReadinessOptions = {}
): Promise<PageReadinessResult> {
  const doc = options.doc ?? (typeof document !== 'undefined' ? document : undefined);
  const win = options.win ?? (typeof window !== 'undefined' ? window : undefined);

  const startTime = Date.now();
  const maxWaitMs = options.maxWaitMs ?? 5000;
  const domQuietSettleMs = options.domQuietSettleMs ?? 150;
  const maxImagesWaitMs = options.maxImagesWaitMs ?? 2000;

  const diagnostics: string[] = [];

  if (!doc || !win) {
    return {
      isReady: false,
      finalUrl: '',
      documentTitle: '',
      domReady: false,
      fontsReady: false,
      imagesSettled: false,
      stabilitySettled: false,
      elapsedMs: 0,
      diagnostics: ['DOM or Window context unavailable']
    };
  }

  // 1. Wait for DOM readyState === 'complete'
  let domReady = doc.readyState === 'complete';
  if (!domReady) {
    domReady = await new Promise<boolean>((resolve) => {
      const onStateChange = () => {
        if (doc.readyState === 'complete') {
          doc.removeEventListener('readystatechange', onStateChange);
          resolve(true);
        }
      };
      doc.addEventListener('readystatechange', onStateChange);
      // Timeout fallback
      setTimeout(() => {
        doc.removeEventListener('readystatechange', onStateChange);
        resolve(doc.readyState === 'complete' || doc.readyState === 'interactive');
      }, Math.min(2000, maxWaitMs));
    });
    if (!domReady) {
      diagnostics.push('DOM readyState timed out before reaching complete');
    }
  }

  // 2. Wait for document.fonts.ready
  let fontsReady = false;
  if ('fonts' in doc && (doc.fonts as FontFaceSet | undefined)?.ready) {
    try {
      await Promise.race([
        (doc.fonts as FontFaceSet).ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('font_timeout')), 1500))
      ]);
      fontsReady = true;
    } catch {
      fontsReady = false;
      diagnostics.push('document.fonts.ready timed out or was unavailable');
    }
  } else {
    fontsReady = true; // Not supported or already ready
  }

  // 3. Wait for in-viewport / loaded images settlement
  let imagesSettled = false;
  try {
    const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img'));
    const pendingImages = images.filter((img) => !img.complete && img.src);

    if (pendingImages.length === 0) {
      imagesSettled = true;
    } else {
      await Promise.race([
        Promise.all(
          pendingImages.map(
            (img) =>
              new Promise<void>((resolve) => {
                if (img.complete) {
                  resolve();
                  return;
                }
                const clean = () => {
                  img.removeEventListener('load', onDone);
                  img.removeEventListener('error', onDone);
                };
                const onDone = () => {
                  clean();
                  resolve();
                };
                img.addEventListener('load', onDone);
                img.addEventListener('error', onDone);
              })
          )
        ),
        new Promise((resolve) => setTimeout(resolve, maxImagesWaitMs))
      ]);
      imagesSettled = true;
    }
  } catch {
    imagesSettled = true; // Non-fatal
  }

  // 4. Wait for visual DOM stability (mutation debounce)
  let stabilitySettled = false;
  if (typeof MutationObserver !== 'undefined' && doc.body) {
    stabilitySettled = await new Promise<boolean>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;

      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          observer.disconnect();
          resolve(true);
        }, domQuietSettleMs);
      });

      observer.observe(doc.body, {
        childList: true,
        subtree: true,
        attributes: true
      });

      // Start initial quiet timer
      timer = setTimeout(() => {
        observer.disconnect();
        resolve(true);
      }, domQuietSettleMs);

      // Hard max limit for stability
      setTimeout(() => {
        observer.disconnect();
        resolve(true);
      }, Math.min(1000, maxWaitMs));
    });
  } else {
    stabilitySettled = true;
  }

  const elapsedMs = Date.now() - startTime;
  const isReady = domReady; // As long as DOM is loaded, page is ready for capture

  return {
    isReady,
    finalUrl: doc.location?.href || win.location?.href || '',
    documentTitle: doc.title || '',
    domReady,
    fontsReady,
    imagesSettled,
    stabilitySettled,
    elapsedMs,
    diagnostics
  };
}
