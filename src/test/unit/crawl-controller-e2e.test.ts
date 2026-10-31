import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrawlController } from '../../background/crawl-controller';
import { TabManager } from '../../background/tab-manager';
import type { DiscoveredRoute } from '../../core/crawler/crawl-scope';

describe('CrawlController E2E Orchestration', () => {
  let createdTabs: any[];
  let nextTabId: number;
  let updateListeners: Set<(tabId: number, changeInfo: any, tab: any) => void>;
  let mockBrowserApi: any;

  beforeEach(() => {
    createdTabs = [];
    nextTabId = 100;
    updateListeners = new Set();

    mockBrowserApi = {
      tabs: {
        create: vi.fn().mockImplementation(async (createProps: any) => {
          const tab = {
            id: nextTabId++,
            url: createProps.url,
            active: createProps.active ?? false,
            windowId: 1
          };
          createdTabs.push(tab);

          // Asynchronously notify listeners that the tab finished loading
          setTimeout(() => {
            const finalUrl = tab.url.includes('/billing')
              ? 'https://example.com/login?redirect=%2Fbilling'
              : tab.url;

            for (const listener of updateListeners) {
              listener(tab.id, { status: 'complete', url: finalUrl }, { ...tab, url: finalUrl });
            }
          }, 8);

          return tab;
        }),
        remove: vi.fn().mockImplementation(async (tabId: number) => {
          const index = createdTabs.findIndex((t) => t.id === tabId);
          if (index !== -1) {
            createdTabs.splice(index, 1);
          }
        }),
        update: vi.fn().mockResolvedValue({}),
        query: vi.fn().mockResolvedValue([{ id: 999, windowId: 1, active: true }]),
        onUpdated: {
          addListener: vi.fn().mockImplementation((callback: any) => {
            updateListeners.add(callback);
          }),
          removeListener: vi.fn().mockImplementation((callback: any) => {
            updateListeners.delete(callback);
          })
        }
      },
      windows: {
        update: vi.fn().mockResolvedValue({})
      }
    };
  });

  function createMockRoutes(count: number): DiscoveredRoute[] {
    return Array.from({ length: count }, (_, i) => ({
      originalUrl: `https://example.com/page-${i + 1}`,
      canonicalUrl: `https://example.com/page-${i + 1}`,
      pathname: `/page-${i + 1}`,
      depth: 1,
      category: 'Main/Marketing' as const,
      navigationLabel: `Page ${i + 1}`,
      title: `Page Title ${i + 1}`,
      paginationNumber: null,
      discoverySource: 'anchor' as const,
      isDestructive: false,
      discoveryIndex: i,
      isSelected: true
    }));
  }

  it('successfully captures a single-page route (1 page)', async () => {
    const tabManager = new TabManager({ browserApi: mockBrowserApi });
    const routes = createMockRoutes(1);

    const controller = new CrawlController({
      jobId: 'job_crawl_1',
      routes,
      tabManager,
      concurrency: 1
    });

    const summary = await controller.start();

    expect(summary.state).toBe('completed');
    expect(summary.totalRoutes).toBe(1);
    expect(summary.completedRoutes).toBe(1);
    expect(summary.failedRoutes).toBe(0);
    expect(summary.redirectedRoutes).toBe(0);
    expect(summary.results[0]?.status).toBe('completed');
    expect(summary.results[0]?.sceneDocumentId).toContain('doc_job_crawl_1');
    // Ensure tab was closed
    expect(createdTabs.length).toBe(0);
  });

  it('orchestrates 5 pages with concurrency of 2 and cleans up all tabs', async () => {
    const tabManager = new TabManager({ browserApi: mockBrowserApi });
    const routes = createMockRoutes(5);

    const progressSnapshots: number[] = [];

    const controller = new CrawlController({
      jobId: 'job_crawl_5',
      routes,
      tabManager,
      concurrency: 2,
      onProgress: (p) => {
        progressSnapshots.push(p.percent);
      }
    });

    const summary = await controller.start();

    expect(summary.state).toBe('completed');
    expect(summary.totalRoutes).toBe(5);
    expect(summary.completedRoutes).toBe(5);
    expect(summary.failedRoutes).toBe(0);
    expect(summary.resourceUsage.pagesCompleted).toBe(5);
    expect(createdTabs.length).toBe(0);
    expect(progressSnapshots.length).toBeGreaterThan(0);
    expect(progressSnapshots[progressSnapshots.length - 1]).toBe(100);
  });

  it('scales to 25 pages within crawl limits', async () => {
    const tabManager = new TabManager({ browserApi: mockBrowserApi });
    const routes = createMockRoutes(25);

    const controller = new CrawlController({
      jobId: 'job_crawl_25',
      routes,
      tabManager,
      concurrency: 2,
      limits: {
        maxPages: 25
      }
    });

    const summary = await controller.start();

    expect(summary.state).toBe('completed');
    expect(summary.totalRoutes).toBe(25);
    expect(summary.completedRoutes).toBe(25);
    expect(summary.failedRoutes).toBe(0);
    expect(createdTabs.length).toBe(0);
  });

  it('gracefully handles login / SSO redirects and reports partial success', async () => {
    const tabManager = new TabManager({ browserApi: mockBrowserApi });
    const routes: DiscoveredRoute[] = [
      {
        originalUrl: 'https://example.com/dashboard',
        canonicalUrl: 'https://example.com/dashboard',
        pathname: '/dashboard',
        depth: 1,
        category: 'Dashboard/Application' as const,
        navigationLabel: 'Dashboard',
        paginationNumber: null,
        discoverySource: 'anchor' as const,
        isDestructive: false,
        discoveryIndex: 0,
        isSelected: true
      },
      {
        originalUrl: 'https://example.com/billing', // Simulates redirecting to /login
        canonicalUrl: 'https://example.com/billing',
        pathname: '/billing',
        depth: 1,
        category: 'Dashboard/Application' as const,
        navigationLabel: 'Billing',
        paginationNumber: null,
        discoverySource: 'anchor' as const,
        isDestructive: false,
        discoveryIndex: 1,
        isSelected: true
      },
      {
        originalUrl: 'https://example.com/settings',
        canonicalUrl: 'https://example.com/settings',
        pathname: '/settings',
        depth: 1,
        category: 'Dashboard/Application' as const,
        navigationLabel: 'Settings',
        paginationNumber: null,
        discoverySource: 'anchor' as const,
        isDestructive: false,
        discoveryIndex: 2,
        isSelected: true
      }
    ];

    const controller = new CrawlController({
      jobId: 'job_auth_redirect',
      routes,
      tabManager,
      concurrency: 1
    });

    const summary = await controller.start();

    expect(summary.state).toBe('partial');
    expect(summary.totalRoutes).toBe(3);
    expect(summary.completedRoutes).toBe(2);
    expect(summary.failedRoutes).toBe(0);
    expect(summary.redirectedRoutes).toBe(1);

    expect(summary.results[0]?.status).toBe('completed');
    expect(summary.results[1]?.status).toBe('redirected_to_auth');
    expect(summary.results[2]?.status).toBe('completed');

    expect(summary.warnings.some((w) => w.includes('billing'))).toBe(true);
    expect(createdTabs.length).toBe(0);
  });

  it('marks job as failed when zero pages succeed', async () => {
    const tabManager = new TabManager({ browserApi: mockBrowserApi });
    const routes = createMockRoutes(2);

    const controller = new CrawlController({
      jobId: 'job_all_fail',
      routes,
      tabManager,
      concurrency: 1,
      pageProcessor: async () => {
        return { success: false, error: 'Network 500 error' };
      }
    });

    const summary = await controller.start();

    expect(summary.state).toBe('failed');
    expect(summary.completedRoutes).toBe(0);
    expect(summary.failedRoutes).toBe(2);
  });

  it('supports pause, resume, and cancel controls', async () => {
    const tabManager = new TabManager({ browserApi: mockBrowserApi });
    const routes = createMockRoutes(4);

    let processedCount = 0;

    const controller = new CrawlController({
      jobId: 'job_pause_resume',
      routes,
      tabManager,
      concurrency: 1,
      pageProcessor: async () => {
        processedCount++;
        await new Promise((r) => setTimeout(r, 20));
        return { success: true };
      }
    });

    const runPromise = controller.start();

    // Pause quickly
    await new Promise((r) => setTimeout(r, 10));
    controller.pause();
    expect(controller.getState()).toBe('paused');

    await new Promise((r) => setTimeout(r, 30));
    const countAtPause = processedCount;

    // Resume
    controller.resume();
    expect(controller.getState()).toBe('running');

    // Cancel after resume
    await new Promise((r) => setTimeout(r, 25));
    await controller.cancel();
    expect(controller.getState()).toBe('cancelled');

    const summary = await runPromise;
    expect(summary.state).toBe('cancelled');
    expect(createdTabs.length).toBe(0);
  });

  it('restores user original active tab in foreground-assisted mode', async () => {
    const tabManager = new TabManager({ browserApi: mockBrowserApi });
    const routes = createMockRoutes(2);

    const controller = new CrawlController({
      jobId: 'job_fg_assisted',
      routes,
      tabManager,
      foregroundAssisted: true,
      concurrency: 1
    });

    const summary = await controller.start();

    expect(summary.state).toBe('completed');
    // Verify tabs.update was called to restore original active tab (id: 999)
    expect(mockBrowserApi.tabs.update).toHaveBeenCalledWith(999, { active: true });
    expect(createdTabs.length).toBe(0);
  });
});
