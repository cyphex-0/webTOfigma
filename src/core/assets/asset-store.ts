/**
 * In-Memory Asset Store.
 * Coordinates bounded asset retrieval, SHA-256 deduplication, and storage budgeting
 * for an active capture session.
 */

import type { AssetRecord, AssetKind } from '../../shared/contracts/assets';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { AssetDeduplicator, type RegisterAssetOptions } from './asset-deduplicator';
import { fetchAssetBytes, AssetFetchQueue, type FetchAssetOptions } from './asset-fetcher';
import { parseImageHeader } from './image-metadata';

export class AssetStore {
  private deduplicator: AssetDeduplicator;
  private fetchQueue: AssetFetchQueue;
  private diagnostics: ExportDiagnostic[] = [];
  private urlToAssetIdMap: Map<string, string> = new Map();

  constructor(options?: {
    maxFileBytes?: number;
    maxJobBytes?: number;
    maxConcurrency?: number;
  }) {
    this.deduplicator = new AssetDeduplicator({
      maxFileBytes: options?.maxFileBytes,
      maxJobBytes: options?.maxJobBytes
    });
    this.fetchQueue = new AssetFetchQueue(options?.maxConcurrency ?? 6);
  }

  getDiagnostics(): ExportDiagnostic[] {
    return [...this.diagnostics];
  }

  async registerBytes(bytes: Uint8Array, options: RegisterAssetOptions): Promise<AssetRecord> {
    const header = parseImageHeader(bytes);
    const dimensions = options.dimensions || (header.width && header.height ? { width: header.width, height: header.height } : undefined);

    const result = await this.deduplicator.register(bytes, {
      ...options,
      mimeType: options.mimeType || header.mimeType,
      dimensions
    });

    this.urlToAssetIdMap.set(options.url, result.asset.assetId);
    return result.asset;
  }

  async fetchAndRegister(
    url: string,
    kind: AssetKind,
    options?: FetchAssetOptions
  ): Promise<AssetRecord | null> {
    // Check if URL was already fetched and registered
    const existingId = this.urlToAssetIdMap.get(url);
    if (existingId) {
      const existingRecord = this.deduplicator.getById(existingId);
      if (existingRecord) return existingRecord;
    }

    // Schedule through bounded concurrency queue
    const fetchResult = await this.fetchQueue.run(() => fetchAssetBytes(url, options));

    if (!fetchResult.success || !fetchResult.bytes) {
      if (fetchResult.diagnostic) {
        this.diagnostics.push(fetchResult.diagnostic);
      }
      return null;
    }

    try {
      const record = await this.registerBytes(fetchResult.bytes, {
        url,
        kind,
        mimeType: fetchResult.mimeType
      });
      return record;
    } catch (err: unknown) {
      this.diagnostics.push({
        code: 'ASSET_REGISTRATION_FAILED',
        severity: 'warning',
        message: err instanceof Error ? err.message : String(err),
        phase: 'asset-fetch',
        assetUrl: url,
        recoveryAction: 'Check asset budget limits',
        timestamp: Date.now()
      });
      return null;
    }
  }

  getAsset(assetId: string): AssetRecord | undefined {
    return this.deduplicator.getById(assetId);
  }

  getAssetByHash(hash: string): AssetRecord | undefined {
    return this.deduplicator.getByHash(hash);
  }

  getBytes(assetId: string): Uint8Array | undefined {
    return this.deduplicator.getBytes(assetId);
  }

  getAllAssets(): AssetRecord[] {
    return this.deduplicator.getAll();
  }

  getTotalBytes(): number {
    return this.deduplicator.getByteUsage();
  }

  clear(): void {
    this.deduplicator.clear();
    this.diagnostics = [];
    this.urlToAssetIdMap.clear();
  }
}
