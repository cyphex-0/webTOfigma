/**
 * Image Metadata Parser.
 * Detects image formats (PNG, JPEG, WebP, GIF, AVIF, SVG) and MIME types from binary headers (magic bytes)
 * and extracts intrinsic dimensions where available.
 */

export type ImageFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'avif' | 'svg' | 'unknown';

export interface ImageHeaderInfo {
  format: ImageFormat;
  mimeType: string;
  width?: number | undefined;
  height?: number | undefined;
  byteLength: number;
}

/**
 * Reads a 32-bit big-endian unsigned integer from a byte array.
 */
function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0;
}

/**
 * Reads a 16-bit little-endian unsigned integer from a byte array.
 */
function readUInt16LE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)) >>> 0;
}

/**
 * Inspects binary magic bytes and extracts image format, MIME type, and intrinsic dimensions.
 */
export function parseImageHeader(bytes: Uint8Array): ImageHeaderInfo {
  const len = bytes.length;

  if (len === 0) {
    return {
      format: 'unknown',
      mimeType: 'application/octet-stream',
      byteLength: 0
    };
  }

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    len >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    // Width and height in IHDR chunk (bytes 16..23)
    let width: number | undefined;
    let height: number | undefined;
    if (len >= 24) {
      width = readUInt32BE(bytes, 16);
      height = readUInt32BE(bytes, 20);
    }
    return {
      format: 'png',
      mimeType: 'image/png',
      width,
      height,
      byteLength: len
    };
  }

  // 2. JPEG: FF D8 FF
  if (len >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return {
      format: 'jpeg',
      mimeType: 'image/jpeg',
      byteLength: len
    };
  }

  // 3. GIF: 47 49 46 38 ('GIF8')
  if (
    len >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  ) {
    let width: number | undefined;
    let height: number | undefined;
    if (len >= 10) {
      width = readUInt16LE(bytes, 6);
      height = readUInt16LE(bytes, 8);
    }
    return {
      format: 'gif',
      mimeType: 'image/gif',
      width,
      height,
      byteLength: len
    };
  }

  // 4. WebP: 'RIFF' .... 'WEBP'
  if (
    len >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return {
      format: 'webp',
      mimeType: 'image/webp',
      byteLength: len
    };
  }

  // 5. AVIF: ftypavif or ftypavis
  if (len >= 16) {
    const slice = new TextDecoder('ascii').decode(bytes.slice(4, 16));
    if (slice.includes('ftypavif') || slice.includes('ftypavis')) {
      return {
        format: 'avif',
        mimeType: 'image/avif',
        byteLength: len
      };
    }
  }

  // 6. SVG: check leading text characters
  const textPrefix = new TextDecoder('utf-8').decode(bytes.slice(0, Math.min(256, len))).trim().toLowerCase();
  if (textPrefix.startsWith('<svg') || textPrefix.startsWith('<?xml') || textPrefix.includes('<svg')) {
    return {
      format: 'svg',
      mimeType: 'image/svg+xml',
      byteLength: len
    };
  }

  return {
    format: 'unknown',
    mimeType: 'application/octet-stream',
    byteLength: len
  };
}
