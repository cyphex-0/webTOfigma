/**
 * Minibar Teardown & Lifecycle Coordinator.
 * Safely unmounts React, tears down event listeners, and removes host elements from the DOM.
 */

export const MINIBAR_HOST_ID = 'web-to-figma-minibar-host';

// Global hooks for active React root and controllers
let activeUnmountFn: (() => void) | null = null;
let activeCleanupFn: (() => void) | null = null;

export function registerMinibarCleanup(unmountFn: () => void, cleanupFn?: () => void): void {
  activeUnmountFn = unmountFn;
  if (cleanupFn) {
    activeCleanupFn = cleanupFn;
  }
}

/**
 * Removes the in-page minibar and cleans up all listeners and DOM nodes.
 * Safe to invoke repeatedly or when minibar is not currently injected.
 */
export function teardownMinibar(): boolean {
  let wasRemoved = false;

  try {
    if (activeCleanupFn) {
      activeCleanupFn();
      activeCleanupFn = null;
    }

    if (activeUnmountFn) {
      activeUnmountFn();
      activeUnmountFn = null;
    }

    if (typeof document !== 'undefined') {
      const host = document.getElementById(MINIBAR_HOST_ID);
      if (host) {
        host.remove();
        wasRemoved = true;
      }
    }
  } catch (err) {
    console.warn('[WebToFigma] Error during minibar teardown:', err);
  }

  return wasRemoved;
}

/**
 * Checks whether minibar is currently present in the document.
 */
export function isMinibarInjected(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.getElementById(MINIBAR_HOST_ID));
}
