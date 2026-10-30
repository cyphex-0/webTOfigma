/**
 * Resilient Capture Storage Engine.
 * Implements high-capacity IndexedDB storage for page snapshots, image assets, and scene documents.
 * Transparently falls back to an in-memory LRU ring-buffer in private/incognito browsing environments
 * or strict tracking protection modes where IndexedDB throws SecurityError.
 */

import { SAFETY_LIMITS } from '../../shared/constants/safety-limits';
import type { PageCaptureMetadata } from '../../shared/contracts/page-capture';
import type { SourceNode } from '../../shared/contracts/source-node';
import type { FigmaSceneDocument } from '../../shared/contracts/scene';
import { CURRENT_STORAGE_SCHEMA_VERSION, assertCompatibleSchemaVersion } from './storage-migrations';

export const DB_NAME = 'web_to_figma_capture_db';
export const DB_VERSION = 1;

export const STORE_SNAPSHOTS = 'snapshots';
export const STORE_ASSETS = 'assets';
export const STORE_SCENE_DOCS = 'scene_documents';

export interface PageSnapshotRecord {
  schemaVersion: number;
  snapshotId: string; // `${jobId}_${pageIndex}`
  jobId: string;
  pageIndex: number;
  metadata: PageCaptureMetadata;
  nodes: SourceNode[];
  assetRefs: string[];
  capturedAt: number;
}

export interface AssetBlobRecord {
  contentHash: string;
  mimeType: string;
  data: Uint8Array;
  byteLength: number;
  storedAt: number;
}

export interface CaptureStorage {
  readonly isMemoryOnly: boolean;
  savePageSnapshot(snapshot: PageSnapshotRecord): Promise<void>;
  getPageSnapshot(jobId: string, pageIndex: number): Promise<PageSnapshotRecord | null>;
  listPageSnapshots(jobId: string): Promise<PageSnapshotRecord[]>;
  saveAssetBlob(hash: string, mimeType: string, data: Uint8Array): Promise<void>;
  getAssetBlob(hash: string): Promise<{ mimeType: string; data: Uint8Array } | null>;
  saveSceneDocument(doc: FigmaSceneDocument & { jobId: string }): Promise<void>;
  getSceneDocument(jobId: string): Promise<FigmaSceneDocument | null>;
  deleteJobData(jobId: string): Promise<void>;
  clearAll(): Promise<void>;
}

/**
 * Non-destructive probe verifying whether IndexedDB is functional and permitted in the current context.
 */
export async function isIndexedDbAvailable(): Promise<boolean> {
  if (typeof indexedDB === 'undefined') {
    return false;
  }

  return new Promise<boolean>((resolve) => {
    try {
      const probeName = '__w2f_idb_probe__';
      const req = indexedDB.open(probeName);

      req.onsuccess = () => {
        try {
          const db = req.result;
          db.close();
          indexedDB.deleteDatabase(probeName);
          resolve(true);
        } catch {
          resolve(true);
        }
      };

      req.onerror = () => {
        resolve(false);
      };

      req.onblocked = () => {
        resolve(false);
      };
    } catch {
      // SecurityError: The operation is insecure (e.g. Firefox private browsing)
      resolve(false);
    }
  });
}

/**
 * In-Memory LRU Ring-Buffer Storage Fallback.
 * Used when IndexedDB is blocked or unavailable in private browsing mode.
 */
export class MemoryCaptureStorage implements CaptureStorage {
  readonly isMemoryOnly = true;
  private snapshots: Map<string, PageSnapshotRecord> = new Map();
  private assets: Map<string, AssetBlobRecord> = new Map();
  private sceneDocs: Map<string, FigmaSceneDocument & { jobId: string }> = new Map();
  private totalAssetBytes = 0;

  async savePageSnapshot(snapshot: PageSnapshotRecord): Promise<void> {
    assertCompatibleSchemaVersion(snapshot.schemaVersion);
    this.snapshots.set(snapshot.snapshotId, snapshot);
  }

  async getPageSnapshot(jobId: string, pageIndex: number): Promise<PageSnapshotRecord | null> {
    const key = `${jobId}_${pageIndex}`;
    return this.snapshots.get(key) ?? null;
  }

  async listPageSnapshots(jobId: string): Promise<PageSnapshotRecord[]> {
    const results: PageSnapshotRecord[] = [];
    for (const snap of this.snapshots.values()) {
      if (snap.jobId === jobId) {
        results.push(snap);
      }
    }
    return results.sort((a, b) => a.pageIndex - b.pageIndex);
  }

  async saveAssetBlob(hash: string, mimeType: string, data: Uint8Array): Promise<void> {
    if (this.assets.has(hash)) return;

    // Guard memory budget
    if (this.totalAssetBytes + data.byteLength > SAFETY_LIMITS.IN_MEMORY_STORAGE_MAX_BYTES) {
      // Evict oldest asset
      const firstKey = this.assets.keys().next().value;
      if (firstKey) {
        const old = this.assets.get(firstKey);
        if (old) {
          this.totalAssetBytes -= old.byteLength;
          this.assets.delete(firstKey);
        }
      }
    }

    this.assets.set(hash, {
      contentHash: hash,
      mimeType,
      data,
      byteLength: data.byteLength,
      storedAt: Date.now()
    });
    this.totalAssetBytes += data.byteLength;
  }

