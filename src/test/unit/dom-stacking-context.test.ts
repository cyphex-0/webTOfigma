import { describe, it, expect } from 'vitest';
import {
  detectStackingContextTrigger,
  parseZIndex,
  StackingContextNode,
  type PaintNode
} from '../../core/dom/stacking-context';

describe('Stacking Context 12-Trigger Detection Engine', () => {
  const dummyEl = document.createElement('div');

  it('detects root document element trigger', () => {
    const htmlEl = document.createElement('html');
    const res = detectStackingContextTrigger(htmlEl, {}, false, true);
    expect(res.createsStackingContext).toBe(true);
    expect(res.stackingTrigger).toBe('root-document');
  });

  it('detects positioned elements with numeric z-index', () => {
    // Relative with z-index 10
    const resRel = detectStackingContextTrigger(dummyEl, { position: 'relative', zIndex: '10' });
    expect(resRel.createsStackingContext).toBe(true);
    expect(resRel.zIndex).toBe(10);
    expect(resRel.stackingTrigger).toBe('positioned-z-index-10');

    // Absolute with z-index -1
    const resAbs = detectStackingContextTrigger(dummyEl, { position: 'absolute', zIndex: '-1' });
    expect(resAbs.createsStackingContext).toBe(true);
    expect(resAbs.zIndex).toBe(-1);

    // Relative with z-index auto does NOT create stacking context
    const resRelAuto = detectStackingContextTrigger(dummyEl, { position: 'relative', zIndex: 'auto' });
    expect(resRelAuto.createsStackingContext).toBe(false);
  });

  it('detects fixed and sticky positioning triggers regardless of z-index', () => {
    const resFixed = detectStackingContextTrigger(dummyEl, { position: 'fixed' });
    expect(resFixed.createsStackingContext).toBe(true);
    expect(resFixed.stackingTrigger).toBe('position-fixed');

    const resSticky = detectStackingContextTrigger(dummyEl, { position: 'sticky' });
    expect(resSticky.createsStackingContext).toBe(true);
    expect(resSticky.stackingTrigger).toBe('position-sticky');
  });

  it('detects opacity < 1 trigger', () => {
    const resOpacity = detectStackingContextTrigger(dummyEl, { opacity: '0.85' });
    expect(resOpacity.createsStackingContext).toBe(true);
    expect(resOpacity.stackingTrigger).toBe('opacity-0.85');

    const resOpacity1 = detectStackingContextTrigger(dummyEl, { opacity: '1' });
    expect(resOpacity1.createsStackingContext).toBe(false);
  });

  it('detects transform, filter, backdrop-filter, perspective, clip-path, and mask triggers', () => {
    expect(detectStackingContextTrigger(dummyEl, { transform: 'scale(1.1)' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { filter: 'blur(4px)' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { backdropFilter: 'blur(10px)' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { perspective: '500px' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { clipPath: 'circle(50%)' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { mask: 'url(#mask)' }).createsStackingContext).toBe(true);
  });

  it('detects isolation: isolate and mix-blend-mode triggers', () => {
    expect(detectStackingContextTrigger(dummyEl, { isolation: 'isolate' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { mixBlendMode: 'multiply' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { mixBlendMode: 'normal' }).createsStackingContext).toBe(false);
  });

  it('detects will-change property triggers', () => {
    expect(detectStackingContextTrigger(dummyEl, { willChange: 'transform, opacity' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { willChange: 'filter' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { willChange: 'color' }).createsStackingContext).toBe(false);
  });

  it('detects contain triggers (paint, layout, strict, content)', () => {
    expect(detectStackingContextTrigger(dummyEl, { contain: 'paint' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { contain: 'layout' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { contain: 'strict' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { contain: 'none' }).createsStackingContext).toBe(false);
  });

  it('detects flex/grid item with z-index !== auto trigger', () => {
    const resFlexItem = detectStackingContextTrigger(dummyEl, { zIndex: '2' }, true);
    expect(resFlexItem.createsStackingContext).toBe(true);
    expect(resFlexItem.stackingTrigger).toBe('flex-grid-item-z-index-2');

    const resNonFlex = detectStackingContextTrigger(dummyEl, { zIndex: '2' }, false);
    expect(resNonFlex.createsStackingContext).toBe(false); // static with z-index is not a stacking context
  });

  it('detects container-type and 3D rendering context triggers', () => {
    expect(detectStackingContextTrigger(dummyEl, { containerType: 'inline-size' }).createsStackingContext).toBe(true);
    expect(detectStackingContextTrigger(dummyEl, { transformStyle: 'preserve-3d' }).createsStackingContext).toBe(true);
  });
});

describe('CSS 2.2 Appendix E Multi-Pass Paint Order Sorting', () => {
  function makeNode(
    id: string,
    opts: Partial<PaintNode<string>> = {}
  ): PaintNode<string> {
    return {
      id,
      data: id,
      zIndex: opts.zIndex ?? 'auto',
      createsStackingContext: opts.createsStackingContext ?? false,
      position: opts.position ?? 'static',
      isFloating: opts.isFloating ?? false,
      isInlineLevel: opts.isInlineLevel ?? false,
      documentOrder: opts.documentOrder ?? 0
    };
  }

  it('sorts nodes into exact 7-layer CSS 2.2 Appendix E paint order', () => {
    // Stacking Context Root (Layer 1)
    const rootNode = makeNode('root_ctx', { createsStackingContext: true, documentOrder: 0 });
    const context = new StackingContextNode<string>(rootNode);

    // Negative z-index child stacking context (Layer 2)
    const negCtxNode = makeNode('neg_ctx_-1', {
      createsStackingContext: true,
      zIndex: -1,
      position: 'relative',
      documentOrder: 10
    });
    const negCtx = new StackingContextNode<string>(negCtxNode);
    context.addChildContext(negCtx);

    // In-flow non-positioned block (Layer 3)
    const blockNode = makeNode('block_div', {
      position: 'static',
      documentOrder: 2
    });
    context.addNonContextDescendant(blockNode);

    // Float element (Layer 4)
    const floatNode = makeNode('float_box', {
      position: 'static',
      isFloating: true,
      documentOrder: 3
    });
    context.addNonContextDescendant(floatNode);

    // In-flow inline text (Layer 5)
    const inlineNode = makeNode('inline_span', {
      position: 'static',
      isInlineLevel: true,
      documentOrder: 4
    });
    context.addNonContextDescendant(inlineNode);

    // Positioned element with z-index: auto (Layer 6)
    const posAutoNode = makeNode('pos_auto', {
      position: 'absolute',
      zIndex: 'auto',
      documentOrder: 5
    });
    context.addNonContextDescendant(posAutoNode);

    // Positive z-index child stacking contexts (Layer 7)
    const posCtxNode1 = makeNode('pos_ctx_1', {
      createsStackingContext: true,
      zIndex: 1,
      position: 'relative',
      documentOrder: 6
    });
    const posCtx1 = new StackingContextNode<string>(posCtxNode1);
    context.addChildContext(posCtx1);

    const posCtxNode5 = makeNode('pos_ctx_5', {
      createsStackingContext: true,
      zIndex: 5,
      position: 'absolute',
      documentOrder: 1
    });
    const posCtx5 = new StackingContextNode<string>(posCtxNode5);
    context.addChildContext(posCtx5);

    // Resolve paint order
    const paintStream = context.resolvePaintOrder();
    const paintOrderIds = paintStream.map((n) => n.id);

    // Expected order:
    // 1. root_ctx (Layer 1)
    // 2. neg_ctx_-1 (Layer 2)
    // 3. block_div (Layer 3)
    // 4. float_box (Layer 4)
    // 5. inline_span (Layer 5)
    // 6. pos_auto (Layer 6)
    // 7. pos_ctx_1 (Layer 7: z=1)
    // 8. pos_ctx_5 (Layer 7: z=5)
    expect(paintOrderIds).toEqual([
      'root_ctx',
      'neg_ctx_-1',
      'block_div',
      'float_box',
      'inline_span',
      'pos_auto',
      'pos_ctx_1',
      'pos_ctx_5'
    ]);
  });

  it('orders multiple negative z-index contexts from most negative to least negative', () => {
    const rootNode = makeNode('root', { createsStackingContext: true, documentOrder: 0 });
    const context = new StackingContextNode<string>(rootNode);

    const neg1 = new StackingContextNode<string>(
      makeNode('neg_1', { createsStackingContext: true, zIndex: -1, documentOrder: 1 })
    );
    const neg10 = new StackingContextNode<string>(
      makeNode('neg_10', { createsStackingContext: true, zIndex: -10, documentOrder: 2 })
    );
    const neg5 = new StackingContextNode<string>(
      makeNode('neg_5', { createsStackingContext: true, zIndex: -5, documentOrder: 3 })
    );

    context.addChildContext(neg1);
    context.addChildContext(neg10);
    context.addChildContext(neg5);

    const result = context.resolvePaintOrder().map((n) => n.id);
    expect(result).toEqual(['root', 'neg_10', 'neg_5', 'neg_1']);
  });
});
