/**
 * Semantic Classifier Engine.
 * Analyzes HTML elements and computed styles to assign meaningful Figma layer names
 * and semantic roles following strict precedence:
 * Semantic HTML -> ARIA Role -> Accessible Name/Label -> Structural Heuristics -> Neutral Fallback.
 * Also assigns stable sibling sequence numbers (e.g. 'Card 01', 'Card 02') without CSS class noise.
 */

import type { SourceNode } from '../../shared/contracts/source-node';

export type SemanticConfidence =
  | 'explicit_html'
  | 'aria_role'
  | 'accessible_label'
  | 'heuristic'
  | 'fallback';

export interface SemanticClassification {
  kind: string; // e.g. 'Header', 'Navigation', 'Card', 'Button'
  displayName: string; // e.g. 'Button — "Submit"' or 'Feature Card 01'
  sourceTag: string;
  ariaRole?: string | undefined;
  accessibleLabel?: string | undefined;
  confidence: SemanticConfidence;
}

/**
 * Truncates long label strings cleanly for layer naming.
 */
function cleanLabel(raw: string, maxLen = 24): string {
  const normalized = raw.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen).trim()}...`;
}

/**
 * Classifies an individual DOM element.
 */
export function classifyElement(
  element: Element,
  computedStyle?: CSSStyleDeclaration | Record<string, string>
): SemanticClassification {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute('role')?.trim().toLowerCase() || undefined;
  const ariaLabel =
    element.getAttribute('aria-label')?.trim() ||
    element.getAttribute('aria-labelledby')?.trim() ||
    element.getAttribute('title')?.trim() ||
    undefined;

  // 1. Explicit Semantic HTML
  if (tagName === 'header') {
    return {
      kind: 'Header',
      displayName: ariaLabel ? `Header — "${cleanLabel(ariaLabel)}"` : 'Header',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'nav') {
    return {
      kind: 'Navigation',
      displayName: ariaLabel ? `Navigation — "${cleanLabel(ariaLabel)}"` : 'Navigation',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'main') {
    return {
      kind: 'Main',
      displayName: 'Main',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'section') {
    return {
      kind: 'Section',
      displayName: ariaLabel ? `Section — "${cleanLabel(ariaLabel)}"` : 'Section',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'article') {
    return {
      kind: 'Article',
      displayName: ariaLabel ? `Article — "${cleanLabel(ariaLabel)}"` : 'Article',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'aside') {
    return {
      kind: 'Aside',
      displayName: ariaLabel ? `Aside — "${cleanLabel(ariaLabel)}"` : 'Aside',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'footer') {
    return {
      kind: 'Footer',
      displayName: ariaLabel ? `Footer — "${cleanLabel(ariaLabel)}"` : 'Footer',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (/^h[1-6]$/.test(tagName)) {
    const level = tagName.toUpperCase();
    const textSnippet = element.textContent?.trim();
    const label = ariaLabel || textSnippet;
    return {
      kind: `Heading — ${level}`,
      displayName: label ? `Heading — ${level} ("${cleanLabel(label)}")` : `Heading — ${level}`,
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: label,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'p') {
    const textSnippet = element.textContent?.trim();
    return {
      kind: 'Paragraph',
      displayName: textSnippet ? `Paragraph ("${cleanLabel(textSnippet)}")` : 'Paragraph',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'a') {
    const textSnippet = element.textContent?.trim();
    const label = ariaLabel || textSnippet;
    return {
      kind: 'Link',
      displayName: label ? `Link — "${cleanLabel(label)}"` : 'Link',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: label,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'button') {
    const textSnippet = element.textContent?.trim();
    const label = ariaLabel || textSnippet;
    return {
      kind: 'Button',
      displayName: label ? `Button — "${cleanLabel(label)}"` : 'Button',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: label,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    const inputType = element.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : 'input');
    const placeholder = element.getAttribute('placeholder') || ariaLabel || inputType;
    return {
      kind: 'Input',
      displayName: `Input — ${placeholder}`,
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'ul' || tagName === 'ol') {
    // Check if breadcrumb list
    if (
      ariaLabel?.toLowerCase().includes('breadcrumb') ||
      element.classList.contains('breadcrumb') ||
      element.classList.contains('breadcrumbs')
    ) {
      return {
        kind: 'Breadcrumb',
        displayName: 'Breadcrumb',
        sourceTag: tagName,
        ariaRole: role,
        accessibleLabel: ariaLabel,
        confidence: 'heuristic'
      };
    }
    return {
      kind: 'List',
      displayName: 'List',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'li') {
    return {
      kind: 'List Item',
      displayName: 'List Item',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'img') {
    const alt = element.getAttribute('alt')?.trim();
    return {
      kind: 'Image',
      displayName: alt ? `Image — "${cleanLabel(alt)}"` : 'Image',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: alt || ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'figure') {
    return {
      kind: 'Figure',
      displayName: ariaLabel ? `Figure — "${cleanLabel(ariaLabel)}"` : 'Figure',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'table') {
    return {
      kind: 'Table',
      displayName: 'Table',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  if (tagName === 'dialog') {
    return {
      kind: 'Dialog',
      displayName: ariaLabel ? `Dialog — "${cleanLabel(ariaLabel)}"` : 'Dialog',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'explicit_html'
    };
  }

  // 2. ARIA Role Precedence
  if (role) {
    switch (role) {
      case 'banner':
        return {
          kind: 'Header',
          displayName: ariaLabel ? `Header — "${cleanLabel(ariaLabel)}"` : 'Header',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'navigation':
        return {
          kind: 'Navigation',
          displayName: ariaLabel ? `Navigation — "${cleanLabel(ariaLabel)}"` : 'Navigation',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'main':
        return {
          kind: 'Main',
          displayName: 'Main',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'region':
        return {
          kind: 'Section',
          displayName: ariaLabel ? `Section — "${cleanLabel(ariaLabel)}"` : 'Section',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'article':
        return {
          kind: 'Article',
          displayName: ariaLabel ? `Article — "${cleanLabel(ariaLabel)}"` : 'Article',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'complementary':
        return {
          kind: 'Aside',
          displayName: ariaLabel ? `Aside — "${cleanLabel(ariaLabel)}"` : 'Aside',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'contentinfo':
        return {
          kind: 'Footer',
          displayName: ariaLabel ? `Footer — "${cleanLabel(ariaLabel)}"` : 'Footer',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'heading': {
        const level = element.getAttribute('aria-level') || '2';
        const label = ariaLabel || element.textContent?.trim();
        return {
          kind: `Heading — H${level}`,
          displayName: label ? `Heading — H${level} ("${cleanLabel(label)}")` : `Heading — H${level}`,
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: label,
          confidence: 'aria_role'
        };
      }
      case 'button': {
        const label = ariaLabel || element.textContent?.trim();
        return {
          kind: 'Button',
          displayName: label ? `Button — "${cleanLabel(label)}"` : 'Button',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: label,
          confidence: 'aria_role'
        };
      }
      case 'link': {
        const label = ariaLabel || element.textContent?.trim();
        return {
          kind: 'Link',
          displayName: label ? `Link — "${cleanLabel(label)}"` : 'Link',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: label,
          confidence: 'aria_role'
        };
      }
      case 'tab': {
        const label = ariaLabel || element.textContent?.trim();
        return {
          kind: 'Tab',
          displayName: label ? `Tab — "${cleanLabel(label)}"` : 'Tab',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: label,
          confidence: 'aria_role'
        };
      }
      case 'tabpanel':
        return {
          kind: 'Tab Panel',
          displayName: ariaLabel ? `Tab Panel — "${cleanLabel(ariaLabel)}"` : 'Tab Panel',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'dialog':
      case 'alertdialog':
        return {
          kind: 'Dialog',
          displayName: ariaLabel ? `Dialog — "${cleanLabel(ariaLabel)}"` : 'Dialog',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'list':
        return {
          kind: 'List',
          displayName: 'List',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'listitem':
        return {
          kind: 'List Item',
          displayName: 'List Item',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
      case 'img':
        return {
          kind: 'Image',
          displayName: ariaLabel ? `Image — "${cleanLabel(ariaLabel)}"` : 'Image',
          sourceTag: tagName,
          ariaRole: role,
          accessibleLabel: ariaLabel,
          confidence: 'aria_role'
        };
    }
  }

  // 3. Structural Heuristics & Attributes
  if (element.hasAttribute('popover') || element.getAttribute('aria-haspopup') === 'true') {
    return {
      kind: 'Popover',
      displayName: ariaLabel ? `Popover — "${cleanLabel(ariaLabel)}"` : 'Popover',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'heuristic'
    };
  }

  // Card Heuristic:
  // Identified by class name containing 'card' OR visual bounding properties (shadow, border, radius)
  // combined with child heading or image
  const classListStr = element.className && typeof element.className === 'string' ? element.className.toLowerCase() : '';
  const isCardClass = /\b(card|card-body|item-card|product-card|feature-card)\b/.test(classListStr);
  const hasCardStructure =
    (element.querySelector('h1, h2, h3, h4, h5, h6') !== null || element.querySelector('img, svg') !== null) &&
    element.childElementCount >= 2;

  let hasCardStyle = false;
  if (computedStyle) {
    const s = computedStyle as any;
    const hasShadow = s.boxShadow && s.boxShadow !== 'none';
    const hasBorder = s.borderWidth && parseFloat(s.borderWidth) > 0 && s.borderStyle !== 'none';
    const hasRadius = s.borderRadius && parseFloat(s.borderRadius) > 0;
    const hasBackground = s.backgroundColor && s.backgroundColor !== 'transparent' && s.backgroundColor !== 'rgba(0, 0, 0, 0)';
    hasCardStyle = (hasShadow || hasBorder) && (hasRadius || hasBackground);
  }

  if (isCardClass || (hasCardStructure && hasCardStyle)) {
    const headingChild = element.querySelector('h1, h2, h3, h4, h5, h6');
    const headingText = headingChild?.textContent?.trim();
    const label = ariaLabel || headingText;
    return {
      kind: 'Card',
      displayName: label ? `Card — "${cleanLabel(label)}"` : 'Card',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: label,
      confidence: 'heuristic'
    };
  }

  // 4. Neutral / Generic Fallbacks
  if (element.childElementCount > 1) {
    return {
      kind: 'Container',
      displayName: 'Container',
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'fallback'
    };
  }

  if (element.childElementCount === 0 && element.textContent?.trim()) {
    return {
      kind: 'Content',
      displayName: `Content ("${cleanLabel(element.textContent)}")`,
      sourceTag: tagName,
      ariaRole: role,
      accessibleLabel: ariaLabel,
      confidence: 'fallback'
    };
  }

  return {
    kind: 'Group',
    displayName: 'Group',
    sourceTag: tagName,
    ariaRole: role,
    accessibleLabel: ariaLabel,
    confidence: 'fallback'
  };
}

/**
 * Assigns stable sequence numbers (e.g. 'Card 01', 'Card 02') to repeated sibling nodes
 * that share identical base category names, without adding long CSS class chains.
 */
export function assignSiblingSequenceNames<T extends { displayName: string; kind: string }>(
  items: T[]
): T[] {
  // Count frequency of kinds
  const kindCounts: Record<string, number> = {};
  for (const item of items) {
    kindCounts[item.kind] = (kindCounts[item.kind] || 0) + 1;
  }

  // Track sequence position
  const currentSeq: Record<string, number> = {};

  return items.map((item) => {
    const total = kindCounts[item.kind] || 0;
    if (total > 1) {
      const idx = (currentSeq[item.kind] || 0) + 1;
      currentSeq[item.kind] = idx;
      const padded = idx < 10 ? `0${idx}` : `${idx}`;

      // If displayName is just the bare kind, format as 'Kind 01'
      if (item.displayName === item.kind) {
        return {
          ...item,
          displayName: `${item.kind} ${padded}`
        };
      }

      // If displayName contains a quote differentiator (e.g. 'Card — "Pro"'), keep it
      // but append sequence if identical
      return {
        ...item,
        displayName: `${item.displayName} #${padded}`
      };
    }
    return item;
  });
}

