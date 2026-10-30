import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  captureCanvasSnapshot,
  captureVideoFrame,
  detectBraveFarbling
} from '../../core/assets/canvas-snapshot';

describe('Canvas and Video Snapshot Extractor with Tainted Canvas & Brave Farbling Guards', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 200;
    document.body.appendChild(canvas);
  });

  describe('captureCanvasSnapshot', () => {
    it('captures pixel data from a valid canvas', () => {
      // Mock toDataURL on canvas
      vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,mockPngBytes');

      const result = captureCanvasSnapshot(canvas);
      expect(result.captured).toBe(true);
      expect(result.dataUrl).toBe('data:image/png;base64,mockPngBytes');
      expect(result.width).toBe(300);
      expect(result.height).toBe(200);
      expect(result.isTainted).toBe(false);
    });

    it('handles zero-dimension canvas gracefully without errors', () => {
      canvas.width = 0;
      canvas.height = 0;

      const result = captureCanvasSnapshot(canvas);
      expect(result.captured).toBe(false);
      expect(result.diagnostics.some((d) => d.code === 'CANVAS_EMPTY_DIMENSIONS')).toBe(true);
    });

    it('traps SecurityError when canvas is tainted by cross-origin resources', () => {
      // Mock SecurityError thrown by toDataURL
      vi.spyOn(canvas, 'toDataURL').mockImplementation(() => {
        const err = new Error("Failed to execute 'toDataURL' on 'HTMLCanvasElement': Tainted canvases may not be exported.");
        err.name = 'SecurityError';
        throw err;
      });

      const result = captureCanvasSnapshot(canvas);
      expect(result.captured).toBe(false);
      expect(result.isTainted).toBe(true);
      expect(result.diagnostics.some((d) => d.code === 'CANVAS_TAINTED_CROSS_ORIGIN')).toBe(true);
      expect(result.diagnostics[0]?.severity).toBe('warning');
    });
  });

  describe('detectBraveFarbling', () => {
    it('detects farbling when consecutive reads return different data', () => {
      let callCount = 0;
      vi.spyOn(canvas, 'toDataURL').mockImplementation(() => {
        callCount++;
        return `data:image/png;base64,noise_${callCount}`;
      });

      const farbling = detectBraveFarbling(canvas);
      expect(farbling).toBe(true);
    });

    it('returns false when canvas readback is completely stable and deterministic', () => {
      vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,stable_output');

      // Ensure navigator.brave is not set
      if (typeof navigator !== 'undefined') {
        (navigator as any).brave = undefined;
      }

      const farbling = detectBraveFarbling(canvas);
      expect(farbling).toBe(false);
    });
  });

  describe('captureVideoFrame', () => {
    it('returns poster image attribute directly when present', () => {
      const video = document.createElement('video');
      video.setAttribute('poster', 'https://example.com/video-poster.jpg');
      video.setAttribute('width', '640');
      video.setAttribute('height', '360');

      const result = captureVideoFrame(video);
      expect(result.captured).toBe(true);
      expect(result.dataUrl).toBe('https://example.com/video-poster.jpg');
      expect(result.diagnostics[0]?.code).toBe('VIDEO_POSTER_FRAME_CAPTURED');
    });

    it('returns diagnostic if video has no poster and zero dimensions', () => {
      const video = document.createElement('video');
      const result = captureVideoFrame(video);
      expect(result.captured).toBe(false);
      expect(result.diagnostics.some((d) => d.code === 'VIDEO_FRAME_UNAVAILABLE')).toBe(true);
    });
  });
});
