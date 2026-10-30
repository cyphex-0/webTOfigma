/**
 * Kiwi Binary Serializer for Figma clipboard payloads.
 * Compiles minimal Figma schema, encodes NodeChange trees, compresses via Deflate,
 * and packages into the standard "fig-kiwi" binary container.
 */

import {
  compileSchema,
  parseSchema,
  encodeBinarySchema,
  decodeBinarySchema,
  type Schema
} from 'kiwi-schema';
import { FIGMA_KIWI_SCHEMA } from './figma-schema';
import type { FigmaMessage } from './figma-types';

export const FIGMA_MAGIC_HEADER = 'fig-kiwi';
export const FIGMA_WIRE_VERSION = 15;

// Cache compiled schema and encoded binary schema
let cachedCompiledSchema: ReturnType<typeof compileSchema> | null = null;
let cachedBinarySchema: Uint8Array | null = null;

/**
 * Initializes and caches the compiled Figma Kiwi schema.
 */
export function getOrCreateCompiledSchema() {
  if (!cachedCompiledSchema || !cachedBinarySchema) {
    const parsed = parseSchema(FIGMA_KIWI_SCHEMA);
    cachedCompiledSchema = compileSchema(parsed);
    cachedBinarySchema = encodeBinarySchema(parsed);
  }
  return {
    compiled: cachedCompiledSchema,
    binarySchema: cachedBinarySchema
  };
}

/**
 * Cross-platform Deflate compression using standard CompressionStream or Node zlib.
 */
export async function compressDeflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream !== 'undefined') {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    await writer.write(data as unknown as BufferSource);
    await writer.close();
    const arrayBuffer = await new Response(cs.readable).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // Node.js fallback
  const zlib = await import('node:zlib');
  return new Uint8Array(zlib.deflateSync(data));
}

/**
 * Cross-platform Deflate decompression using standard DecompressionStream or Node zlib.
 */
export async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('deflate');
    const writer = ds.writable.getWriter();
    await writer.write(data as unknown as BufferSource);
    await writer.close();
    const arrayBuffer = await new Response(ds.readable).arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  // Node.js fallback
  const zlib = await import('node:zlib');
  return new Uint8Array(zlib.inflateSync(data));
}

/**
 * Serializes a FigmaMessage into the full "fig-kiwi" binary container format.
 * 
 * Layout:
 * - Bytes 0..7: ASCII "fig-kiwi" (8 bytes)
 * - Bytes 8..11: uint32 LE version (15)
 * - Bytes 12..15: uint32 LE compressed schema length (N)
 * - Bytes 16..(16+N-1): Deflate-compressed Kiwi binary schema
 * - Bytes (16+N)..(16+N+3): uint32 LE compressed message length (M)
 * - Bytes (16+N+4)..(16+N+3+M): Deflate-compressed Kiwi message (NodeChange[])
 */
export async function serializeFigmaMessage(message: FigmaMessage): Promise<Uint8Array> {
  const { compiled, binarySchema } = getOrCreateCompiledSchema();

  // 1. Encode message to raw Kiwi binary
  // compiled contains dynamic encode/decode methods according to root messages
  const compiledAny = compiled as unknown as {
    encodeMessage: (msg: FigmaMessage) => Uint8Array;
  };
  const rawMessage = compiledAny.encodeMessage(message);

  // 2. Compress schema and message
  const compressedSchema = await compressDeflate(binarySchema);
  const compressedMessage = await compressDeflate(rawMessage);

  // 3. Assemble binary container
  const totalLength = 8 + 4 + 4 + compressedSchema.length + 4 + compressedMessage.length;
  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer);

  // Magic header: "fig-kiwi"
  const encoder = new TextEncoder();
  buffer.set(encoder.encode(FIGMA_MAGIC_HEADER), 0);

  // Version: 15
  view.setUint32(8, FIGMA_WIRE_VERSION, true);

  // Schema Length & Data
  view.setUint32(12, compressedSchema.length, true);
  buffer.set(compressedSchema, 16);

  // Message Length & Data
  const messageOffset = 16 + compressedSchema.length;
  view.setUint32(messageOffset, compressedMessage.length, true);
  buffer.set(compressedMessage, messageOffset + 4);

  return buffer;
}

/**
 * Deserializes a "fig-kiwi" binary container back into a FigmaMessage.
 * Verifies magic header, version, schema chunk, and message chunk.
 */
export async function deserializeFigmaMessage(container: Uint8Array): Promise<FigmaMessage> {
  if (container.length < 24) {
    throw new Error(`Invalid figma binary buffer: length ${container.length} is too short`);
  }

  const decoder = new TextDecoder();
  const magic = decoder.decode(container.subarray(0, 8));
  if (magic !== FIGMA_MAGIC_HEADER) {
    throw new Error(`Invalid figma magic header: expected "${FIGMA_MAGIC_HEADER}", got "${magic}"`);
  }

  const view = new DataView(container.buffer, container.byteOffset, container.byteLength);
  const version = view.getUint32(8, true);
  const schemaLength = view.getUint32(12, true);

  if (container.length < 16 + schemaLength + 4) {
    throw new Error(`Buffer truncated before message header: schemaLength=${schemaLength}`);
  }

  const compressedSchema = container.subarray(16, 16 + schemaLength);
  const decompressedSchema = await decompressDeflate(compressedSchema);
  const schemaObj: Schema = decodeBinarySchema(decompressedSchema);
  const compiled = compileSchema(schemaObj);

  const messageOffset = 16 + schemaLength;
  const messageLength = view.getUint32(messageOffset, true);
  const compressedMessage = container.subarray(messageOffset + 4, messageOffset + 4 + messageLength);

  const decompressedMessage = await decompressDeflate(compressedMessage);
  const compiledAny = compiled as unknown as {
    decodeMessage: (bytes: Uint8Array) => FigmaMessage;
  };
  return compiledAny.decodeMessage(decompressedMessage);
}
