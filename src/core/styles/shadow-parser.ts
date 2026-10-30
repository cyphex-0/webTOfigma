/**
 * CSS Box-Shadow Parser.
 * 
 * Accurately parses single and multi-layer box-shadow declarations,
 * resolving inset flags, offsets, blur, spread, and colors.
 */

import { NormalizedColor, parseCssColor, ColorParseContext } from './color-parser';
import { splitCssArgs } from './gradient-parser';
import { parseLengthPx } from './border-converter';

export interface ParsedShadow {
  isInset: boolean;
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
  color: NormalizedColor;
}

/**
 * Checks whether a token represents a length (e.g. 0, 10px, -2px).
 */
function isLengthToken(token: string): boolean {
  if (!token) return false;
  if (token === '0') return true;
  return /^-?\d+(\.\d+)?(px|rem|em)?$/i.test(token.trim());
}

/**
 * Parses a single box-shadow declaration string.
 */
export function parseSingleBoxShadow(
  str: string,
  context?: ColorParseContext
): ParsedShadow | null {
  const trimmed = str.trim();
  if (!trimmed || trimmed === 'none') return null;

  // Split tokens by whitespace while preserving function arguments like rgba(...)
  const tokens = splitCssArgs(trimmed, ' ');
  if (tokens.length < 2) return null;

  let isInset = false;
  const lengthTokens: string[] = [];
  const colorTokens: string[] = [];

  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (lower === 'inset') {
      isInset = true;
    } else if (isLengthToken(token)) {
      lengthTokens.push(token);
    } else {
      colorTokens.push(token);
    }
  }

  if (lengthTokens.length < 2) return null;

  const offsetX = parseLengthPx(lengthTokens[0], true);
  const offsetY = parseLengthPx(lengthTokens[1], true);
  const blurRadius = lengthTokens[2] ? parseLengthPx(lengthTokens[2], false) : 0;
  const spreadRadius = lengthTokens[3] ? parseLengthPx(lengthTokens[3], true) : 0;

  let color: NormalizedColor = { r: 0, g: 0, b: 0, a: 1 };
  if (colorTokens.length > 0) {
    const rawColorStr = colorTokens.join(' ');
    const parsed = parseCssColor(rawColorStr, context);
    if (parsed) color = parsed;
  }

  return {
    isInset,
    offsetX,
    offsetY,
    blurRadius,
    spreadRadius,
    color
  };
}

/**
 * Parses a comma-separated list of box-shadow declarations.
 */
export function parseBoxShadow(
  shadowCss: string | undefined,
  context?: ColorParseContext
): ParsedShadow[] {
  if (!shadowCss) return [];
  const trimmed = shadowCss.trim();
  if (!trimmed || trimmed === 'none') return [];

  // Split by top-level commas respecting colors like rgba(0, 0, 0, 0.5)
  const shadowStrings = splitCssArgs(trimmed);
  const result: ParsedShadow[] = [];

  for (const s of shadowStrings) {
    const parsed = parseSingleBoxShadow(s, context);
    if (parsed) {
      result.push(parsed);
    }
  }

  return result;
}
