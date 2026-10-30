/**
 * Route selection management, parity selectors (odd/even), page caps, and manual URL additions.
 */

import { DiscoveredRoute, isDestructiveRoute } from './crawl-scope';
import { RouteNumberingMode } from './route-order';
import { normalizeCandidateUrl, UrlNormalizeOptions } from './url-normalizer';
import { categorizeRoute } from './route-categorizer';
import { detectPaginationNumber } from './pagination-detector';

export interface ParitySelectionResult {
  routes: DiscoveredRoute[];
  summaryLabel: string;
  selectedCount: number;
}

export interface PageCapResult {
  routes: DiscoveredRoute[];
  isCapped: boolean;
  selectedCount: number;
  warning?: string | undefined;
}

export interface AddManualRouteResult {
  success: boolean;
  error?: string | undefined;
  routes: DiscoveredRoute[];
  newRoute?: DiscoveredRoute | undefined;
}

/**
 * Applies odd or even parity selection according to the chosen numbering mode.
 */
export function applyParitySelection(
  routes: readonly DiscoveredRoute[],
  parity: 'odd' | 'even',
  mode: RouteNumberingMode
): ParitySelectionResult {
  const isOdd = parity === 'odd';
  let selectedCount = 0;

  const updatedRoutes = routes.map((route, index) => {
    let selectThis = false;

    if (mode === 'pagination-number') {
      // For pagination mode, select based on parsed page number only
      if (route.paginationNumber !== null && route.paginationNumber !== undefined) {
        selectThis = isOdd ? route.paginationNumber % 2 !== 0 : route.paginationNumber % 2 === 0;
      } else {
        selectThis = false;
      }
    } else {
      // For discovery-order and manual-order, use 1-based index in the current route order
      const oneBasedIndex = index + 1;
      selectThis = isOdd ? oneBasedIndex % 2 !== 0 : oneBasedIndex % 2 === 0;
    }

    if (selectThis) {
      selectedCount++;
    }

    return {
      ...route,
      isSelected: selectThis
    };
  });

  const modeLabels: Record<RouteNumberingMode, string> = {
    'pagination-number': 'pagination number',
    'discovery-order': 'discovery order',
    'manual-order': 'manual order'
  };

  const parityCapitalized = parity === 'odd' ? 'Odd' : 'Even';
  const summaryLabel = `${parityCapitalized} pages — ${modeLabels[mode]} — ${selectedCount} route${selectedCount === 1 ? '' : 's'} selected`;

  return {
    routes: updatedRoutes,
    summaryLabel,
    selectedCount
  };
}

/**
 * Selects all non-destructive routes.
 */
export function selectAllRoutes(routes: readonly DiscoveredRoute[]): DiscoveredRoute[] {
  return routes.map((r) => ({
    ...r,
    isSelected: !r.isDestructive
  }));
}

/**
 * Deselects all routes.
 */
export function deselectAllRoutes(routes: readonly DiscoveredRoute[]): DiscoveredRoute[] {
  return routes.map((r) => ({
    ...r,
    isSelected: false
  }));
}

/**
 * Inverts the current selection state for all non-destructive routes.
 */
export function invertRouteSelection(routes: readonly DiscoveredRoute[]): DiscoveredRoute[] {
  return routes.map((r) => ({
    ...r,
    isSelected: r.isDestructive ? false : !r.isSelected
  }));
}

/**
 * Selects only the current page (depth 0 / current-page).
 */
export function selectCurrentPageRoute(routes: readonly DiscoveredRoute[]): DiscoveredRoute[] {
  return routes.map((r) => ({
    ...r,
    isSelected: r.depth === 0 || r.discoverySource === 'current-page'
  }));
}

/**
 * Selects top-level navigation routes (depth <= 1, category Main/Marketing or discoverySource anchor).
 */
