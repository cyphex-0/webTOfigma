import { describe, it, expect, vi } from 'vitest';
import {
  JobCancellationToken,
  JobCancelledError
} from '../../core/capture/job-cancellation';
import {
  processWithYielding,
  yieldToEventLoop
} from '../../core/dom/yielding-traversal';

describe('Job Cancellation & Cooperative Yielding (Phase 22)', () => {
  it('triggers cancellation and notifies registered callbacks', () => {
    const token = new JobCancellationToken('job_test');
    expect(token.isCancelled).toBe(false);

    const callback = vi.fn();
    token.onCancel(callback);

    token.cancel('User clicked Cancel Export');
    expect(token.isCancelled).toBe(true);
    expect(token.reason).toBe('User clicked Cancel Export');
    expect(callback).toHaveBeenCalledWith('User clicked Cancel Export');

    expect(() => token.throwIfCancelled()).toThrow(JobCancelledError);
  });

  it('propagates cancellation down to child tokens hierarchically', () => {
    const parent = new JobCancellationToken('parent');
    const child = parent.createChildToken('child');

    expect(child.isCancelled).toBe(false);

    parent.cancel('Parent cancelled');
    expect(child.isCancelled).toBe(true);
    expect(child.reason).toBe('Parent cancelled');
  });

  it('processes items in chunks and halts on cancellation signal', async () => {
    const token = new JobCancellationToken();
    const items = Array.from({ length: 15 }, (_, i) => i);

    // Cancel halfway
    const results = await processWithYielding(
      items.slice(0, 5),
      (item) => item * 2,
      { chunkSize: 2, signal: token.signal }
    );
    expect(results).toEqual([0, 2, 4, 6, 8]);

    token.cancel('Aborted');

    await expect(
      processWithYielding(items, (item) => item * 2, {
        chunkSize: 2,
        signal: token.signal
      })
    ).rejects.toThrow(JobCancelledError);
  });

  it('yields to the event loop cleanly', async () => {
    await expect(yieldToEventLoop()).resolves.toBeUndefined();
  });
});
