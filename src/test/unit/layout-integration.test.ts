import { describe, it, expect, beforeEach } from 'vitest';
import { reconstructContainerLayout, ChildLayoutInput } from '../../core/layout/index';

describe('Layout Reconstruction Integration Fixtures', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('Flexbox Auto Layout Translation', () => {
    it('converts clean horizontal flex container to HORIZONTAL Auto Layout', () => {
      const container = document.createElement('div');
      const child1 = document.createElement('div');
      const child2 = document.createElement('div');
      container.appendChild(child1);
      container.appendChild(child2);
      document.body.appendChild(container);

      const childrenInput: ChildLayoutInput[] = [
        {
          id: 'item_1',
          element: child1,
          globalRect: { x: 20, y: 10, width: 100, height: 40 },
          style: { width: '100px', height: '40px' },
          hasChildren: false,
          isText: false
        },
        {
          id: 'item_2',
          element: child2,
          globalRect: { x: 140, y: 10, width: 200, height: 40 },
          style: { flexGrow: '1', height: '40px' },
          hasChildren: false,
          isText: false
        }
      ];

      const result = reconstructContainerLayout(
        container,
        {
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px',
          padding: '10px 20px',
          width: '400px',
          height: '60px'
        },
        childrenInput,
        { nodeId: 'nav_flex' }
      );

      expect(result.decision).toBe('auto-layout-exact');
      expect(result.layoutMetadata.layoutMode).toBe('HORIZONTAL');
      expect(result.layoutMetadata.primaryAxisAlign).toBe('SPACE_BETWEEN');
      expect(result.layoutMetadata.counterAxisAlign).toBe('CENTER');
      expect(result.layoutMetadata.itemSpacing).toBe(20);
      expect(result.layoutMetadata.padding).toEqual({ top: 10, right: 20, bottom: 10, left: 20 });

      // Child 1: fixed width
      expect(result.childrenSizing.get('item_1')?.horizontal).toBe('FIXED');
      // Child 2: flexGrow 1 -> horizontal FILL
      expect(result.childrenSizing.get('item_2')?.horizontal).toBe('FILL');
      expect(result.diagnostics).toHaveLength(0);
    });

    it('converts vertical flex container to VERTICAL Auto Layout', () => {
      const container = document.createElement('div');
      const child = document.createElement('p');
      container.appendChild(child);
      document.body.appendChild(container);

      const result = reconstructContainerLayout(
        container,
        {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          rowGap: '12px',
          padding: '16px',
          width: '300px',
          height: 'auto'
        },
        [
          {
            id: 'text_item',
            element: child,
            globalRect: { x: 16, y: 16, width: 268, height: 48 },
            style: { width: '100%', height: 'auto' },
            hasChildren: false,
            isText: true
          }
        ]
      );

      expect(result.decision).toBe('auto-layout-exact');
      expect(result.layoutMetadata.layoutMode).toBe('VERTICAL');
      expect(result.layoutMetadata.itemSpacing).toBe(12);
      expect(result.childrenSizing.get('text_item')?.horizontal).toBe('FILL');
      expect(result.childrenSizing.get('text_item')?.vertical).toBe('HUG');
    });
  });

  describe('Locked Layout Policy: Fallback Preservation', () => {
    it('disqualifies flex-wrap: wrap into positioned frame preserving measured bounds', () => {
      const container = document.createElement('div');
      container.getBoundingClientRect = () => ({
        left: 50,
        top: 100,
        right: 450,
        bottom: 300,
        width: 400,
        height: 200,
        x: 50,
        y: 100,
        toJSON: () => {}
      });

      const child1 = document.createElement('div');
      const child2 = document.createElement('div');
      container.appendChild(child1);
      container.appendChild(child2);

      const result = reconstructContainerLayout(
        container,
        {
          display: 'flex',
          flexWrap: 'wrap',
          flexDirection: 'row',
          width: '400px',
          height: '200px'
        },
        [
          {
            id: 'c1',
            element: child1,
            globalRect: { x: 60, y: 110, width: 180, height: 80 },
            style: { width: '180px', height: '80px' },
            hasChildren: false,
            isText: false
          },
          {
            id: 'c2',
            element: child2,
            globalRect: { x: 60, y: 200, width: 180, height: 80 },
            style: { width: '180px', height: '80px' },
            hasChildren: false,
            isText: false
          }
        ],
        { nodeId: 'wrap_container' }
      );

      expect(result.decision).toBe('positioned-fallback');
      expect(result.layoutMetadata.layoutMode).toBe('NONE');
      expect(result.positionedChildren).toBeDefined();
      expect(result.positionedChildren).toHaveLength(2);

      // Local coordinates rebased from container origin (50, 100)
      expect(result.positionedChildren![0]?.localRect).toEqual({
        x: 10,
        y: 10,
        width: 180,
        height: 80
      });
      expect(result.positionedChildren![1]?.localRect).toEqual({
        x: 10,
        y: 100,
        width: 180,
        height: 80
      });

      expect(result.diagnostics.some((d) => d.code === 'LAYOUT_FALLBACK_APPLIED')).toBe(true);
    });

    it('disqualifies grid with spanning elements into positioned fallback', () => {
      const container = document.createElement('div');
      const child = document.createElement('div');

      const result = reconstructContainerLayout(
        container,
        {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(2, auto)'
        },
        [
          {
            id: 'span_item',
            element: child,
            globalRect: { x: 0, y: 0, width: 400, height: 100 },
            style: { gridColumn: 'span 2' },
            hasChildren: false,
            isText: false
          }
        ]
      );

      expect(result.decision).toBe('positioned-fallback');
      expect(result.layoutMetadata.layoutMode).toBe('NONE');
      expect(result.diagnostics.some((d) => d.code === 'LAYOUT_FALLBACK_APPLIED')).toBe(true);
    });
  });

  describe('CSS Grid 1D Translation', () => {
    it('translates 1-column grid to VERTICAL Auto Layout', () => {
      const container = document.createElement('div');
      const child = document.createElement('div');

      const result = reconstructContainerLayout(
        container,
        {
          display: 'grid',
          gridTemplateColumns: '1fr',
          gridTemplateRows: 'repeat(3, auto)',
          rowGap: '16px',
          padding: '24px'
        },
        [
          {
            id: 'row_1',
            element: child,
            globalRect: { x: 24, y: 24, width: 200, height: 50 },
            style: { width: '200px', height: '50px' },
            hasChildren: false,
            isText: false
          }
        ]
      );

      expect(result.decision).toBe('auto-layout-exact');
      expect(result.layoutMetadata.layoutMode).toBe('VERTICAL');
      expect(result.layoutMetadata.itemSpacing).toBe(16);
      expect(result.layoutMetadata.padding).toEqual({ top: 24, right: 24, bottom: 24, left: 24 });
    });
  });
});