export function selectTopLevelNavRoutes(routes: readonly DiscoveredRoute[]): DiscoveredRoute[] {
  return routes.map((r) => ({
    ...r,
    isSelected:
      !r.isDestructive &&
      r.depth <= 1 &&
      (r.category === 'Main/Marketing' || r.discoverySource === 'anchor' || r.discoverySource === 'current-page')
  }));
}

/**
 * Toggles selection state for an individual route by its canonical URL.
 */
export function toggleRouteSelection(
  routes: readonly DiscoveredRoute[],
  canonicalUrl: string
): DiscoveredRoute[] {
  return routes.map((r) => {
    if (r.canonicalUrl === canonicalUrl) {
      return { ...r, isSelected: !r.isSelected };
    }
    return r;
  });
}

/**
 * Enforces a maximum selected page cap before queue execution.
 */
export function applyPageCap(
  routes: readonly DiscoveredRoute[],
  cap: number
): PageCapResult {
  if (cap <= 0) {
    return {
      routes: deselectAllRoutes(routes),
      isCapped: false,
      selectedCount: 0
    };
  }

  let selectedSoFar = 0;
  let wasExceeded = false;

  const cappedRoutes = routes.map((route) => {
    if (!route.isSelected) {
      return route;
    }

    if (selectedSoFar < cap) {
      selectedSoFar++;
      return route;
    }

    // Exceeds cap: deselect
    wasExceeded = true;
    return {
      ...route,
      isSelected: false
    };
  });

  const warning = wasExceeded
    ? `Selected routes exceeded cap of ${cap}. Only the first ${cap} selected routes will be captured.`
    : undefined;

  return {
    routes: cappedRoutes,
    isCapped: wasExceeded,
    selectedCount: selectedSoFar,
    warning
  };
}

/**
 * Adds a manual URL to the route list after validating against site scope and deduplication rules.
 */
export function addManualRoute(
  routes: readonly DiscoveredRoute[],
  rawUrl: string,
  baseUrl: string,
  allowSubdomains?: boolean
): AddManualRouteResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      success: false,
      error: 'URL cannot be empty.',
      routes: [...routes]
    };
  }

  const normOptions: UrlNormalizeOptions = {
    baseUrl,
    allowSubdomains: Boolean(allowSubdomains)
  };

  const norm = normalizeCandidateUrl(trimmed, normOptions);
  if (!norm.isValid || !norm.canonicalUrl || !norm.pathname) {
    return {
      success: false,
      error: norm.rejectionReason || 'Invalid or external URL.',
      routes: [...routes]
    };
  }

  if (norm.isDownloadFile) {
    return {
      success: false,
      error: 'Downloadable files cannot be crawled as web pages.',
      routes: [...routes]
    };
  }

  // Deduplication check
  if (routes.some((r) => r.canonicalUrl === norm.canonicalUrl)) {
    return {
      success: false,
      error: 'This route is already present in the list.',
      routes: [...routes]
    };
  }

  const destructive = isDestructiveRoute(norm.pathname) || isDestructiveRoute(trimmed);
  const pagination = detectPaginationNumber(norm.canonicalUrl);
  const category = categorizeRoute(norm.canonicalUrl);

  const newRoute: DiscoveredRoute = {
    canonicalUrl: norm.canonicalUrl,
    originalUrl: trimmed,
    pathname: norm.pathname,
    title: undefined,
    navigationLabel: undefined,
    discoverySource: 'manual',
    depth: 1,
    category,
    paginationNumber: pagination,
    isDestructive: destructive,
    discoveryIndex: routes.length + 1,
    isSelected: !destructive
  };

  return {
    success: true,
    routes: [...routes, newRoute],
    newRoute
  };
}

/**
 * Removes a manually added route from the list.
 */
export function removeManualRoute(
  routes: readonly DiscoveredRoute[],
  canonicalUrl: string
): DiscoveredRoute[] {
  return routes.filter((r) => !(r.canonicalUrl === canonicalUrl && r.discoverySource === 'manual'));
}
