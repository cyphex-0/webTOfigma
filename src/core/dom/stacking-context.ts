/**
 * CSS 2.2 Appendix E & CSS Positioned Layout Level 3 Stacking Context Engine.
 * Detects the 12 standard CSS triggers establishing new stacking contexts, builds
 * the stacking context hierarchy, and resolves exact 7-layer paint-order sorting.
 */

import type { StackingContextHints } from '../../shared/contracts/source-node';

export interface StackingContextTriggerResult {
  createsStackingContext: boolean;
  zIndex: number | 'auto';
  stackingTrigger?: string | undefined;
}

/**
 * Properties in will-change that trigger stacking context creation.
 */
const WILL_CHANGE_STACKING_TRIGGERS: ReadonlySet<string> = new Set([
  'transform',
  'opacity',
  'filter',
  'backdrop-filter',
  'perspective',
  'clip-path',
  'mask',
  'mask-image',
  'isolation',
  'mix-blend-mode',
  'contain'
]);

/**
 * Checks if a will-change string includes any stacking-context trigger property.
 */
function hasWillChangeTrigger(willChangeVal: string): boolean {
  if (!willChangeVal || willChangeVal === 'auto') return false;
  const tokens = willChangeVal.split(',').map((t) => t.trim().toLowerCase());
  return tokens.some((t) => WILL_CHANGE_STACKING_TRIGGERS.has(t));
}

/**
 * Checks if a contain value establishes a stacking context (paint, layout, strict, content).
 */
function hasContainTrigger(containVal: string): boolean {
  if (!containVal || containVal === 'none') return false;
  const tokens = containVal.split(/\s+/).map((t) => t.trim().toLowerCase());
  return tokens.some(
    (t) => t === 'paint' || t === 'layout' || t === 'strict' || t === 'content'
  );
}

/**
 * Parses numeric z-index from CSS computed value.
 */
export function parseZIndex(val?: string | null): number | 'auto' {
  if (!val || val === 'auto') return 'auto';
  const num = parseInt(val, 10);
  return Number.isFinite(num) ? num : 'auto';
}

/**
 * Evaluates whether an element establishes a new stacking context according to the 12 CSS triggers.
 * 
 * @param el Element
 * @param style Computed style or style map
 * @param parentIsFlexOrGrid Whether the parent container is display: flex / inline-flex / grid / inline-grid
 * @param isRootElement Whether the element is document.documentElement
 */