/**
 * Annotates a list of SourceNodes with semantic classifications and sequence numbers.
 */
export function enrichNodesWithSemantics(nodes: SourceNode[]): SourceNode[] {
  // Group nodes by parentId to number siblings together
  const parentGroups = new Map<string | null, SourceNode[]>();
  for (const node of nodes) {
    const group = parentGroups.get(node.parentId) || [];
    group.push(node);
    parentGroups.set(node.parentId, group);
  }

  const enrichedMap = new Map<string, SourceNode>();

  for (const [_parentId, siblings] of parentGroups.entries()) {
    // Map each sibling to a classification
    const classified = siblings.map((node) => {
      // Create mock or partial element representation if running off snapshot
      const mockElement = {
        tagName: node.sourceTag,
        getAttribute: (attr: string) => {
          if (attr === 'role') return node.role || null;
          if (attr === 'aria-label') return node.accessibleLabel || null;
          return null;
        },
        hasAttribute: () => false,
        classList: {
          contains: (cls: string) => node.classHints.includes(cls)
        },
        className: node.classHints.join(' '),
        textContent: node.textRuns.map((r) => r.text).join(' '),
        childElementCount: node.childIds.length,
        querySelector: () => null
      } as unknown as Element;

      const classification = classifyElement(mockElement, node.computedStyle as any);
      return {
        node,
        kind: classification.kind,
        displayName: classification.displayName
      };
    });

    const sequenced = assignSiblingSequenceNames(classified);
    for (const item of sequenced) {
      enrichedMap.set(item.node.nodeId, {
        ...item.node,
        name: item.displayName,
        semanticKind: item.kind
      });
    }
  }

  return nodes.map((n) => enrichedMap.get(n.nodeId) || n);
}
