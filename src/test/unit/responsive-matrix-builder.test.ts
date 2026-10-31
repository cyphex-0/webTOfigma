import { describe, it, expect } from 'vitest';
import {
  buildResponsiveMatrix,
  type RouteResponsiveGroup
} from '../../core/scene/responsive-matrix-builder';
import { STANDARD_RESPONSIVE_BREAKPOINTS } from '../../core/capture/responsive-profile';
import type { SceneNode } from '../../shared/contracts/scene';

describe('ResponsiveMatrixBuilder (Phase 21)', () => {
  const createMockFrame = (id: string, name: string, width: number, height: number): SceneNode => ({
    id,
    parentId: null,
    childIds: [],
    name,
    type: 'FRAME',
    visible: true,
    x: 0,
    y: 0,
    width,
    height,
    rotation: 0,
    fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: 1, visible: true }],
    strokes: [],
    effects: [],
    clipsContent: true
  });

  it('arranges desktop and mobile variants side-by-side in a clean row without collision', () => {
    const groups: RouteResponsiveGroup[] = [
      {
        routeIndex: 1,
        routeTitle: 'Home',
        originalUrl: 'https://example.com/',
        canonicalUrl: 'https://example.com/',
        variants: [
          {
            breakpoint: STANDARD_RESPONSIVE_BREAKPOINTS.desktop,
            measuredWidth: 1440,
            measuredHeight: 900,
            frame: createMockFrame('home_desk', 'Home Desktop', 1440, 900)
          },
          {
            breakpoint: STANDARD_RESPONSIVE_BREAKPOINTS.mobile,
            measuredWidth: 375,
            measuredHeight: 667,
            frame: createMockFrame('home_mob', 'Home Mobile', 375, 667)
          }
        ]
      }
    ];

    const result = buildResponsiveMatrix(groups, {
      variantHorizontalGap: 160,
      routeVerticalGap: 240
    });

    expect(result.rowCount).toBe(1);
    expect(result.totalVariants).toBe(2);
    expect(result.positionedFrames).toHaveLength(2);
    expect(result.headerFrames).toHaveLength(1);
    expect(result.diagnostics).toHaveLength(0); // Zero collisions

    const desktop = result.positionedFrames[0]!;
    expect(desktop.name).toBe('01 - Home - Desktop 1440');
    expect(desktop.x).toBe(0);
    expect(desktop.width).toBe(1440);

    const mobile = result.positionedFrames[1]!;
    expect(mobile.name).toBe('01 - Home - Mobile 375');
    expect(mobile.x).toBe(1440 + 160); // 1600
    expect(mobile.width).toBe(375);

    // Both variants share the same row Y coordinate
    expect(desktop.y).toBe(mobile.y);
  });

  it('advances rows using actual maximum height of the previous row', () => {
    const groups: RouteResponsiveGroup[] = [
      {
        routeIndex: 1,
        routeTitle: 'Long Articles',
        originalUrl: 'https://example.com/articles',
        canonicalUrl: 'https://example.com/articles',
        variants: [
          {
            breakpoint: STANDARD_RESPONSIVE_BREAKPOINTS.desktop,
            measuredWidth: 1440,
            measuredHeight: 2500, // Very tall desktop page
            frame: createMockFrame('art_desk', 'Articles Desktop', 1440, 2500)
          },
          {
            breakpoint: STANDARD_RESPONSIVE_BREAKPOINTS.mobile,
            measuredWidth: 375,
            measuredHeight: 3800, // Even taller mobile page!
            frame: createMockFrame('art_mob', 'Articles Mobile', 375, 3800)
          }
        ]
      },
      {
        routeIndex: 2,
        routeTitle: 'Contact',
        originalUrl: 'https://example.com/contact',
        canonicalUrl: 'https://example.com/contact',
        variants: [
          {
            breakpoint: STANDARD_RESPONSIVE_BREAKPOINTS.desktop,
            measuredWidth: 1440,
            measuredHeight: 600, // Short desktop page
            frame: createMockFrame('contact_desk', 'Contact Desktop', 1440, 600)
          }
        ]
      }
    ];

    const result = buildResponsiveMatrix(groups, {
      variantHorizontalGap: 160,
      routeVerticalGap: 240,
      includeRouteHeader: true
    });

    expect(result.rowCount).toBe(2);
    expect(result.totalVariants).toBe(3);
    expect(result.diagnostics).toHaveLength(0); // Collision free

    const row1Desktop = result.positionedFrames[0]!;
    const row2Desktop = result.positionedFrames[2]!;

    // Row 2 Y position must be after Row 1's max height (3800) + header + vertical gap (240)
    expect(row2Desktop.y).toBeGreaterThan(row1Desktop.y + 3800);
  });

  it('generates informative header cards with canonical URL and variant summary', () => {
    const groups: RouteResponsiveGroup[] = [
      {
        routeIndex: 3,
        routeTitle: 'Pricing',
        originalUrl: 'https://example.com/pricing',
        canonicalUrl: 'https://example.com/pricing',
        variants: [
          {
            breakpoint: STANDARD_RESPONSIVE_BREAKPOINTS.desktop,
            measuredWidth: 1440,
            measuredHeight: 900,
            frame: createMockFrame('p_desk', 'Pricing', 1440, 900)
          }
        ]
      }
    ];

    const result = buildResponsiveMatrix(groups);
    expect(result.headerFrames).toHaveLength(1);
    const header = result.headerFrames[0]!;
    expect(header.name).toContain('Header — Route 03: Pricing');

    const metaNode = result.allNodes.find((n) => n.id === 'meta_route_3');
    expect(metaNode?.textData?.text).toContain('https://example.com/pricing');
    expect(metaNode?.textData?.text).toContain('Desktop (1440px)');
  });
});