export function detectStackingContextTrigger(
  el: Element,
  style: CSSStyleDeclaration | Record<string, string>,
  parentIsFlexOrGrid = false,
  isRootElement = false
): StackingContextTriggerResult {
  // 1. Root element of the document (HTML) always creates a stacking context
  if (isRootElement || el.tagName === 'HTML') {
    return { createsStackingContext: true, zIndex: 0, stackingTrigger: 'root-document' };
  }

  const position = (style.position || 'static').toLowerCase();
  const zIndex = parseZIndex(style.zIndex || (style as any)['z-index']);
  const opacity = parseFloat(style.opacity || '1');
  const transform = style.transform || 'none';
  const filter = style.filter || 'none';
  const backdropFilter =
    (style as any).backdropFilter || (style as any)['backdrop-filter'] || 'none';
  const perspective = style.perspective || 'none';
  const clipPath = (style as any).clipPath || (style as any)['clip-path'] || 'none';
  const mask = style.mask || (style as any).maskImage || (style as any)['mask-image'] || 'none';
  const isolation = (style.isolation || 'auto').toLowerCase();
  const mixBlendMode =
    ((style as any).mixBlendMode || (style as any)['mix-blend-mode'] || 'normal').toLowerCase();
  const willChange = ((style as any).willChange || (style as any)['will-change'] || 'auto').toLowerCase();
  const contain = (style.contain || 'none').toLowerCase();
  const containerType =
    ((style as any).containerType || (style as any)['container-type'] || 'normal').toLowerCase();
  const transformStyle =
    ((style as any).transformStyle || (style as any)['transform-style'] || 'flat').toLowerCase();

  // 2. Position absolute or relative with z-index !== 'auto'
  if ((position === 'absolute' || position === 'relative') && zIndex !== 'auto') {
    return { createsStackingContext: true, zIndex, stackingTrigger: `positioned-z-index-${zIndex}` };
  }

  // 3. Position fixed or sticky
  if (position === 'fixed' || position === 'sticky') {
    return { createsStackingContext: true, zIndex, stackingTrigger: `position-${position}` };
  }

  // 4. Opacity < 1
  if (Number.isFinite(opacity) && opacity < 1) {
    return { createsStackingContext: true, zIndex, stackingTrigger: `opacity-${opacity}` };
  }

  // 5. Transform, filter, backdrop-filter, perspective, clip-path, mask !== 'none'
  if (transform !== 'none' && transform.trim() !== '') {
    return { createsStackingContext: true, zIndex, stackingTrigger: 'transform' };
  }
  if (filter !== 'none' && filter.trim() !== '') {
    return { createsStackingContext: true, zIndex, stackingTrigger: 'filter' };
  }
  if (backdropFilter !== 'none' && backdropFilter.trim() !== '') {
    return { createsStackingContext: true, zIndex, stackingTrigger: 'backdrop-filter' };
  }
  if (perspective !== 'none' && perspective.trim() !== '') {
    return { createsStackingContext: true, zIndex, stackingTrigger: 'perspective' };
  }
  if (clipPath !== 'none' && clipPath.trim() !== '') {
    return { createsStackingContext: true, zIndex, stackingTrigger: 'clip-path' };
  }
  if (mask !== 'none' && mask.trim() !== '') {
    return { createsStackingContext: true, zIndex, stackingTrigger: 'mask' };
  }

  // 6. isolation: isolate
  if (isolation === 'isolate') {
    return { createsStackingContext: true, zIndex, stackingTrigger: 'isolation-isolate' };
  }

  // 7. mix-blend-mode !== 'normal'
  if (mixBlendMode !== 'normal') {
    return { createsStackingContext: true, zIndex, stackingTrigger: `mix-blend-mode-${mixBlendMode}` };
  }

  // 8. will-change with stacking triggers
  if (hasWillChangeTrigger(willChange)) {
    return { createsStackingContext: true, zIndex, stackingTrigger: `will-change-${willChange}` };
  }

  // 9. contain: paint | layout | strict | content
  if (hasContainTrigger(contain)) {
    return { createsStackingContext: true, zIndex, stackingTrigger: `contain-${contain}` };
  }

  // 10. Flexbox or grid item with z-index !== 'auto'
  if (parentIsFlexOrGrid && zIndex !== 'auto') {
    return { createsStackingContext: true, zIndex, stackingTrigger: `flex-grid-item-z-index-${zIndex}` };
  }

  // 11. container-type: size | inline-size
  if (containerType === 'size' || containerType === 'inline-size') {
    return { createsStackingContext: true, zIndex, stackingTrigger: `container-type-${containerType}` };
  }

  // 12. 3D rendering context (transform-style: preserve-3d)
  if (transformStyle === 'preserve-3d') {
    return { createsStackingContext: true, zIndex, stackingTrigger: 'preserve-3d' };
  }

  return { createsStackingContext: false, zIndex };
}

/**
 * Representation of an element for paint order sorting within its stacking context.
 */
export interface PaintNode<T = unknown> {
  id: string;
  data: T;
  zIndex: number | 'auto';
  createsStackingContext: boolean;
  position: string;
  isFloating: boolean;
  isInlineLevel: boolean;
  documentOrder: number;
}

/**
 * A stacking context node containing its direct descendants and child stacking contexts.
 */
export class StackingContextNode<T = unknown> {
  public rootItem: PaintNode<T>;
  public childContexts: StackingContextNode<T>[] = [];
  public nonContextDescendants: PaintNode<T>[] = [];

  constructor(rootItem: PaintNode<T>) {
    this.rootItem = rootItem;
  }

  addChildContext(ctx: StackingContextNode<T>): void {
    this.childContexts.push(ctx);
  }

  addNonContextDescendant(node: PaintNode<T>): void {
    this.nonContextDescendants.push(node);
  }

