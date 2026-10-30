/**
 * DOMWalker — High-Precision Deterministic DOM Extraction Engine.
 * Traverses rendered DOM elements, applies visibility rules and privacy sanitization,
 * measures document/viewport geometry with 3D matrix projection, resolves CSS 2.2 Appendix E
 * stacking contexts, synthesizes pseudo-elements, and traverses shadow roots.
 */

import type {
  SourceNode,
  SourceRect,
  ComputedStyleSnapshot,
  VisibilityFlags,
  StackingContextHints
} from '../../shared/contracts/source-node';
import type { PageCaptureMetadata } from '../../shared/contracts/page-capture';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { calculateGeometry } from './geometry';
import { projectTransformedRect } from './matrix-projector';
import { evaluateElementVisibility } from './visibility';
import { sanitizeElementPrivacy } from './privacy-sanitizer';
import { extractTextRuns } from './text-extractor';
import { extractPseudoElements } from './pseudo-elements';
import { inspectShadowRoot } from './shadow-dom';
import { inspectIframe } from './iframe-handler';
import {
  detectStackingContextTrigger,
  StackingContextNode,
  type PaintNode
} from './stacking-context';
import { discoverElementAssets } from '../assets/asset-discovery';

export interface DOMWalkerOptions {
  rootElement?: Element | undefined;
  maxNodeCount?: number | undefined;
  maxDepth?: number | undefined;
  resolvePaintOrder?: boolean | undefined;
  captureMode?: string | undefined;
}

export interface DOMWalkerResult {
  nodes: SourceNode[];
  metadata: PageCaptureMetadata;
  diagnostics: ExportDiagnostic[];
}

/**
 * Builds a ComputedStyleSnapshot from a DOM computed style declaration.
 */
