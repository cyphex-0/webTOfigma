/**
 * Tab Manager for isolated extension-created background tabs and foreground-assisted capture.
 * Strictly protects the user's browsing session: only opens inactive tabs by default,
 * tracks extension-created tabs, and NEVER navigates or closes user-owned tabs.
 */

import { browser as defaultBrowser } from '../shared/browser/browser-api';

export type ManagedTabState = 'opening' | 'loading' | 'ready' | 'capturing' | 'closed';

export interface ManagedTab {
  tabId: number;
  jobId: string;
  routeId: string;
  url: string;
  createdTime: number;
  isExtensionCreated: true;
  isForegroundAssisted: boolean;
  state: ManagedTabState;
  finalUrl?: string | undefined;
}

export interface TabManagerOptions {
  browserApi?: any;
}

export class TabManager {
  private readonly browserApi: any;
  private readonly managedTabs = new Map<number, ManagedTab>();
  private originalActiveTabId: number | null = null;
  private originalWindowId: number | null = null;

  constructor(options?: TabManagerOptions) {
    this.browserApi = options?.browserApi ?? defaultBrowser;
  }

  /**
   * Opens an extension-managed inactive background tab for the specified route.
   */
  public async openBackgroundTab(
    url: string,
    jobId: string,
    routeId: string
  ): Promise<ManagedTab> {
    const tab = await this.browserApi.tabs.create({
      url,
      active: false
    });

    const tabId = tab.id ?? tab.tabId;
    if (tabId === undefined || tabId === null) {
      throw new Error(`Failed to create background tab for URL: ${url}`);
    }

    const managed: ManagedTab = {
      tabId,
      jobId,
      routeId,
      url,
      createdTime: Date.now(),
      isExtensionCreated: true,
      isForegroundAssisted: false,
      state: 'opening'
    };

    this.managedTabs.set(tabId, managed);
    return managed;
  }

  /**
   * Opens an extension-managed foreground-assisted tab when user explicitly opts in.
   * Preserves original active tab identity to restore focus after capture.
   */
  public async openForegroundAssistedTab(
    url: string,
    jobId: string,
    routeId: string
  ): Promise<ManagedTab> {
    // Save original active tab if not already preserved
    if (this.originalActiveTabId === null) {
      try {
        const queryResults = await this.browserApi.tabs.query({ active: true, currentWindow: true });
        const currentActive = queryResults[0];
        if (currentActive?.id) {
          this.originalActiveTabId = currentActive.id;
          this.originalWindowId = currentActive.windowId ?? null;
        }
      } catch {
        // Non-fatal
      }
    }

    const tab = await this.browserApi.tabs.create({
      url,
      active: true
    });

    const tabId = tab.id ?? tab.tabId;
    if (tabId === undefined || tabId === null) {
      throw new Error(`Failed to create foreground tab for URL: ${url}`);
    }

    const managed: ManagedTab = {
      tabId,
      jobId,
      routeId,
      url,
      createdTime: Date.now(),
      isExtensionCreated: true,
      isForegroundAssisted: true,
      state: 'opening'
    };

    this.managedTabs.set(tabId, managed);
    return managed;
  }

  /**
   * Awaits tab navigation completion (browser.tabs.onUpdated with status === 'complete').
   */
  public async waitForTabLoaded(
    tabId: number,
    timeoutMs: number = 20_000
  ): Promise<{ finalUrl: string }> {
    const managed = this.managedTabs.get(tabId);
    if (!managed) {
      throw new Error(`Tab ${tabId} is not managed by this extension.`);
    }

    managed.state = 'loading';

    return new Promise<{ finalUrl: string }>((resolve, reject) => {
      let timeoutTimer: ReturnType<typeof setTimeout>;

      const listener = (
        updatedTabId: number,
        changeInfo: { status?: string; url?: string },
        tab: { url?: string }
      ) => {
        if (updatedTabId === tabId) {
          if (changeInfo.url) {
            managed.finalUrl = changeInfo.url;
          }
          if (changeInfo.status === 'complete') {
            cleanup();
            managed.state = 'ready';
            const finalUrl = changeInfo.url || tab?.url || managed.url;
            managed.finalUrl = finalUrl;
            resolve({ finalUrl });
          }
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutTimer);
        try {
          this.browserApi.tabs.onUpdated.removeListener(listener);
        } catch {
          // Ignore
        }
      };

      try {
        this.browserApi.tabs.onUpdated.addListener(listener);
      } catch (err) {
        reject(new Error(`Failed to attach onUpdated listener: ${String(err)}`));
        return;
      }

      timeoutTimer = setTimeout(() => {
        cleanup();
        // Even if timeout occurs, mark as ready to allow best-effort inspection
        managed.state = 'ready';
        resolve({ finalUrl: managed.finalUrl || managed.url });
      }, timeoutMs);
    });
  }

  /**
   * Safely closes an extension-created tab. Strictly ignores user-owned tabs.
   */
  public async closeJobTab(tabId: number): Promise<boolean> {
    const managed = this.managedTabs.get(tabId);
    if (!managed || !managed.isExtensionCreated) {
      // NEVER close tabs that this extension did not create!
      return false;
    }

    try {
      await this.browserApi.tabs.remove(tabId);
    } catch {
      // Ignore if tab was already closed by user
    } finally {
      managed.state = 'closed';
      this.managedTabs.delete(tabId);
    }

    return true;
  }

  /**
   * Closes all tabs associated with a specific job (or all managed tabs).
   */
  public async closeAllJobTabs(jobId?: string): Promise<void> {
    const tabIdsToClose: number[] = [];

    for (const [tabId, managed] of this.managedTabs.entries()) {
      if (!jobId || managed.jobId === jobId) {
        tabIdsToClose.push(tabId);
      }
    }

    await Promise.all(tabIdsToClose.map((id) => this.closeJobTab(id)));
  }

  /**
   * Restores focus to the user's original active tab if foreground-assisted mode was used.
   */
  public async restoreOriginalActiveTab(): Promise<boolean> {
    if (this.originalActiveTabId === null) {
      return false;
    }

    const tabIdToRestore = this.originalActiveTabId;
    this.originalActiveTabId = null;

    try {
      await this.browserApi.tabs.update(tabIdToRestore, { active: true });
      if (this.originalWindowId !== null) {
        await this.browserApi.windows.update(this.originalWindowId, { focused: true });
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns metadata for all currently managed tabs.
   */
  public getManagedTabs(): ManagedTab[] {
    return Array.from(this.managedTabs.values());
  }

  /**
   * Checks whether a tab is managed by this extension.
   */
  public isManagedTab(tabId: number): boolean {
    return this.managedTabs.has(tabId);
  }
}