  /**
   * Sorts all descendants and child contexts into the CSS 2.2 Appendix E 7-layer paint order:
   * Layer 1: Background and borders of the context root element.
   * Layer 2: Child stacking contexts with negative z-index (most negative first).
   * Layer 3: In-flow, non-inline-level, non-positioned descendants (document order).
   * Layer 4: Non-positioned floating descendants (document order).
   * Layer 5: In-flow, inline-level descendants (document order).
   * Layer 6: Positioned descendants with z-index: auto/0, and child contexts with z-index: 0.
   * Layer 7: Child stacking contexts with positive z-index (smallest first).
   */
  resolvePaintOrder(): PaintNode<T>[] {
    const result: PaintNode<T>[] = [];

    // Layer 1: Root element of this stacking context
    result.push(this.rootItem);

    // Categorize child stacking contexts by z-index
    const negativeContexts: StackingContextNode<T>[] = [];
    const zeroContexts: StackingContextNode<T>[] = [];
    const positiveContexts: StackingContextNode<T>[] = [];

    for (const ctx of this.childContexts) {
      const z = typeof ctx.rootItem.zIndex === 'number' ? ctx.rootItem.zIndex : 0;
      if (z < 0) {
        negativeContexts.push(ctx);
      } else if (z === 0) {
        zeroContexts.push(ctx);
      } else {
        positiveContexts.push(ctx);
      }
    }

    // Sort negative contexts ascending (e.g. -5, -3, -1)
    negativeContexts.sort((a, b) => {
      const za = typeof a.rootItem.zIndex === 'number' ? a.rootItem.zIndex : 0;
      const zb = typeof b.rootItem.zIndex === 'number' ? b.rootItem.zIndex : 0;
      return za - zb || a.rootItem.documentOrder - b.rootItem.documentOrder;
    });

    // Sort positive contexts ascending (e.g. 1, 2, 10)
    positiveContexts.sort((a, b) => {
      const za = typeof a.rootItem.zIndex === 'number' ? a.rootItem.zIndex : 0;
      const zb = typeof b.rootItem.zIndex === 'number' ? b.rootItem.zIndex : 0;
      return za - zb || a.rootItem.documentOrder - b.rootItem.documentOrder;
    });

    // Layer 2: Negative z-index child stacking contexts
    for (const negCtx of negativeContexts) {
      result.push(...negCtx.resolvePaintOrder());
    }

    // Categorize non-stacking-context descendants
    const layer3Blocks: PaintNode<T>[] = [];
    const layer4Floats: PaintNode<T>[] = [];
    const layer5Inlines: PaintNode<T>[] = [];
    const layer6Positioned: PaintNode<T>[] = [];

    for (const node of this.nonContextDescendants) {
      const isPos = node.position !== 'static';
      if (isPos) {
        layer6Positioned.push(node);
      } else if (node.isFloating) {
        layer4Floats.push(node);
      } else if (node.isInlineLevel) {
        layer5Inlines.push(node);
      } else {
        layer3Blocks.push(node);
      }
    }

    // Sort non-context layers by document order
    const byDocOrder = (a: PaintNode<T>, b: PaintNode<T>) => a.documentOrder - b.documentOrder;
    layer3Blocks.sort(byDocOrder);
    layer4Floats.sort(byDocOrder);
    layer5Inlines.sort(byDocOrder);

    // Layer 3: In-flow, non-inline-level, non-positioned descendants
    result.push(...layer3Blocks);

    // Layer 4: Non-positioned floating descendants
    result.push(...layer4Floats);

    // Layer 5: In-flow, inline-level descendants
    result.push(...layer5Inlines);

    // Layer 6: Positioned descendants with z-index: auto/0, and child contexts with z-index: 0 (sorted by document order)
    const layer6Combined: Array<{ order: number; nodes: PaintNode<T>[] }> = [];
    for (const posNode of layer6Positioned) {
      layer6Combined.push({ order: posNode.documentOrder, nodes: [posNode] });
    }
    for (const zeroCtx of zeroContexts) {
      layer6Combined.push({
        order: zeroCtx.rootItem.documentOrder,
        nodes: zeroCtx.resolvePaintOrder()
      });
    }
    layer6Combined.sort((a, b) => a.order - b.order);
    for (const item of layer6Combined) {
      result.push(...item.nodes);
    }

    // Layer 7: Positive z-index child stacking contexts
    for (const posCtx of positiveContexts) {
      result.push(...posCtx.resolvePaintOrder());
    }

    return result;
  }
}
