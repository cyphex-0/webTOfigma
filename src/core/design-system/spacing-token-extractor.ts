/**
 * Spacing and Radius Token Extractor.
 * 
 * Extracts recurring layout spacing and corner radius values:
 * - Scans padding (top, right, bottom, left) and itemSpacing from layoutMetadata
 * - Scans cornerRadius and cornerRadii from all geometric frames and blocks
 * - Employs strictly neutral, evidence-based naming ("Spacing 16 px", "Radius 8 px")
 *   unless a CSS variable was directly exposed in the source
 * - Does not invent synthetic design tokens like "space-4"
 */

import type { SceneNode } from '../../shared/contracts/scene';

export interface SpacingToken {
  id: string;
  label: string;
  valuePx: number;
  frequency: number;
  cssVariable?: string | undefined;
}

export interface RadiusToken {
  id: string;
  label: string;
  valuePx: number;
  frequency: number;
  cssVariable?: string | undefined;
}

export interface ExtractedSpacingResult {
  spacingTokens: SpacingToken[];
  radiusTokens: RadiusToken[];
}

/**
 * Extracts spacing and radius tokens from an array of scene nodes.
 */
export function extractSpacingTokens(nodes: readonly SceneNode[]): ExtractedSpacingResult {
  const spacingCounts = new Map<number, number>();
  const radiusCounts = new Map<number, number>();

  for (const node of nodes) {
    // 1. Padding and Item Spacing from Auto Layout
    if (node.layoutMetadata) {
      const lm = node.layoutMetadata;
      if (typeof lm.itemSpacing === 'number' && lm.itemSpacing > 0) {
        const val = Math.round(lm.itemSpacing);
        spacingCounts.set(val, (spacingCounts.get(val) ?? 0) + 1);
      }

      if (lm.padding) {
        const p = lm.padding;
        const padValues = [p.top, p.right, p.bottom, p.left];
        for (const val of padValues) {
          if (val > 0) {
            const rounded = Math.round(val);
            spacingCounts.set(rounded, (spacingCounts.get(rounded) ?? 0) + 1);
          }
        }
      }
    }

    // 2. Corner Radii
    if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) {
      const val = Math.round(node.cornerRadius);
      radiusCounts.set(val, (radiusCounts.get(val) ?? 0) + 1);
    }

    if (node.cornerRadii) {
      for (const val of node.cornerRadii) {
        if (val > 0) {
          const rounded = Math.round(val);
          radiusCounts.set(rounded, (radiusCounts.get(rounded) ?? 0) + 1);
        }
      }
    }
  }

  // Build neutral spacing tokens sorted ascending by pixel value
  const spacingTokens: SpacingToken[] = Array.from(spacingCounts.entries())
    .map(([valuePx, frequency]) => ({
      id: `spacing_${valuePx}px`,
      label: `Spacing ${valuePx} px`,
      valuePx,
      frequency
    }))
    .sort((a, b) => a.valuePx - b.valuePx);

  // Build neutral radius tokens sorted ascending by pixel value
  const radiusTokens: RadiusToken[] = Array.from(radiusCounts.entries())
    .map(([valuePx, frequency]) => ({
      id: `radius_${valuePx}px`,
      label: `Radius ${valuePx} px`,
      valuePx,
      frequency
    }))
    .sort((a, b) => a.valuePx - b.valuePx);

  return {
    spacingTokens,
    radiusTokens
  };
}
