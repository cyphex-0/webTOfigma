/**
 * Multi-Page Crawl Orchestrator and Queue Controller.
 * 
 * Coordinates multi-page exports across:
 * - Isolated Tab Manager (background inactive tabs & foreground-assisted tabs)
 * - Durable Route Queue with concurrency, pause/resume, and retry
 * - Session guards (login/SSO detection & access-denied skipping)
 * - Resource limits & quotas (page caps, timeouts, DOM node budgets)
 * - Progress tracking with live completion, failure, and partial states
 */

import type { DiscoveredRoute } from '../core/crawler/crawl-scope';
import {
  CrawlResourceLimits,
  CrawlResourceUsage,
  checkCrawlLimits,
  createDefaultCrawlLimits,
  createInitialCrawlUsage,
  recordPageCompletion
} from '../core/crawler/crawl-limits';
import { evaluatePageSession } from '../core/crawler/page-session';
import { TabManager, ManagedTab } from './tab-manager';
import {
  RouteQueue,
  RouteQueueItem,
  RouteQueueProgress,
  PersistedQueueSnapshot
} from './route-queue';
import type { CaptureStorage } from '../core/storage/capture-database';

export type CrawlJobState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'partial'
  | 'failed'
  | 'cancelled';

export interface CrawlJobProgress {
  jobId: string;
  state: CrawlJobState;
  total: number;
  completed: number;
  failed: number;
  redirected: number;
  pending: number;
  inProgress: number;
  percent: number;
  currentUrl?: string | undefined;
  resourceUsage: CrawlResourceUsage;
}

export interface CrawlJobResultItem {
  routeId: string;
  url: string;
  canonicalUrl: string;
  title?: string | undefined;
  category?: string | undefined;
  status: RouteQueueItem['status'];
  sceneDocumentId?: string | undefined;
  error?: string | undefined;
}

export interface CrawlJobSummary {
  jobId: string;
  state: 'completed' | 'partial' | 'failed' | 'cancelled';
  totalRoutes: number;
  completedRoutes: number;
  failedRoutes: number;
  redirectedRoutes: number;
  results: readonly CrawlJobResultItem[];
  resourceUsage: CrawlResourceUsage;
  warnings: readonly string[];
}

export type PageProcessorFn = (
  item: RouteQueueItem,
  tabId: number
) => Promise<{
  success: boolean;
  sceneDocumentId?: string | undefined;
  domNodeCount?: number | undefined;
  assetBytes?: number | undefined;
  isAuthRedirect?: boolean | undefined;
  error?: string | undefined;
}>;

export interface CrawlControllerOptions {
  jobId: string;
  routes: readonly DiscoveredRoute[];
  limits?: Partial<CrawlResourceLimits> | undefined;
  concurrency?: number | undefined; // Default 1, max 2
  foregroundAssisted?: boolean | undefined;
  tabManager?: TabManager | undefined;
  storage?: CaptureStorage | undefined;
  pageProcessor?: PageProcessorFn | undefined;
  onProgress?: ((progress: CrawlJobProgress) => void) | undefined;
  onStateChange?: ((state: CrawlJobState) => void) | undefined;
}

export class CrawlController {
  private readonly jobId: string;
  private readonly limits: CrawlResourceLimits;
  private readonly foregroundAssisted: boolean;
  private readonly tabManager: TabManager;
  private readonly queue: RouteQueue;
  private readonly pageProcessor?: PageProcessorFn | undefined;
  private readonly onProgressCallback?: ((progress: CrawlJobProgress) => void) | undefined;
  private readonly onStateChangeCallback?: ((state: CrawlJobState) => void) | undefined;

  private state: CrawlJobState = 'idle';
  private resourceUsage: CrawlResourceUsage;
  private warnings: string[] = [];
  private activeUrl: string | undefined = undefined;

