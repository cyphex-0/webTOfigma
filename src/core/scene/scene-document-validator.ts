/**
 * Multi-Page Scene Document Validator and Resource Budget Enforcer.
 * 
 * Validates the entire assembled multi-page Figma scene document before layout:
 * - Globally unique node IDs across all pages, sections, and headers
 * - Acyclic parent-child hierarchy (no circular parent links)
 * - Asset reference resolution against known image assets
 * - Non-negative, finite dimensions (width >= 0, height >= 0)
 * - Valid, sanitized string names
 * - Total node count and asset resource budgets
 */

import type { FigmaSceneDocument, SceneNode } from '../../shared/contracts/scene';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface SceneDocumentValidationOptions {
  maxTotalNodes?: number | undefined; // Default 60,000
  maxTotalAssets?: number | undefined; // Default 1,000
  knownAssetRefs?: Set<string> | readonly string[] | undefined;
}

export interface SceneDocumentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  diagnostics: ExportDiagnostic[];
  stats: {
    totalNodes: number;
    totalPageFrames: number;
    totalSections: number;
    totalAssets: number;
  };
}

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * Validates a complete FigmaSceneDocument before canvas layout.
 */
export function validateSceneDocument(
  doc: FigmaSceneDocument & { allNodes?: readonly SceneNode[] | undefined },
  options: SceneDocumentValidationOptions = {}
): SceneDocumentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const diagnostics: ExportDiagnostic[] = [];

  const maxTotalNodes = options.maxTotalNodes ?? 60_000;
  const maxTotalAssets = options.maxTotalAssets ?? 1_000;
  const knownAssets = options.knownAssetRefs
    ? options.knownAssetRefs instanceof Set
      ? options.knownAssetRefs
      : new Set(options.knownAssetRefs)
    : undefined;

  // Collect all nodes to validate (from allNodes array or recursively through pageFrames and sections)
  const nodesToValidate: SceneNode[] = [];
  if (doc.allNodes && doc.allNodes.length > 0) {
    nodesToValidate.push(...doc.allNodes);
  } else {
    // Collect from pageFrames and sections
    const collected = new Set<string>();
    const stack: SceneNode[] = [...doc.pageFrames, ...doc.sections];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (!collected.has(node.id)) {
        collected.add(node.id);
        nodesToValidate.push(node);
      }
    }
  }

  const nodesById = new Map<string, SceneNode>();
  const assetRefsFound = new Set<string>();

  // 1. Globally unique node IDs & Basic properties
  for (const node of nodesToValidate) {
    if (!node.id || node.id.trim() === '') {
      errors.push('Found node with missing or empty ID.');
      continue;
    }

    if (nodesById.has(node.id)) {
      errors.push(`Duplicate node ID detected in document: '${node.id}'.`);
    } else {
      nodesById.set(node.id, node);
    }

    // 2. Non-negative, finite dimensions
    if (!Number.isFinite(node.width) || node.width < 0) {
      errors.push(
        `Node '${node.id}' (${node.name}) has invalid width: ${node.width}. Width must be a non-negative finite number.`
      );
    }
    if (!Number.isFinite(node.height) || node.height < 0) {
      errors.push(
        `Node '${node.id}' (${node.name}) has invalid height: ${node.height}. Height must be a non-negative finite number.`
      );
    }
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      errors.push(
        `Node '${node.id}' (${node.name}) has non-finite coordinates: x=${node.x}, y=${node.y}.`
      );
    }

    // 3. Valid names
    if (!node.name || node.name.trim() === '') {
      warnings.push(`Node '${node.id}' has an empty or blank name.`);
    } else if (CONTROL_CHARS_REGEX.test(node.name)) {
      warnings.push(`Node '${node.id}' name contains unprintable control characters.`);
    }

    // 4. Asset reference discovery
    for (const fill of node.fills) {
      if (fill.type === 'IMAGE' && fill.imageRef) {
        assetRefsFound.add(fill.imageRef);
        if (knownAssets && !knownAssets.has(fill.imageRef)) {
          errors.push(
            `Node '${node.id}' references image asset '${fill.imageRef}' which does not resolve in the asset registry.`
          );
        }
      }
    }
  }

  // 5. Hierarchy and Circular Parent Link Detection
  for (const node of nodesToValidate) {
    if (node.parentId !== null) {
      const parent = nodesById.get(node.parentId);
      if (!parent) {
        // Warning or error depending on whether allNodes contains whole canvas
        errors.push(
          `Node '${node.id}' (${node.name}) references missing parentId '${node.parentId}'.`
        );
      } else if (!parent.childIds.includes(node.id)) {
        errors.push(
          `Node '${node.id}' specifies parent '${parent.id}', but parent does not list it in childIds.`
        );
      }

      // Check for cycles
      const visited = new Set<string>([node.id]);
      let curr = parent;
      while (curr && curr.parentId !== null) {
        if (visited.has(curr.id)) {
          errors.push(
            `Circular parent hierarchy detected involving node '${node.id}' and parent '${curr.id}'.`
          );
          break;
        }
        visited.add(curr.id);
        const next = nodesById.get(curr.parentId);
        if (!next) break;
        curr = next;
      }
    }

    // Verify children exist in document
    for (const childId of node.childIds) {
      const child = nodesById.get(childId);
      if (!child) {
        errors.push(
          `Node '${node.id}' (${node.name}) lists non-existent childId '${childId}'.`
        );
      }
    }
  }

  // 6. Resource Budgets
  const totalNodes = nodesToValidate.length;
  if (totalNodes > maxTotalNodes) {
    errors.push(
      `Total scene node budget exceeded: document contains ${totalNodes.toLocaleString()} nodes (maximum allowed: ${maxTotalNodes.toLocaleString()}).`
    );
  } else if (totalNodes > maxTotalNodes * 0.8) {
    warnings.push(
      `Document node count (${totalNodes.toLocaleString()}) approaches the safety budget of ${maxTotalNodes.toLocaleString()}.`
    );
  }

  const totalAssets = assetRefsFound.size;
  if (totalAssets > maxTotalAssets) {
    errors.push(
      `Total asset count budget exceeded: document contains ${totalAssets.toLocaleString()} unique assets (maximum allowed: ${maxTotalAssets.toLocaleString()}).`
    );
  }

  // Emit diagnostics for errors and warnings
  for (const err of errors) {
    diagnostics.push({
      severity: 'error',
      code: 'SCENE_DOCUMENT_VALIDATION_ERROR',
      message: err,
      phase: 'scene-conversion',
      timestamp: Date.now()
    });
  }

  for (const warn of warnings) {
    diagnostics.push({
      severity: 'warning',
      code: 'SCENE_DOCUMENT_VALIDATION_WARNING',
      message: warn,
      phase: 'scene-conversion',
      timestamp: Date.now()
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    diagnostics,
    stats: {
      totalNodes,
      totalPageFrames: doc.pageFrames.length,
      totalSections: doc.sections.length,
      totalAssets
    }
  };
}
