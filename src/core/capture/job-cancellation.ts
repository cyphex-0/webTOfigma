/**
 * Job Cancellation and Abort Propagation Controller.
 * 
 * Provides unified, hierarchical cancellation token management across
 * extension contexts (Popup, Background worker, and Content Scripts):
 * - Propagates cancellation signals to pending network fetches via AbortController
 * - Halts active DOM walkers, lazy-load scrolls, and queue workers promptly
 * - Supports hierarchical child tokens for per-route task scopes
 */

export class JobCancelledError extends Error {
  readonly jobId?: string | undefined;

  constructor(message: string = 'Operation cancelled by user.', jobId?: string | undefined) {
    super(message);
    this.name = 'JobCancelledError';
    this.jobId = jobId;
  }
}

export class JobCancellationToken {
  private readonly controller: AbortController;
  private readonly jobId?: string | undefined;
  private readonly parentToken?: JobCancellationToken | undefined;
  private cancelReason?: string | undefined;

  constructor(jobId?: string | undefined, parentToken?: JobCancellationToken | undefined) {
    this.jobId = jobId;
    this.parentToken = parentToken;
    this.controller = new AbortController();

    // If parent is already cancelled or cancels later, propagate to this token
    if (this.parentToken) {
      if (this.parentToken.isCancelled) {
        this.cancel(this.parentToken.reason);
      } else {
        this.parentToken.onCancel((reason) => {
          this.cancel(reason);
        });
      }
    }
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get isCancelled(): boolean {
    return this.controller.signal.aborted;
  }

  get reason(): string | undefined {
    return this.cancelReason;
  }

  cancel(reason: string = 'Operation was cancelled.'): void {
    if (this.isCancelled) return;
    this.cancelReason = reason;
    this.controller.abort(reason);
  }

  throwIfCancelled(): void {
    if (this.isCancelled) {
      throw new JobCancelledError(this.cancelReason || 'Job cancelled.', this.jobId);
    }
  }

  onCancel(callback: (reason?: string | undefined) => void): () => void {
    if (this.isCancelled) {
      callback(this.cancelReason);
      return () => {};
    }

    const handler = () => callback(this.cancelReason);
    this.controller.signal.addEventListener('abort', handler, { once: true });

    return () => {
      this.controller.signal.removeEventListener('abort', handler);
    };
  }

  createChildToken(childJobId?: string | undefined): JobCancellationToken {
    return new JobCancellationToken(childJobId ?? this.jobId, this);
  }
}
