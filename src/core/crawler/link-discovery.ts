/**
 * DOM Anchor discovery, SPA route hint extraction, and interactive browsing session recorder.
 */

import { normalizeCandidateUrl, UrlNormalizeOptions } from './url-normalizer';
import { detectPaginationNumber } from './pagination-detector';

export type DiscoverySource =
  | 'current-page'
  | 'anchor'
  | 'sitemap'
  | 'manual'
  | 'route-hint'
  | 'recorded-session';

export interface DiscoveredLink {
  rawUrl: string;
  canonicalUrl: string;
  pathname: string;
  title?: string | undefined;
  navigationLabel?: string | undefined;
  discoverySource: DiscoverySource;
  depth: number;
  paginationNumber: number | null;
  rel?: string | undefined;
  isPseudoAnchor?: boolean | undefined;
}

export interface LinkDiscoveryOptions {
  doc: Document;
  baseUrl: string;
  depth?: number | undefined;
  includeHashRoutes?: boolean | undefined;
  allowSubdomains?: boolean | undefined;
}

/**
 * Custom interactive navigation attributes used by SPAs and UI frameworks.
 */
const NAVIGATION_ATTRIBUTES = [
  'data-href',
  'data-to',
  'data-route',
  'data-path',
  'routerlink',
  'ng-reflect-router-link',
  'to'
] as const;

/**
 * Discovers links from standard DOM anchor elements (<a href>, <area href>).
 */
export function discoverDomAnchors(options: LinkDiscoveryOptions): DiscoveredLink[] {
  const { doc, baseUrl, depth = 1, includeHashRoutes, allowSubdomains } = options;
  const results: DiscoveredLink[] = [];
  const seenCanonical = new Set<string>();

  const normOptions: UrlNormalizeOptions = {
    baseUrl,
    includeHashRoutes,
    allowSubdomains
  };

  const anchors = doc.querySelectorAll<HTMLAnchorElement | HTMLAreaElement>('a[href], area[href]');
  for (let i = 0; i < anchors.length; i++) {
    const el = anchors[i];
    if (!el) continue;

    const rawHref = el.getAttribute('href');
    if (!rawHref) continue;

    const norm = normalizeCandidateUrl(rawHref, normOptions);
    if (!norm.isValid || !norm.canonicalUrl || !norm.pathname) {
      continue;
    }

    if (seenCanonical.has(norm.canonicalUrl)) {
      continue;
    }
    seenCanonical.add(norm.canonicalUrl);

    const anchorText = el.textContent?.trim() || undefined;
    const ariaLabel = el.getAttribute('aria-label')?.trim() || undefined;
    const titleAttr = el.getAttribute('title')?.trim() || undefined;
    const rel = el.getAttribute('rel')?.trim() || undefined;

    const paginationNumber = detectPaginationNumber({
      url: norm.canonicalUrl,
      anchorText,
      ariaLabel,
      rel
    });

    results.push({
      rawUrl: rawHref,
      canonicalUrl: norm.canonicalUrl,
      pathname: norm.pathname,
      title: titleAttr,
      navigationLabel: ariaLabel || anchorText,
      discoverySource: 'anchor',
      depth,
      paginationNumber,
      rel
    });
  }

  return results;
}

/**
 * Discovers pseudo-anchor routes from buttons, custom elements, and data-navigation attributes.
 */
export function discoverPseudoAnchors(options: LinkDiscoveryOptions): DiscoveredLink[] {
  const { doc, baseUrl, depth = 1, includeHashRoutes, allowSubdomains } = options;
  const results: DiscoveredLink[] = [];
  const seenCanonical = new Set<string>();

  const normOptions: UrlNormalizeOptions = {
    baseUrl,
    includeHashRoutes,
    allowSubdomains
  };

  const selector = NAVIGATION_ATTRIBUTES.map((attr) => `[${attr}]`).join(', ');
  const elements = doc.querySelectorAll(selector);

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el || el.tagName.toLowerCase() === 'a' || el.tagName.toLowerCase() === 'area') {
      // Standard anchors are handled by discoverDomAnchors
      continue;
    }

    for (const attr of NAVIGATION_ATTRIBUTES) {
      const val = el.getAttribute(attr);
      if (!val) continue;

      const norm = normalizeCandidateUrl(val, normOptions);
      if (!norm.isValid || !norm.canonicalUrl || !norm.pathname) {
        continue;
      }

      if (seenCanonical.has(norm.canonicalUrl)) {
        continue;
      }
      seenCanonical.add(norm.canonicalUrl);

      const navLabel =
        el.getAttribute('aria-label')?.trim() || el.textContent?.trim() || undefined;

      results.push({
        rawUrl: val,
        canonicalUrl: norm.canonicalUrl,
        pathname: norm.pathname,
        navigationLabel: navLabel,
        discoverySource: 'route-hint',
        depth,
        paginationNumber: null,
        isPseudoAnchor: true
      });
    }
  }

  return results;
}

/**
 * Safely extracts SPA candidate routes from static DOM hydration scripts and prefetch links
 * without code execution.
 */
