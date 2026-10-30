/**
 * Precomputed Clipboard Writer for Figma Proof of Concept.
 * 
 * Strict Zero-I/O Architecture:
 * All Kiwi serialization, Deflate compression, HTML envelope wrapping, Blob construction,
 * and ClipboardItem instantiation occur BEFORE the user clicks the copy button.
 * The click handler calls `navigator.clipboard.write([preparedItem])` synchronously/directly.
 */

import { serializeFigmaMessage } from './kiwi-serializer';
import { formatFigmaClipboardHtml, formatFigmaPlainTextFallback } from './clipboard-envelope';
import { POC_FIXTURES, type FixtureDescriptor } from './fixtures';
import type { FigmaMessage } from './figma-types';

export interface PreparedClipboardPayload {
  fixtureId: string;
  title: string;
  nodeCount: number;
  binaryBytes: number;
  htmlBytes: number;
  plainText: string;
  item: ClipboardItem;
  createdAt: number;
}

/**
 * Precomputes a full Figma clipboard payload ahead of user interaction.
 * Produces a ready-to-write ClipboardItem with standard text/html and text/plain MIME types.
 */
export async function prepareClipboardPayload(
  fixtureOrId: string | FixtureDescriptor,
  customMessage?: FigmaMessage
): Promise<PreparedClipboardPayload> {
  const descriptor: FixtureDescriptor | undefined =
    typeof fixtureOrId === 'string'
      ? POC_FIXTURES[fixtureOrId]
      : fixtureOrId;

  const message: FigmaMessage =
    customMessage ??
    descriptor?.fixture ??
    POC_FIXTURES['nested-card']!.fixture;

  const title = descriptor?.title ?? 'Custom Scene Payload';
  const fixtureId = descriptor?.id ?? 'custom';
  const nodeCount = message.nodeChanges.length;

  // 1. Serialize message to compressed fig-kiwi binary container
  const binaryContainer = await serializeFigmaMessage(message);

  // 2. Format Figma HTML clipboard envelope and plain text fallback
  const html = formatFigmaClipboardHtml(binaryContainer);
  const plainText = formatFigmaPlainTextFallback(nodeCount, title);

  // 3. Instantiate Blobs for both standard MIME representations
  const htmlBlob = new Blob([html], { type: 'text/html' });
  const plainTextBlob = new Blob([plainText], { type: 'text/plain' });

  // 4. Instantiate standard ClipboardItem
  const item = new ClipboardItem({
    'text/html': htmlBlob,
    'text/plain': plainTextBlob
  });

  return {
    fixtureId,
    title,
    nodeCount,
    binaryBytes: binaryContainer.byteLength,
    htmlBytes: html.length,
    plainText,
    item,
    createdAt: Date.now()
  };
}

/**
 * Executes a zero-I/O clipboard write of an already-prepared ClipboardItem.
 * MUST be invoked directly from a user activation handler.
 */
export async function writePreparedClipboardPayload(
  prepared: PreparedClipboardPayload
): Promise<void> {
  if (!navigator.clipboard || !navigator.clipboard.write) {
    throw new Error('Async Clipboard API (navigator.clipboard.write) is not supported in this browser context.');
  }

  // Pure write call — no I/O, no network, no serialization inside this handler
  await navigator.clipboard.write([prepared.item]);
}
