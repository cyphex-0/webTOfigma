/**
 * Route ordering modes and manual sequence reordering.
 */

import { DiscoveredRoute } from './crawl-scope';

export type RouteNumberingMode = 'pagination-number' | 'discovery-order' | 'manual-order';

/**
 * Orders a list of routes according to the specified numbering mode.
 */
export function orderRoutesByMode(
  routes: readonly DiscoveredRoute[],
  mode: RouteNumberingMode,
  manualOrderUrls?: readonly string[]
): DiscoveredRoute[] {
  const list = [...routes];

  switch (mode) {
    case 'discovery-order':
      return list.sort((a, b) => a.discoveryIndex - b.discoveryIndex);

    case 'pagination-number':
      return list.sort((a, b) => {
        // Both have pagination numbers: sort numerically
        if (a.paginationNumber !== null && b.paginationNumber !== null) {
          return a.paginationNumber - b.paginationNumber;
        }
        // Paginated routes come first
        if (a.paginationNumber !== null && b.paginationNumber === null) {
          return -1;
        }
        if (a.paginationNumber === null && b.paginationNumber !== null) {
          return 1;
        }
        // Neither has pagination: preserve discovery index
        return a.discoveryIndex - b.discoveryIndex;
      });

    case 'manual-order': {
      if (!manualOrderUrls || manualOrderUrls.length === 0) {
        return list;
      }
      const orderMap = new Map<string, number>();
      manualOrderUrls.forEach((url, idx) => orderMap.set(url, idx));

      return list.sort((a, b) => {
        const orderA = orderMap.get(a.canonicalUrl);
        const orderB = orderMap.get(b.canonicalUrl);

        if (orderA !== undefined && orderB !== undefined) {
          return orderA - orderB;
        }
        if (orderA !== undefined) return -1;
        if (orderB !== undefined) return 1;

        return a.discoveryIndex - b.discoveryIndex;
      });
    }

    default:
      return list;
  }
}

/**
 * Moves a route up or down in a manual sequence.
 */
export function moveRouteOrder(
  routes: readonly DiscoveredRoute[],
  canonicalUrl: string,
  direction: 'up' | 'down'
): DiscoveredRoute[] {
  const index = routes.findIndex((r) => r.canonicalUrl === canonicalUrl);
  if (index === -1) {
    return [...routes];
  }

  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= routes.length) {
    return [...routes]; // Already at edge
  }

  const list = [...routes];
  const item = list[index]!;
  list.splice(index, 1);
  list.splice(targetIndex, 0, item);

  return list;
}
