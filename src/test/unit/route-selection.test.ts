import { describe, it, expect } from 'vitest';
import {
  applyParitySelection,
  selectAllRoutes,
  deselectAllRoutes,
  invertRouteSelection,
  selectCurrentPageRoute,
  selectTopLevelNavRoutes,
  toggleRouteSelection,
  applyPageCap,
  addManualRoute,
  removeManualRoute
} from '../../core/crawler/route-selection';
import { DiscoveredRoute } from '../../core/crawler/crawl-scope';

describe('RouteSelection Engine', () => {
  const sampleRoutes: DiscoveredRoute[] = [
    {
      canonicalUrl: 'https://example.com/',
      originalUrl: 'https://example.com/',
      pathname: '/',
      discoverySource: 'current-page',
      depth: 0,
      category: 'Main/Marketing',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 1,
      isSelected: false
    },
    {
      canonicalUrl: 'https://example.com/blog/page/1',
      originalUrl: 'https://example.com/blog/page/1',
      pathname: '/blog/page/1',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Blog/Articles',
      paginationNumber: 1,
      isDestructive: false,
      discoveryIndex: 2,
      isSelected: false
    },
    {
      canonicalUrl: 'https://example.com/blog/page/2',
      originalUrl: 'https://example.com/blog/page/2',
      pathname: '/blog/page/2',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Blog/Articles',
      paginationNumber: 2,
      isDestructive: false,
      discoveryIndex: 3,
      isSelected: false
    },
    {
      canonicalUrl: 'https://example.com/blog/page/3',
      originalUrl: 'https://example.com/blog/page/3',
      pathname: '/blog/page/3',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Blog/Articles',
      paginationNumber: 3,
      isDestructive: false,
      discoveryIndex: 4,
      isSelected: false
    },
    {
      canonicalUrl: 'https://example.com/account/logout',
      originalUrl: 'https://example.com/account/logout',
      pathname: '/account/logout',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Authentication/Account',
      paginationNumber: null,
      isDestructive: true,
      discoveryIndex: 5,
      isSelected: false
    }
  ];

  describe('Parity Selection (Odd / Even)', () => {
    it('selects odd routes based on pagination number only', () => {
      const res = applyParitySelection(sampleRoutes, 'odd', 'pagination-number');
      expect(res.selectedCount).toBe(2); // page 1 and page 3
      expect(res.summaryLabel).toBe('Odd pages — pagination number — 2 routes selected');

      const selectedUrls = res.routes.filter((r) => r.isSelected).map((r) => r.canonicalUrl);
      expect(selectedUrls).toEqual([
        'https://example.com/blog/page/1',
        'https://example.com/blog/page/3'
      ]);
      // Null pagination items remain unselected
      expect(res.routes.find((r) => r.pathname === '/')?.isSelected).toBe(false);
    });

    it('selects even routes based on pagination number only', () => {
      const res = applyParitySelection(sampleRoutes, 'even', 'pagination-number');
      expect(res.selectedCount).toBe(1); // page 2
      expect(res.summaryLabel).toBe('Even pages — pagination number — 1 route selected');

      const selected = res.routes.filter((r) => r.isSelected);
      expect(selected[0]?.canonicalUrl).toBe('https://example.com/blog/page/2');
    });

    it('selects odd routes based on discovery order (1st, 3rd, 5th items)', () => {
      const res = applyParitySelection(sampleRoutes, 'odd', 'discovery-order');
      expect(res.selectedCount).toBe(3); // indices 1, 3, 5
      expect(res.summaryLabel).toBe('Odd pages — discovery order — 3 routes selected');

      expect(res.routes[0]?.isSelected).toBe(true); // 1st
      expect(res.routes[1]?.isSelected).toBe(false); // 2nd
      expect(res.routes[2]?.isSelected).toBe(true); // 3rd
      expect(res.routes[3]?.isSelected).toBe(false); // 4th
      expect(res.routes[4]?.isSelected).toBe(true); // 5th
    });

    it('selects even routes based on discovery order (2nd, 4th items)', () => {
      const res = applyParitySelection(sampleRoutes, 'even', 'discovery-order');
      expect(res.selectedCount).toBe(2); // indices 2, 4
      expect(res.summaryLabel).toBe('Even pages — discovery order — 2 routes selected');

      expect(res.routes[0]?.isSelected).toBe(false);
      expect(res.routes[1]?.isSelected).toBe(true);
      expect(res.routes[2]?.isSelected).toBe(false);
      expect(res.routes[3]?.isSelected).toBe(true);
    });
  });

  describe('Standard Selection Actions', () => {
    it('selectAll selects only non-destructive routes', () => {
      const all = selectAllRoutes(sampleRoutes);
      expect(all.filter((r) => r.isSelected)).toHaveLength(4);
      expect(all.find((r) => r.isDestructive)?.isSelected).toBe(false);
    });

    it('deselectAll deselects every route', () => {
      const deselected = deselectAllRoutes(sampleRoutes);
      expect(deselected.every((r) => !r.isSelected)).toBe(true);
    });

    it('invertRouteSelection inverts non-destructive selection', () => {
      const initial = sampleRoutes.map((r, i) => ({ ...r, isSelected: i === 0 }));
      const inverted = invertRouteSelection(initial);
      expect(inverted[0]?.isSelected).toBe(false);
      expect(inverted[1]?.isSelected).toBe(true);
      expect(inverted[2]?.isSelected).toBe(true);
      expect(inverted[3]?.isSelected).toBe(true);
      expect(inverted[4]?.isSelected).toBe(false); // destructive remains false
    });

    it('selectCurrentPageRoute selects only the current page', () => {
      const res = selectCurrentPageRoute(sampleRoutes);
      expect(res.filter((r) => r.isSelected)).toHaveLength(1);
      expect(res[0]?.canonicalUrl).toBe('https://example.com/');
    });

    it('toggleRouteSelection flips selection of a specific route', () => {
      const toggled = toggleRouteSelection(sampleRoutes, 'https://example.com/blog/page/1');
      expect(toggled.find((r) => r.canonicalUrl === 'https://example.com/blog/page/1')?.isSelected).toBe(true);
      const toggledBack = toggleRouteSelection(toggled, 'https://example.com/blog/page/1');
      expect(toggledBack.find((r) => r.canonicalUrl === 'https://example.com/blog/page/1')?.isSelected).toBe(false);
    });
  });

  describe('Page Cap Enforcement', () => {
    it('caps selected routes and deselects excess with warning', () => {
      const allSelected = selectAllRoutes(sampleRoutes); // 4 selected
      const capped = applyPageCap(allSelected, 2);

      expect(capped.isCapped).toBe(true);
      expect(capped.selectedCount).toBe(2);
      expect(capped.routes.filter((r) => r.isSelected)).toHaveLength(2);
      expect(capped.warning).toContain('exceeded cap of 2');
    });

    it('does not alter selection when selected count is within cap', () => {
      const initial = sampleRoutes.map((r, i) => ({ ...r, isSelected: i < 2 }));
      const capped = applyPageCap(initial, 5);

      expect(capped.isCapped).toBe(false);
      expect(capped.selectedCount).toBe(2);
      expect(capped.warning).toBeUndefined();
    });
  });

  describe('Manual Route Management', () => {
    it('adds a valid manual route within site scope', () => {
      const res = addManualRoute(sampleRoutes, '/pricing', 'https://example.com');
      expect(res.success).toBe(true);
      expect(res.newRoute).toBeDefined();
      expect(res.newRoute?.canonicalUrl).toBe('https://example.com/pricing');
      expect(res.newRoute?.discoverySource).toBe('manual');
      expect(res.newRoute?.isSelected).toBe(true);
      expect(res.routes).toHaveLength(sampleRoutes.length + 1);
    });

    it('rejects external origins or duplicates', () => {
      const resExternal = addManualRoute(sampleRoutes, 'https://attacker.com/malicious', 'https://example.com');
      expect(resExternal.success).toBe(false);
      expect(resExternal.error).toContain('outside allowed site scope');

      const resDup = addManualRoute(sampleRoutes, '/', 'https://example.com');
      expect(resDup.success).toBe(false);
      expect(resDup.error).toContain('already present');
    });

    it('removes manual route by canonical URL', () => {
      const added = addManualRoute(sampleRoutes, '/about', 'https://example.com');
      expect(added.routes).toHaveLength(sampleRoutes.length + 1);

      const removed = removeManualRoute(added.routes, 'https://example.com/about');
      expect(removed).toHaveLength(sampleRoutes.length);
      expect(removed.some((r) => r.canonicalUrl === 'https://example.com/about')).toBe(false);
    });
  });
});
