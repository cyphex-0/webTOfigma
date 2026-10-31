import { describe, it, expect } from 'vitest';
import { buildSiteDirectoryBoard, SiteDirectoryInput } from '../../core/scene/site-directory-builder';

describe('SiteDirectoryBuilder', () => {
  const sampleInput: SiteDirectoryInput = {
    siteHostname: 'acme.corp',
    exportTimestamp: 1730000000000,
    batchId: 'batch_test_01',
    totalDiscovered: 10,
    totalSelected: 3,
    pages: [
      {
        index: 1,
        title: 'Home Page',
        pathname: '/',
        category: 'Main/Marketing',
        status: 'completed',
        dimensions: { width: 1440, height: 2800 },
        warningCount: 0
      },
      {
        index: 2,
        title: 'Pricing Plans',
        pathname: '/pricing',
        category: 'Products/Services',
        status: 'completed',
        dimensions: { width: 1440, height: 1900 },
        warningCount: 1
      },
      {
        index: 3,
        title: 'Customer Dashboard',
        pathname: '/app',
        category: 'Dashboard/Application',
        status: 'redirected_to_auth',
        dimensions: { width: 1440, height: 900 },
        warningCount: 0
      }
    ]
  };

  it('builds a readable 00 - Site Directory board frame with correct metrics', () => {
    const { boardNode, childNodes } = buildSiteDirectoryBoard(sampleInput, {
      x: 0,
      y: 0,
      width: 1080
    });

    expect(boardNode.name).toBe('00 - Site Directory');
    expect(boardNode.type).toBe('FRAME');
    expect(boardNode.width).toBe(1080);
    expect(boardNode.height).toBeGreaterThanOrEqual(400);

    // Verify metrics cards exist
    const discoveredCard = childNodes.find((n) => n.name === 'Metric Card — Discovered Routes');
    expect(discoveredCard).toBeDefined();

    const successCard = childNodes.find((n) => n.name === 'Metric Card — Captured Successfully');
    expect(successCard).toBeDefined();

    // Verify row frames exist for all 3 pages
    expect(childNodes.some((n) => n.name.includes('Row 01 — Home Page'))).toBe(true);
    expect(childNodes.some((n) => n.name.includes('Row 02 — Pricing Plans'))).toBe(true);
    expect(childNodes.some((n) => n.name.includes('Row 03 — Customer Dashboard'))).toBe(true);
  });

  it('preserves clean parent-child relationships for all internal directory nodes', () => {
    const { boardNode, childNodes } = buildSiteDirectoryBoard(sampleInput);

    const childIdsSet = new Set(childNodes.map((n) => n.id));
    for (const id of boardNode.childIds) {
      expect(childIdsSet.has(id)).toBe(true);
    }
  });
});
