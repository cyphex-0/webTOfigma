import type { PageSnapshotRecord, AssetBlobRecord } from '../../core/storage/capture-database';
import type { PageCaptureMetadata } from '../../shared/contracts/page-capture';
import type { ExportJob } from '../../shared/contracts/export-job';
import type { FigmaSceneDocument } from '../../shared/contracts/scene';

export { landingPageNodes } from './landing-page.fixture';
export { nestedFlexCardNodes } from './nested-flex-card.fixture';
export { gridPageNodes } from './grid-page.fixture';
export { longArticleNodes } from './long-article.fixture';
export { svgIconNodes, svgIconRaw } from './svg-icon.fixture';

export const mockPageCaptureMetadata: PageCaptureMetadata = {
  schemaVersion: 1,
  pageIndex: 0,
  requestedUrl: 'https://example.com/landing',
  finalUrl: 'https://example.com/landing',
  title: 'Acme Cloud Platform',
  readinessState: 'complete',
  navigationStatus: 200,
  capturedAt: 1772370000000,
  viewport: {
    width: 1440,
    height: 900,
    devicePixelRatio: 2,
    scrollX: 0,
    scrollY: 0
  },
  documentDimensions: {
    width: 1440,
    height: 2400
  },
  captureMode: 'full-page'
};

export const mockPageSnapshotRecord: PageSnapshotRecord = {
  schemaVersion: 1,
  snapshotId: 'job_test_123_0',
  jobId: 'job_test_123',
  pageIndex: 0,
  metadata: mockPageCaptureMetadata,
  nodes: [],
  assetRefs: ['asset_hash_hero_banner', 'asset_hash_logo'],
  capturedAt: 1772370000000
};

export const mockAssetBlobRecord: AssetBlobRecord = {
  contentHash: 'asset_hash_hero_banner',
  mimeType: 'image/png',
  data: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), // PNG header magic
  byteLength: 8,
  storedAt: 1772370000000
};

export const mockExportJob: ExportJob = {
  schemaVersion: 1,
  jobId: 'job_test_123',
  createdAt: 1772370000000,
  updatedAt: 1772370001000,
  mode: 'full-page',
  startUrl: 'https://example.com/landing',
  selectedRoutes: ['/landing'],
  userOptions: {
    maxDepth: 1,
    maxPages: 1,
    captureImages: true,
    captureFonts: true
  },
  status: 'capturing',
  progressPercent: 30,
  currentStep: 'Capturing DOM tree',
  warnings: [],
  failures: [],
  resultManifest: {
    pageCount: 1,
    totalNodes: 1,
    totalAssets: 1,
    totalAssetBytes: 8
  }
};

export const mockSceneDocument: FigmaSceneDocument & { jobId: string } = {
  jobId: 'job_test_123',
  schemaVersion: 1,
  exportTitle: 'Acme Cloud Platform Export',
  sourceSite: 'https://example.com/landing',
  exportedAt: 1772370001000,
  pageFrames: [
    {
      id: 'node_root_frame',
      parentId: null,
      childIds: [],
      name: 'Landing Page Frame',
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 2400,
      rotation: 0,
      clipsContent: true,
      fills: [],
      strokes: [],
      effects: []
    }
  ],
  sections: [],
  metadata: {
    totalNodes: 1,
    totalAssets: 1,
    totalPages: 1,
    devicePixelRatio: 2
  }
};
