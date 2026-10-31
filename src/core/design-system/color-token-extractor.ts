/**
 * Color Token Extractor and Deterministic Color Clusterer.
 * 
 * Analyzes scene nodes across all captured pages:
 * - Extracts computed colors from solid fills, strokes, and text elements
 * - Formats human-readable hex and RGBA values
 * - Tracks frequency counts and contextual roles (fill, stroke, text)
 * - Associates CSS custom property names (--var-color) when available
 * - Groups near-identical colors using deterministic Euclidean threshold
 *   while strictly preserving original source values
 */

import type { SceneNode, ScenePaint, SceneStroke } from '../../shared/contracts/scene';

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface ExtractedColorToken {
  hex: string;
  rgba: RgbaColor;
  frequency: number;
  roles: Array<'fill' | 'stroke' | 'text'>;
  cssVariableNames: string[];
  members: Array<{
    hex: string;
    rgba: RgbaColor;
    frequency: number;
  }>;
}

export interface ColorExtractionOptions {
  clusteringThreshold?: number | undefined; // Euclidean distance in normalized 0..1 RGB space (default: 0.02)
  minFrequency?: number | undefined; // default: 1
}

/**
 * Converts a normalized 0..1 RGBA color to an uppercase hex string (#RRGGBB or #RRGGBBAA).
 */
export function rgbaToHex(color: RgbaColor): string {
  const r = Math.round(Math.max(0, Math.min(1, color.r)) * 255);
  const g = Math.round(Math.max(0, Math.min(1, color.g)) * 255);
  const b = Math.round(Math.max(0, Math.min(1, color.b)) * 255);
  const a = Math.round(Math.max(0, Math.min(1, color.a)) * 255);

  const hexR = r.toString(16).padStart(2, '0').toUpperCase();
  const hexG = g.toString(16).padStart(2, '0').toUpperCase();
  const hexB = b.toString(16).padStart(2, '0').toUpperCase();

  if (a >= 254) {
    return `#${hexR}${hexG}${hexB}`;
  }

  const hexA = a.toString(16).padStart(2, '0').toUpperCase();
  return `#${hexR}${hexG}${hexB}${hexA}`;
}

/**
 * Calculates Euclidean distance between two colors in normalized RGB space.
 */
export function colorDistance(a: RgbaColor, b: RgbaColor): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  const da = (a.a - b.a) * 0.5; // Weight alpha difference slightly lower than RGB
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da);
}

/**
 * Extracts and clusters unique color tokens from scene nodes across all page captures.
 */
export function extractColorTokens(
  nodes: readonly SceneNode[],
  options: ColorExtractionOptions = {}
): ExtractedColorToken[] {
  const threshold = options.clusteringThreshold ?? 0.02;
  const minFrequency = options.minFrequency ?? 1;

  // Map keyed by exact hex string
  const rawColorMap = new Map<
    string,
    {
      hex: string;
      rgba: RgbaColor;
      count: number;
      roles: Set<'fill' | 'stroke' | 'text'>;
      cssVars: Set<string>;
    }
  >();

  const recordColor = (
    color: RgbaColor | undefined,
    role: 'fill' | 'stroke' | 'text',
    cssVar?: string
  ) => {
    if (!color) return;
    const hex = rgbaToHex(color);
    let record = rawColorMap.get(hex);
    if (!record) {
      record = {
        hex,
        rgba: { ...color },
        count: 0,
        roles: new Set(),
        cssVars: new Set()
      };
      rawColorMap.set(hex, record);
    }
    record.count++;
    record.roles.add(role);
    if (cssVar) {
      record.cssVars.add(cssVar);
    }
  };

  for (const node of nodes) {
    // 1. Fills
    for (const fill of node.fills) {
      if (fill.type === 'SOLID' && fill.color) {
        const effectiveAlpha = (fill.color.a ?? 1) * (fill.opacity ?? 1);
        recordColor({ ...fill.color, a: effectiveAlpha }, 'fill');
      }
    }

    // 2. Strokes
    for (const stroke of node.strokes) {
      if (stroke.visible && stroke.color) {
        recordColor(stroke.color, 'stroke');
      }
    }

    // 3. Text colors
    if (node.textData && node.fills.length > 0) {
      for (const fill of node.fills) {
        if (fill.type === 'SOLID' && fill.color) {
          const effectiveAlpha = (fill.color.a ?? 1) * (fill.opacity ?? 1);
          recordColor({ ...fill.color, a: effectiveAlpha }, 'text');
        }
      }
    }
  }

  // Filter by minimum frequency
  const rawTokens = Array.from(rawColorMap.values()).filter((r) => r.count >= minFrequency);

  // Sort descending by frequency so most dominant colors become cluster heads
  rawTokens.sort((a, b) => b.count - a.count);

  // Deterministic clustering
  const clusters: ExtractedColorToken[] = [];
  const visitedHex = new Set<string>();

  for (const raw of rawTokens) {
    if (visitedHex.has(raw.hex)) continue;
    visitedHex.add(raw.hex);

    const clusterMembers: ExtractedColorToken['members'] = [
      { hex: raw.hex, rgba: raw.rgba, frequency: raw.count }
    ];
    let totalClusterCount = raw.count;
    const combinedRoles = new Set(raw.roles);
    const combinedVars = new Set(raw.cssVars);

    // Look for close candidate colors that haven't been claimed yet
    for (const other of rawTokens) {
      if (visitedHex.has(other.hex)) continue;
      if (colorDistance(raw.rgba, other.rgba) <= threshold) {
        visitedHex.add(other.hex);
        clusterMembers.push({ hex: other.hex, rgba: other.rgba, frequency: other.count });
        totalClusterCount += other.count;
        for (const role of other.roles) combinedRoles.add(role);
        for (const v of other.cssVars) combinedVars.add(v);
      }
    }

    clusters.push({
      hex: raw.hex,
      rgba: raw.rgba,
      frequency: totalClusterCount,
      roles: Array.from(combinedRoles),
      cssVariableNames: Array.from(combinedVars),
      members: clusterMembers
    });
  }

  // Sort final clusters by overall frequency
  return clusters.sort((a, b) => b.frequency - a.frequency);
}
