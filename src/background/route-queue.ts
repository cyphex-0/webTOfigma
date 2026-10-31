/**
 * Durable FIFO route execution queue with configurable concurrency,
 * pause/resume/cancel controls, and service worker suspension recovery.
 */

import { DiscoveredRoute } from '../core/crawler/crawl-scope';

export type RouteQueueItemStatus =
  | 'pending'
  | 'in-progress'
  | 'completed'
  | 'failed'
  | 'redirected_to_auth'
  | 'cancelled';

export interface RouteQueueItem {
  routeId: string;
  url: string;
  canonicalUrl: string;
  title?: string | undefined;
  category: string;
  depth: number;
  paginationNumber: number | null;
  status: RouteQueueItemStatus;
  attempts: number;
  sceneDocumentId?: string | undefined;
  error?: string | undefined;
  startTime?: number | undefined;
  completedTime?: number | undefined;
}

export type QueueState = 'idle' | 'running' | 'paused' | 'cancelled' | 'completed';

export interface PersistedQueueSnapshot {
  jobId: string;
  state: QueueState;
  concurrency: number;
  items: RouteQueueItem[];
  updatedAt: number;
}

export interface RouteQueueProgress {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  inProgress: number;
  percent: number;
}

export interface RouteQueueOptions {
  jobId: string;
  routes: readonly DiscoveredRoute[];
  concurrency?: number | undefined; // Default 1, max 2
  onProgress?: ((progress: RouteQueueProgress) => void) | undefined;
  onPersist?: ((snapshot: PersistedQueueSnapshot) => Promise<void>) | undefined;
}

export type RouteProcessor = (
  item: RouteQueueItem
) => Promise<{
  success: boolean;
  sceneDocumentId?: string | undefined;
  isAuthRedirect?: boolean | undefined;
  error?: string | undefined;
}>;

export class RouteQueue {
  private readonly jobId: string;
  private readonly concurrency: number;
  private items: RouteQueueItem[] = [];
  private state: QueueState = 'idle';
  private activeWorkers = 0;
  private processor: RouteProcessor | null = null;
  private readonly onProgress?: ((progress: RouteQueueProgress) => void) | undefined;
  private readonly onPersist?: ((snapshot: PersistedQueueSnapshot) => Promise<void>) | undefined;
  private completionResolvers: Array<(state: QueueState) => void> = [];

  constructor(options: RouteQueueOptions) {
    this.jobId = options.jobId;
    // Strictly cap concurrency to max 2 for memory/performance safety
    this.concurrency = Math.min(2, Math.max(1, options.concurrency ?? 1));
    this.onProgress = options.onProgress;
    this.onPersist = options.onPersist;

    this.items = options.routes.map((route, idx) => ({
      routeId: `r_${idx + 1}_${Math.random().toString(36).slice(2, 7)}`,
      url: route.originalUrl,
      canonicalUrl: route.canonicalUrl,
      title: route.title || route.navigationLabel,
      category: route.category,
      depth: route.depth,
      paginationNumber: route.paginationNumber,
      status: 'pending',
      attempts: 0
    }));
  }

  /**
   * Sets the execution handler for individual route processing.
   */
  public setProcessor(processor: RouteProcessor): void {
    this.processor = processor;
  }

  /**
   * Starts processing pending routes up to the configured concurrency limit.
   */
  public async start(): Promise<void> {
    if (this.state === 'running') {
      return;
    }
    this.state = 'running';
    void this.persistState();
    this.notifyProgress();
    this.drain();
  }

  /**
   * Pauses queue dequeuing. In-flight items continue to completion.
   */
  public pause(): void {
    if (this.state !== 'running') {
      return;
    }
    this.state = 'paused';
    void this.persistState();
    this.notifyProgress();
  }

  /**
   * Resumes a paused queue.
   */
  public resume(): void {
    if (this.state !== 'paused') {
      return;
    }
    this.state = 'running';
    void this.persistState();
    this.notifyProgress();
    this.drain();
  }

  /**
   * Cancels future queue work and marks all pending items as cancelled.
   */
  public cancel(): void {
    this.state = 'cancelled';
    for (const item of this.items) {
      if (item.status === 'pending') {
        item.status = 'cancelled';
      }
    }
    void this.persistState();
    this.notifyProgress();
    this.notifyCompletion();
  }

  /**
   * Awaits until the queue completes all items or is cancelled.
   */
  public waitForCompletion(): Promise<QueueState> {
    if (this.state === 'completed' || this.state === 'cancelled') {
      return Promise.resolve(this.state);
    }
    return new Promise((resolve) => {
      this.completionResolvers.push(resolve);
    });
  }

