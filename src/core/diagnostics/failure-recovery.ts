/**
 * Failure Recovery, Error Code Registry, and Selective Retry Engine.
 * 
 * Provides stable diagnostics, actionable recovery paths, and selective retry:
 * - Stable diagnostic error codes covering all proven failure scenarios:
 *   TAB_RESTRICTED, PERMISSION_DENIED, PAGE_LOAD_TIMEOUT, LOGIN_WALL_DETECTED,
 *   INFINITE_SCROLL_CAPPED, ASSET_FETCH_TIMEOUT, CANVAS_TAINTED, PAYLOAD_TOO_LARGE,
 *   CLIPBOARD_ACTIVATION_LOST, PARTIAL_ROUTE_FAILURE
 * - Actionable next-step recommendations without vague generic messages
 * - Differentiates retryable failures (network timeout, rate limit) from unretryable
 *   ones (restricted browser scheme, denied permission, tainted canvas)
 * - Retains successful page captures when individual routes fail
 */

import type { DiagnosticPhase, DiagnosticSeverity, ExportDiagnostic } from '../../shared/contracts/diagnostics';
import type { DiscoveredRoute } from '../crawler/crawl-scope';

export interface RegisteredFailureSpec {
  code: string;
  severity: DiagnosticSeverity;
  phase: DiagnosticPhase;
  defaultMessage: string;
  recommendedAction: string;
  isRetryable: boolean;
  maxRetries: number;
}

export const FAILURE_REGISTRY: Record<string, RegisteredFailureSpec> = {
  TAB_RESTRICTED: {
    code: 'TAB_RESTRICTED',
    severity: 'fatal',
    phase: 'dom-extraction',
    defaultMessage: 'Cannot capture browser-internal or protected scheme pages (chrome://, about:, file://).',
    recommendedAction: 'Navigate to a standard public website (http:// or https://) and try again.',
    isRetryable: false,
    maxRetries: 0
  },
  PERMISSION_DENIED: {
    code: 'PERMISSION_DENIED',
    severity: 'fatal',
    phase: 'dom-extraction',
    defaultMessage: 'Required extension tab permission was denied.',
    recommendedAction: 'Grant activeTab permission when prompted by clicking the extension icon.',
    isRetryable: false,
    maxRetries: 0
  },
  PAGE_LOAD_TIMEOUT: {
    code: 'PAGE_LOAD_TIMEOUT',
    severity: 'error',
    phase: 'dom-extraction',
    defaultMessage: 'Page document failed to reach network idle or interactive state within timeout limit.',
    recommendedAction: 'Check your network connection and retry the failed route.',
    isRetryable: true,
    maxRetries: 2
  },
  LOGIN_WALL_DETECTED: {
    code: 'LOGIN_WALL_DETECTED',
    severity: 'warning',
    phase: 'dom-extraction',
    defaultMessage: 'Target route redirected to an authentication or login wall.',
    recommendedAction: 'Log into the website in your active browser window, then retry export.',
    isRetryable: false,
    maxRetries: 0
  },
  INFINITE_SCROLL_CAPPED: {
    code: 'INFINITE_SCROLL_CAPPED',
    severity: 'info',
    phase: 'dom-extraction',
    defaultMessage: 'Infinite scroll was safely bounded at maximum depth cap to prevent browser freezing.',
    recommendedAction: 'Exported content represents the initial scroll segments.',
    isRetryable: false,
    maxRetries: 0
  },
  ASSET_FETCH_TIMEOUT: {
    code: 'ASSET_FETCH_TIMEOUT',
    severity: 'warning',
    phase: 'asset-fetch',
    defaultMessage: 'Remote image or web font asset timed out during download.',
    recommendedAction: 'Retry downloading failed assets or export with fallback placeholder.',
    isRetryable: true,
    maxRetries: 2
  },
  CANVAS_TAINTED: {
    code: 'CANVAS_TAINTED',
    severity: 'warning',
    phase: 'dom-extraction',
    defaultMessage: 'HTML5 canvas was tainted by cross-origin resources and cannot be read.',
    recommendedAction: 'Exported canvas element using structural fallback frame.',
    isRetryable: false,
    maxRetries: 0
  },
  PAYLOAD_TOO_LARGE: {
    code: 'PAYLOAD_TOO_LARGE',
    severity: 'error',
    phase: 'clipboard-serialization',
    defaultMessage: 'Serialized Figma payload exceeds browser clipboard capacity or hardware tier budget.',
    recommendedAction: 'Split the export into smaller batches or select fewer routes.',
    isRetryable: true,
    maxRetries: 1
  },
  CLIPBOARD_ACTIVATION_LOST: {
    code: 'CLIPBOARD_ACTIVATION_LOST',
    severity: 'error',
    phase: 'clipboard-serialization',
    defaultMessage: 'Transient user activation expired before clipboard write could complete.',
    recommendedAction: 'Click "Copy to Figma" directly without switching tabs or windows.',
    isRetryable: true,
    maxRetries: 3
  },
  PARTIAL_ROUTE_FAILURE: {
    code: 'PARTIAL_ROUTE_FAILURE',
    severity: 'warning',
    phase: 'scene-conversion',
    defaultMessage: 'One or more routes failed during multi-page export. Successful routes have been retained.',
    recommendedAction: 'Review failed routes in diagnostics and click "Retry Failed Routes".',
    isRetryable: true,
    maxRetries: 2
  }
};

