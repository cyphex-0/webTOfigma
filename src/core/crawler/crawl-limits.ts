/**
 * Resource limits, quotas, and execution budgets for multi-page crawling.
 */

export interface CrawlResourceLimits {
  maxPages: number;
  perPageTimeoutMs: number;
  totalJobTimeoutMs: number;
  maxTotalDomNodes: number;
  maxTotalAssetBytes: number;
}

export interface CrawlResourceUsage {
  pagesAttempted: number;
  pagesCompleted: number;
  pagesFailed: number;
  totalDomNodes: number;
  totalAssetBytes: number;
  jobStartTime: number;
}

export type LimitExceededReason =
  | 'PAGE_CAP_EXCEEDED'
  | 'TOTAL_TIMEOUT_EXCEEDED'
  | 'DOM_NODE_BUDGET_EXCEEDED'
  | 'ASSET_BYTES_QUOTA_EXCEEDED';

export interface CheckLimitsResult {
  isExceeded: boolean;
  reason?: LimitExceededReason | undefined;
  message?: string | undefined;
}

export const DEFAULT_CRAWL_LIMITS: CrawlResourceLimits = {
  maxPages: 25,
  perPageTimeoutMs: 25_000, // 25 seconds per page
  totalJobTimeoutMs: 300_000, // 5 minutes total job budget
  maxTotalDomNodes: 60_000, // 60,000 DOM nodes across all pages
  maxTotalAssetBytes: 100 * 1024 * 1024 // 100 MB total asset payload
};

/**
 * Creates a merged resource limits configuration with sensible defaults.
 */
export function createDefaultCrawlLimits(
  overrides?: Partial<CrawlResourceLimits>
): CrawlResourceLimits {
  return {
    ...DEFAULT_CRAWL_LIMITS,
    ...overrides
  };
}

/**
 * Initializes a new usage tracking container for an export job.
 */
export function createInitialCrawlUsage(startTime: number = Date.now()): CrawlResourceUsage {
  return {
    pagesAttempted: 0,
    pagesCompleted: 0,
    pagesFailed: 0,
    totalDomNodes: 0,
    totalAssetBytes: 0,
    jobStartTime: startTime
  };
}

/**
 * Checks whether current usage has exceeded any configured resource budget.
 */
export function checkCrawlLimits(
  limits: CrawlResourceLimits,
  usage: CrawlResourceUsage,
  now: number = Date.now()
): CheckLimitsResult {
  // 1. Max completed/attempted pages check
  if (usage.pagesCompleted >= limits.maxPages) {
    return {
      isExceeded: true,
      reason: 'PAGE_CAP_EXCEEDED',
      message: `Configured maximum page cap of ${limits.maxPages} reached.`
    };
  }

  // 2. Total job duration timeout check
  const elapsed = now - usage.jobStartTime;
  if (elapsed >= limits.totalJobTimeoutMs) {
    return {
      isExceeded: true,
      reason: 'TOTAL_TIMEOUT_EXCEEDED',
      message: `Total crawl execution timeout of ${Math.round(limits.totalJobTimeoutMs / 1000)}s exceeded.`
    };
  }

  // 3. DOM node budget check
  if (usage.totalDomNodes >= limits.maxTotalDomNodes) {
    return {
      isExceeded: true,
      reason: 'DOM_NODE_BUDGET_EXCEEDED',
      message: `Total DOM node budget of ${limits.maxTotalDomNodes.toLocaleString()} nodes exceeded.`
    };
  }

  // 4. Asset bytes quota check
  if (usage.totalAssetBytes >= limits.maxTotalAssetBytes) {
    return {
      isExceeded: true,
      reason: 'ASSET_BYTES_QUOTA_EXCEEDED',
      message: `Total asset payload quota of ${Math.round(limits.maxTotalAssetBytes / (1024 * 1024))}MB exceeded.`
    };
  }

  return { isExceeded: false };
}

/**
 * Updates usage metrics after a page completes or fails.
 */
export function recordPageCompletion(
  usage: CrawlResourceUsage,
  domNodes: number,
  assetBytes: number,
  succeeded: boolean
): CrawlResourceUsage {
  return {
    ...usage,
    pagesAttempted: usage.pagesAttempted + 1,
    pagesCompleted: succeeded ? usage.pagesCompleted + 1 : usage.pagesCompleted,
    pagesFailed: succeeded ? usage.pagesFailed : usage.pagesFailed + 1,
    totalDomNodes: usage.totalDomNodes + Math.max(0, domNodes),
    totalAssetBytes: usage.totalAssetBytes + Math.max(0, assetBytes)
  };
}
