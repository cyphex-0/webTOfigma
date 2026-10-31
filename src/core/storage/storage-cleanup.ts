/**
 * Storage Cleanup and Cache Expiration Manager.
 * 
 * Enforces data retention and lifecycle policies for local storage:
 * - Automatically purges expired capture jobs, page snapshots, and asset buffers (default 24h retention)
 * - Releases memory after export completion, failure, or cancellation
 * - Provides user-initiated cache clearing with explicit confirmation of what is deleted
 * - Does not touch user settings, original website data, or Figma files
 */

import { getCaptureStorage, type CaptureStorage } from './capture-database';

export const DEFAULT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CleanupResult {
  purgedJobsCount: number;
  isMemoryOnly: boolean;
  timestamp: number;
}

export interface ClearAllDataResult {
  success: boolean;
  message: string;
  isMemoryOnly: boolean;
  timestamp: number;
}

export class StorageCleanupManager {
  private readonly storagePromise: Promise<CaptureStorage>;

  constructor(storage?: CaptureStorage | Promise<CaptureStorage> | undefined) {
    this.storagePromise = storage ? Promise.resolve(storage) : getCaptureStorage();
  }

  private async getStorage(): Promise<CaptureStorage> {
    return this.storagePromise;
  }

  /**
   * Purges snapshots and assets for a specific completed, failed, or cancelled job.
   */
  async purgeJob(jobId: string): Promise<void> {
    const storage = await this.getStorage();
    await storage.deleteJobData(jobId);
  }

  /**
   * Purges all capture data older than the retention threshold.
   */
  async purgeExpiredJobs(
    activeJobIds: readonly string[],
    retentionMs: number = DEFAULT_RETENTION_MS
  ): Promise<CleanupResult> {
    const storage = await this.getStorage();
    const cutoff = Date.now() - retentionMs;
    let purgedCount = 0;

    for (const jobId of activeJobIds) {
      const snapshots = await storage.listPageSnapshots(jobId);
      if (snapshots.length > 0) {
        const oldestCaptured = Math.min(...snapshots.map((s) => s.capturedAt));
        if (oldestCaptured < cutoff) {
          await storage.deleteJobData(jobId);
          purgedCount++;
        }
      }
    }

    return {
      purgedJobsCount: purgedCount,
      isMemoryOnly: storage.isMemoryOnly,
      timestamp: Date.now()
    };
  }

  /**
   * Clears all cached page snapshots, image blobs, and scene documents from local storage.
   * Invoked via Settings "Clear Cached Data" action.
   */
  async clearAllCachedData(): Promise<ClearAllDataResult> {
    const storage = await this.getStorage();
    await storage.clearAll();

    return {
      success: true,
      message: 'All cached export data, temporary page snapshots, and local image buffers have been purged.',
      isMemoryOnly: storage.isMemoryOnly,
      timestamp: Date.now()
    };
  }
}

export const storageCleanupManager = new StorageCleanupManager();
