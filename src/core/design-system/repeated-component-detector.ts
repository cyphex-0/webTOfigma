/**
 * Repeated Component Pattern Detector.
 * 
 * Analyzes scene graph structures to identify repeated visual component candidates:
 * - Detects common UI design patterns: buttons, cards, inputs, badges, nav items, list items
 * - Computes conservative structural, stylistic, and geometric signatures
 * - Strictly distinguishes "visually repeated candidate" from source-code components;
 *   the browser DOM cannot prove original component hierarchy or component intent
 * - Labels all results as inferred visual patterns
 */

import type { SceneNode } from '../../shared/contracts/scene';

export type ComponentCandidateType =
  | 'button'
  | 'card'
  | 'input'
  | 'badge'
  | 'nav-item'
  | 'list-item';

export interface RepeatedComponentCandidate {
  candidateId: string;
  candidateType: ComponentCandidateType;
  signature: string;
  name: string;
  instanceCount: number;
  representativeNode: SceneNode;
  memberNodeIds: string[];
  disclaimer: string;
}

export interface ComponentDetectionOptions {
  minInstances?: number | undefined; // default: 2
}

/**
 * Classifies an individual frame into a potential candidate component type.
 */
export function classifyCandidateType(
  node: SceneNode,
  childNodes: readonly SceneNode[]
): ComponentCandidateType | null {
  if (node.type !== 'FRAME' && node.type !== 'GROUP') {
    return null;
  }

  const w = node.width;
  const h = node.height;
  const childCount = childNodes.length;
  const hasCornerRadius = (node.cornerRadius ?? 0) > 0;
  const hasFill = node.fills.some((f) => f.visible && f.type === 'SOLID');
  const hasStroke = node.strokes.some((s) => s.visible);

  // 1. Badge / Chip: Small, pill-like or rounded, single text child
  if (h >= 16 && h <= 32 && w <= 160 && (hasCornerRadius || (node.cornerRadius ?? 0) >= 8)) {
    if (childCount <= 2 && childNodes.some((c) => c.type === 'TEXT')) {
      return 'badge';
    }
  }

  // 2. Button: Small-medium height, interactive width, fills/strokes, cornerRadius, text child
  if (h >= 28 && h <= 56 && w >= 40 && w <= 320) {
    if (hasFill || hasStroke || hasCornerRadius) {
      if (childNodes.some((c) => c.type === 'TEXT')) {
        return 'button';
      }
    }
  }

  // 3. Form Input: Distinct height (32-52px), border/stroke or fill, usually wide
  if (h >= 32 && h <= 54 && w >= 120 && (hasStroke || hasFill) && hasCornerRadius) {
    if (childCount <= 2) {
      return 'input';
    }
  }

  // 4. Nav Item: Link-like element inside header/nav
  if (h <= 48 && w <= 200 && (node.name.toLowerCase().includes('nav') || node.name.toLowerCase().includes('link'))) {
    if (childNodes.some((c) => c.type === 'TEXT')) {
      return 'nav-item';
    }
  }

  // 5. Card: Medium to large surface with cornerRadius or stroke, multiple children
  if (w >= 180 && h >= 120 && (hasFill || hasStroke || hasCornerRadius) && childCount >= 2) {
    return 'card';
  }

  // 6. Generic List Item: Repeated child frame in vertical/horizontal sequence
  if (h >= 24 && h <= 120 && w >= 150 && childCount >= 1) {
    return 'list-item';
  }

  return null;
}

/**
 * Computes a conservative structural & geometric signature for grouping candidate components.
 */
export function computeComponentSignature(
  type: ComponentCandidateType,
  node: SceneNode,
  childNodes: readonly SceneNode[]
): string {
  // Quantize height to nearest 4px and aspect ratio bucket to allow minor responsive flexibility
  const quantizedHeight = Math.round(node.height / 4) * 4;
  const layout = node.layoutMetadata?.layoutMode ?? 'NONE';
  const childTypeFingerprint = childNodes
    .map((c) => c.type)
    .sort()
    .join('+');

  const cornerRadiusBucket = (node.cornerRadius ?? 0) > 0 ? Math.round((node.cornerRadius ?? 0) / 4) * 4 : 0;
  const fillType = node.fills[0]?.type ?? 'NONE';

  return `${type}|h:${quantizedHeight}|layout:${layout}|r:${cornerRadiusBucket}|fill:${fillType}|children:${childTypeFingerprint}`;
}

/**
 * Detects visually repeated component candidates across all scene nodes.
 */
export function detectRepeatedComponents(
  nodes: readonly SceneNode[],
  options: ComponentDetectionOptions = {}
): RepeatedComponentCandidate[] {
  const minInstances = options.minInstances ?? 2;

  // Build parent-child lookup
  const childrenByParentId = new Map<string, SceneNode[]>();
  for (const n of nodes) {
    if (n.parentId) {
      const list = childrenByParentId.get(n.parentId) ?? [];
      list.push(n);
      childrenByParentId.set(n.parentId, list);
    }
  }

  // Candidate cluster tracker keyed by signature
  const clusters = new Map<
    string,
    {
      type: ComponentCandidateType;
      nodes: SceneNode[];
    }
  >();

  for (const node of nodes) {
    const childNodes = childrenByParentId.get(node.id) ?? [];
    const candidateType = classifyCandidateType(node, childNodes);
    if (!candidateType) continue;

    const signature = computeComponentSignature(candidateType, node, childNodes);
    const existing = clusters.get(signature);
    if (existing) {
      existing.nodes.push(node);
    } else {
      clusters.set(signature, { type: candidateType, nodes: [node] });
    }
  }

  const results: RepeatedComponentCandidate[] = [];
  let candidateIndex = 1;

  for (const [signature, cluster] of clusters.entries()) {
    if (cluster.nodes.length >= minInstances) {
      const rep = cluster.nodes[0]!;
      const typeLabel = cluster.type.charAt(0).toUpperCase() + cluster.type.slice(1);

      results.push({
        candidateId: `candidate_${cluster.type}_${candidateIndex++}`,
        candidateType: cluster.type,
        signature,
        name: `Inferred Visual Component: ${typeLabel} (${cluster.nodes.length} instances)`,
        instanceCount: cluster.nodes.length,
        representativeNode: rep,
        memberNodeIds: cluster.nodes.map((n) => n.id),
        disclaimer:
          'Inferred visual candidate based on repeated DOM structure and geometry. Not proven to be a source-code reusable component.'
      });
    }
  }

  // Sort descending by instance count
  return results.sort((a, b) => b.instanceCount - a.instanceCount);
}