export function discoverSpaRouteHints(options: LinkDiscoveryOptions): DiscoveredLink[] {
  const { doc, baseUrl, depth = 1, includeHashRoutes, allowSubdomains } = options;
  const results: DiscoveredLink[] = [];
  const seenCanonical = new Set<string>();

  const normOptions: UrlNormalizeOptions = {
    baseUrl,
    includeHashRoutes,
    allowSubdomains
  };

  const addCandidate = (candidatePath: string) => {
    // Ignore dynamic wildcard or parameter segments (e.g. /users/[id], /posts/:slug)
    if (candidatePath.includes('[') || candidatePath.includes(':') || candidatePath.includes('*')) {
      return;
    }

    const norm = normalizeCandidateUrl(candidatePath, normOptions);
    if (!norm.isValid || !norm.canonicalUrl || !norm.pathname) {
      return;
    }

    if (seenCanonical.has(norm.canonicalUrl)) {
      return;
    }
    seenCanonical.add(norm.canonicalUrl);

    results.push({
      rawUrl: candidatePath,
      canonicalUrl: norm.canonicalUrl,
      pathname: norm.pathname,
      discoverySource: 'route-hint',
      depth,
      paginationNumber: null
    });
  };

  // 1. Next.js static __NEXT_DATA__ inspection
  const nextDataScript = doc.getElementById('__NEXT_DATA__');
  if (nextDataScript && nextDataScript.textContent) {
    try {
      const data = JSON.parse(nextDataScript.textContent);
      if (typeof data.page === 'string' && data.page.startsWith('/')) {
        addCandidate(data.page);
      }
    } catch {
      // Ignore JSON parse errors in third-party payloads
    }
  }

  // 2. Prefetch and modulepreload links targeting pages or route chunks
  const prefetchLinks = doc.querySelectorAll<HTMLLinkElement>(
    'link[rel="prefetch"][href], link[rel="modulepreload"][href], link[rel="preload"][as="script"][href]'
  );
  for (let i = 0; i < prefetchLinks.length; i++) {
    const link = prefetchLinks[i];
    if (!link) continue;
    const href = link.getAttribute('href');
    if (!href) continue;

    // Pattern: /_next/static/chunks/pages/dashboard-*.js -> /dashboard
    const nextPagesMatch = href.match(/(?:\/_next\/static\/chunks\/pages|\/_next\/static\/.*\/pages)\/([a-zA-Z0-9_\-/]+?)(?:\.js|-)/);
    if (nextPagesMatch && nextPagesMatch[1]) {
      const rawRoute = nextPagesMatch[1];
      if (rawRoute === 'index') {
        addCandidate('/');
      } else if (rawRoute !== '_app' && rawRoute !== '_error' && rawRoute !== '_document') {
        addCandidate(`/${rawRoute}`);
      }
    }

    // Pattern: /_nuxt/pages/dashboard.js -> /dashboard
    const nuxtPagesMatch = href.match(/\/_nuxt\/pages\/([a-zA-Z0-9_\-/]+?)\.js/);
    if (nuxtPagesMatch && nuxtPagesMatch[1]) {
      const rawRoute = nuxtPagesMatch[1];
      if (rawRoute === 'index') {
        addCandidate('/');
      } else {
        addCandidate(`/${rawRoute}`);
      }
    }
  }

  return results;
}

/**
 * Interactive Browse & Record Routes session listener.
 * Transparently and non-destructively hooks popstate and history state transitions
 * while the user explores an application.
 */
export class BrowseSessionRecorder {
  private isActive = false;
  private readonly baseUrl: string;
  private readonly onRouteDiscovered: (route: DiscoveredLink) => void;
  private originalPushState: typeof history.pushState | null = null;
  private originalReplaceState: typeof history.replaceState | null = null;
  private popstateListener: ((e: PopStateEvent) => void) | null = null;
  private readonly seenCanonical = new Set<string>();

  constructor(baseUrl: string, onRouteDiscovered: (route: DiscoveredLink) => void) {
    this.baseUrl = baseUrl;
    this.onRouteDiscovered = onRouteDiscovered;
  }

  public start(): void {
    if (this.isActive || typeof window === 'undefined') {
      return;
    }
    this.isActive = true;

    // 1. Hook popstate
    this.popstateListener = () => {
      this.handleUrlChange(window.location.href);
    };
    window.addEventListener('popstate', this.popstateListener);

    // 2. Wrap pushState non-destructively
    this.originalPushState = history.pushState;
    const self = this;
    history.pushState = function (data: unknown, unused: string, url?: string | URL | null) {
      const result = self.originalPushState?.apply(this, [data, unused, url]);
      if (url) {
        self.handleUrlChange(String(url));
      } else {
        self.handleUrlChange(window.location.href);
      }
      return result;
    };

    // 3. Wrap replaceState non-destructively
    this.originalReplaceState = history.replaceState;
    history.replaceState = function (data: unknown, unused: string, url?: string | URL | null) {
      const result = self.originalReplaceState?.apply(this, [data, unused, url]);
      if (url) {
        self.handleUrlChange(String(url));
      } else {
        self.handleUrlChange(window.location.href);
      }
      return result;
    };

    // Record initial current page
    this.handleUrlChange(window.location.href);
  }

  public stop(): void {
    if (!this.isActive) {
      return;
    }
    this.isActive = false;

    if (this.popstateListener) {
      window.removeEventListener('popstate', this.popstateListener);
      this.popstateListener = null;
    }

    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = null;
    }

    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = null;
    }
  }

  public isRecording(): boolean {
    return this.isActive;
  }

  private handleUrlChange(rawUrl: string): void {
    const norm = normalizeCandidateUrl(rawUrl, {
      baseUrl: this.baseUrl,
      includeHashRoutes: true,
      allowSubdomains: false
    });

    if (!norm.isValid || !norm.canonicalUrl || !norm.pathname) {
      return;
    }

    if (this.seenCanonical.has(norm.canonicalUrl)) {
      return;
    }
    this.seenCanonical.add(norm.canonicalUrl);

    this.onRouteDiscovered({
      rawUrl,
      canonicalUrl: norm.canonicalUrl,
      pathname: norm.pathname,
      title: document.title || undefined,
      discoverySource: 'recorded-session',
      depth: 1,
      paginationNumber: detectPaginationNumber(norm.canonicalUrl)
    });
  }
}
