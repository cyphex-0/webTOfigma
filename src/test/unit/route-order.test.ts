import { describe, it, expect } from 'vitest';
import { orderRoutesByMode, moveRouteOrder } from '../../core/crawler/route-order';
import { DiscoveredRoute } from '../../core/crawler/crawl-scope';

describe('RouteOrder Engine', () => {
  const routes: DiscoveredRoute[] = [
    {
      canonicalUrl: 'https://example.com/blog',
      originalUrl: 'https://example.com/blog',
      pathname: '/blog',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Blog/Articles',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 3,
      isSelected: true
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
      discoveryIndex: 1,
      isSelected: true
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
      isSelected: true
    }
  ];

  it('orders by discovery-order index', () => {
    const ordered = orderRoutesByMode(routes, 'discovery-order');
    expect(ordered[0]?.discoveryIndex).toBe(1);
    expect(ordered[1]?.discoveryIndex).toBe(2);
    expect(ordered[2]?.discoveryIndex).toBe(3);
  });

  it('orders by pagination-number placing paginated items in numeric order first', () => {
    const ordered = orderRoutesByMode(routes, 'pagination-number');
    expect(ordered[0]?.paginationNumber).toBe(1);
    expect(ordered[1]?.paginationNumber).toBe(2);
    expect(ordered[2]?.paginationNumber).toBeNull();
  });

  it('orders by custom manual-order URLs', () => {
    const manualUrls = [
      'https://example.com/blog',
      'https://example.com/blog/page/1',
      'https://example.com/blog/page/2'
    ];
    const ordered = orderRoutesByMode(routes, 'manual-order', manualUrls);
    expect(ordered.map((r) => r.canonicalUrl)).toEqual(manualUrls);
  });

  it('moves route up and down in manual order', () => {
    const initial = [...routes];
    // Move second item up
    const movedUp = moveRouteOrder(initial, 'https://example.com/blog/page/2', 'up');
    expect(movedUp[0]?.canonicalUrl).toBe('https://example.com/blog/page/2');

    // Move first item down
    const movedDown = moveRouteOrder(movedUp, 'https://example.com/blog/page/2', 'down');
    expect(movedDown[1]?.canonicalUrl).toBe('https://example.com/blog/page/2');
  });
});
