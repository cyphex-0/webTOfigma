import { browser, isFirefox } from './browser-api';

export interface BrowserCapabilities {
  supportsClipboardWrite: boolean;
  supportsScriptingApi: boolean;
  supportsLocalStorage: boolean;
  supportsOffscreenDocument: boolean;
  browserTarget: string;
}

/**
 * Perform non-destructive runtime capability detection
 */
export const detectBrowserCapabilities = (): BrowserCapabilities => {
  const hasScripting = typeof browser?.scripting !== 'undefined';
  const hasStorage = typeof browser?.storage?.local !== 'undefined';
  const hasOffscreen = typeof (browser as any)?.offscreen !== 'undefined';
  const hasClipboard = typeof navigator !== 'undefined' && typeof navigator.clipboard?.write !== 'undefined';

  return {
    supportsClipboardWrite: hasClipboard,
    supportsScriptingApi: hasScripting,
    supportsLocalStorage: hasStorage,
    supportsOffscreenDocument: hasOffscreen,
    browserTarget: isFirefox ? 'gecko-firefox' : 'chromium',
  };
};
