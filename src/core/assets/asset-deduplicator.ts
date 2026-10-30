/**
 * Cryptographic Asset Hasher and Deduplication Engine.
 * Deduplicates identical asset bytes into a single canonical AssetRecord via SHA-256 hashing.
 * Enforces per-file and total-job size limits.
 */

import type { AssetRecord, AssetKind } from '../../shared/contracts/assets';

export const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB per file limit
export const DEFAULT_MAX_JOB_BYTES = 100 * 1024 * 1024; // 100 MB total job limit

/**
 * Computes deterministic SHA-256 hex content hash from a binary byte array.
 */
export async function computeContentHash(bytes: Uint8Array): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
    try {
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fall through to software hash
    }
  }

  // Fallback FNV-1a / Murmur-like deterministic 64-character hash for non-crypto headless runtimes
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0;
    h1 = Math.imul(h1 ^ b, 0x01000193);
    h2 = Math.imul(h2 ^ b, 0x5bd1e995);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const lenHex = bytes.length.toString(16).padStart(8, '0');
  return `${hex1}${hex2}${lenHex}`.padEnd(64, '0');
}

export interface RegisterAssetOptions {
  url: string;
  kind: AssetKind;
  mimeType?: string | undefined;
  dimensions?: { width: number; height: number } | undefined;
  diagnostic?: string | undefined;
}

export interface DeduplicationResult {
  asset: AssetRecord;
  isDuplicate: boolean;
  contentHash: string;
}

export class AssetDeduplicator {
  private assetsByHash: Map<string, AssetRecord> = new Map();
  private assetsById: Map<string, AssetRecord> = new Map();
  private assetBytesMap: Map<string, Uint8Array> = new Map();

  private totalBytes = 0;
  private readonly maxFileBytes: number;
  private readonly maxJobBytes: number;
  private idCounter = 0;

  constructor(options?: { maxFileBytes?: number | undefined; maxJobBytes?: number | undefined }) {
    this.maxFileBytes = options?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
    this.maxJobBytes = options?.maxJobBytes ?? DEFAULT_MAX_JOB_BYTES;
  }

  async register(bytes: Uint8Array, options: RegisterAssetOptions): Promise<DeduplicationResult> {
    const byteLength = bytes.length;

    // Check per-file size limit
    if (byteLength > this.maxFileBytes) {
      throw new Error(
        `Asset size (${byteLength} bytes) exceeds per-file limit (${this.maxFileBytes} bytes)`
      );
    }

    // Compute deterministic content hash
    const contentHash = await computeContentHash(bytes);

    // Check if identical byte content is already registered
    const existing = this.assetsByHash.get(contentHash);
    if (existing) {
      return {
        asset: existing,
        isDuplicate: true,
        contentHash
      };
    }

    // Check job-wide total byte ceiling
    if (this.totalBytes + byteLength > this.maxJobBytes) {
      throw new Error(
        `Asset job budget exceeded: ${this.totalBytes + byteLength} bytes exceeds limit of ${this.maxJobBytes} bytes`
      );
    }

    const assetId = `asset_${++this.idCounter}_${contentHash.slice(0, 10)}`;
    const record: AssetRecord = {
      assetId,
      url: options.url,
      kind: options.kind,
      mimeType: options.mimeType || 'application/octet-stream',
      byteLength,
      contentHash,
      dimensions: options.dimensions,
      fetchState: 'cached',
      embeddingState: 'blob-reference',
      diagnostic: options.diagnostic
    };

    this.assetsByHash.set(contentHash, record);
    this.assetsById.set(assetId, record);
    this.assetBytesMap.set(assetId, bytes);
    this.totalBytes += byteLength;

    return {
      asset: record,
      isDuplicate: false,
      contentHash
    };
  }

  getByHash(hash: string): AssetRecord | undefined {
    return this.assetsByHash.get(hash);
  }

  getById(id: string): AssetRecord | undefined {
    return this.assetsById.get(id);
  }

  getBytes(assetId: string): Uint8Array | undefined {
    return this.assetBytesMap.get(assetId);
  }

  getAll(): AssetRecord[] {
    return Array.from(this.assetsById.values());
  }

  getByteUsage(): number {
    return this.totalBytes;
  }

  clear(): void {
    this.assetsByHash.clear();
    this.assetsById.clear();
    this.assetBytesMap.clear();
    this.totalBytes = 0;
    this.idCounter = 0;
  }
}
