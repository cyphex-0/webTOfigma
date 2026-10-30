import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  MemoryCaptureStorage,
  IndexedDbCaptureStorage,
  isIndexedDbAvailable,
  getCaptureStorage,
  type PageSnapshotRecord
} from '../../core/storage/capture-database';
import {
  CURRENT_STORAGE_SCHEMA_VERSION,
  assertCompatibleSchemaVersion
} from '../../core/storage/storage-migrations';
import {
  mockPageSnapshotRecord,
  mockSceneDocument
} from '../fixtures';

describe('Resilient Capture Storage & Migrations', () => {
  describe('Storage Migrations & Version Validation', () => {
    it('allows current schema version', () => {
      expect(() => {
        assertCompatibleSchemaVersion(CURRENT_STORAGE_SCHEMA_VERSION);
      }).not.toThrow();
    });

    it('rejects future unsupported schema version with descriptive message', () => {
      expect(() => {
        assertCompatibleSchemaVersion(CURRENT_STORAGE_SCHEMA_VERSION + 1);
      }).toThrow(/Unsupported schemaVersion/);
    });
  });

  describe('MemoryCaptureStorage (Ring Buffer Fallback)', () => {
    let storage: MemoryCaptureStorage;

    beforeEach(async () => {
      storage = new MemoryCaptureStorage();
      await storage.clearAll();
    });

    it('identifies as memory-only storage', () => {
      expect(storage.isMemoryOnly).toBe(true);
    });

    it('saves and retrieves page snapshots', async () => {
      await storage.savePageSnapshot(mockPageSnapshotRecord);
      const retrieved = await storage.getPageSnapshot(
        mockPageSnapshotRecord.jobId,
        mockPageSnapshotRecord.pageIndex
      );

      expect(retrieved).not.toBeNull();
      expect(retrieved?.snapshotId).toBe(mockPageSnapshotRecord.snapshotId);
      expect(retrieved?.metadata.title).toBe(mockPageSnapshotRecord.metadata.title);
    });

    it('returns null for non-existent page snapshot', async () => {
      const result = await storage.getPageSnapshot('non_existent_job', 0);
      expect(result).toBeNull();
    });

    it('lists all page snapshots for a given job ordered by pageIndex', async () => {
      const snapPage0: PageSnapshotRecord = {
        ...mockPageSnapshotRecord,
        snapshotId: 'job_multi_0',
        jobId: 'job_multi',
        pageIndex: 0
      };
      const snapPage1: PageSnapshotRecord = {
        ...mockPageSnapshotRecord,
        snapshotId: 'job_multi_1',
        jobId: 'job_multi',
        pageIndex: 1
      };
      const snapOtherJob: PageSnapshotRecord = {
        ...mockPageSnapshotRecord,
        snapshotId: 'other_job_0',
        jobId: 'other_job',
        pageIndex: 0
      };

      await storage.savePageSnapshot(snapPage1);
      await storage.savePageSnapshot(snapPage0);
      await storage.savePageSnapshot(snapOtherJob);

      const list = await storage.listPageSnapshots('job_multi');
      expect(list).toHaveLength(2);
      expect(list[0]?.pageIndex).toBe(0);
      expect(list[1]?.pageIndex).toBe(1);
    });

    it('stores and retrieves binary asset blobs', async () => {
      const hash = 'asset_sha256_mock';
      const binaryData = new Uint8Array([1, 2, 3, 4, 5]);

      await storage.saveAssetBlob(hash, 'image/png', binaryData);
      const retrieved = await storage.getAssetBlob(hash);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.mimeType).toBe('image/png');
      expect(retrieved?.data).toEqual(binaryData);
    });

    it('returns null for unknown asset blob hash', async () => {
      const result = await storage.getAssetBlob('unknown_hash');
      expect(result).toBeNull();
    });

    it('saves and retrieves scene documents by jobId', async () => {
      await storage.saveSceneDocument(mockSceneDocument);
      const retrieved = await storage.getSceneDocument(mockSceneDocument.jobId);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.exportTitle).toBe(mockSceneDocument.exportTitle);
      expect(retrieved?.pageFrames).toHaveLength(1);
    });

    it('deletes job data cleanly without touching other jobs', async () => {
      const jobA: PageSnapshotRecord = {
        ...mockPageSnapshotRecord,
        snapshotId: 'job_a_0',
        jobId: 'job_a',
        pageIndex: 0
      };
      const jobB: PageSnapshotRecord = {
        ...mockPageSnapshotRecord,
        snapshotId: 'job_b_0',
        jobId: 'job_b',
        pageIndex: 0
      };

      await storage.savePageSnapshot(jobA);
      await storage.savePageSnapshot(jobB);
      await storage.saveSceneDocument({ ...mockSceneDocument, jobId: 'job_a' });
      await storage.saveSceneDocument({ ...mockSceneDocument, jobId: 'job_b' });

      await storage.deleteJobData('job_a');

      expect(await storage.getPageSnapshot('job_a', 0)).toBeNull();
      expect(await storage.getSceneDocument('job_a')).toBeNull();
      expect(await storage.getPageSnapshot('job_b', 0)).not.toBeNull();
      expect(await storage.getSceneDocument('job_b')).not.toBeNull();
    });

    it('clears all snapshots, assets, and scene documents on clearAll', async () => {
      await storage.savePageSnapshot(mockPageSnapshotRecord);
      await storage.saveAssetBlob('hash_1', 'image/png', new Uint8Array([10, 20]));
      await storage.saveSceneDocument(mockSceneDocument);

      await storage.clearAll();

      expect(await storage.getPageSnapshot(mockPageSnapshotRecord.jobId, 0)).toBeNull();
      expect(await storage.getAssetBlob('hash_1')).toBeNull();
      expect(await storage.getSceneDocument(mockSceneDocument.jobId)).toBeNull();
    });

    it('enforces schemaVersion validation on save', async () => {
      const invalidSnapshot: PageSnapshotRecord = {
        ...mockPageSnapshotRecord,
        schemaVersion: 999
      };

      await expect(storage.savePageSnapshot(invalidSnapshot)).rejects.toThrow(
        /Unsupported schemaVersion/
      );
    });
  });

  describe('isIndexedDbAvailable & Storage Selection Fallback', () => {
    it('returns false when indexedDB is undefined', async () => {
      const originalIdb = globalThis.indexedDB;
      try {
        delete (globalThis as any).indexedDB;
        const available = await isIndexedDbAvailable();
        expect(available).toBe(false);
      } finally {
        if (originalIdb !== undefined) {
          globalThis.indexedDB = originalIdb;
        }
      }
    });

    it('returns false when indexedDB.open throws SecurityError (incognito mode)', async () => {
      const originalIdb = globalThis.indexedDB;
      try {
        (globalThis as any).indexedDB = {
          open: () => {
            throw new Error('SecurityError: The operation is insecure.');
          }
        };
        const available = await isIndexedDbAvailable();
        expect(available).toBe(false);
      } finally {
        if (originalIdb !== undefined) {
          globalThis.indexedDB = originalIdb;
        }
      }
    });

    it('getCaptureStorage returns MemoryCaptureStorage when IndexedDB is restricted', async () => {
      const originalIdb = globalThis.indexedDB;
      try {
        delete (globalThis as any).indexedDB;
        const storageInstance = await getCaptureStorage();
        expect(storageInstance).toBeInstanceOf(MemoryCaptureStorage);
        expect(storageInstance.isMemoryOnly).toBe(true);
      } finally {
        if (originalIdb !== undefined) {
          globalThis.indexedDB = originalIdb;
        }
      }
    });
  });

  describe('IndexedDbCaptureStorage Error Handling', () => {
    it('identifies as non-memory-only storage', () => {
      const idbStorage = new IndexedDbCaptureStorage();
      expect(idbStorage.isMemoryOnly).toBe(false);
    });

    it('asserts schema version compatibility before attempting db transaction', async () => {
      const idbStorage = new IndexedDbCaptureStorage();
      const invalidSnap = {
        ...mockPageSnapshotRecord,
        schemaVersion: 999
      };

      await expect(idbStorage.savePageSnapshot(invalidSnap)).rejects.toThrow(
        /Unsupported schemaVersion/
      );
    });
  });
});
