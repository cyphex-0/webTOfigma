/**
 * CSS Gradient Parser and Affine Coordinate Normalizer.
 * 
 * Supports linear-gradient, radial-gradient, conic-gradient, and repeating variants.
 * Computes Figma-compatible 2x3 affine transformation matrices, stop distributions,
 * and handles repeating gradient stop replication / raster fallback.
 */

import { NormalizedColor, parseCssColor, clamp01 } from './color-parser';
import { ExportDiagnostic } from '../../shared/contracts/diagnostics';

export type GradientType = 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR';

export type AffineMatrix2x3 = [
  [number, number, number],
  [number, number, number]
];

export interface GradientStop {
  position: number; // 0..1
  color: NormalizedColor;
}

export interface NormalizedGradient {
  type: GradientType;
  stops: GradientStop[];
  transform: AffineMatrix2x3;
  isRepeating: boolean;
  rasterFallbackRequired?: boolean | undefined;
  diagnostic?: ExportDiagnostic | undefined;
}

/**
 * Splits CSS parameter lists by delimiter (default comma) while respecting parentheses and quotes.
 */
export function splitCssArgs(input: string, delimiter = ','): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const char = input[i] ?? '';
    const prevChar = i > 0 ? input[i - 1] : '';

    if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      current += char;
    } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      current += char;
    } else if (!inSingleQuote && !inDoubleQuote) {
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === delimiter && depth === 0) {
        tokens.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    } else {
      current += char;
    }
  }

  if (current.trim().length > 0) {
    tokens.push(current.trim());
  }

  return tokens;
}

/**
 * Parses raw color stops list into normalized GradientStop array.
 * Distributes omitted positions evenly per W3C CSS Gradient specifications.
 */
export function parseGradientStops(rawStops: string[], isConic = false): GradientStop[] {
  const intermediateStops: Array<{
    color: NormalizedColor;
    position: number | null;
  }> = [];

  for (const raw of rawStops) {
    const trimmed = raw.trim();
    if (!trimmed) continue;

    // A stop might be: "red", "red 20%", "red 0% 50%" (dual stop), "rgba(...) 100px", "red 45deg"
    const parts = splitCssArgs(trimmed, ' ');
    if (parts.length === 0) continue;

    let colorStr = '';
    let posStr1: string | undefined = undefined;
    let posStr2: string | undefined = undefined;

    // Find the color and stop position parts
    // Color might be first: "red 20%" or color might be last: "20% red"
    const firstPart = parts[0] ?? '';
    const lastPart = parts[parts.length - 1] ?? '';

    if (
      firstPart.endsWith('%') ||
      firstPart.endsWith('px') ||
      firstPart.endsWith('deg') ||
      firstPart.endsWith('turn') ||
      !isNaN(Number(firstPart))
    ) {
      // Position first: "20% red"
      posStr1 = firstPart;
      colorStr = parts.slice(1).join(' ');
    } else {
      // Color first: "red 20%" or "rgb(...) 10% 20%"
      // Find where color ends (can contain parens)
      let colorIndex = 0;
      let depth = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i] ?? '';
        for (const c of p) {
          if (c === '(') depth++;
          if (c === ')') depth--;
        }
        if (depth === 0) {
          colorIndex = i;
          break;
        }
      }

      colorStr = parts.slice(0, colorIndex + 1).join(' ');
      posStr1 = parts[colorIndex + 1];
      posStr2 = parts[colorIndex + 2];
    }

    const parsedColor = parseCssColor(colorStr) ?? { r: 0, g: 0, b: 0, a: 1 };

    const parsePosNumber = (pStr: string | undefined): number | null => {
      if (!pStr) return null;
      const clean = pStr.trim().toLowerCase();
      if (clean.endsWith('%')) {
        return clamp01(parseFloat(clean.slice(0, -1)) / 100);
      }
      if (clean.endsWith('deg')) {
        return clamp01(parseFloat(clean.slice(0, -3)) / 360);
      }
      if (clean.endsWith('turn')) {
        return clamp01(parseFloat(clean.slice(0, -4)));
      }
      if (clean.endsWith('rad')) {
        return clamp01((parseFloat(clean.slice(0, -3)) * 180) / Math.PI / 360);
      }
      if (clean.endsWith('px')) {
        return clamp01(parseFloat(clean.slice(0, -2)) / 100); // 100px relative scale default
      }
      const num = parseFloat(clean);
      if (!isNaN(num)) {
        return isConic ? clamp01(num / 360) : clamp01(num);
      }
      return null;
    };

    const p1 = parsePosNumber(posStr1);
    intermediateStops.push({ color: parsedColor, position: p1 });

    if (posStr2) {
      const p2 = parsePosNumber(posStr2);
      if (p2 !== null) {
        intermediateStops.push({ color: parsedColor, position: p2 });
      }
    }
  }

  if (intermediateStops.length === 0) {
    return [
      { position: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
      { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }
    ];
  }

  // CSS Specification: distribute missing positions
  // 1. If first stop position is null, set to 0
  const first = intermediateStops[0];
  if (first && first.position === null) {
    first.position = 0;
  }

  // 2. If last stop position is null, set to 1
  const last = intermediateStops[intermediateStops.length - 1];
  if (last && last.position === null) {
    last.position = 1;
  }

  // 3. Interpolate unpositioned intermediate stops
  let lastFixedIndex = 0;
  for (let i = 1; i < intermediateStops.length; i++) {
    const cur = intermediateStops[i];
    if (cur && cur.position !== null) {
      const startPos = intermediateStops[lastFixedIndex]?.position ?? 0;
      const endPos = cur.position;
      const gap = i - lastFixedIndex;

      for (let j = 1; j < gap; j++) {
        const target = intermediateStops[lastFixedIndex + j];
        if (target) {
          target.position = startPos + ((endPos - startPos) * j) / gap;
        }
      }
      lastFixedIndex = i;
    }
  }

  // 4. Ensure monotonic non-decreasing positions
  let currentMax = 0;
  return intermediateStops.map((stop) => {
    let pos = stop.position ?? currentMax;
    if (pos < currentMax) pos = currentMax;
    currentMax = pos;
    return {
      position: clamp01(pos),
      color: stop.color
    };
  });
}

