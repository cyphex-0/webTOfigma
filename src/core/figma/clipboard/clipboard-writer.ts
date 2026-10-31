/**
 * Zero-I/O Clipboard Writer for Web-to-Figma.
 * 
 * Strict Zero-I/O Architecture:
 * In Manifest V3 extensions, transient user activation for navigator.clipboard.write
 * expires within a few hundred milliseconds. All Kiwi binary encoding, Deflate
 * compression, base64 formatting, HTML envelope wrapping, and ClipboardItem instantiation
 * MUST be completed in advance before enabling the copy button.
 * 
 * The button click handler executes only `navigator.clipboard.write([preparedItem])`
 * with zero awaited computation.
 */

import {
  formatFigmaClipboardHtml,
  formatFigmaPlainTextFallback
} from '../poc/clipboard-envelope';
import type { ClipboardBatch } from './batch-partitioner';

export const DEFAULT_PAYLOAD_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

export interface PreparedClipboardBatch {
  batchId: string;
  batchIndex: number;
  totalBatches: number;
  nodeCount: number;
  binaryBuffer: Uint8Array;
  htmlString: string;
  plainText: string;
  htmlBlob: Blob;
  plainTextBlob: Blob;
  clipboardItem: ClipboardItem | null;
  preparedAt: number;
  expiresAt: number;
}

export interface PreparedPayloadParams {
  batchId: string;
  batchIndex: number;
  totalBatches: number;
  nodeCount: number;
  binaryBuffer: Uint8Array;
  ttlMs?: number | undefined;
}

export interface ClipboardWriteConfirmation {
  success: boolean;
  batchId: string;
  batchIndex: number;
  totalBatches: number;
  timestamp: number;
  instructions: string;
}

export class ClipboardWriteError extends Error {
  readonly code:
    | 'CLIPBOARD_NOT_SUPPORTED'
    | 'PAYLOAD_EXPIRED'
    | 'PERMISSION_DENIED'
    | 'USER_ACTIVATION_LOST'
    | 'WRITE_FAILED';

  constructor(code: ClipboardWriteError['code'], message: string, cause?: unknown) {
    super(message);
    this.name = 'ClipboardWriteError';
    this.code = code;
    if (cause) {
      this.cause = cause;
    }
  }
}

/**
 * Precomputes binary buffer, HTML envelope, and ClipboardItem ahead of user click.
 */
export function prepareClipboardBatchItem(params: PreparedPayloadParams): PreparedClipboardBatch {
  const { batchId, batchIndex, totalBatches, nodeCount, binaryBuffer, ttlMs } = params;

  if (binaryBuffer.byteLength === 0) {
    throw new ClipboardWriteError('WRITE_FAILED', 'Cannot prepare clipboard payload with 0 binary bytes.');
  }

  // 1. Precompute HTML envelope with base64 metadata and payload
  const htmlString = formatFigmaClipboardHtml(binaryBuffer, {
    fileKey: 'paste',
    pasteID: batchIndex,
    dataType: 'scene'
  });

  // 2. Precompute plain text fallback
  const plainText = formatFigmaPlainTextFallback(
    nodeCount,
    `Batch ${batchIndex} of ${totalBatches}`
  );

  // 3. Pre-instantiate Blobs
  const htmlBlob = new Blob([htmlString], { type: 'text/html' });
  const plainTextBlob = new Blob([plainText], { type: 'text/plain' });

  // 4. Pre-instantiate standard ClipboardItem if available in current JS environment
  let clipboardItem: ClipboardItem | null = null;
  if (typeof ClipboardItem !== 'undefined') {
    try {
      clipboardItem = new ClipboardItem({
        'text/html': htmlBlob,
        'text/plain': plainTextBlob
      });
    } catch {
      // If constructor fails in testing/headless context, keep null and fallback on write
      clipboardItem = null;
    }
  }

  const preparedAt = Date.now();
  const expiresAt = preparedAt + (ttlMs ?? DEFAULT_PAYLOAD_TTL_MS);

  return {
    batchId,
    batchIndex,
    totalBatches,
    nodeCount,
    binaryBuffer,
    htmlString,
    plainText,
    htmlBlob,
    plainTextBlob,
    clipboardItem,
    preparedAt,
    expiresAt
  };
}

/**
 * Executes direct zero-I/O clipboard write of a precomputed batch payload.
 * Must be invoked directly from user activation event without awaiting prior serialization.
 */
export async function writePreparedBatchDirectly(
  prepared: PreparedClipboardBatch
): Promise<ClipboardWriteConfirmation> {
  const now = Date.now();
  if (now > prepared.expiresAt) {
    throw new ClipboardWriteError(
      'PAYLOAD_EXPIRED',
      `Prepared clipboard batch has expired (TTL ${Math.round(DEFAULT_PAYLOAD_TTL_MS / 1000)}s). Please prepare the batch again.`
    );
  }

  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new ClipboardWriteError(
      'CLIPBOARD_NOT_SUPPORTED',
      'Clipboard API is not supported in this runtime environment.'
    );
  }

  try {
    if (typeof navigator.clipboard.write === 'function') {
      const itemToWrite =
        prepared.clipboardItem ??
        (typeof ClipboardItem !== 'undefined'
          ? new ClipboardItem({
              'text/html': prepared.htmlBlob,
              'text/plain': prepared.plainTextBlob
            })
          : null);

      if (itemToWrite) {
        await navigator.clipboard.write([itemToWrite]);
      } else if (typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(prepared.plainText);
      } else {
        throw new ClipboardWriteError(
          'CLIPBOARD_NOT_SUPPORTED',
          'Neither clipboard.write nor clipboard.writeText are available.'
        );
      }
    } else if (typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(prepared.plainText);
    } else {
      throw new ClipboardWriteError(
        'CLIPBOARD_NOT_SUPPORTED',
        'navigator.clipboard.write is not a function.'
      );
    }
  } catch (err: unknown) {
    if (err instanceof ClipboardWriteError) {
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('permission') || message.includes('denied') || message.includes('NotAllowedError')) {
      throw new ClipboardWriteError('PERMISSION_DENIED', `Clipboard permission denied: ${message}`, err);
    }
    if (message.includes('activation') || message.includes('transient') || message.includes('gesture')) {
      throw new ClipboardWriteError('USER_ACTIVATION_LOST', `User activation expired before write: ${message}`, err);
    }

    throw new ClipboardWriteError('WRITE_FAILED', `Clipboard write failed: ${message}`, err);
  }

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  const pasteKey = isMac ? 'Cmd+V' : 'Ctrl+V';

  return {
    success: true,
    batchId: prepared.batchId,
    batchIndex: prepared.batchIndex,
    totalBatches: prepared.totalBatches,
    timestamp: Date.now(),
    instructions: `Payload copied to clipboard. Open your target Figma file and press ${pasteKey} to paste.`
  };
}
