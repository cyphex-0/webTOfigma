import { describe, it, expect } from 'vitest';
import {
  classifyFailure,
  partitionRetryableRoutes,
  FAILURE_REGISTRY
} from '../../core/diagnostics/failure-recovery';
import type { DiscoveredRoute } from '../../core/crawler/crawl-scope';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';

describe('Failure Recovery & Error Code Registry (Phase 22)', () => {
  it('classifies restricted browser tabs as unretryable fatal error', () => {
    const err = new Error('Cannot access a chrome:// URL');
    const result = classifyFailure(err, { url: 'chrome://settings' });

    expect(result.code).toBe('TAB_RESTRICTED');
    expect(result.severity).toBe('fatal');
    expect(result.isRetryable).toBe(false);
    expect(result.recoveryAction).toContain('Navigate to a standard public website');
  });

  it('classifies network timeouts as retryable error', () => {
    const err = new Error('Network timeout waiting for page ready');
    const result = classifyFailure(err, { url: 'https://example.com/slow', phase: 'dom-extraction' });

    expect(result.code).toBe('PAGE_LOAD_TIMEOUT');
    expect(result.severity).toBe('error');
    expect(result.isRetryable).toBe(true);
    expect(result.maxRetries).toBe(2);
  });

  it('classifies tainted canvas as unretryable warning with structural fallback', () => {
    const err = new Error('Failed to execute toDataURL: tainted cross-origin data');
    const result = classifyFailure(err, { url: 'https://example.com/canvas' });

    expect(result.code).toBe('CANVAS_TAINTED');
    expect(result.severity).toBe('warning');
    expect(result.isRetryable).toBe(false);
  });

  it('separates retryable vs unrecoverable routes based on diagnostic codes', () => {
    const failedRoutes: DiscoveredRoute[] = [
      {
        canonicalUrl: 'https://example.com/timeout',
        originalUrl: 'https://example.com/timeout',
        pathname: '/timeout',
        title: 'Timeout Page',
        discoverySource: 'anchor',
        depth: 1,
        category: 'Main/Marketing',
        paginationNumber: null,
        isDestructive: false,
        discoveryIndex: 1,
        isSelected: true
      },
      {
        canonicalUrl: 'https://example.com/login-wall',
        originalUrl: 'https://example.com/login-wall',
        pathname: '/login-wall',
        title: 'Login Wall',
        discoverySource: 'anchor',
        depth: 1,
        category: 'Authentication/Account',
        paginationNumber: null,
        isDestructive: false,
        discoveryIndex: 2,
        isSelected: true
      }
    ];

    const diagnostics: ExportDiagnostic[] = [
      {
        severity: 'error',
        code: 'PAGE_LOAD_TIMEOUT',
        message: 'Timeout',
        phase: 'dom-extraction',
        pageUrl: 'https://example.com/timeout',
        timestamp: Date.now()
      },
      {
        severity: 'warning',
        code: 'LOGIN_WALL_DETECTED',
        message: 'Auth required',
        phase: 'dom-extraction',
        pageUrl: 'https://example.com/login-wall',
        timestamp: Date.now()
      }
    ];

    const { retryableRoutes, unretryableRoutes } = partitionRetryableRoutes(failedRoutes, diagnostics);

    expect(retryableRoutes).toHaveLength(1);
    expect(retryableRoutes[0]?.canonicalUrl).toBe('https://example.com/timeout');

    expect(unretryableRoutes).toHaveLength(1);
    expect(unretryableRoutes[0]?.canonicalUrl).toBe('https://example.com/login-wall');
  });
});