  private notifyCompletion(): void {
    if (this.state === 'completed' || this.state === 'cancelled') {
      const resolvers = [...this.completionResolvers];
      this.completionResolvers = [];
      for (const resolve of resolvers) {
        resolve(this.state);
      }
    }
  }

  /**
   * Drains the queue by launching workers up to concurrency limit.
   */
  private drain(): void {
    if (this.state !== 'running' || !this.processor) {
      return;
    }

    while (this.activeWorkers < this.concurrency) {
      const nextItem = this.items.find((item) => item.status === 'pending');
      if (!nextItem) {
        break;
      }
      this.spawnWorker(nextItem);
    }

    // Check completion if no active workers and no pending items
    if (this.activeWorkers === 0 && !this.items.some((i) => i.status === 'pending')) {
      if (this.state === 'running') {
        this.state = 'completed';
        void this.persistState();
        this.notifyProgress();
        this.notifyCompletion();
      }
    }
  }

  private async spawnWorker(item: RouteQueueItem): Promise<void> {
    this.activeWorkers++;
    item.status = 'in-progress';
    item.attempts++;
    item.startTime = Date.now();
    this.notifyProgress();
    void this.persistState();

    try {
      if (!this.processor) {
        throw new Error('No route processor registered.');
      }
      const result = await this.processor(item);

      if (result.isAuthRedirect) {
        item.status = 'redirected_to_auth';
        item.error = result.error || 'Redirected to authentication page.';
      } else if (result.success) {
        item.status = 'completed';
        item.sceneDocumentId = result.sceneDocumentId;
      } else {
        item.status = 'failed';
        item.error = result.error || 'Page capture failed.';
      }
    } catch (err) {
      item.status = 'failed';
      item.error = err instanceof Error ? err.message : String(err);
    } finally {
      item.completedTime = Date.now();
      this.activeWorkers--;
      this.notifyProgress();
      void this.persistState();

      // Continue draining next available items
      this.drain();
    }
  }

  /**
   * Retries an individual failed item.
   */
  public retryItem(routeId: string): boolean {
    const item = this.items.find((i) => i.routeId === routeId);
    if (!item || (item.status !== 'failed' && item.status !== 'cancelled')) {
      return false;
    }

    item.status = 'pending';
    item.error = undefined;
    void this.persistState();
    this.notifyProgress();

    if (this.state === 'completed' || this.state === 'idle') {
      this.state = 'running';
      this.drain();
    } else if (this.state === 'running') {
      this.drain();
    }

    return true;
  }

  /**
   * Restores queue state from a persisted snapshot after a background worker restart.
   */
  public restoreFromSnapshot(snapshot: PersistedQueueSnapshot): void {
    if (snapshot.jobId !== this.jobId) {
      return;
    }
    this.items = snapshot.items.map((saved) => {
      // Any item that was in-progress when the worker died must be reset to pending
      if (saved.status === 'in-progress') {
        return { ...saved, status: 'pending' };
      }
      return saved;
    });
    // Set to idle so subsequent queue.start() can transition to running and drain
    this.state = 'idle';
    this.notifyProgress();
  }

  public getSnapshot(): PersistedQueueSnapshot {
    return {
      jobId: this.jobId,
      state: this.state,
      concurrency: this.concurrency,
      items: [...this.items],
      updatedAt: Date.now()
    };
  }

  public getState(): QueueState {
    return this.state;
  }

  public getItems(): readonly RouteQueueItem[] {
    return this.items;
  }

  public getProgress(): RouteQueueProgress {
    const total = this.items.length;
    const completed = this.items.filter((i) => i.status === 'completed').length;
    const failed = this.items.filter(
      (i) => i.status === 'failed' || i.status === 'redirected_to_auth'
    ).length;
    const inProgress = this.items.filter((i) => i.status === 'in-progress').length;
    const pending = this.items.filter((i) => i.status === 'pending').length;
    const percent = total === 0 ? 100 : Math.round((completed / total) * 100);

    return {
      total,
      completed,
      failed,
      pending,
      inProgress,
      percent
    };
  }

  private notifyProgress(): void {
    if (this.onProgress) {
      this.onProgress(this.getProgress());
    }
  }

  private async persistState(): Promise<void> {
    if (this.onPersist) {
      try {
        await this.onPersist(this.getSnapshot());
      } catch {
        // Non-fatal persistence error
      }
    }
  }
}
