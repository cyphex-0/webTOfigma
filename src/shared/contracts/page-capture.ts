/**
 * Page capture metadata and request contracts.
 */

export interface PageRequest {
  url: string;
  discoveryIndex: number;
  crawlDepth: number;
  routeCategory?: string | undefined;
  paginationNumber?: number | undefined;
  originMetadata: {
    origin: string;
    referrer?: string | undefined;
  };
}

export type DocumentReadiness = 'loading' | 'interactive' | 'complete';

export interface ViewportDimensions {
  width: number;
  height: number;
  devicePixelRatio: number;
  scrollX: number;
  scrollY: number;
}

export interface PageCaptureMetadata {
  schemaVersion: number;
  pageIndex: number;
  requestedUrl: string;
  finalUrl: string;
  title: string;
  readinessState: DocumentReadiness;
  navigationStatus?: number | undefined;
  capturedAt: number;
  viewport: ViewportDimensions;
  documentDimensions: {
    width: number;
    height: number;
  };
  captureMode: string;
}