export interface ClassifiedFailureResult extends ExportDiagnostic {
  isRetryable: boolean;
  maxRetries: number;
}

/**
 * Classifies an error into a structured, stable failure diagnostic with actionable guidance.
 */
export function classifyFailure(
  err: unknown,
  context: {
    url?: string | undefined;
    assetUrl?: string | undefined;
    phase?: DiagnosticPhase | undefined;
  } = {}
): ClassifiedFailureResult {
  const message = err instanceof Error ? err.message : String(err);
  let spec = FAILURE_REGISTRY.PAGE_LOAD_TIMEOUT!;

  if (message.includes('chrome://') || message.includes('about:') || message.includes('Cannot access a chrome://')) {
    spec = FAILURE_REGISTRY.TAB_RESTRICTED!;
  } else if (message.includes('permission') || message.includes('denied') || message.includes('NotAllowedError')) {
    spec = FAILURE_REGISTRY.PERMISSION_DENIED!;
  } else if (message.includes('login') || message.includes('auth') || message.includes('sign-in')) {
    spec = FAILURE_REGISTRY.LOGIN_WALL_DETECTED!;
  } else if (message.includes('timeout') || message.includes('timed out')) {
    spec = context.phase === 'asset-fetch' ? FAILURE_REGISTRY.ASSET_FETCH_TIMEOUT! : FAILURE_REGISTRY.PAGE_LOAD_TIMEOUT!;
  } else if (message.includes('tainted') || message.includes('cross-origin data')) {
    spec = FAILURE_REGISTRY.CANVAS_TAINTED!;
  } else if (message.includes('activation') || message.includes('gesture')) {
    spec = FAILURE_REGISTRY.CLIPBOARD_ACTIVATION_LOST!;
  } else if (message.includes('payload') || message.includes('too large') || message.includes('quota')) {
    spec = FAILURE_REGISTRY.PAYLOAD_TOO_LARGE!;
  }

  return {
    code: spec.code,
    severity: spec.severity,
    phase: context.phase ?? spec.phase,
    message: message || spec.defaultMessage,
    recoveryAction: spec.recommendedAction,
    pageUrl: context.url,
    assetUrl: context.assetUrl,
    timestamp: Date.now(),
    isRetryable: spec.isRetryable,
    maxRetries: spec.maxRetries
  };
}

/**
 * Separates failed routes into retryable vs unrecoverable candidates to prevent infinite retry loops.
 */
export function partitionRetryableRoutes(
  failedRoutes: readonly DiscoveredRoute[],
  diagnostics: readonly ExportDiagnostic[]
): {
  retryableRoutes: DiscoveredRoute[];
  unretryableRoutes: DiscoveredRoute[];
} {
  const unretryableUrls = new Set<string>();

  for (const diag of diagnostics) {
    if (diag.pageUrl) {
      const spec = FAILURE_REGISTRY[diag.code];
      if (spec && !spec.isRetryable) {
        unretryableUrls.add(diag.pageUrl);
      }
    }
  }

  const retryableRoutes: DiscoveredRoute[] = [];
  const unretryableRoutes: DiscoveredRoute[] = [];

  for (const route of failedRoutes) {
    if (unretryableUrls.has(route.canonicalUrl) || unretryableUrls.has(route.originalUrl)) {
      unretryableRoutes.push(route);
    } else {
      retryableRoutes.push(route);
    }
  }

  return {
    retryableRoutes,
    unretryableRoutes
  };
}
