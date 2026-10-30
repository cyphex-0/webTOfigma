/**
 * Iframe Boundary and Same-Origin Inspection Engine.
 * Safely inspects iframe documents when same-origin access is permitted,
 * or captures opaque visual frames with diagnostics when cross-origin restricted.
 */

import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface IframeInspectionResult {
  isIframe: boolean;
  isSameOrigin: boolean;
  contentDocument: Document | null;
  diagnostic?: ExportDiagnostic | undefined;
}

/**
 * Safely inspects an iframe element, distinguishing accessible same-origin documents
 * from cross-origin sandboxes without attempting to breach browser security policies.
 * 
 * @param el DOM Element to inspect
 * @param nodeId Optional node identifier for diagnostic attribution
 */
export function inspectIframe(
  el: Element,
  nodeId?: string
): IframeInspectionResult {
  if (el.tagName !== 'IFRAME') {
    return {
      isIframe: false,
      isSameOrigin: false,
      contentDocument: null
    };
  }

  const iframeEl = el as HTMLIFrameElement;
  let contentDoc: Document | null = null;
  let isAccessible = false;

  try {
    // Attempting to read contentDocument throws a SecurityError on cross-origin frames
    contentDoc = iframeEl.contentDocument;
    if (contentDoc && contentDoc.documentElement) {
      isAccessible = true;
    }
  } catch {
    // Access denied by browser same-origin policy
    isAccessible = false;
    contentDoc = null;
  }

  if (isAccessible && contentDoc) {
    return {
      isIframe: true,
      isSameOrigin: true,
      contentDocument: contentDoc
    };
  }

  // Cross-origin or restricted iframe: capture visual frame container and emit diagnostic
  const diagnostic: ExportDiagnostic = {
    severity: 'info',
    code: 'CROSS_ORIGIN_IFRAME_OPAQUE',
    message: `Iframe (${iframeEl.src || 'about:blank'}) is protected by cross-origin security boundary. Rendered as an opaque frame container.`,
    phase: 'dom-extraction',
    ...(nodeId ? { nodeId } : {}),
    timestamp: Date.now()
  };

  return {
    isIframe: true,
    isSameOrigin: false,
    contentDocument: null,
    diagnostic
  };
}
