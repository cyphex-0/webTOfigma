import browser from 'webextension-polyfill';

export { browser };

/**
 * Safe runtime browser family identification
 */
export const isFirefox =
  typeof navigator !== 'undefined' && /firefox/i.test(navigator.userAgent);

export const isChromium = !isFirefox;

export const getBrowserTargetName = (): string => {
  if (isFirefox) return 'Firefox';
  if (typeof navigator !== 'undefined') {
    if (/edg/i.test(navigator.userAgent)) return 'Microsoft Edge';
    if ((navigator as any).brave) return 'Brave';
    if (/chrome/i.test(navigator.userAgent)) return 'Google Chrome';
  }
  return 'Chromium';
};
