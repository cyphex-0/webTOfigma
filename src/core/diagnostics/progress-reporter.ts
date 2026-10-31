/**
 * Progress Reporter and Export Completion Summarizer.
 * 
 * Reports accurate progress across 12 distinct export stages:
 * - permission, discovery, route-review, page-loading, lazy-load-settling,
 *   dom-extraction, asset-retrieval, style-layout-conversion, scene-assembly,
 *   serialization, ready-to-copy, clipboard-copy.
 * 
 * Strict Non-Negotiable Contract:
 * - Report exact counts where known: discovered, selected, queued, processing,
 *   succeeded, failed, skipped, and copied batches.
 * - Never fabricate percentage progress from elapsed time or fake timers.
 * - Compiles an evidence-based completion summary with fidelity classifications.
 */

import type { PageFidelityReport } from './fidelity-classifier';

export type ExportProgressStage =
  | 'permission'
  | 'discovery'
  | 'route-review'
  | 'page-loading'
  | 'lazy-load-settling'
  | 'dom-extraction'
  | 'asset-retrieval'
  | 'style-layout-conversion'
  | 'scene-assembly'
  | 'serialization'
  | 'ready-to-copy'
  | 'clipboard-copy';

export interface ProgressCounts {
  discovered: number;
  selected: number;
  queued: number;
  processing: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalBatches: number;
  copiedBatches: number;
}

export interface ProgressSnapshot {
  jobId: string;
  stage: ExportProgressStage;
  stageDescription: string;
  counts: ProgressCounts;
  currentRouteUrl?: string | undefined;
  activeBatchIndex?: number | undefined;
  updatedAt: number;
}

export interface ExportCompletionSummary {
  jobId: string;
  completedAt: number;
  durationMs: number;
  pagesFound: number;
  pagesSelected: number;
  pagesSucceeded: number;
  pagesFailed: number;
  pagesSkipped: number;
  totalAssetCount: number;
  totalAssetBytes: number;
  totalBatches: number;
  batchesCopied: number;
  warningsCount: number;
  errorsCount: number;
  fidelityBreakdown: {
    high: number;
    partial: number;
    unsupported: number;
  };
  fidelityReports: PageFidelityReport[];
}

export class ProgressReporter {
  private readonly jobId: string;
  private readonly startTime: number;
  private currentStage: ExportProgressStage;
  private stageDescription: string;
  private counts: ProgressCounts;
  private currentRouteUrl?: string | undefined;
  private activeBatchIndex?: number | undefined;
  private warningsCount = 0;
  private errorsCount = 0;
  private totalAssets = 0;
  private totalAssetBytes = 0;
  private readonly fidelityReports: PageFidelityReport[] = [];

  constructor(jobId: string, initialStage: ExportProgressStage = 'permission') {
    this.jobId = jobId;
    this.startTime = Date.now();
    this.currentStage = initialStage;
    this.stageDescription = this.getDefaultDescription(initialStage);
    this.counts = {
      discovered: 0,
      selected: 0,
      queued: 0,
      processing: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      totalBatches: 0,
      copiedBatches: 0
    };
  }

  private getDefaultDescription(stage: ExportProgressStage): string {
    switch (stage) {
      case 'permission':
        return 'Verifying extension and active tab permissions...';
      case 'discovery':
        return 'Discovering site routes and sitemaps...';
      case 'route-review':
        return 'Waiting for route review and selection...';
      case 'page-loading':
        return 'Loading page document into capture tab...';
      case 'lazy-load-settling':
        return 'Waiting for lazy assets and layout to settle...';
      case 'dom-extraction':
        return 'Extracting DOM nodes, styles, and geometry...';
      case 'asset-retrieval':
        return 'Fetching image and font assets locally...';
      case 'style-layout-conversion':
        return 'Translating styles and computing Auto Layout...';
      case 'scene-assembly':
        return 'Assembling multi-page scene canvas and sections...';
      case 'serialization':
        return 'Encoding scene into binary Kiwi wire format...';
      case 'ready-to-copy':
        return 'Export ready. Precomputing clipboard payloads...';
      case 'clipboard-copy':
        return 'Writing prepared batches to system clipboard...';
    }
  }

  setStage(stage: ExportProgressStage, customDescription?: string): void {
    this.currentStage = stage;
    this.stageDescription = customDescription || this.getDefaultDescription(stage);
  }

  updateCounts(partial: Partial<ProgressCounts>): void {
    this.counts = {
      ...this.counts,
      ...partial
    };
  }

  setCurrentRoute(url: string | undefined): void {
    this.currentRouteUrl = url;
  }

  setActiveBatch(batchIndex: number | undefined): void {
    this.activeBatchIndex = batchIndex;
  }

  recordDiagnostic(severity: 'warning' | 'error' | 'fatal' | 'info'): void {
    if (severity === 'warning') this.warningsCount++;
    if (severity === 'error' || severity === 'fatal') this.errorsCount++;
  }

  recordAssets(count: number, bytes: number): void {
    this.totalAssets += count;
    this.totalAssetBytes += bytes;
  }

  addFidelityReport(report: PageFidelityReport): void {
    this.fidelityReports.push(report);
  }

  getSnapshot(): ProgressSnapshot {
    return {
      jobId: this.jobId,
      stage: this.currentStage,
      stageDescription: this.stageDescription,
      counts: { ...this.counts },
      currentRouteUrl: this.currentRouteUrl,
      activeBatchIndex: this.activeBatchIndex,
      updatedAt: Date.now()
    };
  }

  generateCompletionSummary(): ExportCompletionSummary {
    const fidelityBreakdown = {
      high: 0,
      partial: 0,
      unsupported: 0
    };

    for (const report of this.fidelityReports) {
      fidelityBreakdown[report.fidelity]++;
    }

    return {
      jobId: this.jobId,
      completedAt: Date.now(),
      durationMs: Date.now() - this.startTime,
      pagesFound: this.counts.discovered,
      pagesSelected: this.counts.selected,
      pagesSucceeded: this.counts.succeeded,
      pagesFailed: this.counts.failed,
      pagesSkipped: this.counts.skipped,
      totalAssetCount: this.totalAssets,
      totalAssetBytes: this.totalAssetBytes,
      totalBatches: this.counts.totalBatches,
      batchesCopied: this.counts.copiedBatches,
      warningsCount: this.warningsCount,
      errorsCount: this.errorsCount,
      fidelityBreakdown,
      fidelityReports: [...this.fidelityReports]
    };
  }
}
