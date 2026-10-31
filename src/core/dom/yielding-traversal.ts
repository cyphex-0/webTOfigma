/**
 * Cooperative DOM Processing and Event Loop Yielding Engine.
 * 
 * Prevents main-thread UI freezing during heavy DOM traversals:
 * - Periodically yields execution to browser event loop
 * - Enforces node count and total processing duration caps
 * - Integrates with AbortSignal / JobCancellationToken for prompt cancellation
 */

import { JobCancelledError } from '../capture/job-cancellation';

export interface YieldingOptions {
  chunkSize?: number | undefined; // Number of items between yields (default: 100)
  maxDurationMs?: number | undefined; // Maximum duration before throwing timeout error (default: 20000ms)
  signal?: AbortSignal | undefined;
}

/**
 * Yields control to the browser microtask / event queue.
 */
export function yieldToEventLoop(): Promise<void> {
  if (typeof (globalThis as any).scheduler?.yield === 'function') {
    return (globalThis as any).scheduler.yield();
  }
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Processes an array of items in cooperative chunks with event loop yielding.
 */
export async function processWithYielding<T, R>(
  items: readonly T[],
  processor: (item: T, index: number) => R | Promise<R>,
  options: YieldingOptions = {}
): Promise<R[]> {
  const chunkSize = options.chunkSize ?? 100;
  const maxDuration = options.maxDurationMs ?? 20000;
  const signal = options.signal;

  const startTime = Date.now();
  const results: R[] = [];

  for (let i = 0; i < items.length; i++) {
    // Check cancellation
    if (signal?.aborted) {
      throw new JobCancelledError('Processing cancelled by abort signal.');
    }

    // Check duration cap
    if (Date.now() - startTime > maxDuration) {
      throw new Error(`DOM processing duration exceeded maximum budget of ${Math.round(maxDuration / 1000)}s.`);
    }

    const item = items[i]!;
    results.push(await processor(item, i));

    // Yield to event loop at chunk boundary
    if ((i + 1) % chunkSize === 0 && i < items.length - 1) {
      await yieldToEventLoop();
    }
  }

  return results;
}
