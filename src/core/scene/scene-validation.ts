/**
 * Scene Graph Validator and Structural Integrity Checker.
 * 
 * Verifies bidirectional parent-child consistency, cycle-free hierarchy,
 * valid finite geometric bounds, and Figma scene schema conformance.
 */

import { PageScene, SceneNode } from '../../shared/contracts/scene';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export interface SceneValidationResult {
  isValid: boolean;
  errors: string[];
  diagnostics: ExportDiagnostic[];
}

/**
 * Validates a PageScene structure for structural integrity and Figma compliance.
 */
export function validatePageScene(scene: PageScene): SceneValidationResult {
  const errors: string[] = [];
  const diagnostics: ExportDiagnostic[] = [];

  const nodesById = new Map<string, SceneNode>();
  for (const node of scene.nodes) {
    if (nodesById.has(node.id)) {
      errors.push(`Duplicate node ID detected: ${node.id}`);
    }
    nodesById.set(node.id, node);
  }

  // 1. Verify Page Frame exists and is root
  if (!scene.pageFrame) {
    errors.push('Scene is missing a root pageFrame.');
    return { isValid: false, errors, diagnostics };
  }

  if (scene.pageFrame.parentId !== null) {
    errors.push(`Root pageFrame must have parentId: null, received: ${scene.pageFrame.parentId}`);
  }

  if (scene.pageFrame.type !== 'FRAME') {
    errors.push(`Root pageFrame must have type: 'FRAME', received: ${scene.pageFrame.type}`);
  }

  // 2. Validate bidirectional parent-child consistency
  for (const node of scene.nodes) {
    // Check parent reference
    if (node.parentId !== null) {
      const parent = nodesById.get(node.parentId);
      if (!parent) {
        errors.push(`Node '${node.id}' references non-existent parentId '${node.parentId}'.`);
      } else if (!parent.childIds.includes(node.id)) {
        errors.push(
          `Node '${node.id}' has parent '${parent.id}', but parent childIds does not contain it.`
        );
      }
    }

    // Check child references
    for (const childId of node.childIds) {
      const child = nodesById.get(childId);
      if (!child) {
        errors.push(`Node '${node.id}' references non-existent childId '${childId}'.`);
      } else if (child.parentId !== node.id) {
        errors.push(
          `Node '${node.id}' contains child '${child.id}', but child has parentId '${child.parentId}'.`
        );
      }
    }

    // 3. Validate geometry
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      errors.push(`Node '${node.id}' has non-finite coordinates: (${node.x}, ${node.y}).`);
    }
    if (!Number.isFinite(node.width) || node.width <= 0) {
      errors.push(`Node '${node.id}' has non-positive width: ${node.width}.`);
    }
    if (!Number.isFinite(node.height) || node.height <= 0) {
      errors.push(`Node '${node.id}' has non-positive height: ${node.height}.`);
    }

    // 4. Validate TEXT nodes
    if (node.type === 'TEXT') {
      if (!node.textData) {
        errors.push(`TEXT node '${node.id}' is missing textData.`);
      } else {
        if (typeof node.textData.text !== 'string') {
          errors.push(`TEXT node '${node.id}' textData.text must be a string.`);
        }
        if (!node.textData.fontFamily) {
          errors.push(`TEXT node '${node.id}' textData is missing fontFamily.`);
        }
        if (!node.textData.fontSize || node.textData.fontSize <= 0) {
          errors.push(`TEXT node '${node.id}' textData has invalid fontSize.`);
        }
      }
    }
  }

  // 5. Cycle Detection via DFS
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function detectCycle(nodeId: string): boolean {
    visited.add(nodeId);
    inStack.add(nodeId);

    const node = nodesById.get(nodeId);
    if (node) {
      for (const childId of node.childIds) {
        if (!visited.has(childId)) {
          if (detectCycle(childId)) return true;
        } else if (inStack.has(childId)) {
          errors.push(`Cycle detected in scene hierarchy at node '${childId}'.`);
          return true;
        }
      }
    }

    inStack.delete(nodeId);
    return false;
  }

  detectCycle(scene.pageFrame.id);

  // 6. Check unattached orphaned nodes
  if (visited.size < scene.nodes.length) {
    const unattachedCount = scene.nodes.length - visited.size;
    diagnostics.push({
      severity: 'warning',
      code: 'SCENE_UNATTACHED_NODES',
      message: `${unattachedCount} nodes in the scene are unreachable from the root page frame.`,
      phase: 'scene-conversion',
      timestamp: Date.now()
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    diagnostics
  };
}
