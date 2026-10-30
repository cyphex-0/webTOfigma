import { browser } from '../shared/browser/browser-api';

/**
 * Baseline Content Script
 * Injected into permitted web contexts.
 * Purely local, executes zero network requests.
 */
(() => {
  console.log('[WebToFigma] Content script loaded. (Phase 0 Baseline)');

  browser.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message === 'object' && message !== null && (message as any).type === 'CONTENT_PING') {
      return Promise.resolve({
        status: 'CONTENT_PONG',
        location: window.location.href,
        title: document.title,
      });
    }
    return undefined;
  });
})();