/**
 * Parses CSS linear-gradient angle / direction keywords.
 * Returns angle in degrees [0, 360).
 */
export function parseLinearAngle(directionStr: string): number {
  const clean = directionStr.trim().toLowerCase();

  switch (clean) {
    case 'to top':
      return 0;
    case 'to right top':
    case 'to top right':
      return 45;
    case 'to right':
      return 90;
    case 'to right bottom':
    case 'to bottom right':
      return 135;
    case 'to bottom':
      return 180;
    case 'to left bottom':
    case 'to bottom left':
      return 225;
    case 'to left':
      return 270;
    case 'to left top':
    case 'to top left':
      return 315;
  }

  if (clean.endsWith('deg')) {
    const deg = parseFloat(clean.slice(0, -3));
    return ((deg % 360) + 360) % 360;
  }
  if (clean.endsWith('turn')) {
    const turn = parseFloat(clean.slice(0, -4));
    return (((turn * 360) % 360) + 360) % 360;
  }
  if (clean.endsWith('rad')) {
    const rad = parseFloat(clean.slice(0, -3));
    return ((((rad * 180) / Math.PI) % 360) + 360) % 360;
  }
  if (clean.endsWith('grad')) {
    const grad = parseFloat(clean.slice(0, -4));
    return (((grad * 0.9) % 360) + 360) % 360;
  }

  return 180; // Default: to bottom
}

/**
 * Derives a 2x3 affine matrix for a linear gradient given an angle in degrees.
 */
export function deriveLinearTransform(angleDeg: number): AffineMatrix2x3 {
  const rad = (angleDeg * Math.PI) / 180;
  const vx = Math.sin(rad);
  const vy = -Math.cos(rad);

  const x0 = 0.5 - 0.5 * vx;
  const y0 = 0.5 - 0.5 * vy;
  const dx = vx;
  const dy = vy;

  return [
    [dx, -dy, x0],
    [dy, dx, y0]
  ];
}

/**
 * Parses CSS position keywords or coordinates ("center", "top left", "50% 50%").
 * Returns normalized coordinates (x, y) in [0, 1].
 */