  constructor(options: CrawlControllerOptions) {
    this.jobId = options.jobId;
    this.limits = createDefaultCrawlLimits(options.limits);
    this.foregroundAssisted = options.foregroundAssisted ?? false;
    this.tabManager = options.tabManager ?? new TabManager();
    this.pageProcessor = options.pageProcessor;
    this.onProgressCallback = options.onProgress;
    this.onStateChangeCallback = options.onStateChange;
    this.resourceUsage = createInitialCrawlUsage();

    this.queue = new RouteQueue({
      jobId: options.jobId,
      routes: options.routes,
      concurrency: options.concurrency ?? 1,
      onProgress: (_qProgress: RouteQueueProgress) => {
        this.emitProgress();
      }
    });

    this.setupProcessor();
  }

  private setupProcessor(): void {
    this.queue.setProcessor(async (item) => {
      if (this.state === 'cancelled') {
        return { success: false, error: 'Job was cancelled.' };
      }

      this.activeUrl = item.url;
      this.emitProgress();

      // 1. Enforce crawl resource budget before launching next page
      const limitCheck = checkCrawlLimits(this.limits, this.resourceUsage);
      if (limitCheck.isExceeded) {
        const warningMsg = `Crawl limits exceeded: ${limitCheck.message}`;
        this.warnings.push(warningMsg);
        this.resourceUsage = recordPageCompletion(this.resourceUsage, 0, 0, false);
        return { success: false, error: limitCheck.message };
      }

      let openedTab: ManagedTab | null = null;
      try {
        // 2. Open isolated background or foreground-assisted tab
        if (this.foregroundAssisted) {
          openedTab = await this.tabManager.openForegroundAssistedTab(
            item.url,
            this.jobId,
            item.routeId
          );
        } else {
          openedTab = await this.tabManager.openBackgroundTab(
            item.url,
            this.jobId,
            item.routeId
          );
        }

        // 3. Await tab navigation
        const loadedInfo = await this.tabManager.waitForTabLoaded(
          openedTab.tabId,
          this.limits.perPageTimeoutMs
        );

        // 4. Session authentication & login redirect guard
        const finalUrl = loadedInfo.finalUrl || item.url;
        const sessionEval = evaluatePageSession({
          requestedUrl: item.url,
          finalUrl
        });

        if (sessionEval.isAuthRedirect || sessionEval.isAccessDenied) {
          const reason = sessionEval.reason || 'Authentication or SSO redirect encountered.';
          this.warnings.push(`Skipped route ${item.url}: ${reason}`);
          this.resourceUsage = recordPageCompletion(this.resourceUsage, 0, 0, false);
          return {
            success: false,
            isAuthRedirect: true,
            error: reason
          };
        }

        // 5. Execute page processing
        if (this.pageProcessor) {
          const procResult = await this.pageProcessor(item, openedTab.tabId);
          if (procResult.isAuthRedirect) {
            this.resourceUsage = recordPageCompletion(this.resourceUsage, 0, 0, false);
            return {
              success: false,
              isAuthRedirect: true,
              error: procResult.error || 'Authentication redirect detected during processing.'
            };
          }

          if (procResult.success) {
            this.resourceUsage = recordPageCompletion(
              this.resourceUsage,
              procResult.domNodeCount ?? 100,
              procResult.assetBytes ?? 1000,
              true
            );
            return {
              success: true,
              sceneDocumentId: procResult.sceneDocumentId
            };
          } else {
            this.resourceUsage = recordPageCompletion(this.resourceUsage, 0, 0, false);
            return {
              success: false,
              error: procResult.error || 'Page processing failed.'
            };
          }
        }

        // Default fallback processor (synthesizes scene document)
        const sceneDocumentId = `doc_${this.jobId}_${item.routeId}`;
        this.resourceUsage = recordPageCompletion(this.resourceUsage, 120, 25000, true);
        return {
          success: true,
          sceneDocumentId
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        this.resourceUsage = recordPageCompletion(this.resourceUsage, 0, 0, false);
        return {
          success: false,
          error: errorMsg
        };
      } finally {
        // 6. Strictly close extension-created tab
        if (openedTab) {
          await this.tabManager.closeJobTab(openedTab.tabId);
        }
      }
    });
  }

  /**
   * Starts multi-page crawl execution and resolves with the final job summary.
   */
  public async start(): Promise<CrawlJobSummary> {
    if (this.state === 'running') {
      throw new Error(`Crawl job ${this.jobId} is already running.`);
    }

    this.transitionState('running');
    await this.queue.start();
    await this.queue.waitForCompletion();

    return this.finishJob();
  }

  /**
   * Pauses the queue. In-flight pages run to completion.
   */
  public pause(): void {
    if (this.state !== 'running') {
      return;
    }
    this.queue.pause();
    this.transitionState('paused');
  }

  /**
   * Resumes a paused crawl job.
   */
  public resume(): void {
    if (this.state !== 'paused') {
      return;
    }
    this.queue.resume();
    this.transitionState('running');
  }

  /**
   * Cancels the crawl job and closes any open tabs.
   */
  public async cancel(): Promise<void> {
    this.queue.cancel();
    this.transitionState('cancelled');
    await this.tabManager.closeAllJobTabs(this.jobId);
    if (this.foregroundAssisted) {
      await this.tabManager.restoreOriginalActiveTab();
    }
    this.emitProgress();
  }

  /**
   * Restores queue state from a persisted snapshot.
   */
  public restoreFromSnapshot(snapshot: PersistedQueueSnapshot): void {
    this.queue.restoreFromSnapshot(snapshot);
    this.emitProgress();
  }

  public getState(): CrawlJobState {
    return this.state;
  }

  public getProgress(): CrawlJobProgress {
    const qProgress = this.queue.getProgress();
    const redirected = this.queue
      .getItems()
      .filter((i) => i.status === 'redirected_to_auth').length;

    return {
      jobId: this.jobId,
      state: this.state,
      total: qProgress.total,
      completed: qProgress.completed,
      failed: qProgress.failed,
      redirected,
      pending: qProgress.pending,
      inProgress: qProgress.inProgress,
      percent: qProgress.percent,
      currentUrl: this.activeUrl,
      resourceUsage: { ...this.resourceUsage }
    };
  }

  public getSummary(): CrawlJobSummary {
    const items = this.queue.getItems();
    const totalRoutes = items.length;
    const completedRoutes = items.filter((i) => i.status === 'completed').length;
    const failedRoutes = items.filter((i) => i.status === 'failed').length;
    const redirectedRoutes = items.filter((i) => i.status === 'redirected_to_auth').length;

    let computedState: 'completed' | 'partial' | 'failed' | 'cancelled';
    if (this.state === 'cancelled') {
      computedState = 'cancelled';
    } else if (totalRoutes === 0 || completedRoutes === totalRoutes) {
      computedState = 'completed';
    } else if (completedRoutes > 0) {
      computedState = 'partial';
    } else {
      computedState = 'failed';
    }

    const results: CrawlJobResultItem[] = items.map((i) => ({
      routeId: i.routeId,
      url: i.url,
      canonicalUrl: i.canonicalUrl,
      title: i.title,
      category: i.category,
      status: i.status,
      sceneDocumentId: i.sceneDocumentId,
      error: i.error
    }));

    return {
      jobId: this.jobId,
      state: computedState,
      totalRoutes,
      completedRoutes,
      failedRoutes,
      redirectedRoutes,
      results,
      resourceUsage: { ...this.resourceUsage },
      warnings: [...this.warnings]
    };
  }

  private async finishJob(): Promise<CrawlJobSummary> {
    const summary = this.getSummary();
    this.transitionState(summary.state);

    // Guaranteed cleanup of any leftover tabs
    await this.tabManager.closeAllJobTabs(this.jobId);
    if (this.foregroundAssisted) {
      await this.tabManager.restoreOriginalActiveTab();
    }

    this.activeUrl = undefined;
    this.emitProgress();
    return summary;
  }

  private transitionState(nextState: CrawlJobState): void {
    this.state = nextState;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(nextState);
    }
    this.emitProgress();
  }

  private emitProgress(): void {
    if (this.onProgressCallback) {
      this.onProgressCallback(this.getProgress());
    }
  }
}
