/**
 * Durable Job State Machine for Web-to-Figma Extension.
 * Persists all capture job transitions into browser.storage.local to survive
 * Chromium Service Worker termination and Firefox Event Page suspension.
 */

import { browser } from '../shared/browser/browser-api';
import type { JobRecord, JobState } from '../shared/contracts/messages';
import { JobTimeoutError, serializeError } from '../shared/errors/extension-errors';

export const STORAGE_KEY_JOBS = 'w2f_job_records';
export const STORAGE_KEY_ACTIVE_JOB_ID = 'w2f_active_job_id';

export interface CreateJobParams {
  tabId: number;
  url: string;
  origin: string;
  mode: 'single-page' | 'multi-page';
}

export type JobChangeListener = (job: JobRecord) => void;

class JobRegistry {
  private inMemoryCache: Map<string, JobRecord> = new Map();
  private activeJobId: string | null = null;
  private listeners: Set<JobChangeListener> = new Set();
  private initialized = false;

  /**
   * Initializes the registry by restoring stored jobs from durable storage.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const result = await browser.storage.local.get([
        STORAGE_KEY_JOBS,
        STORAGE_KEY_ACTIVE_JOB_ID
      ]);

      const storedJobs = (result[STORAGE_KEY_JOBS] as Record<string, JobRecord>) || {};
      for (const [id, job] of Object.entries(storedJobs)) {
        this.inMemoryCache.set(id, job);
      }

      this.activeJobId = (result[STORAGE_KEY_ACTIVE_JOB_ID] as string) || null;
      await this.recoverOrPruneStaleJobs();
      this.initialized = true;
    } catch {
      // In tests or environments without storage, start clean
      this.initialized = true;
    }
  }

  /**
   * Subscribes to job state changes. Returns an unsubscribe function.
   */
  onJobChange(listener: JobChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(job: JobRecord): void {
    for (const listener of this.listeners) {
      try {
        listener(job);
      } catch {
        // Ignore listener exceptions
      }
    }
  }

  private async persist(): Promise<void> {
    try {
      const jobsObj: Record<string, JobRecord> = {};
      for (const [id, job] of this.inMemoryCache.entries()) {
        jobsObj[id] = job;
      }
      await browser.storage.local.set({
        [STORAGE_KEY_JOBS]: jobsObj,
        [STORAGE_KEY_ACTIVE_JOB_ID]: this.activeJobId
      });
    } catch {
      // Storage unavailable or quota limit
    }
  }

  /**
   * Creates and persists a new capture job.
   */
  async createJob(params: CreateJobParams): Promise<JobRecord> {
    await this.initialize();

    const now = Date.now();
    const jobId = `job_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const newJob: JobRecord = {
      jobId,
      tabId: params.tabId,
      url: params.url,
      origin: params.origin,
      mode: params.mode,
      state: 'created',
      createdAt: now,
      updatedAt: now,
      progressPercent: 0,
      currentStep: 'Job created',
      warnings: []
    };

    this.inMemoryCache.set(jobId, newJob);
    this.activeJobId = jobId;
    await this.persist();
    this.notifyListeners(newJob);
    return newJob;
  }

  /**
   * Retrieves a job by ID.
   */
  async getJob(jobId: string): Promise<JobRecord | null> {
    await this.initialize();
    return this.inMemoryCache.get(jobId) ?? null;
  }

  /**
   * Retrieves the currently active job (if any).
   */
  async getActiveJob(): Promise<JobRecord | null> {
    await this.initialize();
    if (!this.activeJobId) return null;
    return this.inMemoryCache.get(this.activeJobId) ?? null;
  }

  /**
   * Updates a job's lifecycle state and persists to storage.
   */
  async updateJobState(
    jobId: string,
    state: JobState,
    patch?: Partial<Omit<JobRecord, 'jobId' | 'state' | 'createdAt'>>
  ): Promise<JobRecord> {
    await this.initialize();

    const existing = this.inMemoryCache.get(jobId);
    if (!existing) {
      throw new Error(`Cannot update non-existent job ${jobId}`);
    }

    const now = Date.now();
    const updated: JobRecord = {
      ...existing,
      ...patch,
      state,
      updatedAt: now,
      warnings: patch?.warnings
        ? Array.from(new Set([...existing.warnings, ...patch.warnings]))
        : existing.warnings
    };

    // If job reached terminal state, clear active job pointer
    const terminalStates: JobState[] = ['completed', 'failed', 'cancelled', 'partial'];
    if (terminalStates.includes(state) && this.activeJobId === jobId) {
      this.activeJobId = null;
    }

    this.inMemoryCache.set(jobId, updated);
    await this.persist();
    this.notifyListeners(updated);
    return updated;
  }

  /**
   * Cancels an active job.
   */
  async cancelJob(jobId: string, reason = 'User requested cancellation'): Promise<JobRecord> {
    return this.updateJobState(jobId, 'cancelled', {
      currentStep: `Cancelled: ${reason}`
    });
  }

  /**
   * Checks for stale in-flight jobs on background startup.
   * If a job was left in an in-flight state without updates for > 5 minutes, marks as failed.
   */
  async recoverOrPruneStaleJobs(staleThresholdMs = 300_000): Promise<void> {
    const now = Date.now();
    const inFlightStates: JobState[] = ['injecting', 'capturing', 'processing', 'copying'];

    for (const [id, job] of this.inMemoryCache.entries()) {
      if (inFlightStates.includes(job.state)) {
        if (now - job.updatedAt > staleThresholdMs) {
          const timeoutErr = new JobTimeoutError(id, now - job.createdAt);
          const timedOutJob: JobRecord = {
            ...job,
            state: 'failed',
            updatedAt: now,
            currentStep: 'Job timed out due to worker inactivity',
            error: serializeError(timeoutErr)
          };
          this.inMemoryCache.set(id, timedOutJob);
          if (this.activeJobId === id) {
            this.activeJobId = null;
          }
        }
      }
    }
  }

  /**
   * Clears registry history for clean testing.
   */
  async clearAll(): Promise<void> {
    this.inMemoryCache.clear();
    this.activeJobId = null;
    await browser.storage.local.remove([
      STORAGE_KEY_JOBS,
      STORAGE_KEY_ACTIVE_JOB_ID
    ]);
  }
}

export const jobRegistry = new JobRegistry();
