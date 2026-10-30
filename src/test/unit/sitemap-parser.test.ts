import { describe, it, expect, vi } from 'vitest';
import {
  parseSitemapXml,
  fetchAndParseSitemapTree
} from '../../core/crawler/sitemap-parser';

describe('Sitemap XML Parser & Recursive Index Traversal', () => {
  const BASE_URL = 'https://example.com';
  const NORM_OPTIONS = { baseUrl: BASE_URL };

  const VALID_URLSET_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2026-10-30</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about/</loc>
    <lastmod>2026-10-25</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://example.com/pricing?utm_source=seo</loc>
    <priority>0.9</priority>
  </url>
  <url>
    <!-- External URL that must be filtered out -->
    <loc>https://external-site.com/promo</loc>
  </url>
  <url>
    <!-- Downloadable file that must be filtered out -->
    <loc>https://example.com/whitepaper.pdf</loc>
  </url>
</urlset>`;

  const VALID_SITEMAPINDEX_XML = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>https://example.com/sitemap-products.xml</loc>
    <lastmod>2026-10-30</lastmod>
  </sitemap>
  <sitemap>
    <loc>https://example.com/sitemap-blog.xml</loc>
    <lastmod>2026-10-28</lastmod>
  </sitemap>
</sitemapindex>`;

  const PRODUCTS_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/products/exporter</loc>
  </url>
  <url>
    <loc>https://example.com/products/importer</loc>
  </url>
</urlset>`;

  const BLOG_SITEMAP_XML = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/blog/v1-announcement</loc>
  </url>
</urlset>`;

  it('parses valid urlset XML and extracts normalized valid entries', () => {
    const res = parseSitemapXml(VALID_URLSET_XML, 'https://example.com/sitemap.xml', NORM_OPTIONS);

    expect(res.diagnostics).toHaveLength(0);
    expect(res.subSitemaps).toHaveLength(0);
    expect(res.entries).toHaveLength(3);

    expect(res.entries[0]?.canonicalUrl).toBe('https://example.com/');
    expect(res.entries[0]?.priority).toBe(1.0);
    expect(res.entries[0]?.changefreq).toBe('daily');

    // /about/ trailing slash normalized to /about
    expect(res.entries[1]?.canonicalUrl).toBe('https://example.com/about');
    expect(res.entries[1]?.priority).toBe(0.8);

    // tracking parameter utm_source stripped
    expect(res.entries[2]?.canonicalUrl).toBe('https://example.com/pricing');
    expect(res.entries[2]?.priority).toBe(0.9);
  });

  it('parses sitemapindex XML and identifies sub-sitemaps', () => {
    const res = parseSitemapXml(VALID_SITEMAPINDEX_XML, 'https://example.com/sitemap.xml', NORM_OPTIONS);

    expect(res.diagnostics).toHaveLength(0);
    expect(res.entries).toHaveLength(0);
    expect(res.subSitemaps).toEqual([
      'https://example.com/sitemap-products.xml',
      'https://example.com/sitemap-blog.xml'
    ]);
  });

  it('gracefully handles malformed or invalid XML without throwing', () => {
    const invalidXml = '<urlset><url><loc>https://example.com/unclosed';
    const res = parseSitemapXml(invalidXml, 'https://example.com/broken.xml', NORM_OPTIONS);

    expect(res.entries).toHaveLength(0);
    expect(res.diagnostics.length).toBeGreaterThan(0);
    expect(res.diagnostics[0]?.code).toBe('SITEMAP_PARSE_ERROR');
  });

  it('traverses recursive sitemap indexes with custom fetchFn', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url === 'https://example.com/sitemap.xml') return VALID_SITEMAPINDEX_XML;
      if (url === 'https://example.com/sitemap-products.xml') return PRODUCTS_SITEMAP_XML;
      if (url === 'https://example.com/sitemap-blog.xml') return BLOG_SITEMAP_XML;
      throw new Error(`404 Not Found: ${url}`);
    });

    const result = await fetchAndParseSitemapTree({
      baseUrl: BASE_URL,
      sitemapUrl: 'https://example.com/sitemap.xml',
      fetchFn: mockFetch
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(result.diagnostics).toHaveLength(0);
    expect(result.entries).toHaveLength(3);

    const canonicalUrls = result.entries.map((e) => e.canonicalUrl);
    expect(canonicalUrls).toContain('https://example.com/products/exporter');
    expect(canonicalUrls).toContain('https://example.com/products/importer');
    expect(canonicalUrls).toContain('https://example.com/blog/v1-announcement');
  });

  it('handles fetch network errors without breaking pipeline', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('Network error: connection refused');
    });

    const result = await fetchAndParseSitemapTree({
      baseUrl: BASE_URL,
      fetchFn: failingFetch
    });

    expect(result.entries).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]?.code).toBe('SITEMAP_FETCH_ERROR');
  });

  it('enforces maximum sitemaps cap', async () => {
    const multiIndexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/s1.xml</loc></sitemap>
  <sitemap><loc>https://example.com/s2.xml</loc></sitemap>
  <sitemap><loc>https://example.com/s3.xml</loc></sitemap>
</sitemapindex>`;

    const mockFetch = vi.fn(async (url: string) => {
      if (url === 'https://example.com/sitemap.xml') return multiIndexXml;
      return `<urlset><url><loc>${url.replace('.xml', '')}</loc></url></urlset>`;
    });

    const result = await fetchAndParseSitemapTree({
      baseUrl: BASE_URL,
      maxSitemaps: 2, // Only index + 1 child
      fetchFn: mockFetch
    });

    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(2);
    expect(result.diagnostics.some((d) => d.code === 'SITEMAP_MAX_REACHED')).toBe(true);
  });
});
