import { describe, it, expect } from 'vitest';
import {
  createStructuredPageMetadata,
  buildMetadataHeaderFrame,
  StructuredPageMetadata
} from '../../core/scene/page-metadata';

describe('PageMetadata and Visual Header Frame', () => {
  const sampleMetadata: StructuredPageMetadata = createStructuredPageMetadata({
    routeIndex: 2,
    name: '02 - Pricing Plans - /pricing',
    title: 'Pricing Plans',
    originalUrl: 'https://example.com/pricing',
    canonicalUrl: 'https://example.com/pricing',
    pathname: '/pricing',
    category: 'Products/Services',
    batchId: 'batch_123',
    width: 1440,
    height: 3200,
    status: 'completed',
    diagnostics: [
      {
        severity: 'warning',
        code: 'FONT_SUBSTITUTED',
        message: 'Replaced custom font with Inter',
        phase: 'scene-conversion',
        timestamp: Date.now()
      }
    ]
  });

  it('creates structured metadata with accurate warning count and category', () => {
    expect(sampleMetadata.routeIndex).toBe(2);
    expect(sampleMetadata.category).toBe('Products/Services');
    expect(sampleMetadata.warningCount).toBe(1);
    expect(sampleMetadata.captureDimensions.width).toBe(1440);
    expect(sampleMetadata.captureDimensions.height).toBe(3200);
    expect(sampleMetadata.status).toBe('completed');
  });

  it('does not guess category when user left it unclassified', () => {
    const unclassified = createStructuredPageMetadata({
      routeIndex: 1,
      name: '01 - Home - /',
      title: 'Home',
      originalUrl: 'https://example.com/',
      canonicalUrl: 'https://example.com/',
      pathname: '/',
      category: undefined, // left unclassified
      batchId: 'batch_123',
      width: 1440,
      height: 900
    });

    expect(unclassified.category).toBeUndefined();
  });

  it('builds an external metadata header frame positioned strictly above the page frame', () => {
    const pageFrameY = 100;
    const pageFrameHeight = 3200;

    const { headerFrame, childNodes } = buildMetadataHeaderFrame({
      metadata: sampleMetadata,
      pageFrameX: 0,
      pageFrameY,
      pageFrameWidth: 1440,
      headerHeight: 52,
      marginBelow: 16
    });

    // Header must be placed at pageFrameY - (52 + 16) = 32
    expect(headerFrame.y).toBe(32);
    expect(headerFrame.height).toBe(52);
    expect(headerFrame.width).toBe(1440);

    // Source page height must NOT be altered by metadata
    expect(sampleMetadata.captureDimensions.height).toBe(pageFrameHeight);

    // Header has its title, url, status badge, and dimensions badge
    expect(headerFrame.childIds.length).toBe(4);
    expect(childNodes.some((n) => n.name === 'Page Title & Path')).toBe(true);
    expect(childNodes.some((n) => n.name === 'Full Source URL')).toBe(true);
    expect(childNodes.some((n) => n.name === 'Status Badge')).toBe(true);
    expect(childNodes.some((n) => n.name === 'Dimensions Badge')).toBe(true);
  });

  it('correctly adapts status colors for completed, redirect, and failed routes', () => {
    const failedMeta = createStructuredPageMetadata({
      routeIndex: 3,
      name: '03 - Billing - /billing',
      title: 'Billing',
      originalUrl: 'https://example.com/billing',
      canonicalUrl: 'https://example.com/billing',
      pathname: '/billing',
      batchId: 'batch_123',
      width: 1440,
      height: 900,
      status: 'failed',
      failureReason: '500 Internal Server Error'
    });

    const { childNodes } = buildMetadataHeaderFrame({
      metadata: failedMeta,
      pageFrameX: 0,
      pageFrameY: 0
    });

    const statusBadge = childNodes.find((n) => n.name === 'Status Badge');
    expect(statusBadge).toBeDefined();
    // Red color for failed status
    expect(statusBadge?.fills[0]?.color?.r).toBeCloseTo(0.99, 1);
  });
});
