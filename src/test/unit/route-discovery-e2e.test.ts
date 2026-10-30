import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  discoverSiteRoutes,
  isDestructiveRoute,
  matchesPathPattern
} from '../../core/crawler/crawl-scope';

describe('Route Discovery & Crawl Scoping Engine (End-to-End)', () => {
  const BASE_URL = 'https://example.com';

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('correctly matches wildcard and prefix path patterns', () => {
    expect(matchesPathPattern('/blog/post-1', '/blog/*')).toBe(true);
    expect(matchesPathPattern('/blog', '/blog/*')).toBe(true);
    expect(matchesPathPattern('/pricing', '/blog/*')).toBe(false);

    expect(matchesPathPattern('/docs/api/v1', '/docs*')).toBe(true);
    expect(matchesPathPattern('/about', '/about')).toBe(true);
    expect(matchesPathPattern('/about-us', '/about')).toBe(false);
  });

  it('identifies destructive routes accurately', () => {
    expect(isDestructiveRoute('/logout')).toBe(true);
    expect(isDestructiveRoute('/auth/sign-out')).toBe(true);
    expect(isDestructiveRoute('/account/delete')).toBe(true);
    expect(isDestructiveRoute('/api/mutation')).toBe(true);

    expect(isDestructiveRoute('/login')).toBe(false);
    expect(isDestructiveRoute('/pricing')).toBe(false);
    expect(isDestructiveRoute('/blog/announcement')).toBe(false);
  });

  it('bounds discovery to depth 0 (current page only) when maxDepth is 0', async () => {
    document.body.innerHTML = `
      <a href="/about">About</a>
      <a href="/pricing">Pricing</a>
    `;

    const result = await discoverSiteRoutes(document, {
      baseUrl: BASE_URL,
      currentUrl: 'https://example.com/home',
      currentTitle: 'Home Page',
      maxDepth: 0
    });

    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.canonicalUrl).toBe('https://example.com/home');
    expect(result.routes[0]?.discoverySource).toBe('current-page');
    expect(result.routes[0]?.depth).toBe(0);
  });

  it('discovers and deduplicates routes across DOM anchors, SPA hints, sitemaps, and manual URLs', async () => {
    // 1. DOM anchors
    document.body.innerHTML = `
      <nav>
        <a href="/">Home</a>
        <a href="/about/">About Us</a>
        <a href="/blog?utm_source=twitter">Our Blog</a>
        <a href="/catalog/page/2" aria-label="Page 2">2</a>
        <!-- Destructive route: must be excluded -->
        <a href="/account/logout">Sign Out</a>
      </nav>
      <!-- SPA button navigation -->
      <button data-route="/dashboard">Dashboard</button>
      <!-- Next.js hydration payload -->
      <script id="__NEXT_DATA__" type="application/json">
        { "page": "/docs/intro" }
      </script>
    `;

    // 2. Mock sitemap XML
    const mockSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
      <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url><loc>https://example.com/about</loc></url>
        <url><loc>https://example.com/pricing</loc></url>
        <url><loc>https://example.com/store</loc></url>
      </urlset>`;

    const mockFetch = vi.fn(async () => mockSitemapXml);

    const result = await discoverSiteRoutes(document, {
      baseUrl: BASE_URL,
      currentUrl: 'https://example.com/',
      currentTitle: 'Home',
      maxDepth: 1,
      fetchSitemap: true,
      sitemapFetchFn: mockFetch,
      manualUrls: ['https://example.com/contact']
    });

    // Verify deduplication:
    // /about was discovered via anchor and sitemap; it must exist only once!
    const aboutRoutes = result.routes.filter((r) => r.pathname === '/about');
    expect(aboutRoutes).toHaveLength(1);

    // Verify tracking query parameter was stripped from blog link
    const blogRoute = result.routes.find((r) => r.pathname === '/blog');
    expect(blogRoute).toBeDefined();
    expect(blogRoute?.canonicalUrl).toBe('https://example.com/blog');

    // Verify destructive route /account/logout was excluded
    const logoutRoute = result.routes.find((r) => r.pathname.includes('logout'));
    expect(logoutRoute).toBeUndefined();

    // Verify categories
    expect(result.routes.find((r) => r.pathname === '/')?.category).toBe('Main/Marketing');
    expect(result.routes.find((r) => r.pathname === '/blog')?.category).toBe('Blog/Articles');
    expect(result.routes.find((r) => r.pathname === '/dashboard')?.category).toBe('Dashboard/Application');
    expect(result.routes.find((r) => r.pathname === '/docs/intro')?.category).toBe('Documentation/Help');
    expect(result.routes.find((r) => r.pathname === '/pricing')?.category).toBe('Main/Marketing');
    expect(result.routes.find((r) => r.pathname === '/store')?.category).toBe('Store/Catalog');

    // Verify pagination on catalog link
    const page2Route = result.routes.find((r) => r.pathname === '/catalog/page/2');
    expect(page2Route?.paginationNumber).toBe(2);

    // Verify manual URL is included
    expect(result.routes.some((r) => r.pathname === '/contact')).toBe(true);
  });

  it('enforces include and exclude path filters', async () => {
    document.body.innerHTML = `
      <a href="/blog/ai-trends">AI Trends</a>
      <a href="/blog/figma-export">Figma Export</a>
      <a href="/blog/drafts/secret">Secret Draft</a>
      <a href="/docs/guide">Documentation</a>
      <a href="/pricing">Pricing</a>
    `;

    const result = await discoverSiteRoutes(document, {
      baseUrl: BASE_URL,
      currentUrl: 'https://example.com/',
      includePatterns: ['/blog/*'],
      excludePatterns: ['/blog/drafts/*']
    });

    const pathnames = result.routes.map((r) => r.pathname);
    expect(pathnames).toContain('/blog/ai-trends');
    expect(pathnames).toContain('/blog/figma-export');
    expect(pathnames).not.toContain('/blog/drafts/secret');
    expect(pathnames).not.toContain('/docs/guide');
    expect(pathnames).not.toContain('/pricing');
  });

  it('enforces maxPagesCap and flags result as isCapped', async () => {
    // Generate 15 distinct links
    const linksHtml = Array.from({ length: 15 }, (_, i) => `<a href="/feature-${i}">Feature ${i}</a>`).join('');
    document.body.innerHTML = `<nav>${linksHtml}</nav>`;

    const result = await discoverSiteRoutes(document, {
      baseUrl: BASE_URL,
      currentUrl: 'https://example.com/',
      maxPagesCap: 5
    });

    expect(result.routes).toHaveLength(5);
    expect(result.isCapped).toBe(true);
    expect(result.totalUnique).toBe(16); // 1 current + 15 links
  });

  it('handles sitemap failure gracefully without interrupting DOM discovery', async () => {
    document.body.innerHTML = `<a href="/services">Our Services</a>`;

    const failingFetch = vi.fn(async () => {
      throw new Error('500 Internal Server Error');
    });

    const result = await discoverSiteRoutes(document, {
      baseUrl: BASE_URL,
      currentUrl: 'https://example.com/',
      fetchSitemap: true,
      sitemapFetchFn: failingFetch
    });

    expect(result.routes.some((r) => r.pathname === '/services')).toBe(true);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0]?.code).toBe('SITEMAP_FETCH_ERROR');
  });
});
