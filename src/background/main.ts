import { getBrowserTargetName } from '../shared/browser/browser-api';
import { registerMessageListeners } from './message-router';
import { jobRegistry } from './job-registry';

/**
 * Initializes shared background event routing and durable job recovery.
 * Synchronous listener registration occurs immediately on module evaluation.
 */
export function initializeSharedBackground(): void {
  const target = getBrowserTargetName();
  console.log(`[WebToFigma] Background service initialized on ${target}. (Phase 2 MV3 Runtime)`);

  // 1. Register message listeners synchronously before any async operations
  registerMessageListeners();

  // 2. Asynchronously recover or prune any stale in-flight jobs from storage
  void jobRegistry.initialize();
}
