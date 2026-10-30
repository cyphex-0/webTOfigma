/**
 * Fixed and Sticky Element Single-Instance Policy Engine.
 * 
 * Ensures sticky headers, fixed navigation, and floating interface widgets
 * are captured as exactly one canonical instance in full-page mode.
 * Prevents checkpoint duplication and applies user exclusion policies.
 */

import { SourceNode } from '../../shared/contracts/source-node';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface FixedStickyPolicyOptions {
  excludeFixedOverlays?: boolean | undefined;
  excludeCookieBanners?: boolean | undefined;
  excludeChatWidgets?: boolean | undefined;
}

export interface FixedStickyEvaluation {
  isFixedOrSticky: boolean;
  isTopNavigation: boolean;
  isPersistentOverlay: boolean;
  shouldExclude: boolean;
  category: 'top-nav' | 'sticky-in-flow' | 'overlay-widget' | 'standard';
}

/**
 * Evaluates a SourceNode's fixed/sticky positioning behavior and categorization.
 */
export function evaluateFixedStickyNode(
  node: SourceNode,
  options: FixedStickyPolicyOptions = {}
): FixedStickyEvaluation {
  const pos = (node.computedStyle.position || '').toLowerCase();
  const isFixed = pos === 'fixed';
  const isSticky = pos === 'sticky';
  const isFixedOrSticky = isFixed || isSticky;

  if (!isFixedOrSticky) {
    return {
      isFixedOrSticky: false,
      isTopNavigation: false,
      isPersistentOverlay: false,
      shouldExclude: false,
      category: 'standard'
    };
  }

  const tag = node.sourceTag.toLowerCase();
  const isHeaderTag = tag === 'header' || tag === 'nav' || node.semanticKind === 'header';
  const isAtTop = node.sourceRect.y <= 120;
  const isTopNavigation = isHeaderTag || (isFixedOrSticky && isAtTop && node.sourceRect.width >= 600);

  // Detect cookie consent banners
  const isCookieBanner = node.classHints.some((c) =>
    /cookie|consent|gdpr|notice-bar|banner/i.test(c)
  );

  // Detect chat widgets
  const isChatWidget = node.classHints.some((c) =>
    /intercom|drift|crisp|zendesk|chat-widget|livechat|customerly/i.test(c)
  );

  const isPersistentOverlay = isFixed && !isTopNavigation;

  let shouldExclude = false;
  if (options.excludeCookieBanners && isCookieBanner) {
    shouldExclude = true;
  } else if (options.excludeChatWidgets && isChatWidget) {
    shouldExclude = true;
  } else if (options.excludeFixedOverlays && isPersistentOverlay) {
    shouldExclude = true;
  }

  let category: FixedStickyEvaluation['category'] = 'standard';
  if (isTopNavigation) {
    category = 'top-nav';
  } else if (isSticky) {
    category = 'sticky-in-flow';
  } else if (isPersistentOverlay) {
    category = 'overlay-widget';
  }

  return {
    isFixedOrSticky: true,
    isTopNavigation,
    isPersistentOverlay,
    shouldExclude,
    category
  };
}

/**
 * Applies the single-instance fixed and sticky policy to full-page captured nodes.
 * Prunes excluded overlay widgets, deduplicates repeated fixed elements,
 * and normalizes top navigation positioning.
 */
export function applyFixedStickyPolicy(
  nodes: SourceNode[],
  options: FixedStickyPolicyOptions = {}
): { nodes: SourceNode[]; diagnostics: ExportDiagnostic[] } {
  const diagnostics: ExportDiagnostic[] = [];
  const nodesById = new Map<string, SourceNode>();
  for (const n of nodes) {
    nodesById.set(n.nodeId, n);
  }

  const excludedIds = new Set<string>();

  for (const node of nodes) {
    const evalResult = evaluateFixedStickyNode(node, options);
    if (evalResult.shouldExclude) {
      excludedIds.add(node.nodeId);
      // Recursively exclude descendants
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

  // Deduplicate and filter nodes
  const processedNodes: SourceNode[] = [];
  const observedFixedNavSignatures = new Set<string>();
  const removedIds = new Set<string>(excludedIds);

  for (const node of nodes) {
    if (removedIds.has(node.nodeId)) {
      continue;
    }

    const evalResult = evaluateFixedStickyNode(node, options);

    // If it's a fixed top navigation, ensure only one instance is retained
    if (evalResult.isTopNavigation) {
      const signature = `${node.sourceTag}_${node.sourceRect.width}x${node.sourceRect.height}`;
      if (observedFixedNavSignatures.has(signature)) {
        removedIds.add(node.nodeId);
        diagnostics.push({
          severity: 'info',
          code: 'STICKY_NAV_DEDUPLICATED',
          message: `Deduplicated repeated sticky navigation element '${node.nodeId}'.`,
          phase: 'dom-extraction',
          timestamp: Date.now()
        });
        continue;
      }
      observedFixedNavSignatures.add(signature);
    }

    processedNodes.push(node);
  }

  // Filter childIds across all retained nodes
  const finalNodes = processedNodes.map((node) => ({
    ...node,
    childIds: node.childIds.filter((cid) => !removedIds.has(cid))
  }));

  return {
    nodes: finalNodes,
    diagnostics
  };
}
