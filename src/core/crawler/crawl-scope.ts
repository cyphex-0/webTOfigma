/**
 * Crawl scope coordinator, path filter engine, destructive route guard, and multi-source deduplicator.
 */

import { normalizeCandidateUrl, UrlNormalizeOptions } from './url-normalizer';
import { categorizeRoute, RouteCategory } from './route-categorizer';
import { detectPaginationNumber } from './pagination-detector';
import {
  discoverDomAnchors,
  discoverPseudoAnchors,
  discoverSpaRouteHints,
  DiscoveredLink,
  DiscoverySource
} from './link-discovery';
import { fetchAndParseSitemapTree, SitemapEntry } from './sitemap-parser';

export interface DiscoveredRoute {
  canonicalUrl: string;
  originalUrl: string;
  pathname: string;
  title?: string | undefined;
  navigationLabel?: string | undefined;
  discoverySource: DiscoverySource;
  depth: number;
  category: RouteCategory;
  paginationNumber: number | null;
  isDestructive: boolean;
  discoveryIndex: number;
  isSelected: boolean;
}

export interface CrawlScopeConfig {
  baseUrl: string;
  currentUrl?: string | undefined;
  currentTitle?: string | undefined;
  maxDepth?: number | undefined; // 0 = current only, 1 = direct links (default), 2 = 2 hops
  maxPagesCap?: number | undefined; // default 25
  allowSubdomains?: boolean | undefined;
  includeHashRoutes?: boolean | undefined;
  includePatterns?: string[] | undefined;
  excludePatterns?: string[] | undefined;
  excludeDestructiveRoutes?: boolean | undefined; // default true
  fetchSitemap?: boolean | undefined; // default false in DOM-only runs, true when requested
  sitemapFetchFn?: ((url: string) => Promise<string>) | undefined;
  manualUrls?: string[] | undefined;
}

export interface RouteDiscoveryDiagnostic {
  code: string;
  message: string;
  url?: string | undefined;
}

export interface RouteDiscoveryResult {
  routes: DiscoveredRoute[];
  totalDiscovered: number;
  totalUnique: number;
  isCapped: boolean;
  diagnostics: RouteDiscoveryDiagnostic[];
}

/**
 * Standard regex patterns matching potentially destructive, mutating, or session-terminating routes.
 */
const DESTRUCTIVE_ROUTE_PATTERNS = [
  /(?:^|\/)(?:logout|signout|sign-out|log-out)(?:\/|$|\?)/i,
  /(?:^|\/)(?:delete|remove|destroy|purge|cancel-account)(?:\/|$|\?)/i,
  /(?:^|\/)(?:api\/.*(?:mutation|delete|create|update))(?:\/|$|\?)/i
];

/**
 * Evaluates whether a URL or path matches destructive route patterns.
 */
