import { describe, it, expect, beforeEach } from 'vitest';
import { parseImageHeader } from '../../core/assets/image-metadata';
import {
  computeContentHash,
  AssetDeduplicator
} from '../../core/assets/asset-deduplicator';

describe('Image Metadata, Content Hasher & Asset Deduplicator', () => {
  describe('parseImageHeader', () => {
    it('detects PNG magic bytes and parses intrinsic dimensions', () => {
      // 1x1 PNG header
      const pngBytes = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
        0x00, 0x00, 0x00, 0x0d, // IHDR length (13)
        0x49, 0x48, 0x44, 0x52, // 'IHDR'
        0x00, 0x00, 0x03, 0x20, // Width: 800
        0x00, 0x00, 0x02, 0x58, // Height: 600
        0x08, 0x06, 0x00, 0x00, 0x00
      ]);

      const info = parseImageHeader(pngBytes);
      expect(info.format).toBe('png');
      expect(info.mimeType).toBe('image/png');
      expect(info.width).toBe(800);
      expect(info.height).toBe(600);
      expect(info.byteLength).toBe(pngBytes.length);
    });

    it('detects JPEG header', () => {
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      const info = parseImageHeader(jpegBytes);
      expect(info.format).toBe('jpeg');
      expect(info.mimeType).toBe('image/jpeg');
    });

    it('detects GIF89a header and parses dimensions', () => {
      const gifBytes = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
        0x64, 0x00, // Width: 100 (little endian)
        0xc8, 0x00 // Height: 200 (little endian)
      ]);

      const info = parseImageHeader(gifBytes);
      expect(info.format).toBe('gif');
      expect(info.mimeType).toBe('image/gif');
      expect(info.width).toBe(100);
      expect(info.height).toBe(200);
    });

    it('detects WebP RIFF header', () => {
      const webpBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x00, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50 // WEBP
      ]);
      const info = parseImageHeader(webpBytes);
      expect(info.format).toBe('webp');
      expect(info.mimeType).toBe('image/webp');
    });

    it('detects SVG markup from text buffer', () => {
      const svgText = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>';
      const svgBytes = new TextEncoder().encode(svgText);
      const info = parseImageHeader(svgBytes);
      expect(info.format).toBe('svg');
      expect(info.mimeType).toBe('image/svg+xml');
    });
  });

  describe('computeContentHash', () => {
    it('computes consistent 64-char hex hash for identical byte payloads', async () => {
      const b1 = new Uint8Array([1, 2, 3, 4, 5]);
      const b2 = new Uint8Array([1, 2, 3, 4, 5]);
      const b3 = new Uint8Array([5, 4, 3, 2, 1]);

      const h1 = await computeContentHash(b1);
      const h2 = await computeContentHash(b2);
      const h3 = await computeContentHash(b3);

      expect(h1).toHaveLength(64);
      expect(h1).toBe(h2);
      expect(h1).not.toBe(h3);
    });
  });

  describe('AssetDeduplicator', () => {
    let deduplicator: AssetDeduplicator;

    beforeEach(() => {
      deduplicator = new AssetDeduplicator({
        maxFileBytes: 1024 * 1024, // 1MB file limit
        maxJobBytes: 5 * 1024 * 1024 // 5MB job limit
      });
    });

    it('registers unique asset and collapses identical duplicates to single record', async () => {
      const logoBytes = new Uint8Array([10, 20, 30, 40, 50, 60]);

      // Card 1 registers logo
      const res1 = await deduplicator.register(logoBytes, {
        url: 'https://example.com/logo.png',
        kind: 'image-bitmap',
        mimeType: 'image/png'
      });

      expect(res1.isDuplicate).toBe(false);
      expect(res1.asset.assetId).toBeDefined();
      expect(deduplicator.getByteUsage()).toBe(6);

      // Card 2 registers identical logo
      const res2 = await deduplicator.register(logoBytes, {
        url: 'https://example.com/logo.png',
        kind: 'image-bitmap',
        mimeType: 'image/png'
      });

      expect(res2.isDuplicate).toBe(true);
      expect(res2.asset.assetId).toBe(res1.asset.assetId);
      // Byte usage should remain unchanged (deduplicated)
      expect(deduplicator.getByteUsage()).toBe(6);
      expect(deduplicator.getAll().length).toBe(1);
    });

    it('enforces per-file byte limit', async () => {
      const hugeBytes = new Uint8Array(2 * 1024 * 1024); // 2MB exceeds 1MB limit
      await expect(
        deduplicator.register(hugeBytes, {
          url: 'https://example.com/huge.png',
          kind: 'image-bitmap'
        })
      ).rejects.toThrow(/exceeds per-file limit/);
    });

    it('enforces total-job byte limit', async () => {
      const smallDedupe = new AssetDeduplicator({
        maxFileBytes: 500,
        maxJobBytes: 800
      });

      const b1 = new Uint8Array(450);
      b1[0] = 1;
      const b2 = new Uint8Array(450);
      b2[0] = 2;

      await smallDedupe.register(b1, { url: '1.png', kind: 'image-bitmap' });
      // Second unique asset pushes total to 900 > 800 limit
      await expect(
        smallDedupe.register(b2, { url: '2.png', kind: 'image-bitmap' })
      ).rejects.toThrow(/Asset job budget exceeded/);
    });

    it('stores and retrieves binary buffer by assetId', async () => {
      const sample = new Uint8Array([42, 43, 44]);
      const res = await deduplicator.register(sample, { url: 'test.png', kind: 'image-bitmap' });

      const retrieved = deduplicator.getBytes(res.asset.assetId);
      expect(retrieved).toEqual(sample);
    });
  });
});
