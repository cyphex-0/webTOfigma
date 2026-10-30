/**
 * Selected Element Capture Engine.
 * 
 * Captures a user-selected DOM element subtree confirmed via Element Picker.
 * Calculates local coordinates relative to the selected root's bounding box,
 * preserves all descendants and computed styles, and optionally inherits
 * the nearest opaque ancestor background when the selected root is transparent.
 */

import { PageCapture } from '../../shared/contracts/scene';
import { SourceNode } from '../../shared/contracts/source-node';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import { DOMWalker, DOMWalkerOptions } from '../dom/dom-walker';

export interface SelectedElementCaptureOptions extends DOMWalkerOptions {
  includeAncestorBackground?: boolean | undefined;
}

export interface SelectedElementCaptureResult {
  capture: PageCapture;
  diagnostics: ExportDiagnostic[];
}

/**
 * Checks whether an element's background is transparent or non-rendered.
 */
function isBackgroundTransparent(style: CSSStyleDeclaration | Record<string, string>): boolean {
  const bg = (style.backgroundColor || '').trim().toLowerCase();
  const img = (style.backgroundImage || '').trim().toLowerCase();

  const hasColor =
    bg !== '' &&
    bg !== 'transparent' &&
    bg !== 'rgba(0, 0, 0, 0)' &&
    bg !== 'none';

  const hasImage = Boolean(img && img !== 'none' && img !== '');
  return !hasColor && !hasImage;
}

/**
 * Finds the nearest ancestor element with an opaque or visible background.
 */
export function findNearestOpaqueAncestorBackground(
  el: Element
): { backgroundColor: string; backgroundImage?: string | undefined; ancestorTag: string } | null {
  let curr = el.parentElement;
  const win = el.ownerDocument.defaultView ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win) return null;

  while (curr && curr !== el.ownerDocument.documentElement) {
    const cs = win.getComputedStyle(curr);
    if (!isBackgroundTransparent(cs)) {
      return {
        backgroundColor: cs.backgroundColor,
        ...(cs.backgroundImage && cs.backgroundImage !== 'none'
          ? { backgroundImage: cs.backgroundImage }
          : {}),
        ancestorTag: curr.tagName.toLowerCase()
      };
    }
    curr = curr.parentElement;
  }

  // Check document.body and documentElement
  if (el.ownerDocument.body) {
    const bodyCs = win.getComputedStyle(el.ownerDocument.body);
    if (!isBackgroundTransparent(bodyCs)) {
      return {
        backgroundColor: bodyCs.backgroundColor,
        ...(bodyCs.backgroundImage && bodyCs.backgroundImage !== 'none'
          ? { backgroundImage: bodyCs.backgroundImage }
          : {}),
        ancestorTag: 'body'
      };
    }
  }

  return null;
}

/**
 * Captures an isolated subtree rooted at the selected element.
 */
export function captureSelectedElement(
  targetElement: Element,
  options: SelectedElementCaptureOptions = {}
): SelectedElementCaptureResult {
  const win = targetElement.ownerDocument.defaultView ?? (typeof window !== 'undefined' ? window : undefined);
  if (!win) {
    throw new Error('captureSelectedElement requires an active DOM environment');
  }

  const diagnostics: ExportDiagnostic[] = [];

  // 1. Measure selected root bounds in document coordinates
  const clientRect = targetElement.getBoundingClientRect();
  const scrollX = win.scrollX || win.pageXOffset || 0;
  const scrollY = win.scrollY || win.pageYOffset || 0;

  const rootOriginX = clientRect.left + scrollX;
  const rootOriginY = clientRect.top + scrollY;
  const rootWidth = clientRect.width;
  const rootHeight = clientRect.height;

  // 2. Walk the selected subtree
  const walker = new DOMWalker({
    ...options,
    rootElement: targetElement,
    captureMode: 'selected-element',
    maxNodeCount: options.maxNodeCount ?? 2000
  });

  const walkResult = walker.walk(targetElement);
  diagnostics.push(...walkResult.diagnostics);

  if (walkResult.nodes.length === 0) {
    throw new Error('DOMWalker produced zero nodes for selected element');
  }

  const rootNode = walkResult.nodes[0]!;

  // 3. Optional Ancestor Background Inheritance
  if (options.includeAncestorBackground) {
    const targetCs = win.getComputedStyle(targetElement);
    if (isBackgroundTransparent(targetCs)) {
      const ancestorBg = findNearestOpaqueAncestorBackground(targetElement);
      if (ancestorBg) {
        rootNode.computedStyle.backgroundColor = ancestorBg.backgroundColor;
        if (ancestorBg.backgroundImage) {
          rootNode.computedStyle.backgroundImage = ancestorBg.backgroundImage;
        }

        diagnostics.push({
          severity: 'info',
          code: 'ANCESTOR_BACKGROUND_INHERITED',
          message: `Inherited background ${ancestorBg.backgroundColor} from ancestor <${ancestorBg.ancestorTag}> because selected root background was transparent.`,
          phase: 'dom-extraction',
          timestamp: Date.now()
        });
      }
    }
  }

  // 4. Rebase all documentRect coordinates relative to root element's origin (0, 0)
  const rebasedNodes: SourceNode[] = walkResult.nodes.map((node) => ({
    ...node,
    documentRect: {
      x: Math.round((node.documentRect.x - rootOriginX) * 100) / 100,
      y: Math.round((node.documentRect.y - rootOriginY) * 100) / 100,
      width: Math.round(node.documentRect.width * 100) / 100,
      height: Math.round(node.documentRect.height * 100) / 100
    }
  }));

  // Ensure root node has parentId: null
  rebasedNodes[0]!.parentId = null;

  // 5. Construct PageCapture contract
  const accessibleTitle =
    targetElement.getAttribute('aria-label') ||
    targetElement.getAttribute('id') ||
    targetElement.getAttribute('data-testid') ||
    targetElement.tagName.toLowerCase();

  const capture: PageCapture = {
    metadata: {
      ...walkResult.metadata,
      captureMode: 'selected-element',
      title: `${walkResult.metadata.title} — [${accessibleTitle}]`,
      documentDimensions: {
        width: Math.max(1, rootWidth),
        height: Math.max(1, rootHeight)
      }
    },
    nodes: rebasedNodes,
    diagnostics
  };

  return {
    capture,
    diagnostics
  };
}