function snapshotComputedStyle(
  style: CSSStyleDeclaration | Record<string, string>
): ComputedStyleSnapshot {
  const s = style as any;
  const fontFamily = (s.fontFamily || 'sans-serif').replace(/["']/g, '');

  const snapshot: ComputedStyleSnapshot = {
    display: s.display || 'block',
    position: s.position || 'static',
    overflow: s.overflow || 'visible',
    boxSizing: s.boxSizing || 'content-box',
    backgroundColor: s.backgroundColor || 'transparent',
    color: s.color || '#000000',
    fontSize: s.fontSize || '16px',
    fontFamily,
    fontWeight: s.fontWeight || '400',
    lineHeight: s.lineHeight || 'normal',
    letterSpacing: s.letterSpacing || 'normal',
    textAlign: s.textAlign || 'left',
    borderRadius: s.borderRadius || '0px',
    borderWidth: s.borderWidth || '0px',
    borderColor: s.borderColor || 'transparent',
    borderStyle: s.borderStyle || 'none',
    boxShadow: s.boxShadow || 'none',
    transform: s.transform || 'none',
    padding: s.padding || '0px',
    margin: s.margin || '0px'
  };

  if (s.flexDirection) snapshot.flexDirection = s.flexDirection;
  if (s.justifyContent) snapshot.justifyContent = s.justifyContent;
  if (s.alignItems) snapshot.alignItems = s.alignItems;
  if (s.gap) snapshot.gap = s.gap;
  if (s.gridTemplateColumns) snapshot.gridTemplateColumns = s.gridTemplateColumns;
  if (s.gridTemplateRows) snapshot.gridTemplateRows = s.gridTemplateRows;

  // Background properties
  if (s.backgroundImage) snapshot.backgroundImage = s.backgroundImage;
  if (s.backgroundSize) snapshot.backgroundSize = s.backgroundSize;
  if (s.backgroundPosition) snapshot.backgroundPosition = s.backgroundPosition;
  if (s.backgroundRepeat) snapshot.backgroundRepeat = s.backgroundRepeat;

  // Individual 4-corner radii
  if (s.borderTopLeftRadius) snapshot.borderTopLeftRadius = s.borderTopLeftRadius;
  if (s.borderTopRightRadius) snapshot.borderTopRightRadius = s.borderTopRightRadius;
  if (s.borderBottomRightRadius) snapshot.borderBottomRightRadius = s.borderBottomRightRadius;
  if (s.borderBottomLeftRadius) snapshot.borderBottomLeftRadius = s.borderBottomLeftRadius;

  // Individual 4-edge border widths
  if (s.borderTopWidth) snapshot.borderTopWidth = s.borderTopWidth;
  if (s.borderRightWidth) snapshot.borderRightWidth = s.borderRightWidth;
  if (s.borderBottomWidth) snapshot.borderBottomWidth = s.borderBottomWidth;
  if (s.borderLeftWidth) snapshot.borderLeftWidth = s.borderLeftWidth;

  // Individual 4-edge border colors
  if (s.borderTopColor) snapshot.borderTopColor = s.borderTopColor;
  if (s.borderRightColor) snapshot.borderRightColor = s.borderRightColor;
  if (s.borderBottomColor) snapshot.borderBottomColor = s.borderBottomColor;
  if (s.borderLeftColor) snapshot.borderLeftColor = s.borderLeftColor;

  // Individual 4-edge border styles
  if (s.borderTopStyle) snapshot.borderTopStyle = s.borderTopStyle;
  if (s.borderRightStyle) snapshot.borderRightStyle = s.borderRightStyle;
  if (s.borderBottomStyle) snapshot.borderBottomStyle = s.borderBottomStyle;
  if (s.borderLeftStyle) snapshot.borderLeftStyle = s.borderLeftStyle;

  // Outline
  if (s.outlineWidth) snapshot.outlineWidth = s.outlineWidth;
  if (s.outlineStyle) snapshot.outlineStyle = s.outlineStyle;
  if (s.outlineColor) snapshot.outlineColor = s.outlineColor;
  if (s.outlineOffset) snapshot.outlineOffset = s.outlineOffset;

  // Effects & Opacity
  if (s.filter) snapshot.filter = s.filter;
  if (s.backdropFilter) snapshot.backdropFilter = s.backdropFilter;
  if (s.opacity) snapshot.opacity = s.opacity;
  if (s.mixBlendMode) snapshot.mixBlendMode = s.mixBlendMode;

  return snapshot;
}

export class DOMWalker {
  private maxNodeCount: number;
  private maxDepth: number;
  private resolvePaintOrder: boolean;
  private captureMode: string;

  private nodeCount = 0;
  private documentOrderSeq = 0;
  private nodesMap: Map<string, SourceNode> = new Map();
  private diagnostics: ExportDiagnostic[] = [];
  private idSequence = 0;

  constructor(options: DOMWalkerOptions = {}) {
    this.maxNodeCount = options.maxNodeCount ?? 5000;
    this.maxDepth = options.maxDepth ?? 32;
    this.resolvePaintOrder = options.resolvePaintOrder ?? true;
    this.captureMode = options.captureMode ?? 'full-page';
  }

  private nextNodeId(): string {
    return `node_${++this.idSequence}`;
  }

  /**
   * Performs recursive DOM traversal and returns extracted nodes, metadata, and diagnostics.
   */
  walk(targetRoot?: Element): DOMWalkerResult {
    this.nodeCount = 0;
    this.documentOrderSeq = 0;
    this.idSequence = 0;
    this.nodesMap.clear();
    this.diagnostics = [];

    const root =
      targetRoot ??
      (typeof document !== 'undefined'
        ? document.documentElement
        : undefined);

    if (!root) {
      throw new Error('DOMWalker requires a valid DOM element or active document.documentElement');
    }

    const scrollX = typeof window !== 'undefined' ? window.scrollX || window.pageXOffset || 0 : 0;
    const scrollY = typeof window !== 'undefined' ? window.scrollY || window.pageYOffset || 0 : 0;
    const innerWidth = typeof window !== 'undefined' ? window.innerWidth : 1440;
    const innerHeight = typeof window !== 'undefined' ? window.innerHeight : 900;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

    // Traverse root
    const rootNodeId = this.walkElement(root, null, 0, scrollX, scrollY, innerWidth, innerHeight, false);

    // Build ordered node list
    let finalNodes: SourceNode[] = Array.from(this.nodesMap.values());

    // Resolve CSS 2.2 Appendix E Stacking Context Paint Order if requested
    if (this.resolvePaintOrder && rootNodeId && this.nodesMap.has(rootNodeId)) {
      finalNodes = this.sortNodesByStackingContext(rootNodeId);
    }

    // Enforce hard upper bound on output nodes
    if (finalNodes.length > this.maxNodeCount) {
      finalNodes = finalNodes.slice(0, this.maxNodeCount);
    }

    const docWidth =
      typeof document !== 'undefined'
        ? Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0, innerWidth)
        : innerWidth;
    const docHeight =
      typeof document !== 'undefined'
        ? Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0, innerHeight)
        : innerHeight;

    const metadata: PageCaptureMetadata = {
      schemaVersion: 1,
      pageIndex: 0,
      requestedUrl: typeof window !== 'undefined' ? window.location.href : 'http://localhost',
      finalUrl: typeof window !== 'undefined' ? window.location.href : 'http://localhost',
      title: typeof document !== 'undefined' ? document.title || 'Untitled' : 'Untitled',
      readinessState:
        typeof document !== 'undefined' && document.readyState === 'loading'
          ? 'loading'
          : typeof document !== 'undefined' && document.readyState === 'interactive'
          ? 'interactive'
          : 'complete',
      capturedAt: Date.now(),
      viewport: {
        width: innerWidth,
        height: innerHeight,
        devicePixelRatio: dpr,
        scrollX,
        scrollY
      },
      documentDimensions: {
        width: docWidth,
        height: docHeight
      },
      captureMode: this.captureMode
    };

    return {
      nodes: finalNodes,
      metadata,
      diagnostics: this.diagnostics
    };
  }

  private walkElement(
    el: Element,
    parentId: string | null,
    depth: number,
    scrollX: number,
    scrollY: number,
    viewportW: number,
    viewportH: number,
    parentIsFlexOrGrid: boolean
  ): string | null {
    // 1. Safety limit check: maxNodeCount
    if (this.nodeCount >= this.maxNodeCount) {
      if (this.nodeCount === this.maxNodeCount) {
        this.diagnostics.push({
          severity: 'warning',
          code: 'MAX_NODES_EXCEEDED',
          message: `Capture reached safety limit of ${this.maxNodeCount} nodes. Subtree traversal stopped.`,
          phase: 'dom-extraction',
          timestamp: Date.now()
        });
      }
      return null;
    }

    // 2. Safety limit check: maxDepth
    if (depth > this.maxDepth) {
      this.diagnostics.push({
        severity: 'warning',
        code: 'MAX_DEPTH_EXCEEDED',
        message: `DOM traversal reached maximum nesting depth of ${this.maxDepth}. Deeper descendants pruned.`,
        phase: 'dom-extraction',
        timestamp: Date.now()
      });
      return null;
    }

    // 3. Computed style extraction
    const style =
      typeof window !== 'undefined' && window.getComputedStyle
        ? window.getComputedStyle(el)
        : ({} as any);

    // 4. Geometry measurement
    const geo = calculateGeometry(el, scrollX, scrollY, style.position);

    // 5. 3D Matrix decomposition and flat projection
    const nodeId = this.nextNodeId();
    const transformRes = projectTransformedRect(
      geo.sourceRect,
      style.transform,
      style.transformOrigin,
      nodeId
    );
    if (transformRes.diagnostic) {
      this.diagnostics.push(transformRes.diagnostic);
    }

    const sourceRect = transformRes.projectedRect;
    const documentRect: SourceRect = {
      x: sourceRect.x + scrollX,
      y: sourceRect.y + scrollY,
      width: sourceRect.width,
      height: sourceRect.height
    };

    // 6. Visibility evaluation and pruning
    const visEval = evaluateElementVisibility(el, sourceRect, style, viewportW, viewportH);
    if (visEval.shouldPruneSubtree) {
      return null;
    }

    // 7. Privacy sanitization
    const privacy = sanitizeElementPrivacy(el);

    // 8. Stacking context trigger detection
    const isRoot = parentId === null;
    const stackingTrigger = detectStackingContextTrigger(el, style, parentIsFlexOrGrid, isRoot);
    const stackingHints: StackingContextHints = {
      createsStackingContext: stackingTrigger.createsStackingContext,
      zIndex: stackingTrigger.zIndex,
      ...(stackingTrigger.stackingTrigger ? { stackingTrigger: stackingTrigger.stackingTrigger } : {})
    };

    // 9. Text run extraction
    const textRuns = extractTextRuns(el, style);

    // 10. Pseudo-element synthesis (::before / ::after)
    const pseudoNodes = extractPseudoElements(
      el,
      nodeId,
      () => this.nextNodeId(),
      sourceRect,
      documentRect
    );

    // 11. Layout hints
    const display = (style.display || 'block').toLowerCase();
    const isFlexContainer = display.includes('flex');
    const isGridContainer = display.includes('grid');
    const layoutHints = {
      isFlexContainer,
      isGridContainer,
      isInline: display.startsWith('inline') || display === 'contents',
      isBlock: display === 'block' || display === 'flow-root'
    };

    // 12. Shadow DOM & Iframe Inspection
    const shadowRes = inspectShadowRoot(el, nodeId);
    if (shadowRes.diagnostic) {
      this.diagnostics.push(shadowRes.diagnostic);
    }

    const iframeRes = inspectIframe(el, nodeId);
    if (iframeRes.diagnostic) {
      this.diagnostics.push(iframeRes.diagnostic);
    }

    const childIds: string[] = [];

    // Increment node counter
    this.nodeCount++;
    const currentDocOrder = ++this.documentOrderSeq;

    // 13. Traverse Children
    const traverseChildElement = (childEl: Element) => {
      const childNodeId = this.walkElement(
        childEl,
        nodeId,
        depth + 1,
        scrollX,
        scrollY,
        viewportW,
        viewportH,
        isFlexContainer || isGridContainer
      );
      if (childNodeId) {
        childIds.push(childNodeId);
      }
    };

    // Insert ::before pseudo element first if present
    for (const pseudo of pseudoNodes) {
      if (pseudo.sourceTag === '::before' && this.nodeCount < this.maxNodeCount) {
        childIds.push(pseudo.nodeId);
        this.nodesMap.set(pseudo.nodeId, pseudo);
        this.nodeCount++;
      }
    }

    // Traverse shadow DOM, iframe content, or ordinary DOM children
    if (iframeRes.isSameOrigin && iframeRes.contentDocument?.documentElement) {
      traverseChildElement(iframeRes.contentDocument.documentElement);
    } else if (shadowRes.isOpen && shadowRes.shadowRoot) {
      for (let i = 0; i < shadowRes.shadowRoot.children.length; i++) {
        const c = shadowRes.shadowRoot.children[i];
        if (c) traverseChildElement(c);
      }
    } else if (shadowRes.slottedElements.length > 0) {
      for (const slotted of shadowRes.slottedElements) {
        traverseChildElement(slotted);
      }
    } else {
      for (let i = 0; i < el.children.length; i++) {
        const c = el.children[i];
        if (c) traverseChildElement(c);
      }
    }

    // Insert ::after pseudo element last if present
    for (const pseudo of pseudoNodes) {
      if (pseudo.sourceTag === '::after' && this.nodeCount < this.maxNodeCount) {
        childIds.push(pseudo.nodeId);
        this.nodesMap.set(pseudo.nodeId, pseudo);
        this.nodeCount++;
      }
    }

    // 13. Asset Discovery
    const discoveredAssets = discoverElementAssets(el, style);
    const assetRefs = discoveredAssets.map((a) => a.normalizedUrl);

    // Assemble final SourceNode
    const sourceNode: SourceNode = {
      nodeId,
      parentId,
      childIds,
      sourceTag: privacy.sourceTag,
      ...(privacy.role ? { role: privacy.role } : {}),
      ...(privacy.accessibleLabel ? { accessibleLabel: privacy.accessibleLabel } : {}),
      classHints: privacy.classHints,
      textRuns,
      sourceRect,
      documentRect,
      visibility: visEval.flags,
      stacking: stackingHints,
      computedStyle: snapshotComputedStyle(style),
      layoutHints,
      assetRefs
    };

    // Store in node registry
    this.nodesMap.set(nodeId, sourceNode);
    (sourceNode as any).__documentOrder = currentDocOrder;

    return nodeId;
  }

  /**
   * Reorders the extracted node tree into strict CSS 2.2 Appendix E paint order.
   */
  private sortNodesByStackingContext(rootNodeId: string): SourceNode[] {
    const root = this.nodesMap.get(rootNodeId);
    if (!root) return Array.from(this.nodesMap.values());

    const toPaintNode = (node: SourceNode): PaintNode<SourceNode> => ({
      id: node.nodeId,
      data: node,
      zIndex: node.stacking.zIndex,
      createsStackingContext: node.stacking.createsStackingContext,
      position: node.computedStyle.position,
      isFloating: false,
      isInlineLevel: node.layoutHints.isInline,
      documentOrder: (node as any).__documentOrder ?? 0
    });

    // Build stacking context hierarchy
    const buildContextTree = (
      currentNodeId: string,
      currentCtx: StackingContextNode<SourceNode>
    ) => {
      const node = this.nodesMap.get(currentNodeId);
      if (!node) return;

      for (const childId of node.childIds) {
        const childNode = this.nodesMap.get(childId);
        if (!childNode) continue;

        const paintNode = toPaintNode(childNode);
        if (childNode.stacking.createsStackingContext) {
          const childCtx = new StackingContextNode<SourceNode>(paintNode);
          currentCtx.addChildContext(childCtx);
          buildContextTree(childId, childCtx);
        } else {
          currentCtx.addNonContextDescendant(paintNode);
          buildContextTree(childId, currentCtx);
        }
      }
    };

    const rootCtx = new StackingContextNode<SourceNode>(toPaintNode(root));
    buildContextTree(rootNodeId, rootCtx);

    const sortedPaintNodes = rootCtx.resolvePaintOrder();
    return sortedPaintNodes.map((pn) => pn.data);
  }
}