export function parsePositionCoordinates(posStr: string): { x: number; y: number } {
  const tokens = posStr.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let x = 0.5;
  let y = 0.5;

  for (const token of tokens) {
    if (token === 'left') x = 0;
    else if (token === 'right') x = 1;
    else if (token === 'top') y = 0;
    else if (token === 'bottom') y = 1;
    else if (token === 'center') {
      // center can be x or y depending on context; default maintains 0.5
    } else if (token.endsWith('%')) {
      const val = parseFloat(token.slice(0, -1)) / 100;
      if (tokens.indexOf(token) === 0) x = clamp01(val);
      else y = clamp01(val);
    }
  }

  return { x, y };
}

/**
 * Replicates repeating gradient stops across [0, 1] if <= 32 stops,
 * or signals raster fallback if frequency causes stop explosion.
 */
export function handleRepeatingStops(
  baseStops: GradientStop[],
  gradientType: string
): { stops: GradientStop[]; rasterFallback: boolean; diagnostic?: ExportDiagnostic | undefined } {
  if (baseStops.length < 2) {
    return { stops: baseStops, rasterFallback: false };
  }

  const p0 = baseStops[0]?.position ?? 0;
  const pn = baseStops[baseStops.length - 1]?.position ?? 1;
  const period = pn - p0;

  if (period <= 0.001) {
    return {
      stops: baseStops,
      rasterFallback: true,
      diagnostic: {
        severity: 'warning',
        code: 'GRADIENT_REPEATING_RASTERIZED',
        message: `High-frequency repeating ${gradientType} gradient period (${period}) is too small. Converted to raster fallback.`,
        phase: 'style-resolution',
        recoveryAction: 'Rasterized repeating gradient layer to preserve visual fidelity without stop explosion.',
        timestamp: Date.now()
      }
    };
  }

  const cycles = Math.ceil(1 / period);
  const totalStops = cycles * baseStops.length;

  if (totalStops > 32) {
    return {
      stops: baseStops,
      rasterFallback: true,
      diagnostic: {
        severity: 'warning',
        code: 'GRADIENT_REPEATING_RASTERIZED',
        message: `Repeating ${gradientType} gradient stop count (${totalStops}) exceeds safety limit of 32 stops. Converted to raster fallback.`,
        phase: 'style-resolution',
        recoveryAction: 'Used element raster fallback for high-frequency repeating gradient.',
        timestamp: Date.now()
      }
    };
  }

  // Replicate stops across [0, 1]
  const expanded: GradientStop[] = [];
  for (let c = 0; c < cycles; c++) {
    const cycleOffset = c * period;
    for (const stop of baseStops) {
      const pos = clamp01(stop.position + cycleOffset);
      if (pos <= 1) {
        expanded.push({
          position: pos,
          color: stop.color
        });
      }
    }
  }

  return { stops: expanded, rasterFallback: false };
}

/**
 * Parses a linear-gradient(...) or repeating-linear-gradient(...) CSS expression.
 */
export function parseLinearGradient(
  fnBody: string,
  isRepeating = false
): NormalizedGradient {
  const args = splitCssArgs(fnBody);
  let angleDeg = 180;
  let stopArgs = args;

  const firstArg = args[0]?.trim();
  if (firstArg && (
    firstArg.startsWith('to ') ||
    firstArg.endsWith('deg') ||
    firstArg.endsWith('turn') ||
    firstArg.endsWith('rad') ||
    firstArg.endsWith('grad')
  )) {
    angleDeg = parseLinearAngle(firstArg);
    stopArgs = args.slice(1);
  }

  const baseStops = parseGradientStops(stopArgs, false);
  const transform = deriveLinearTransform(angleDeg);

  if (isRepeating) {
    const { stops, rasterFallback, diagnostic } = handleRepeatingStops(baseStops, 'linear');
    return {
      type: 'GRADIENT_LINEAR',
      stops,
      transform,
      isRepeating: true,
      ...(rasterFallback ? { rasterFallbackRequired: true } : {}),
      ...(diagnostic ? { diagnostic } : {})
    };
  }

  return {
    type: 'GRADIENT_LINEAR',
    stops: baseStops,
    transform,
    isRepeating: false
  };
}

/**
 * Parses a radial-gradient(...) or repeating-radial-gradient(...) CSS expression.
 */
