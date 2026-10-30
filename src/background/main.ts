import { browser, getBrowserTargetName } from '../shared/browser/browser-api';

export function initializeSharedBackground(): void {
  const target = getBrowserTargetName();
  console.log(`[WebToFigma] Background service initialized on ${target}. (Phase 0 Baseline)`);

  // Register message listener synchronously at module evaluation
  browser.runtime.onMessage.addListener((message: unknown) => {
    if (typeof message === 'object' && message !== null && (message as any).type === 'PING') {
      return Promise.resolve({
        status: 'PONG',
        target,
        timestamp: Date.now(),
      });
    }
    return undefined;
  });

  // Handle extension installation/update
  browser.runtime.onInstalled.addListener((details) => {
    console.log(`[WebToFigma] Extension event: ${details.reason}`);
  });
}
