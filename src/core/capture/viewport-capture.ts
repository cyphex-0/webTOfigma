/**
 * Current Viewport Capture Engine.
 * 
 * Captures rendered DOM elements intersecting the visible viewport at the
 * current scroll position. Never drives or alters page scroll.
 * Applies precise viewport clipping and user-configurable exclusion policies.
 */

import { PageCapture } from '../../shared/contracts/scene';
import { SourceNode, SourceRect } from '../../shared/contracts/source-node';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { DOMWalker, DOMWalkerOptions } from '../dom/dom-walker';

export interface ViewportCaptureOptions extends DOMWalkerOptions {
  windowRef?: Window | undefined;
  documentRef?: Document | undefined;
  excludeFixedOverlays?: boolean | undefined;
  excludeCookieBanners?: boolean | undefined;
  excludeChatWidgets?: boolean | undefined;
}

export interface ViewportCaptureResult {
  capture: PageCapture;
  diagnostics: ExportDiagnostic[];
}

/**
 * Checks if a bounding rectangle intersects the viewport rectangle [0, 0, width, height].
 */
export function intersectsViewport(rect: SourceRect, width: number, height: number): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  return (
    rect.x < width &&
    rect.x + rect.width > 0 &&
    rect.y < height &&
    rect.y + rect.height > 0
  );
}

/**
 * Checks if a node should be excluded based on overlay/widget exclusion settings.
 */
function shouldExcludeNode(node: SourceNode, options: ViewportCaptureOptions): boolean {
  // Always exclude internal extension markers
  if (node.classHints.some((c) => c.includes('w2f') || c.includes('web-to-figma'))) {
    return true;
  }

  const isFixedOrSticky =
    node.computedStyle.position === 'fixed' || node.computedStyle.position === 'sticky';

  // Exclude fixed overlays if requested
  if (options.excludeFixedOverlays && isFixedOrSticky) {
    const isTopNav = node.sourceTag.toLowerCase() === 'header' || node.semanticKind === 'header';
    if (!isTopNav) {
      return true;
    }
  }

  // Exclude cookie banners
  if (options.excludeCookieBanners) {
    const isCookieBanner = node.classHints.some((c) =>
      /cookie|consent|gdpr|notice-bar|banner/i.test(c)
    );
    if (isCookieBanner) return true;
  }

  // Exclude chat widgets
  if (options.excludeChatWidgets) {
    const isChat = node.classHints.some((c) =>
      /intercom|drift|crisp|zendesk|chat-widget|livechat/i.test(c)
    );
    if (isChat) return true;
  }

  return false;
}

/**
 * Captures the current viewport DOM snapshot without scrolling the page.
 */
export function captureViewport(options: ViewportCaptureOptions = {}): ViewportCaptureResult {
  const win = options.windowRef ?? (typeof window !== 'undefined' ? window : undefined);
  const doc = options.documentRef ?? (typeof document !== 'undefined' ? document : undefined);

  if (!win || !doc) {
    throw new Error('captureViewport requires an active DOM environment with window and document');
  }

  // 1. Record original scroll position to guarantee it is never altered
  const initialScrollX = win.scrollX || win.pageXOffset || 0;
  const initialScrollY = win.scrollY || win.pageYOffset || 0;
  const viewportWidth = win.innerWidth;
  const viewportHeight = win.innerHeight;

  // 2. Perform DOM Walk
  const walker = new DOMWalker({
    ...options,
    captureMode: 'viewport',
    maxNodeCount: options.maxNodeCount ?? 3000
  });

  const walkResult = walker.walk(options.rootElement ?? doc.documentElement);
  const diagnostics: ExportDiagnostic[] = [...walkResult.diagnostics];

  // 3. Viewport Intersection Filtering
  const nodesById = new Map<string, SourceNode>();
  for (const node of walkResult.nodes) {
    nodesById.set(node.nodeId, node);
  }

  // Pre-pass: identify all explicitly excluded nodes and their descendant subtrees
  const excludedIds = new Set<string>();
  for (const node of walkResult.nodes) {
    if (shouldExcludeNode(node, options)) {
      excludedIds.add(node.nodeId);
      // Recursively exclude all descendants
      const markDescendants = (id: string) => {
        const n = nodesById.get(id);
        if (n) {
          for (const cid of n.childIds) {
            excludedIds.add(cid);
            markDescendants(cid);
          }
        }
      };
      markDescendants(node.nodeId);
    }
  }

  const retainedNodeIds = new Set<string>();

  // First pass: identify intersecting non-excluded nodes
  for (const node of walkResult.nodes) {
    if (excludedIds.has(node.nodeId)) {
      continue;
    }

    if (intersectsViewport(node.sourceRect, viewportWidth, viewportHeight)) {
      retainedNodeIds.add(node.nodeId);

      // Retain all non-excluded ancestors up to root to preserve tree hierarchy
      let curr = node.parentId ? nodesById.get(node.parentId) : undefined;
      while (curr && !excludedIds.has(curr.nodeId)) {
        retainedNodeIds.add(curr.nodeId);
        curr = curr.parentId ? nodesById.get(curr.parentId) : undefined;
      }
    }
  }

  // Second pass: filter and adjust retained nodes
  const filteredNodes: SourceNode[] = [];
  for (const node of walkResult.nodes) {
    if (!retainedNodeIds.has(node.nodeId)) {
      continue;
    }

    // Filter childIds to only reference retained children
    const filteredChildIds = node.childIds.filter((cid) => retainedNodeIds.has(cid));

    // In viewport mode, adjust documentRect to viewport coordinates
    const viewportRect: SourceRect = {
      x: node.sourceRect.x,
      y: node.sourceRect.y,
      width: node.sourceRect.width,
      height: node.sourceRect.height
    };

    filteredNodes.push({
      ...node,
      childIds: filteredChildIds,
      documentRect: viewportRect
    });
  }

  // 4. Verify scroll position was untouched
  const finalScrollX = win.scrollX || win.pageXOffset || 0;
  const finalScrollY = win.scrollY || win.pageYOffset || 0;

  if (finalScrollX !== initialScrollX || finalScrollY !== initialScrollY) {
    diagnostics.push({
      severity: 'warning',
      code: 'VIEWPORT_SCROLL_ALTERED',
      message: `Page scroll offset was altered during viewport capture: from (${initialScrollX}, ${initialScrollY}) to (${finalScrollX}, ${finalScrollY}).`,
      phase: 'dom-extraction',
      timestamp: Date.now()
    });
  }

  // 5. Build Final PageCapture
  const capture: PageCapture = {
    metadata: {
      ...walkResult.metadata,
      captureMode: 'viewport',
      documentDimensions: {
        width: viewportWidth,
        height: viewportHeight
      }
    },
    nodes: filteredNodes,
    diagnostics
  };

  return {
    capture,
    diagnostics
  };
}