export function isDestructiveRoute(urlOrPath: string): boolean {
  for (const pattern of DESTRUCTIVE_ROUTE_PATTERNS) {
    if (pattern.test(urlOrPath)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a path satisfies wildcard or prefix pattern filters.
 */
export function matchesPathPattern(pathname: string, pattern: string): boolean {
  const trimmed = pattern.trim().toLowerCase();
  const lowerPath = pathname.toLowerCase();

  if (!trimmed || trimmed === '*') {
    return true;
  }

  // Exact match
  if (trimmed === lowerPath) {
    return true;
  }

  // Prefix wildcard: /blog/* or /docs*
  if (trimmed.endsWith('/*')) {
    const prefix = trimmed.slice(0, -2);
    return lowerPath === prefix || lowerPath.startsWith(`${prefix}/`);
  }

  if (trimmed.endsWith('*')) {
    const prefix = trimmed.slice(0, -1);
    return lowerPath.startsWith(prefix);
  }

  return lowerPath === trimmed || lowerPath.startsWith(`${trimmed}/`);
}

/**
 * Coordinates multi-source discovery across DOM anchors, SPA hints, sitemaps, and manual entries,
 * enforcing crawl scope, deduplication, and page caps.
 */
export async function discoverSiteRoutes(
  doc: Document,
  config: CrawlScopeConfig
): Promise<RouteDiscoveryResult> {
  const maxDepth = config.maxDepth ?? 1;
  const maxPagesCap = config.maxPagesCap ?? 25;
  const excludeDestructive = config.excludeDestructiveRoutes ?? true;

  const normalizeOptions: UrlNormalizeOptions = {
    baseUrl: config.baseUrl,
    allowSubdomains: config.allowSubdomains,
    includeHashRoutes: config.includeHashRoutes
  };

  const diagnostics: RouteDiscoveryDiagnostic[] = [];
  const candidateMap = new Map<string, DiscoveredRoute>();
  let totalDiscovered = 0;
  let discoveryIndexCounter = 1;

  const registerCandidate = (
    rawUrl: string,
    source: DiscoverySource,
    depth: number,
    extra?: {
      title?: string | undefined;
      navigationLabel?: string | undefined;
      paginationNumber?: number | null | undefined;
    }
  ): boolean => {
    totalDiscovered++;

    if (depth > maxDepth) {
      return false;
    }

    const norm = normalizeCandidateUrl(rawUrl, normalizeOptions);
    if (!norm.isValid || !norm.canonicalUrl || !norm.pathname) {
      return false;
    }

    const canonicalUrl = norm.canonicalUrl;
    const pathname = norm.pathname;

    // Check include patterns if configured
    if (config.includePatterns && config.includePatterns.length > 0) {
      const matchesInclude = config.includePatterns.some((pattern) =>
        matchesPathPattern(pathname, pattern)
      );
      if (!matchesInclude) {
        return false;
      }
    }

    // Check exclude patterns if configured
    if (config.excludePatterns && config.excludePatterns.length > 0) {
      const matchesExclude = config.excludePatterns.some((pattern) =>
        matchesPathPattern(pathname, pattern)
      );
      if (matchesExclude) {
        return false;
      }
    }

    const destructive = isDestructiveRoute(pathname) || isDestructiveRoute(rawUrl);
    if (destructive && excludeDestructive) {
      return false;
    }

    // Deduplication check
    if (candidateMap.has(canonicalUrl)) {
      const existing = candidateMap.get(canonicalUrl)!;
      // Enrich with title or label if missing
      if (!existing.title && extra?.title) {
        existing.title = extra.title;
      }
      if (!existing.navigationLabel && extra?.navigationLabel) {
        existing.navigationLabel = extra.navigationLabel;
      }
      return false;
    }

    const pagination =
      extra?.paginationNumber !== undefined
        ? extra.paginationNumber
        : detectPaginationNumber(canonicalUrl);

    const category = categorizeRoute({
      url: canonicalUrl,
      title: extra?.title,
      navigationLabel: extra?.navigationLabel
    });

    const route: DiscoveredRoute = {
      canonicalUrl,
      originalUrl: rawUrl,
      pathname,
      title: extra?.title || extra?.navigationLabel,
      navigationLabel: extra?.navigationLabel,
      discoverySource: source,
      depth,
      category,
      paginationNumber: pagination,
      isDestructive: destructive,
      discoveryIndex: discoveryIndexCounter++,
      isSelected: !destructive
    };

    candidateMap.set(canonicalUrl, route);
    return true;
  };

  // 1. Current Page (Depth 0)
  const currentUrl = config.currentUrl || doc.location?.href || config.baseUrl;
  const currentTitle = config.currentTitle || doc.title || undefined;
  registerCandidate(currentUrl, 'current-page', 0, {
    title: currentTitle,
    navigationLabel: currentTitle
  });

  // If depth is 0, stop at current page only
  if (maxDepth === 0) {
    const routes = Array.from(candidateMap.values());
    return {
      routes,
      totalDiscovered,
      totalUnique: routes.length,
      isCapped: false,
      diagnostics
    };
  }

  // 2. DOM Anchors (Depth 1)
  const domAnchors = discoverDomAnchors({
    doc,
    baseUrl: config.baseUrl,
    depth: 1,
    includeHashRoutes: config.includeHashRoutes,
    allowSubdomains: config.allowSubdomains
  });
  for (const anchor of domAnchors) {
    registerCandidate(anchor.rawUrl, anchor.discoverySource, anchor.depth, {
      title: anchor.title,
      navigationLabel: anchor.navigationLabel,
      paginationNumber: anchor.paginationNumber
    });
  }

  // 3. Pseudo-Anchors & Navigation Attributes (Depth 1)
  const pseudoAnchors = discoverPseudoAnchors({
    doc,
    baseUrl: config.baseUrl,
    depth: 1,
    includeHashRoutes: config.includeHashRoutes,
    allowSubdomains: config.allowSubdomains
  });
  for (const pseudo of pseudoAnchors) {
    registerCandidate(pseudo.rawUrl, pseudo.discoverySource, pseudo.depth, {
      navigationLabel: pseudo.navigationLabel
    });
  }

  // 4. SPA Route Hints & Prefetch Link Chunks (Depth 1)
  const spaHints = discoverSpaRouteHints({
    doc,
    baseUrl: config.baseUrl,
    depth: 1,
    includeHashRoutes: config.includeHashRoutes,
    allowSubdomains: config.allowSubdomains
  });
  for (const hint of spaHints) {
    registerCandidate(hint.rawUrl, hint.discoverySource, hint.depth);
  }

  // 5. Manual URLs
  if (config.manualUrls && config.manualUrls.length > 0) {
    for (const manual of config.manualUrls) {
      registerCandidate(manual, 'manual', 1);
    }
  }

  // 6. Optional Sitemap Fetch & Parsing
  if (config.fetchSitemap) {
    try {
      const sitemapResult = await fetchAndParseSitemapTree({
        baseUrl: config.baseUrl,
        allowSubdomains: config.allowSubdomains,
        fetchFn: config.sitemapFetchFn
      });
      for (const entry of sitemapResult.entries) {
        registerCandidate(entry.loc, 'sitemap', 1);
      }
      for (const diag of sitemapResult.diagnostics) {
        diagnostics.push({
          code: diag.code,
          message: diag.message,
          url: diag.url
        });
      }
    } catch (err) {
      diagnostics.push({
        code: 'SITEMAP_FETCH_ERROR',
        message: `Sitemap discovery failed: ${String(err)}`
      });
    }
  }

  const allUnique = Array.from(candidateMap.values());
  const isCapped = allUnique.length > maxPagesCap;
  const boundedRoutes = allUnique.slice(0, maxPagesCap);

  return {
    routes: boundedRoutes,
    totalDiscovered,
    totalUnique: allUnique.length,
    isCapped,
    diagnostics
  };
}
