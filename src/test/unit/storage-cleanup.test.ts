import { describe, it, expect, beforeEach } from 'vitest';
import { StorageCleanupManager } from '../../core/storage/storage-cleanup';
import { MemoryCaptureStorage } from '../../core/storage/capture-database';
import { mockPageSnapshotRecord } from '../fixtures';

describe('Storage Cleanup & Data Expiration Manager (Phase 22)', () => {
  let memoryStorage: MemoryCaptureStorage;
  let cleanupManager: StorageCleanupManager;

  const createTestSnapshot = (jobId: string, timestamp: number) => ({
    ...mockPageSnapshotRecord,
    snapshotId: `${jobId}_0`,
    jobId,
    pageIndex: 0,
    capturedAt: timestamp,
    metadata: {
      ...mockPageSnapshotRecord.metadata,
      capturedAt: timestamp
    }
  });

  beforeEach(() => {
    memoryStorage = new MemoryCaptureStorage();
    cleanupManager = new StorageCleanupManager(memoryStorage);
  });

  it('purges specific job data on command', async () => {
    await memoryStorage.savePageSnapshot(createTestSnapshot('job1', Date.now()));
    expect(await memoryStorage.listPageSnapshots('job1')).toHaveLength(1);

    await cleanupManager.purgeJob('job1');
    expect(await memoryStorage.listPageSnapshots('job1')).toHaveLength(0);
  });

  it('purges expired jobs older than retention threshold', async () => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const oldTimestamp = Date.now() - (ONE_DAY_MS + 10000);

    // Old expired job
    await memoryStorage.savePageSnapshot(createTestSnapshot('job_old', oldTimestamp));

    // Recent job
    await memoryStorage.savePageSnapshot(createTestSnapshot('job_new', Date.now()));

    const result = await cleanupManager.purgeExpiredJobs(['job_old', 'job_new'], ONE_DAY_MS);
    expect(result.purgedJobsCount).toBe(1);

    expect(await memoryStorage.listPageSnapshots('job_old')).toHaveLength(0);
    expect(await memoryStorage.listPageSnapshots('job_new')).toHaveLength(1);
  });

  it('clears all cached export data on demand', async () => {
    await memoryStorage.savePageSnapshot(createTestSnapshot('j1', Date.now()));

    const res = await cleanupManager.clearAllCachedData();
    expect(res.success).toBe(true);
    expect(res.message).toContain('All cached export data');
    expect(await memoryStorage.listPageSnapshots('j1')).toHaveLength(0);
  });
});