export function parseRadialGradient(
  fnBody: string,
  isRepeating = false
): NormalizedGradient {
  const args = splitCssArgs(fnBody);
  let center = { x: 0.5, y: 0.5 };
  let stopArgs = args;

  const firstArg = args[0]?.trim();
  if (firstArg && (firstArg.includes('circle') || firstArg.includes('ellipse') || firstArg.includes('at '))) {
    if (firstArg.includes('at ')) {
      const atPart = firstArg.split('at ')[1]?.trim() ?? '';
      center = parsePositionCoordinates(atPart);
    }
    stopArgs = args.slice(1);
  }

  const baseStops = parseGradientStops(stopArgs, false);

  // In Figma radial gradient: affine transform centers at (cx, cy) with 0.5 radius
  const rx = 0.5;
  const ry = 0.5;
  const transform: AffineMatrix2x3 = [
    [2 * rx, 0, center.x - rx],
    [0, 2 * ry, center.y - ry]
  ];

  if (isRepeating) {
    const { stops, rasterFallback, diagnostic } = handleRepeatingStops(baseStops, 'radial');
    return {
      type: 'GRADIENT_RADIAL',
      stops,
      transform,
      isRepeating: true,
      ...(rasterFallback ? { rasterFallbackRequired: true } : {}),
      ...(diagnostic ? { diagnostic } : {})
    };
  }

  return {
    type: 'GRADIENT_RADIAL',
    stops: baseStops,
    transform,
    isRepeating: false
  };
}

/**
 * Parses a conic-gradient(...) or repeating-conic-gradient(...) CSS expression.
 * Maps CSS 12 o'clock angles to Cartesian coordinates with -90deg offset
 * and derives Figma's 2x3 affine gradientTransform matrix.
 */
export function parseConicGradient(
  fnBody: string,
  isRepeating = false
): NormalizedGradient {
  const args = splitCssArgs(fnBody);
  let cssAngleDeg = 0;
  let center = { x: 0.5, y: 0.5 };
  let stopArgs = args;

  const firstArg = args[0]?.trim();
  if (firstArg && (firstArg.startsWith('from ') || firstArg.startsWith('at ') || firstArg.includes(' at '))) {
    if (firstArg.includes('from ')) {
      const fromPart = firstArg.split('from ')[1]?.split(' at ')[0]?.trim() ?? '';
      cssAngleDeg = parseLinearAngle(fromPart);
    }
    if (firstArg.includes('at ')) {
      const atPart = firstArg.split('at ')[1]?.trim() ?? '';
      center = parsePositionCoordinates(atPart);
    }
    stopArgs = args.slice(1);
  }

  const baseStops = parseGradientStops(stopArgs, true);

  // Exact formula from specifications:
  // Offset by -90 deg: theta = cssAngleDeg - 90
  const thetaRad = ((cssAngleDeg - 90) * Math.PI) / 180;
  const cosT = Math.cos(thetaRad);
  const sinT = Math.sin(thetaRad);

  const transform: AffineMatrix2x3 = [
    [cosT, -sinT, center.x],
    [sinT, cosT, center.y]
  ];

  if (isRepeating) {
    const { stops, rasterFallback, diagnostic } = handleRepeatingStops(baseStops, 'conic');
    return {
      type: 'GRADIENT_ANGULAR',
      stops,
      transform,
      isRepeating: true,
      ...(rasterFallback ? { rasterFallbackRequired: true } : {}),
      ...(diagnostic ? { diagnostic } : {})
    };
  }

  return {
    type: 'GRADIENT_ANGULAR',
    stops: baseStops,
    transform,
    isRepeating: false
  };
}

/**
 * Master CSS Gradient Parser.
 * Detects gradient function type and parses into a NormalizedGradient.
 */
export function parseCssGradient(input: string): NormalizedGradient | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^([a-z-]+)\((.+)\)$/i);
  if (!match || !match[1] || !match[2]) return null;

  const fnName = match[1].toLowerCase();
  const fnBody = match[2].trim();

  switch (fnName) {
    case 'linear-gradient':
      return parseLinearGradient(fnBody, false);
    case 'repeating-linear-gradient':
      return parseLinearGradient(fnBody, true);
    case 'radial-gradient':
      return parseRadialGradient(fnBody, false);
    case 'repeating-radial-gradient':
      return parseRadialGradient(fnBody, true);
    case 'conic-gradient':
      return parseConicGradient(fnBody, false);
    case 'repeating-conic-gradient':
      return parseConicGradient(fnBody, true);
    default:
      return null;
  }
}
