import { browser, isFirefox } from './browser-api';

export interface BrowserCapabilities {
  supportsClipboardWrite: boolean;
  supportsScriptingApi: boolean;
  supportsLocalStorage: boolean;
  supportsOffscreenDocument: boolean;
  browserTarget: string;
}

export interface UrlInjectabilityResult {
  injectable: boolean;
  reason?: string;
}

/**
 * Validates whether a tab URL can be injected with a content script.
 * Enforces browser security boundaries:
 * - Prevents injection into chrome://, edge://, about:, brave://, file:, data:
 * - Prevents injection into extension web stores (Chrome Web Store, AMO, Edge Add-ons)
 * - Prevents injection into PDF viewer documents
 */
export function isInjectableUrl(url: string | undefined | null): UrlInjectabilityResult {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return {
      injectable: false,
      reason: 'Empty or undefined URL.'
    };
  }

  const cleanUrl = url.trim();

  // 1. Browser internal system schemes
  const restrictedSchemes = [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'brave://',
    'about:',
    'view-source:',
    'data:',
    'blob:',
    'filesystem:',
    'devtools://',
    'javascript:'
  ];

  for (const scheme of restrictedSchemes) {
    if (cleanUrl.toLowerCase().startsWith(scheme)) {
      return {
        injectable: false,
        reason: `Browser security restricts script execution on "${scheme}" pages.`
      };
    }
  }

  // 2. Parse URL host
  let parsed: URL;
  try {
    parsed = new URL(cleanUrl);
  } catch {
    return {
      injectable: false,
      reason: 'Malformed or invalid URL.'
    };
  }

  // Only http: and https: are allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      injectable: false,
      reason: `Unsupported protocol "${parsed.protocol}". Only HTTP and HTTPS sites are supported.`
    };
  }

  const host = parsed.hostname.toLowerCase();

  // 3. Extension Web Stores
  const restrictedHosts = [
    'chromewebstore.google.com',
    'chrome.google.com',
    'addons.mozilla.org',
    'microsoftedge.microsoft.com'
  ];

  for (const restrictedHost of restrictedHosts) {
    if (host === restrictedHost || host.endsWith(`.${restrictedHost}`)) {
      if (
        restrictedHost !== 'chrome.google.com' ||
        parsed.pathname.startsWith('/webstore')
      ) {
        return {
          injectable: false,
          reason: 'Browser policy blocks extensions from injecting into Web Store catalogs.'
        };
      }
    }
  }

  // 4. PDF files
  if (parsed.pathname.toLowerCase().endsWith('.pdf')) {
    return {
      injectable: false,
      reason: 'Target is a PDF document, which does not contain an inspectable HTML DOM tree.'
    };
  }

  return {
    injectable: true
  };
}

/**
 * Perform non-destructive runtime capability detection
 */
export const detectBrowserCapabilities = (): BrowserCapabilities => {
  const hasScripting = typeof browser?.scripting !== 'undefined';
  const hasStorage = typeof browser?.storage?.local !== 'undefined';
  const hasOffscreen = typeof (browser as unknown as { offscreen?: unknown })?.offscreen !== 'undefined';
  const hasClipboard =
    typeof navigator !== 'undefined' &&
    typeof navigator.clipboard !== 'undefined' &&
    typeof navigator.clipboard.write !== 'undefined';

  return {
    supportsClipboardWrite: hasClipboard,
    supportsScriptingApi: hasScripting,
    supportsLocalStorage: hasStorage,
    supportsOffscreenDocument: hasOffscreen,
    browserTarget: isFirefox ? 'gecko-firefox' : 'chromium'
  };
};