  async getAssetBlob(hash: string): Promise<{ mimeType: string; data: Uint8Array } | null> {
    const rec = this.assets.get(hash);
    if (!rec) return null;
    return { mimeType: rec.mimeType, data: rec.data };
  }

  async saveSceneDocument(doc: FigmaSceneDocument & { jobId: string }): Promise<void> {
    assertCompatibleSchemaVersion(doc.schemaVersion);
    this.sceneDocs.set(doc.jobId, doc);
  }

  async getSceneDocument(jobId: string): Promise<FigmaSceneDocument | null> {
    return this.sceneDocs.get(jobId) ?? null;
  }

  async deleteJobData(jobId: string): Promise<void> {
    for (const [key, snap] of this.snapshots.entries()) {
      if (snap.jobId === jobId) {
        this.snapshots.delete(key);
      }
    }
    this.sceneDocs.delete(jobId);
  }

  async clearAll(): Promise<void> {
    this.snapshots.clear();
    this.assets.clear();
    this.sceneDocs.clear();
    this.totalAssetBytes = 0;
  }
}

/**
 * Standard IndexedDB Capture Storage Implementation.
 */
export class IndexedDbCaptureStorage implements CaptureStorage {
  readonly isMemoryOnly = false;
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_SNAPSHOTS)) {
          const snapStore = db.createObjectStore(STORE_SNAPSHOTS, { keyPath: 'snapshotId' });
          snapStore.createIndex('jobId', 'jobId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_ASSETS)) {
          db.createObjectStore(STORE_ASSETS, { keyPath: 'contentHash' });
        }
        if (!db.objectStoreNames.contains(STORE_SCENE_DOCS)) {
          db.createObjectStore(STORE_SCENE_DOCS, { keyPath: 'jobId' });
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
    });

    return this.dbPromise;
  }

  async savePageSnapshot(snapshot: PageSnapshotRecord): Promise<void> {
    assertCompatibleSchemaVersion(snapshot.schemaVersion);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readwrite');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const req = store.put(snapshot);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getPageSnapshot(jobId: string, pageIndex: number): Promise<PageSnapshotRecord | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const key = `${jobId}_${pageIndex}`;
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as PageSnapshotRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async listPageSnapshots(jobId: string): Promise<PageSnapshotRecord[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SNAPSHOTS, 'readonly');
      const store = tx.objectStore(STORE_SNAPSHOTS);
      const index = store.index('jobId');
      const req = index.getAll(jobId);
      req.onsuccess = () => {
        const list = (req.result as PageSnapshotRecord[]) ?? [];
        resolve(list.sort((a, b) => a.pageIndex - b.pageIndex));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveAssetBlob(hash: string, mimeType: string, data: Uint8Array): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSETS, 'readwrite');
      const store = tx.objectStore(STORE_ASSETS);
      const record: AssetBlobRecord = {
        contentHash: hash,
        mimeType,
        data,
        byteLength: data.byteLength,
        storedAt: Date.now()
      };
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getAssetBlob(hash: string): Promise<{ mimeType: string; data: Uint8Array } | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ASSETS, 'readonly');
      const store = tx.objectStore(STORE_ASSETS);
      const req = store.get(hash);
      req.onsuccess = () => {
        const rec = req.result as AssetBlobRecord | undefined;
        if (!rec) {
          resolve(null);
        } else {
          resolve({ mimeType: rec.mimeType, data: rec.data });
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async saveSceneDocument(doc: FigmaSceneDocument & { jobId: string }): Promise<void> {
    assertCompatibleSchemaVersion(doc.schemaVersion);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCENE_DOCS, 'readwrite');
      const store = tx.objectStore(STORE_SCENE_DOCS);
      const req = store.put(doc);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getSceneDocument(jobId: string): Promise<FigmaSceneDocument | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SCENE_DOCS, 'readonly');
      const store = tx.objectStore(STORE_SCENE_DOCS);
      const req = store.get(jobId);
      req.onsuccess = () => resolve((req.result as FigmaSceneDocument) ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  async deleteJobData(jobId: string): Promise<void> {
    const snapshots = await this.listPageSnapshots(jobId);
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SNAPSHOTS, STORE_SCENE_DOCS], 'readwrite');
      const snapStore = tx.objectStore(STORE_SNAPSHOTS);
      const docStore = tx.objectStore(STORE_SCENE_DOCS);

      for (const snap of snapshots) {
        snapStore.delete(snap.snapshotId);
      }
      docStore.delete(jobId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [STORE_SNAPSHOTS, STORE_ASSETS, STORE_SCENE_DOCS],
        'readwrite'
      );
      tx.objectStore(STORE_SNAPSHOTS).clear();
      tx.objectStore(STORE_ASSETS).clear();
      tx.objectStore(STORE_SCENE_DOCS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Global cached instance
let activeStorageInstance: CaptureStorage | null = null;

/**
 * Returns the active storage instance, probing IndexedDB and falling back to memory if needed.
 */
export async function getCaptureStorage(): Promise<CaptureStorage> {
  if (activeStorageInstance) {
    return activeStorageInstance;
  }

  const idbUsable = await isIndexedDbAvailable();
  if (idbUsable) {
    activeStorageInstance = new IndexedDbCaptureStorage();
  } else {
    console.warn(
      '[WebToFigma] IndexedDB is unavailable or restricted (incognito/private mode). Using resilient in-memory ring-buffer storage.'
    );
    activeStorageInstance = new MemoryCaptureStorage();
  }
  return activeStorageInstance;
}
