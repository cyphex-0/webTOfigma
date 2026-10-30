/**
 * Shadow DOM Inspection and Boundary Resolution Engine.
 * Recursively traverses open Shadow Roots and handles closed Shadow Roots
 * by capturing host surface geometry, light-DOM slotted nodes, and emitting diagnostics.
 */

import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface ShadowRootInspectionResult {
  hasShadowRoot: boolean;
  isOpen: boolean;
  shadowRoot: ShadowRoot | null;
  slottedElements: Element[];
  diagnostic?: ExportDiagnostic | undefined;
}

/**
 * Checks if a tag name represents a registered or potential custom element (contains a hyphen).
 */
export function isCustomElementTag(tagName: string): boolean {
  return tagName.includes('-') && !tagName.startsWith('annotation-');
}

/**
 * Inspects an element for open or closed Shadow DOM encapsulation.
 * 
 * @param el DOM Element
 * @param nodeId Optional node identifier for diagnostic attribution
 */
export function inspectShadowRoot(
  el: Element,
  nodeId?: string
): ShadowRootInspectionResult {
  // 1. Open Shadow Root: el.shadowRoot is directly accessible
  if (el.shadowRoot) {
    return {
      hasShadowRoot: true,
      isOpen: true,
      shadowRoot: el.shadowRoot,
      slottedElements: []
    };
  }

  // 2. Closed Shadow Root:
  // For custom elements (e.g. <user-card>, <video-player>) or elements attached with mode: 'closed',
  // el.shadowRoot returns null. We capture light-DOM slotted children and emit a diagnostic.
  const isCustom = isCustomElementTag(el.tagName);
  const hasSlottedChildren = el.childElementCount > 0;

  if (isCustom) {
    const diagnostic: ExportDiagnostic = {
      severity: 'warning',
      code: 'CLOSED_SHADOW_ROOT_ENCAPSULATED',
      message: `Element <${el.tagName.toLowerCase()}> utilizes an encapsulated closed Shadow Root. Surface box and light-DOM slotted nodes captured.`,
      phase: 'dom-extraction',
      ...(nodeId ? { nodeId } : {}),
      timestamp: Date.now()
    };

    return {
      hasShadowRoot: true,
      isOpen: false,
      shadowRoot: null,
      slottedElements: Array.from(el.children),
      diagnostic
    };
  }

  return {
    hasShadowRoot: false,
    isOpen: false,
    shadowRoot: null,
    slottedElements: []
  };
}
