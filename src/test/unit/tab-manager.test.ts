import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TabManager } from '../../background/tab-manager';

describe('TabManager (Isolated Background & Foreground Tabs)', () => {
  let mockBrowserApi: any;
  let tabListeners: ((tabId: number, changeInfo: any, tab: any) => void)[] = [];

  beforeEach(() => {
    tabListeners = [];

    mockBrowserApi = {
      tabs: {
        create: vi.fn(async (createProperties: { url: string; active?: boolean }) => ({
          id: Math.floor(Math.random() * 1000) + 100,
          url: createProperties.url,
          active: Boolean(createProperties.active)
        })),
        query: vi.fn(async () => [{ id: 42, windowId: 1, active: true }]),
        update: vi.fn(async () => ({ id: 42, active: true })),
        remove: vi.fn(async () => undefined),
        onUpdated: {
          addListener: vi.fn((fn) => tabListeners.push(fn)),
          removeListener: vi.fn((fn) => {
            tabListeners = tabListeners.filter((l) => l !== fn);
          })
        }
      },
      windows: {
        update: vi.fn(async () => undefined)
      }
    };
  });

  it('opens an inactive background tab (active: false) and tracks it', async () => {
    const manager = new TabManager({ browserApi: mockBrowserApi });

    const managed = await manager.openBackgroundTab('https://example.com/about', 'job_1', 'route_1');

    expect(mockBrowserApi.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/about',
      active: false
    });
    expect(managed.isExtensionCreated).toBe(true);
    expect(managed.isForegroundAssisted).toBe(false);
    expect(managed.jobId).toBe('job_1');
    expect(manager.isManagedTab(managed.tabId)).toBe(true);
  });

  it('awaits tab loading completion and captures final redirected URL', async () => {
    const manager = new TabManager({ browserApi: mockBrowserApi });
    const managed = await manager.openBackgroundTab('https://example.com/blog', 'job_1', 'route_2');

    const loadPromise = manager.waitForTabLoaded(managed.tabId, 1000);

    // Simulate onUpdated firing
    for (const listener of tabListeners) {
      listener(
        managed.tabId,
        { status: 'complete', url: 'https://example.com/blog/latest' },
        { url: 'https://example.com/blog/latest' }
      );
    }

    const { finalUrl } = await loadPromise;
    expect(finalUrl).toBe('https://example.com/blog/latest');
    expect(managed.state).toBe('ready');
  });

  it('strictly protects user tabs and never removes non-extension tabs', async () => {
    const manager = new TabManager({ browserApi: mockBrowserApi });

    // Attempt to close user tab 999
    const closed = await manager.closeJobTab(999);
    expect(closed).toBe(false);
    expect(mockBrowserApi.tabs.remove).not.toHaveBeenCalled();
  });

  it('closes all managed tabs belonging to a specific job', async () => {
    const manager = new TabManager({ browserApi: mockBrowserApi });
    const tabA = await manager.openBackgroundTab('https://example.com/a', 'job_A', 'route_a');
    const tabB = await manager.openBackgroundTab('https://example.com/b', 'job_A', 'route_b');
    const tabC = await manager.openBackgroundTab('https://example.com/c', 'job_B', 'route_c');

    await manager.closeAllJobTabs('job_A');

    expect(manager.isManagedTab(tabA.tabId)).toBe(false);
    expect(manager.isManagedTab(tabB.tabId)).toBe(false);
    expect(manager.isManagedTab(tabC.tabId)).toBe(true); // job_B tab remains untouched
  });

  it('preserves and restores original active tab when using foreground-assisted mode', async () => {
    const manager = new TabManager({ browserApi: mockBrowserApi });

    const managed = await manager.openForegroundAssistedTab('https://example.com/app', 'job_1', 'route_1');
    expect(managed.isForegroundAssisted).toBe(true);
    expect(mockBrowserApi.tabs.create).toHaveBeenCalledWith({
      url: 'https://example.com/app',
      active: true
    });

    const restored = await manager.restoreOriginalActiveTab();
    expect(restored).toBe(true);
    expect(mockBrowserApi.tabs.update).toHaveBeenCalledWith(42, { active: true });
    expect(mockBrowserApi.windows.update).toHaveBeenCalledWith(1, { focused: true });
  });
});
