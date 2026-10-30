/**
 * Canvas and Video Snapshot Extractor.
 * Safely captures HTML5 canvas and video frames with strict cross-origin tainted canvas guards,
 * honest security error handling, and Brave Shields farbling detection.
 */

import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface CanvasSnapshotOptions {
  allowSnapshotCapture?: boolean | undefined;
  format?: 'image/png' | 'image/webp' | 'image/jpeg' | undefined;
  quality?: number | undefined;
}

export interface CanvasSnapshotResult {
  captured: boolean;
  dataUrl?: string | undefined;
  width: number;
  height: number;
  isTainted: boolean;
  braveFarblingDetected?: boolean | undefined;
  diagnostics: ExportDiagnostic[];
}

/**
 * Checks whether Brave Shields canvas fingerprinting randomization (farbling)
 * is active in the current execution context by testing read stability on the canvas.
 */
export function detectBraveFarbling(canvas: HTMLCanvasElement): boolean {
  try {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    const hasBrave = Boolean(nav && typeof nav.brave?.isBrave === 'function');

    const read1 = canvas.toDataURL('image/png');
    const read2 = canvas.toDataURL('image/png');

    if (read1 !== read2) {
      return true;
    }

    return hasBrave;
  } catch {
    return false;
  }
}

/**
 * Captures pixel data from an HTML5 canvas element with safe SecurityError trapping.
 */
export function captureCanvasSnapshot(
  canvas: HTMLCanvasElement,
  options?: CanvasSnapshotOptions
): CanvasSnapshotResult {
  const width = canvas.width || 0;
  const height = canvas.height || 0;
  const diagnostics: ExportDiagnostic[] = [];

  if (width === 0 || height === 0) {
    return {
      captured: false,
      width,
      height,
      isTainted: false,
      diagnostics: [
        {
          code: 'CANVAS_EMPTY_DIMENSIONS',
          severity: 'info',
          message: `Canvas has zero dimensions (${width}x${height})`,
          phase: 'asset-fetch',
          recoveryAction: 'Check canvas width and height attributes',
          timestamp: Date.now()
        }
      ]
    };
  }

  const format = options?.format || 'image/png';
  const quality = options?.quality ?? 0.92;

  try {
    const dataUrl = canvas.toDataURL(format, quality);

    const braveFarblingDetected = detectBraveFarbling(canvas);
    if (braveFarblingDetected) {
      diagnostics.push({
        code: 'BRAVE_SHIELDS_CANVAS_FARBLING_DETECTED',
        severity: 'info',
        message: 'Brave Shields fingerprinting protection active on canvas snapshot in current execution context',
        phase: 'asset-fetch',
        recoveryAction: 'Canvas pixel readback includes farbling noise as intended by user privacy settings',
        timestamp: Date.now()
      });
    }

    return {
      captured: true,
      dataUrl,
      width,
      height,
      isTainted: false,
      braveFarblingDetected,
      diagnostics
    };
  } catch (err: unknown) {
    const isSecurityErr =
      err instanceof Error &&
      (err.name === 'SecurityError' ||
        err.message.toLowerCase().includes('tainted') ||
        err.message.toLowerCase().includes('cross-origin'));

    diagnostics.push({
      code: 'CANVAS_TAINTED_CROSS_ORIGIN',
      severity: 'warning',
      message:
        'Canvas is tainted by cross-origin resources and cannot be exported directly via toDataURL',
      phase: 'asset-fetch',
      recoveryAction:
        'Serve cross-origin images with Access-Control-Allow-Origin or use screenshot capture',
      timestamp: Date.now()
    });

    return {
      captured: false,
      width,
      height,
      isTainted: isSecurityErr,
      diagnostics
    };
  }
}

/**
 * Captures a representative snapshot from a video element (poster or rendered frame).
 */
export function captureVideoFrame(
  video: HTMLVideoElement,
  options?: CanvasSnapshotOptions
): CanvasSnapshotResult {
  const diagnostics: ExportDiagnostic[] = [];

  // 1. If poster is present, return poster URL as snapshot reference
  const poster = video.getAttribute('poster');
  if (poster && poster.trim()) {
    return {
      captured: true,
      dataUrl: poster.trim(),
      width: video.videoWidth || parseFloat(video.getAttribute('width') || '0') || 640,
      height: video.videoHeight || parseFloat(video.getAttribute('height') || '0') || 360,
      isTainted: false,
      diagnostics: [
        {
          code: 'VIDEO_POSTER_FRAME_CAPTURED',
          severity: 'info',
          message: 'Video poster attribute used as representative visual asset',
          phase: 'asset-fetch',
          recoveryAction: 'Original video stream cannot be exported directly',
          timestamp: Date.now()
        }
      ]
    };
  }

  // 2. If video has dimensions, attempt offscreen canvas snapshot
  const width = video.videoWidth || parseFloat(video.getAttribute('width') || '0') || 0;
  const height = video.videoHeight || parseFloat(video.getAttribute('height') || '0') || 0;

  if (width === 0 || height === 0) {
    return {
      captured: false,
      width,
      height,
      isTainted: false,
      diagnostics: [
        {
          code: 'VIDEO_FRAME_UNAVAILABLE',
          severity: 'info',
          message: 'Video has no poster and zero videoWidth/videoHeight dimensions',
          phase: 'asset-fetch',
          recoveryAction: 'Provide a video poster attribute or wait for video metadata to load',
          timestamp: Date.now()
        }
      ]
    };
  }

  try {
    const offscreen = document.createElement('canvas');
    offscreen.width = width;
    offscreen.height = height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      return {
        captured: false,
        width,
        height,
        isTainted: false,
        diagnostics
      };
    }

    ctx.drawImage(video, 0, 0, width, height);
    return captureCanvasSnapshot(offscreen, options);
  } catch (err: unknown) {
    diagnostics.push({
      code: 'VIDEO_FRAME_CAPTURE_FAILED',
      severity: 'warning',
      message: err instanceof Error ? err.message : String(err),
      phase: 'asset-fetch',
      recoveryAction: 'Use video poster attribute',
      timestamp: Date.now()
    });

    return {
      captured: false,
      width,
      height,
      isTainted: true,
      diagnostics
    };
  }
}
