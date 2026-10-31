/**
 * Typography Token Extractor.
 * 
 * Analyzes text nodes across all captured pages:
 * - Aggregates typography signatures (font family, weight, size, line-height, letter-spacing)
 * - Identifies semantic scale tiers: H1-H6, Body Large, Body, Body Small, Caption
 * - Maps font substitutions (where original web font was substituted with local or fallback font)
 * - Counts usage frequency for each typography style
 */

import type { SceneNode, SceneTextData } from '../../shared/contracts/scene';

export type TypographyRole =
  | 'H1'
  | 'H2'
  | 'H3'
  | 'H4'
  | 'H5'
  | 'H6'
  | 'Body Large'
  | 'Body'
  | 'Body Small'
  | 'Caption';

export interface TypographyToken {
  id: string;
  name: string;
  role: TypographyRole;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  resolvedFont: string;
  lineHeight: number;
  letterSpacing: number;
  frequency: number;
}

export interface FontSubstitution {
  sourceFont: string;
  resolvedFont: string;
  count: number;
}

export interface ExtractedTypographyResult {
  tokens: TypographyToken[];
  fontSubstitutions: FontSubstitution[];
  uniqueFamilies: string[];
}

/**
 * Heuristically infers the typographic role from font size and weight.
 */
export function inferTypographyRole(fontSize: number, fontWeight: number): TypographyRole {
  if (fontSize >= 32) return 'H1';
  if (fontSize >= 28) return 'H2';
  if (fontSize >= 24) return 'H3';
  if (fontSize >= 20) return 'H4';
  if (fontSize >= 18 && fontWeight >= 600) return 'H5';
  if (fontSize >= 16 && fontWeight >= 600) return 'H6';
  if (fontSize >= 18) return 'Body Large';
  if (fontSize >= 15) return 'Body';
  if (fontSize >= 13) return 'Body Small';
  return 'Caption';
}

/**
 * Extracts typography scale tokens and font substitution mappings from scene nodes.
 */
export function extractTypographyTokens(nodes: readonly SceneNode[]): ExtractedTypographyResult {
  const tokenMap = new Map<string, TypographyToken>();
  const substitutionCounts = new Map<string, { sourceFont: string; resolvedFont: string; count: number }>();
  const familySet = new Set<string>();

  for (const node of nodes) {
    if (!node.textData) continue;
    const td: SceneTextData = node.textData;

    const fontSize = Math.round(td.fontSize);
    const fontWeight = Math.round(td.fontWeight);
    const sourceFont = (td.sourceFont || td.fontFamily || 'Inter').trim();
    const resolvedFont = (td.resolvedFont || td.fontFamily || 'Inter').trim();

    familySet.add(resolvedFont);

    // Track font substitution if resolved font differs from declared source font
    if (sourceFont && resolvedFont && sourceFont.toLowerCase() !== resolvedFont.toLowerCase()) {
      const subKey = `${sourceFont}=>${resolvedFont}`;
      const existing = substitutionCounts.get(subKey);
      if (existing) {
        existing.count++;
      } else {
        substitutionCounts.set(subKey, { sourceFont, resolvedFont, count: 1 });
      }
    }

    let lineHeightPx = Math.round(fontSize * 1.25);
    if (typeof td.lineHeight === 'number') {
      lineHeightPx = Math.round(td.lineHeight);
    } else if (td.lineHeight && typeof td.lineHeight === 'object' && td.lineHeight.value !== undefined) {
      lineHeightPx = Math.round(td.lineHeight.value);
    }

    let letterSpacingPx = 0;
    if (typeof td.letterSpacing === 'number') {
      letterSpacingPx = td.letterSpacing;
    } else if (td.letterSpacing && typeof td.letterSpacing === 'object') {
      letterSpacingPx = td.letterSpacing.value;
    }

    const role = inferTypographyRole(fontSize, fontWeight);
    const key = `${resolvedFont}_${fontWeight}_${fontSize}_${lineHeightPx}`;

    const existing = tokenMap.get(key);
    if (existing) {
      existing.frequency++;
    } else {
      const id = `type_${role.toLowerCase().replace(/\s+/g, '_')}_${fontSize}`;
      tokenMap.set(key, {
        id,
        name: `${role} (${resolvedFont} ${fontWeight} / ${fontSize}px)`,
        role,
        fontSize,
        fontWeight,
        fontFamily: sourceFont,
        resolvedFont,
        lineHeight: lineHeightPx,
        letterSpacing: letterSpacingPx,
        frequency: 1
      });
    }
  }

  // Sort tokens by font size descending, then weight descending
  const tokens = Array.from(tokenMap.values()).sort((a, b) => {
    if (b.fontSize !== a.fontSize) return b.fontSize - a.fontSize;
    return b.fontWeight - a.fontWeight;
  });

  return {
    tokens,
    fontSubstitutions: Array.from(substitutionCounts.values()).sort((a, b) => b.count - a.count),
    uniqueFamilies: Array.from(familySet).sort()
  };
}
