import { describe, it, expect } from 'vitest';
import {
  groupPagesByCategory,
  buildCategorySection,
  STANDARD_CATEGORY_DEFINITIONS
} from '../../core/scene/section-builder';
import type { SceneNode } from '../../shared/contracts/scene';
import type { StructuredPageMetadata } from '../../core/scene/page-metadata';

describe('SectionBuilder', () => {
  function createSampleFrame(id: string): SceneNode {
    return {
      id,
      parentId: null,
      childIds: [],
      name: `Page ${id}`,
      type: 'FRAME',
      visible: true,
      x: 0,
      y: 0,
      width: 1440,
      height: 900,
      rotation: 0,
      fills: [],
      strokes: [],
      effects: [],
      clipsContent: true
    };
  }

  function createSampleMeta(id: string, category?: any): StructuredPageMetadata {
    return {
      routeIndex: 1,
      name: `Page ${id}`,
      title: `Page ${id}`,
      originalUrl: `https://example.com/${id}`,
      canonicalUrl: `https://example.com/${id}`,
      pathname: `/${id}`,
      category,
      batchId: 'batch_test',
      captureDimensions: { width: 1440, height: 900 },
      capturedAt: Date.now(),
      status: 'completed',
      warningCount: 0
    };
  }

  it('groups pages into standard numbered categories based on metadata', () => {
    const f1 = createSampleFrame('home');
    const f2 = createSampleFrame('pricing');
    const f3 = createSampleFrame('blog');
    const f4 = createSampleFrame('random');

    const metadataMap: Record<string, StructuredPageMetadata> = {
      home: createSampleMeta('home', 'Main/Marketing'),
      pricing: createSampleMeta('pricing', 'Products/Services'),
      blog: createSampleMeta('blog', 'Blog/Articles'),
      random: createSampleMeta('random', undefined) // unclassified -> 07 - Other Pages
    };

    const groups = groupPagesByCategory([f1, f2, f3, f4], metadataMap);

    // Expect 4 populated categories
    expect(groups.length).toBe(4);
    expect(groups[0]?.definition.code).toBe('01'); // Main / Marketing
    expect(groups[1]?.definition.code).toBe('02'); // Products / Services
    expect(groups[2]?.definition.code).toBe('03'); // Blog / Content
    expect(groups[3]?.definition.code).toBe('07'); // Other Pages

    expect(groups[0]?.frames[0]?.id).toBe('home');
    expect(groups[1]?.frames[0]?.id).toBe('pricing');
    expect(groups[2]?.frames[0]?.id).toBe('blog');
    expect(groups[3]?.frames[0]?.id).toBe('random');
  });

  it('builds native Section node with type: SECTION when enabled', () => {
    const f1 = createSampleFrame('home');
    const group = {
      definition: STANDARD_CATEGORY_DEFINITIONS[0]!,
      frames: [f1],
      metadata: [createSampleMeta('home', 'Main/Marketing')]
    };

    const result = buildCategorySection(group, {
      useNativeSections: true,
      x: 100,
      y: 200,
      width: 1800,
      height: 1200
    });

    expect(result.isNativeSection).toBe(true);
    expect(result.node.type).toBe('SECTION');
    expect(result.node.name).toBe('01 - Main / Marketing');
    expect(result.node.childIds).toContain('home');
    expect(result.diagnostics.length).toBe(0);
  });

  it('builds category heading Frame with diagnostic fallback when native sections are disabled', () => {
    const f1 = createSampleFrame('pricing');
    const group = {
      definition: STANDARD_CATEGORY_DEFINITIONS[1]!,
      frames: [f1],
      metadata: [createSampleMeta('pricing', 'Products/Services')]
    };

    const result = buildCategorySection(group, {
      useNativeSections: false,
      width: 1440
    });

    // Must NOT be labeled as SECTION
    expect(result.isNativeSection).toBe(false);
    expect(result.node.type).toBe('FRAME');
    expect(result.node.name).toContain('Category Heading —');

    // Must emit compatibility fallback diagnostic
    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0]?.code).toBe('SECTION_COMPATIBILITY_FALLBACK');
    expect(result.diagnostics[0]?.severity).toBe('info');
  });
});
