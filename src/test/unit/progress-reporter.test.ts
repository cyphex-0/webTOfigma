import { describe, it, expect } from 'vitest';
import { ProgressReporter } from '../../core/diagnostics/progress-reporter';

describe('Progress Reporter & Completion Summary (Phase 22)', () => {
  it('initializes with permission stage and zero counts', () => {
    const reporter = new ProgressReporter('job_123');
    const snapshot = reporter.getSnapshot();

    expect(snapshot.jobId).toBe('job_123');
    expect(snapshot.stage).toBe('permission');
    expect(snapshot.counts.discovered).toBe(0);
    expect(snapshot.counts.succeeded).toBe(0);
    expect(snapshot.counts.copiedBatches).toBe(0);
  });

  it('updates stages and exact counts across multi-page export workflow', () => {
    const reporter = new ProgressReporter('job_456');

    reporter.setStage('discovery');
    reporter.updateCounts({ discovered: 15, selected: 10, queued: 10 });

    let snapshot = reporter.getSnapshot();
    expect(snapshot.stage).toBe('discovery');
    expect(snapshot.counts.discovered).toBe(15);
    expect(snapshot.counts.selected).toBe(10);

    reporter.setStage('dom-extraction');
    reporter.setCurrentRoute('https://example.com/pricing');
    reporter.updateCounts({ processing: 1, queued: 9 });

    snapshot = reporter.getSnapshot();
    expect(snapshot.stage).toBe('dom-extraction');
    expect(snapshot.currentRouteUrl).toBe('https://example.com/pricing');
    expect(snapshot.counts.processing).toBe(1);

    reporter.setStage('clipboard-copy');
    reporter.updateCounts({ succeeded: 9, failed: 1, totalBatches: 2, copiedBatches: 1 });

    snapshot = reporter.getSnapshot();
    expect(snapshot.stage).toBe('clipboard-copy');
    expect(snapshot.counts.succeeded).toBe(9);
    expect(snapshot.counts.failed).toBe(1);
    expect(snapshot.counts.copiedBatches).toBe(1);
  });

  it('compiles comprehensive completion summary with fidelity breakdown', () => {
    const reporter = new ProgressReporter('job_789');
    reporter.updateCounts({
      discovered: 5,
      selected: 5,
      succeeded: 4,
      failed: 1,
      totalBatches: 2,
      copiedBatches: 2
    });

    reporter.recordAssets(12, 1024 * 1024);
    reporter.recordDiagnostic('warning');
    reporter.recordDiagnostic('error');

    reporter.addFidelityReport({
      pageUrl: 'https://example.com/p1',
      fidelity: 'high',
      reasons: [],
      timestamp: Date.now()
    });

    reporter.addFidelityReport({
      pageUrl: 'https://example.com/p2',
      fidelity: 'partial',
      reasons: [
        {
          code: 'SUBSTITUTED_FONTS',
          summary: '1 font substituted',
          count: 1
        }
      ],
      timestamp: Date.now()
    });

    const summary = reporter.generateCompletionSummary();

    expect(summary.jobId).toBe('job_789');
    expect(summary.pagesFound).toBe(5);
    expect(summary.pagesSucceeded).toBe(4);
    expect(summary.pagesFailed).toBe(1);
    expect(summary.totalAssetCount).toBe(12);
    expect(summary.totalAssetBytes).toBe(1024 * 1024);
    expect(summary.warningsCount).toBe(1);
    expect(summary.errorsCount).toBe(1);
    expect(summary.batchesCopied).toBe(2);
    expect(summary.fidelityBreakdown.high).toBe(1);
    expect(summary.fidelityBreakdown.partial).toBe(1);
    expect(summary.fidelityReports).toHaveLength(2);
  });
});
