import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseDataUrl,
  fetchAssetBytes,
  AssetFetchQueue
} from '../../core/assets/asset-fetcher';
import { AssetStore } from '../../core/assets/asset-store';

describe('Bounded Asset Fetcher and In-Memory Asset Store', () => {
  describe('parseDataUrl', () => {
    it('decodes base64 data URLs into Uint8Array buffer', () => {
      // 3 bytes: 1, 2, 3 in base64 is 'AQID'
      const dataUrl = 'data:image/png;base64,AQID';
      const parsed = parseDataUrl(dataUrl);

      expect(parsed).not.toBeNull();
      expect(parsed?.mimeType).toBe('image/png');
      expect(Array.from(parsed?.bytes || [])).toEqual([1, 2, 3]);
    });

    it('decodes percent-encoded SVG data URLs into UTF-8 bytes', () => {
      const dataUrl = 'data:image/svg+xml;charset=utf-8,%3Csvg%20viewBox%3D%220%200%2010%2010%22%3E%3C%2Fsvg%3E';
      const parsed = parseDataUrl(dataUrl);

      expect(parsed).not.toBeNull();
      expect(parsed?.mimeType).toBe('image/svg+xml');
      const text = new TextDecoder().decode(parsed?.bytes);
      expect(text).toContain('<svg viewBox="0 0 10 10"></svg>');
    });

    it('returns null for non-data URLs or malformed strings', () => {
      expect(parseDataUrl('https://example.com/photo.jpg')).toBeNull();
      expect(parseDataUrl('data:image/png')).toBeNull(); // Missing comma
    });
  });

  describe('fetchAssetBytes', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('decodes inline data: URLs without network fetch', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const dataUrl = 'data:image/png;base64,AQID';

      const res = await fetchAssetBytes(dataUrl);
      expect(res.success).toBe(true);
      expect(res.bytes).toHaveLength(3);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetches remote asset using HTTP and credentials: omit', async () => {
      const mockBytes = new Uint8Array([10, 20, 30, 40]);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'content-type': 'image/png',
          'content-length': '4'
        }),
        arrayBuffer: () => Promise.resolve(mockBytes.buffer)
      } as any);

      const res = await fetchAssetBytes('https://example.com/image.png');
      expect(res.success).toBe(true);
      expect(res.bytes).toEqual(mockBytes);
      expect(res.mimeType).toBe('image/png');
    });

    it('handles HTTP error status and records diagnostic', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      } as any);

      const res = await fetchAssetBytes('https://example.com/missing.png');
      expect(res.success).toBe(false);
      expect(res.diagnostic?.code).toBe('ASSET_FETCH_HTTP_ERROR');
      expect(res.diagnostic?.message).toContain('HTTP 404');
    });

    it('handles cancellation via AbortSignal', async () => {
      const controller = new AbortController();
      controller.abort(); // already aborted

      const res = await fetchAssetBytes('https://example.com/slow.png', {
        signal: controller.signal
      });

      expect(res.success).toBe(false);
      expect(res.diagnostic?.code).toBe('ASSET_FETCH_CANCELLED');
    });
  });

  describe('AssetFetchQueue', () => {
    it('throttles concurrency to maxConcurrency limit', async () => {
      const queue = new AssetFetchQueue(2);
      let running = 0;
      let maxRunning = 0;

      const task = async () => {
        return queue.run(async () => {
          running++;
          maxRunning = Math.max(maxRunning, running);
          await new Promise((r) => setTimeout(r, 10));
          running--;
        });
      };

      await Promise.all([task(), task(), task(), task(), task()]);
      expect(maxRunning).toBeLessThanOrEqual(2);
    });
  });

  describe('AssetStore', () => {
    let store: AssetStore;

    beforeEach(() => {
      store = new AssetStore({
        maxFileBytes: 1024 * 1024,
        maxJobBytes: 10 * 1024 * 1024
      });
    });

    afterEach(() => {
      store.clear();
      vi.restoreAllMocks();
    });

    it('fetches, registers, and deduplicates identical assets', async () => {
      const samplePng = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG
        0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x64, // 100 width
        0x00, 0x00, 0x00, 0x64, // 100 height
        0x08, 0x06, 0x00, 0x00, 0x00
      ]);

      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        arrayBuffer: () => Promise.resolve(samplePng.buffer)
      } as any);

      const record1 = await store.fetchAndRegister('https://example.com/logo.png', 'image-bitmap');
      expect(record1).not.toBeNull();
      expect(record1?.mimeType).toBe('image/png');
      expect(record1?.dimensions).toEqual({ width: 100, height: 100 });

      // Second request with same URL
      const record2 = await store.fetchAndRegister('https://example.com/logo.png', 'image-bitmap');
      expect(record2?.assetId).toBe(record1?.assetId);

      expect(store.getAllAssets().length).toBe(1);
      expect(store.getBytes(record1!.assetId)).toBeDefined();
    });
  });
});
