import { describe, it, expect, vi } from 'vitest';
import { RouteQueue, PersistedQueueSnapshot } from '../../background/route-queue';
import { DiscoveredRoute } from '../../core/crawler/crawl-scope';

describe('RouteQueue (FIFO Concurrency & Worker Recovery)', () => {
  const sampleRoutes: DiscoveredRoute[] = [
    {
      canonicalUrl: 'https://example.com/page1',
      originalUrl: 'https://example.com/page1',
      pathname: '/page1',
      title: 'Page 1',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Main/Marketing',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 1,
      isSelected: true
    },
    {
      canonicalUrl: 'https://example.com/page2',
      originalUrl: 'https://example.com/page2',
      pathname: '/page2',
      title: 'Page 2',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Main/Marketing',
      paginationNumber: 2,
      isDestructive: false,
      discoveryIndex: 2,
      isSelected: true
    },
    {
      canonicalUrl: 'https://example.com/page3',
      originalUrl: 'https://example.com/page3',
      pathname: '/page3',
      title: 'Page 3',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Main/Marketing',
      paginationNumber: 3,
      isDestructive: false,
      discoveryIndex: 3,
      isSelected: true
    }
  ];

  it('processes routes sequentially with concurrency 1', async () => {
    const queue = new RouteQueue({
      jobId: 'job_queue_1',
      routes: sampleRoutes,
      concurrency: 1
    });

    const executionOrder: string[] = [];
    let concurrentWorkers = 0;
    let maxObservedConcurrency = 0;

    queue.setProcessor(async (item) => {
      concurrentWorkers++;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrentWorkers);
      executionOrder.push(item.url);
      await new Promise((r) => setTimeout(r, 20));
      concurrentWorkers--;
      return { success: true, sceneDocumentId: `doc_${item.routeId}` };
    });

    await queue.start();

    // Await completion
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (queue.getState() === 'completed') {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    expect(executionOrder).toEqual([
      'https://example.com/page1',
      'https://example.com/page2',
      'https://example.com/page3'
    ]);
    expect(maxObservedConcurrency).toBe(1);
    expect(queue.getProgress().completed).toBe(3);
  });

  it('supports concurrency 2 and never exceeds cap of 2', async () => {
    const queue = new RouteQueue({
      jobId: 'job_queue_2',
      routes: sampleRoutes,
      concurrency: 5 // Requests 5, but must be capped at 2
    });

    let concurrentWorkers = 0;
    let maxObservedConcurrency = 0;

    queue.setProcessor(async () => {
      concurrentWorkers++;
      maxObservedConcurrency = Math.max(maxObservedConcurrency, concurrentWorkers);
      await new Promise((r) => setTimeout(r, 30));
      concurrentWorkers--;
      return { success: true };
    });

    await queue.start();

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (queue.getState() === 'completed') {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
  });

  it('handles pause, resume, and cancel controls properly', async () => {
    const queue = new RouteQueue({
      jobId: 'job_queue_3',
      routes: sampleRoutes,
      concurrency: 1
    });

    let processedCount = 0;

    queue.setProcessor(async () => {
      processedCount++;
      await new Promise((r) => setTimeout(r, 20));
      return { success: true };
    });

    await queue.start();
    // Pause immediately
    queue.pause();
    expect(queue.getState()).toBe('paused');

    // Wait 50ms: only 1 in-flight item should finish
    await new Promise((r) => setTimeout(r, 50));
    expect(processedCount).toBe(1);

    // Resume
    queue.resume();
    expect(queue.getState()).toBe('running');

    // Cancel before 3rd item
    queue.cancel();
    expect(queue.getState()).toBe('cancelled');

    const items = queue.getItems();
    expect(items.some((i) => i.status === 'cancelled')).toBe(true);
  });

  it('continues execution after individual page failure or auth redirect', async () => {
    const queue = new RouteQueue({
      jobId: 'job_queue_4',
      routes: sampleRoutes,
      concurrency: 1
    });

    queue.setProcessor(async (item) => {
      if (item.url.includes('page1')) {
        return { success: false, error: 'Network timeout' };
      }
      if (item.url.includes('page2')) {
        return { success: false, isAuthRedirect: true, error: 'Redirected to SSO' };
      }
      return { success: true, sceneDocumentId: 'doc_ok' };
    });

    await queue.start();

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (queue.getState() === 'completed') {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    const progress = queue.getProgress();
    expect(progress.completed).toBe(1);
    expect(progress.failed).toBe(2);

    const items = queue.getItems();
    expect(items[0]?.status).toBe('failed');
    expect(items[1]?.status).toBe('redirected_to_auth');
    expect(items[2]?.status).toBe('completed');
  });

  it('restores queue state from snapshot after worker restart without re-running completed items', async () => {
    const snapshot: PersistedQueueSnapshot = {
      jobId: 'job_restore_1',
      state: 'running',
      concurrency: 1,
      items: [
        {
          routeId: 'r_1',
          url: 'https://example.com/page1',
          canonicalUrl: 'https://example.com/page1',
          category: 'Main',
          depth: 1,
          paginationNumber: null,
          status: 'completed',
          attempts: 1,
          sceneDocumentId: 'doc_1'
        },
        {
          routeId: 'r_2',
          url: 'https://example.com/page2',
          canonicalUrl: 'https://example.com/page2',
          category: 'Main',
          depth: 1,
          paginationNumber: null,
          status: 'in-progress', // was in-flight when worker died
          attempts: 1
        }
      ],
      updatedAt: Date.now()
    };

    const queue = new RouteQueue({
      jobId: 'job_restore_1',
      routes: sampleRoutes.slice(0, 2),
      concurrency: 1
    });

    queue.restoreFromSnapshot(snapshot);

    const restoredItems = queue.getItems();
    expect(restoredItems[0]?.status).toBe('completed');
    expect(restoredItems[1]?.status).toBe('pending'); // Reset to pending for retry!

    const executedUrls: string[] = [];
    queue.setProcessor(async (item) => {
      executedUrls.push(item.url);
      return { success: true, sceneDocumentId: 'doc_2' };
    });

    await queue.start();

    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (queue.getState() === 'completed') {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });

    // Only page2 was re-executed! page1 was not repeated!
    expect(executedUrls).toEqual(['https://example.com/page2']);
  });
});
