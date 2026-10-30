/**
 * Bounded Asset Fetcher.
 * Retrieves remote and inline assets with concurrency throttling, AbortSignal support,
 * timeout guards, per-file byte ceilings, and local data: URL decoding without remote network I/O.
 */

import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { DEFAULT_MAX_FILE_BYTES } from './asset-deduplicator';

export interface FetchAssetOptions {
  signal?: AbortSignal | undefined;
  timeoutMs?: number | undefined;
  maxFileBytes?: number | undefined;
}

export interface FetchAssetResult {
  success: boolean;
  bytes?: Uint8Array | undefined;
  mimeType?: string | undefined;
  byteLength?: number | undefined;
  diagnostic?: ExportDiagnostic | undefined;
}

/**
 * Decodes an inline data: URL locally into a Uint8Array byte buffer without network requests.
 */
export function parseDataUrl(dataUrl: string): { bytes: Uint8Array; mimeType: string } | null {
  if (!dataUrl.startsWith('data:')) return null;

  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) return null;

  const meta = dataUrl.slice(5, commaIndex); // e.g. "image/png;base64"
  const rawData = dataUrl.slice(commaIndex + 1);

  const isBase64 = meta.includes(';base64');
  const mimeType = (meta.split(';')[0] || 'application/octet-stream').trim();

  try {
    if (isBase64) {
      const binaryString = typeof atob === 'function' ? atob(rawData) : Buffer.from(rawData, 'base64').toString('binary');
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return { bytes, mimeType };
    } else {
      const decoded = decodeURIComponent(rawData);
      const bytes = new TextEncoder().encode(decoded);
      return { bytes, mimeType };
    }
  } catch {
    return null;
  }
}

/**
 * Fetches an individual asset from a URL or decodes inline data URL.
 */
export async function fetchAssetBytes(
  url: string,
  options?: FetchAssetOptions
): Promise<FetchAssetResult> {
  const maxFileBytes = options?.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  const timeoutMs = options?.timeoutMs ?? 10_000;

  // 1. Handle inline data: URLs directly
  if (url.startsWith('data:')) {
    const parsed = parseDataUrl(url);
    if (!parsed) {
      return {
        success: false,
        diagnostic: {
          code: 'ASSET_DATA_URL_MALFORMED',
          severity: 'warning',
          message: 'Malformed inline data: URL could not be parsed',
          phase: 'asset-fetch',
          assetUrl: url.slice(0, 60),
          recoveryAction: 'Verify data: URL formatting',
          timestamp: Date.now()
        }
      };
    }

    if (parsed.bytes.length > maxFileBytes) {
      return {
        success: false,
        diagnostic: {
          code: 'ASSET_FILE_TOO_LARGE',
          severity: 'warning',
          message: `Inline data asset (${parsed.bytes.length} bytes) exceeds limit (${maxFileBytes} bytes)`,
          phase: 'asset-fetch',
          assetUrl: url.slice(0, 60),
          recoveryAction: 'Compress or resize asset',
          timestamp: Date.now()
        }
      };
    }

    return {
      success: true,
      bytes: parsed.bytes,
      mimeType: parsed.mimeType,
      byteLength: parsed.bytes.length
    };
  }

  // 2. Remote HTTP/HTTPS fetch with timeout and abort controller
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  // Link external signal if provided
  if (options?.signal) {
    options.signal.addEventListener('abort', () => {
      controller.abort();
    });
  }

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'default'
    });

    clearTimeout(timer);

    if (!response.ok) {
      return {
        success: false,
        diagnostic: {
          code: 'ASSET_FETCH_HTTP_ERROR',
          severity: 'warning',
          message: `Asset fetch returned HTTP ${response.status}: ${response.statusText}`,
          phase: 'asset-fetch',
          assetUrl: url,
          recoveryAction: 'Check that asset URL is accessible and not behind authentication',
          timestamp: Date.now()
        }
      };
    }

    // Check Content-Length header if available
    const contentLength = response.headers.get('content-length');
    if (contentLength) {
      const declaredBytes = parseInt(contentLength, 10);
      if (Number.isFinite(declaredBytes) && declaredBytes > maxFileBytes) {
        return {
          success: false,
          diagnostic: {
            code: 'ASSET_FILE_TOO_LARGE',
            severity: 'warning',
            message: `Asset declared size (${declaredBytes} bytes) exceeds limit (${maxFileBytes} bytes)`,
            phase: 'asset-fetch',
            assetUrl: url,
            recoveryAction: 'Compress or resize asset',
            timestamp: Date.now()
          }
        };
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    if (bytes.length > maxFileBytes) {
      return {
        success: false,
        diagnostic: {
          code: 'ASSET_FILE_TOO_LARGE',
          severity: 'warning',
          message: `Asset size (${bytes.length} bytes) exceeds limit (${maxFileBytes} bytes)`,
          phase: 'asset-fetch',
          assetUrl: url,
          recoveryAction: 'Compress or resize asset',
          timestamp: Date.now()
        }
      };
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream';

    return {
      success: true,
      bytes,
      mimeType,
      byteLength: bytes.length
    };
  } catch (err: unknown) {
    clearTimeout(timer);

    if (timedOut) {
      return {
        success: false,
        diagnostic: {
          code: 'ASSET_FETCH_TIMEOUT',
          severity: 'warning',
          message: `Asset fetch timed out after ${timeoutMs}ms`,
          phase: 'asset-fetch',
          assetUrl: url,
          recoveryAction: 'Check remote server response time or network connection',
          timestamp: Date.now()
        }
      };
    }

    if (options?.signal?.aborted) {
      return {
        success: false,
        diagnostic: {
          code: 'ASSET_FETCH_CANCELLED',
          severity: 'info',
          message: 'Asset fetch cancelled by export job abort signal',
          phase: 'asset-fetch',
          assetUrl: url,
          recoveryAction: 'Restart capture job if necessary',
          timestamp: Date.now()
        }
      };
    }

    return {
      success: false,
      diagnostic: {
        code: 'ASSET_FETCH_NETWORK_ERROR',
        severity: 'warning',
        message: err instanceof Error ? err.message : String(err),
        phase: 'asset-fetch',
        assetUrl: url,
        recoveryAction: 'Ensure remote origin allows cross-origin requests or check URL',
        timestamp: Date.now()
      }
    };
  }
}

/**
 * Concurrency-limited asset fetch queue.
 */
export class AssetFetchQueue {
  private activeCount = 0;
  private queue: Array<() => void> = [];
  private readonly maxConcurrency: number;

  constructor(maxConcurrency = 6) {
    this.maxConcurrency = maxConcurrency;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }

    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}
