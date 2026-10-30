/**
 * Clipboard Envelope Formatter for Figma.
 * Wraps binary Kiwi payloads into Figma-compatible HTML comments and creates
 * plain-text fallbacks for standard ClipboardItem construction.
 */

import type { FigmaClipboardMeta } from './figma-types';

/**
 * Converts a Uint8Array into a Base64 string across browser and Node environments.
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/**
 * Converts a Base64 string into a Uint8Array across browser and Node environments.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export interface FigmaClipboardPayload {
  html: string;
  plainText: string;
  meta: FigmaClipboardMeta;
  binaryBuffer: Uint8Array;
}

/**
 * Creates Figma's exact HTML clipboard envelope enclosing base64-encoded
 * metadata and Kiwi binary buffers.
 */
export function formatFigmaClipboardHtml(
  figmaBinary: Uint8Array,
  meta: FigmaClipboardMeta = { fileKey: 'paste', pasteID: 1, dataType: 'scene' }
): string {
  const metaJson = JSON.stringify(meta);
  const metaEncoder = new TextEncoder();
  const metaBytes = metaEncoder.encode(metaJson);

  const metaBase64 = uint8ArrayToBase64(metaBytes);
  const figmaBase64 = uint8ArrayToBase64(figmaBinary);

  // Figma uses <!--(figmeta)...(/figmeta)--><!--(figma)...(/figma)-->
  return `<meta charset="utf-8"><span><!--(figmeta)${metaBase64}(/figmeta)--><!--(figma)${figmaBase64}(/figma)--></span>`;
}

/**
 * Creates a human-readable plain text fallback for the clipboard.
 */
export function formatFigmaPlainTextFallback(nodeCount: number, description?: string): string {
  const desc = description ? ` (${description})` : '';
  return `[Web-to-Figma Payload: ${nodeCount} node(s)${desc} - Paste directly into Figma using Ctrl+V or Cmd+V]`;
}

/**
 * Parses Figma clipboard HTML to extract meta and binary payloads.
 * Supports both <!--(figma)...(/figma)--> and <!--figma-->...<!--/figma--> syntax.
 */
export function parseFigmaClipboardHtml(html: string): {
  meta: FigmaClipboardMeta | null;
  binary: Uint8Array | null;
} {
  // Match figmeta
  const metaMatch =
    html.match(/<!--\(figmeta\)([\s\S]*?)\(\/figmeta\)-->/) ||
    html.match(/<!--figmeta-->([\s\S]*?)<!--\/figmeta-->/);

  let parsedMeta: FigmaClipboardMeta | null = null;
  if (metaMatch && metaMatch[1]) {
    try {
      const metaBytes = base64ToUint8Array(metaMatch[1].trim());
      const metaText = new TextDecoder().decode(metaBytes);
      parsedMeta = JSON.parse(metaText) as FigmaClipboardMeta;
    } catch {
      // Ignored if invalid JSON
    }
  }

  // Match figma
  const figmaMatch =
    html.match(/<!--\(figma\)([\s\S]*?)\(\/figma\)-->/) ||
    html.match(/<!--figma-->([\s\S]*?)<!--\/figma-->/);

  let binary: Uint8Array | null = null;
  if (figmaMatch && figmaMatch[1]) {
    try {
      binary = base64ToUint8Array(figmaMatch[1].trim());
    } catch {
      // Ignored if invalid base64
    }
  }

  return { meta: parsedMeta, binary };
}
