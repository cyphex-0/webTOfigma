import { describe, it, expect } from 'vitest';
import {
  compileSafeUserRegex,
  filterRoutes,
  reassignRouteCategory,
  mergeCategories,
  PRESET_FILTERS
} from '../../core/crawler/route-filter';
import { DiscoveredRoute } from '../../core/crawler/crawl-scope';

describe('RouteFilter Engine & Safe Regex', () => {
  const sampleRoutes: DiscoveredRoute[] = [
    {
      canonicalUrl: 'https://example.com/',
      originalUrl: 'https://example.com/',
      pathname: '/',
      title: 'Home',
      discoverySource: 'current-page',
      depth: 0,
      category: 'Main/Marketing',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 1,
      isSelected: true
    },
    {
      canonicalUrl: 'https://example.com/blog/design-systems',
      originalUrl: 'https://example.com/blog/design-systems',
      pathname: '/blog/design-systems',
      title: 'Design Systems',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Blog/Articles',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 2,
      isSelected: true
    },
    {
      canonicalUrl: 'https://example.com/blog/release-notes',
      originalUrl: 'https://example.com/blog/release-notes',
      pathname: '/blog/release-notes',
      title: 'Release Notes',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Blog/Articles',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 3,
      isSelected: true
    },
    {
      canonicalUrl: 'https://example.com/docs/intro',
      originalUrl: 'https://example.com/docs/intro',
      pathname: '/docs/intro',
      title: 'Introduction',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Documentation/Help',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 4,
      isSelected: true
    },
    {
      canonicalUrl: 'https://example.com/account/logout',
      originalUrl: 'https://example.com/account/logout',
      pathname: '/account/logout',
      title: 'Logout',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Authentication/Account',
      paginationNumber: null,
      isDestructive: true,
      discoveryIndex: 5,
      isSelected: false
    }
  ];

  describe('compileSafeUserRegex', () => {
    it('compiles valid simple regex correctly', () => {
      const res = compileSafeUserRegex('^/blog/.*');
      expect(res.isValid).toBe(true);
      expect(res.regex).toBeDefined();
      expect(res.regex?.test('/blog/test')).toBe(true);
    });

    it('rejects invalid syntax without throwing', () => {
      const res = compileSafeUserRegex('[unclosed-bracket');
      expect(res.isValid).toBe(false);
      expect(res.error).toBeDefined();
    });

    it('rejects excessively long regex patterns', () => {
      const longPattern = 'a'.repeat(250);
      const res = compileSafeUserRegex(longPattern);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('maximum allowed length');
    });

    it('rejects dangerous nested quantifiers prone to ReDoS', () => {
      const dangerous = '([a-z]+)+';
      const res = compileSafeUserRegex(dangerous);
      expect(res.isValid).toBe(false);
      expect(res.error).toContain('nested quantifiers');
    });
  });

  describe('filterRoutes', () => {
    it('excludes destructive routes by default', () => {
      const filtered = filterRoutes(sampleRoutes, {});
      expect(filtered.some((r) => r.pathname.includes('logout'))).toBe(false);
      expect(filtered).toHaveLength(4);
    });

    it('filters by preset path filter (e.g. blog preset)', () => {
      const filtered = filterRoutes(sampleRoutes, {
        activePresetIds: ['blog']
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((r) => r.pathname.startsWith('/blog/'))).toBe(true);
    });

    it('filters by search query matching title or pathname', () => {
      const filtered = filterRoutes(sampleRoutes, {
        searchQuery: 'intro'
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.pathname).toBe('/docs/intro');
    });

    it('applies custom regex filter safely', () => {
      const filtered = filterRoutes(sampleRoutes, {
        customRegexPattern: 'systems|notes'
      });
      expect(filtered).toHaveLength(2);
      const paths = filtered.map((r) => r.pathname);
      expect(paths).toContain('/blog/design-systems');
      expect(paths).toContain('/blog/release-notes');
    });

    it('filters by selected category', () => {
      const filtered = filterRoutes(sampleRoutes, {
        selectedCategories: ['Documentation/Help']
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.category).toBe('Documentation/Help');
    });
  });

  describe('Category Reassignment and Merging', () => {
    it('reassigns a route category while preserving original URLs and metadata', () => {
      const target = sampleRoutes[1]!;
      const reassigned = reassignRouteCategory(target, 'Products/Services');

      expect(reassigned.category).toBe('Products/Services');
      expect(reassigned.canonicalUrl).toBe(target.canonicalUrl);
      expect(reassigned.originalUrl).toBe(target.originalUrl);
      expect(reassigned.title).toBe(target.title);
    });

    it('merges multiple categories into a single target category', () => {
      const merged = mergeCategories(sampleRoutes, ['Blog/Articles', 'Documentation/Help'], 'Main/Marketing');
      const blogItem = merged.find((r) => r.pathname === '/blog/design-systems');
      const docsItem = merged.find((r) => r.pathname === '/docs/intro');

      expect(blogItem?.category).toBe('Main/Marketing');
      expect(docsItem?.category).toBe('Main/Marketing');
    });
  });
});
