import { describe, it, expect } from 'vitest';
import {
  createDefaultCrawlLimits,
  createInitialCrawlUsage,
  checkCrawlLimits,
  recordPageCompletion
} from '../../core/crawler/crawl-limits';

describe('CrawlLimits & Resource Quotas', () => {
  it('initializes default limits and zero usage', () => {
    const limits = createDefaultCrawlLimits({ maxPages: 10 });
    expect(limits.maxPages).toBe(10);
    expect(limits.perPageTimeoutMs).toBe(25_000);
    expect(limits.totalJobTimeoutMs).toBe(300_000);

    const usage = createInitialCrawlUsage(1000);
    expect(usage.pagesCompleted).toBe(0);
    expect(usage.totalDomNodes).toBe(0);
    expect(usage.totalAssetBytes).toBe(0);
    expect(usage.jobStartTime).toBe(1000);
  });

  it('detects when max pages cap is reached', () => {
    const limits = createDefaultCrawlLimits({ maxPages: 2 });
    let usage = createInitialCrawlUsage();

    expect(checkCrawlLimits(limits, usage).isExceeded).toBe(false);

    usage = recordPageCompletion(usage, 100, 5000, true);
    expect(checkCrawlLimits(limits, usage).isExceeded).toBe(false);

    usage = recordPageCompletion(usage, 200, 10000, true);
    const check = checkCrawlLimits(limits, usage);
    expect(check.isExceeded).toBe(true);
    expect(check.reason).toBe('PAGE_CAP_EXCEEDED');
  });

  it('detects when total job timeout is exceeded', () => {
    const limits = createDefaultCrawlLimits({ totalJobTimeoutMs: 10_000 });
    const usage = createInitialCrawlUsage(1000);

    // 5 seconds elapsed
    expect(checkCrawlLimits(limits, usage, 6000).isExceeded).toBe(false);

    // 11 seconds elapsed
    const check = checkCrawlLimits(limits, usage, 12000);
    expect(check.isExceeded).toBe(true);
    expect(check.reason).toBe('TOTAL_TIMEOUT_EXCEEDED');
  });

  it('detects when DOM node budget or asset bytes quota is exceeded', () => {
    const limits = createDefaultCrawlLimits({
      maxTotalDomNodes: 1000,
      maxTotalAssetBytes: 50_000
    });

    let usage = createInitialCrawlUsage();
    usage = recordPageCompletion(usage, 1200, 1000, true);

    const nodeCheck = checkCrawlLimits(limits, usage);
    expect(nodeCheck.isExceeded).toBe(true);
    expect(nodeCheck.reason).toBe('DOM_NODE_BUDGET_EXCEEDED');

    // Reset nodes, exceed asset bytes
    usage = { ...createInitialCrawlUsage(), totalAssetBytes: 60_000 };
    const assetCheck = checkCrawlLimits(limits, usage);
    expect(assetCheck.isExceeded).toBe(true);
    expect(assetCheck.reason).toBe('ASSET_BYTES_QUOTA_EXCEEDED');
  });
});
