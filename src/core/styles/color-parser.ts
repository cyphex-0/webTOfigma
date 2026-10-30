/**
 * CSS Color Parser and sRGB Normalization Engine.
 * 
 * Converts hex (3, 4, 6, 8-digit), rgb(), rgba(), hsl(), hsla(), color(srgb ...),
 * named colors, and CSS custom properties into a normalized { r, g, b, a } format
 * where each channel is in [0, 1].
 * 
 * Preserves alpha distinctly from layer opacity.
 */

export interface NormalizedColor {
  r: number; // 0..1
  g: number; // 0..1
  b: number; // 0..1
  a: number; // 0..1
}

export interface ColorParseContext {
  currentColor?: NormalizedColor | undefined;
  cssVariables?: Record<string, string> | undefined;
}

export function clamp01(val: number): number {
  if (Number.isNaN(val)) return 0;
  if (val < 0) return 0;
  if (val > 1) return 1;
  return val;
}

// 148 standard W3C CSS Color Module Level 4 named colors mapped to hex
const NAMED_COLORS: Record<string, string> = {
  aliceblue: '#f0f8ff',
  antiquewhite: '#faebd7',
  aqua: '#00ffff',
  aquamarine: '#7fffd4',
  azure: '#f0ffff',
  beige: '#f5f5dc',
  bisque: '#ffe4c4',
  black: '#000000',
  blanchedalmond: '#ffebcd',
  blue: '#0000ff',
  blueviolet: '#8a2be2',
  brown: '#a52a2a',
  burlywood: '#deb887',
  cadetblue: '#5f9ea0',
  chartreuse: '#7fff00',
  chocolate: '#d2691e',
  coral: '#ff7f50',
  cornflowerblue: '#6495ed',
  cornsilk: '#fff8dc',
  crimson: '#dc143c',
  cyan: '#00ffff',
  darkblue: '#00008b',
  darkcyan: '#008b8b',
  darkgoldenrod: '#b8860b',
  darkgray: '#a9a9a9',
  darkgreen: '#006400',
  darkgrey: '#a9a9a9',
  darkkhaki: '#bdb76b',
  darkmagenta: '#8b008b',
  darkolivegreen: '#556b2f',
  darkorange: '#ff8c00',
  darkorchid: '#9932cc',
  darkred: '#8b0000',
  darksalmon: '#e9967a',
  darkseagreen: '#8fbc8f',
  darkslateblue: '#483d8b',
  darkslategray: '#2f4f4f',
  darkslategrey: '#2f4f4f',
  darkturquoise: '#00ced1',
  darkviolet: '#9400d3',
  deeppink: '#ff1493',
  deepskyblue: '#00bfff',
  dimgray: '#696969',
  dimgrey: '#696969',
  dodgerblue: '#1e90ff',
  firebrick: '#b22222',
  floralwhite: '#fffaf0',
  forestgreen: '#228b22',
  fuchsia: '#ff00ff',
  gainsboro: '#dcdcdc',
  ghostwhite: '#f8f8ff',
  gold: '#ffd700',
  goldenrod: '#daa520',
  gray: '#808080',
  green: '#008000',
  greenyellow: '#adff2f',
  grey: '#808080',
  honeydew: '#f0fff0',
  hotpink: '#ff69b4',
  indianred: '#cd5c5c',
  indigo: '#4b0082',
  ivory: '#fffff0',
  khaki: '#f0e68c',
  lavender: '#e6e6fa',
  lavenderblush: '#fff0f5',
  lawngreen: '#7cfc00',
  lemonchiffon: '#fffacd',
  lightblue: '#add8e6',
  lightcoral: '#f08080',
  lightcyan: '#e0ffff',
  lightgoldenrodyellow: '#fafad2',
  lightgray: '#d3d3d3',
  lightgreen: '#90ee90',
  lightgrey: '#d3d3d3',
  lightpink: '#ffb6c1',
  lightsalmon: '#ffa07a',
  lightseagreen: '#20b2aa',
  lightskyblue: '#87cefa',
  lightslategray: '#778899',
  lightslategrey: '#778899',
  lightsteelblue: '#b0c4de',
  lightyellow: '#ffffe0',
  lime: '#00ff00',
  limegreen: '#32cd32',
  linen: '#faf0e6',
  magenta: '#ff00ff',
  maroon: '#800000',
  mediumaquamarine: '#66cdaa',
  mediumblue: '#0000cd',
  mediumorchid: '#ba55d3',
  mediumpurple: '#9370db',
  mediumseagreen: '#3cb371',
  mediumslateblue: '#7b68ee',
  mediumspringgreen: '#00fa9a',
  mediumturquoise: '#48d1cc',
  mediumvioletred: '#c71585',
  midnightblue: '#191970',
  mintcream: '#f5fffa',
  mistyrose: '#ffe4e1',
  moccasin: '#ffe4b5',
  navajowhite: '#ffdead',
  navy: '#000080',
  oldlace: '#fdf5e6',
  olive: '#808000',
  olivedrab: '#6b8e23',
  orange: '#ffa500',
  orangered: '#ff4500',
  orchid: '#da70d6',
  palegoldenrod: '#eee8aa',
  palegreen: '#98fb98',
  paleturquoise: '#afeeee',
  palevioletred: '#db7093',
  papayawhip: '#ffefd5',
  peachpuff: '#ffdab9',
  peru: '#cd853f',
  pink: '#ffc0cb',
  plum: '#dda0dd',
  powderblue: '#b0e0e6',
  purple: '#800080',
  rebeccapurple: '#663399',
  red: '#ff0000',
  rosybrown: '#bc8f8f',
  royalblue: '#4169e1',
  saddlebrown: '#8b4513',
  salmon: '#fa8072',
  sandybrown: '#f4a460',
  seagreen: '#2e8b57',
  seashell: '#fff5ee',
  sienna: '#a0522d',
  silver: '#c0c0c0',
  skyblue: '#87ceeb',
  slateblue: '#6a5acd',
  slategray: '#708090',
  slategrey: '#708090',
  snow: '#fffafa',
  springgreen: '#00ff7f',
  steelblue: '#4682b4',
  tan: '#d2b48c',
  teal: '#008080',
  thistle: '#d8bfd8',
  tomato: '#ff6347',
  turquoise: '#40e0d0',
  violet: '#ee82ee',
  wheat: '#f5deb3',
  white: '#ffffff',
  whitesmoke: '#f5f5f5',
  yellow: '#ffff00',
  yellowgreen: '#9acd32'
};

/**
 * Parses a hex color string (#RGB, #RGBA, #RRGGBB, #RRGGBBAA).
 */
export function parseHexColor(hex: string): NormalizedColor | null {
  const cleanHex = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]+$/.test(cleanHex)) return null;

  let r = 0;
  let g = 0;
  let b = 0;
  let a = 1;

  if (cleanHex.length === 3) {
    const c0 = cleanHex[0] ?? '0';
    const c1 = cleanHex[1] ?? '0';
    const c2 = cleanHex[2] ?? '0';
    r = parseInt(c0 + c0, 16) / 255;
    g = parseInt(c1 + c1, 16) / 255;
    b = parseInt(c2 + c2, 16) / 255;
  } else if (cleanHex.length === 4) {
    const c0 = cleanHex[0] ?? '0';
    const c1 = cleanHex[1] ?? '0';
    const c2 = cleanHex[2] ?? '0';
    const c3 = cleanHex[3] ?? 'f';
    r = parseInt(c0 + c0, 16) / 255;
    g = parseInt(c1 + c1, 16) / 255;
    b = parseInt(c2 + c2, 16) / 255;
    a = parseInt(c3 + c3, 16) / 255;
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.slice(0, 2), 16) / 255;
    g = parseInt(cleanHex.slice(2, 4), 16) / 255;
    b = parseInt(cleanHex.slice(4, 6), 16) / 255;
  } else if (cleanHex.length === 8) {
    r = parseInt(cleanHex.slice(0, 2), 16) / 255;
    g = parseInt(cleanHex.slice(2, 4), 16) / 255;
    b = parseInt(cleanHex.slice(4, 6), 16) / 255;
    a = parseInt(cleanHex.slice(6, 8), 16) / 255;
  } else {
    return null;
  }

  return {
    r: clamp01(r),
    g: clamp01(g),
    b: clamp01(b),
    a: clamp01(a)
  };
}

/**
 * Parses channel values from a comma-separated or space-separated list.
 * Can be percentage or 0..255 number.
 */
function parseChannelValue(val: string, maxVal = 255): number {
  const trimmed = val.trim();
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed.slice(0, -1));
    return clamp01(pct / 100);
  }
  const num = parseFloat(trimmed);
  return clamp01(num / maxVal);
}

/**
 * Parses alpha value from a string (number 0..1 or percentage 0..100%).
 */
function parseAlphaValue(val: string): number {
  const trimmed = val.trim();
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed.slice(0, -1));
    return clamp01(pct / 100);
  }
  const num = parseFloat(trimmed);
  return clamp01(num);
}

/**
 * Parses rgb(...) and rgba(...) CSS functions.
 */
export function parseRgbColor(str: string): NormalizedColor | null {
  const match = str.trim().match(/^rgba?\((.+)\)$/i);
  if (!match || !match[1]) return null;

  const inner = match[1].trim();

  // Modern CSS syntax: rgb(r g b [/ a])
  if (inner.includes('/') || (!inner.includes(',') && inner.split(/\s+/).length >= 3)) {
    const parts = inner.split('/');
    const colorPart = parts[0]?.trim() ?? '';
    const alphaPart = parts[1]?.trim();

    const channels = colorPart.split(/\s+/).filter(Boolean);
    if (channels.length < 3) return null;

    const r = parseChannelValue(channels[0] ?? '0');
    const g = parseChannelValue(channels[1] ?? '0');
    const b = parseChannelValue(channels[2] ?? '0');
    const a = alphaPart !== undefined ? parseAlphaValue(alphaPart) : 1;

    return { r, g, b, a };
  }

  // Legacy comma-separated syntax: rgb(r, g, b[, a])
  const parts = inner.split(',').map((p) => p.trim());
  if (parts.length < 3) return null;

  const r = parseChannelValue(parts[0] ?? '0');
  const g = parseChannelValue(parts[1] ?? '0');
  const b = parseChannelValue(parts[2] ?? '0');
  const a = parts[3] !== undefined ? parseAlphaValue(parts[3]) : 1;

  return { r, g, b, a };
}

/**
 * Converts HSL angles (deg, rad, grad, turn) to degrees [0, 360).
 */
function parseHueAngle(str: string): number {
  const trimmed = str.trim().toLowerCase();
  let degrees = 0;

  if (trimmed.endsWith('turn')) {
    degrees = parseFloat(trimmed.slice(0, -4)) * 360;
  } else if (trimmed.endsWith('grad')) {
    degrees = parseFloat(trimmed.slice(0, -4)) * 0.9;
  } else if (trimmed.endsWith('rad')) {
    degrees = (parseFloat(trimmed.slice(0, -3)) * 180) / Math.PI;
  } else if (trimmed.endsWith('deg')) {
    degrees = parseFloat(trimmed.slice(0, -3));
  } else {
    degrees = parseFloat(trimmed);
  }

  if (Number.isNaN(degrees)) return 0;
  return ((degrees % 360) + 360) % 360;
}

/**
 * Converts HSL values to sRGB normalized channels [0, 1].
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  l = clamp01(l);

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = l - c / 2;

  let rPrime = 0;
  let gPrime = 0;
  let bPrime = 0;

  if (hp >= 0 && hp < 1) {
    rPrime = c;
    gPrime = x;
  } else if (hp >= 1 && hp < 2) {
    rPrime = x;
    gPrime = c;
  } else if (hp >= 2 && hp < 3) {
    gPrime = c;
    bPrime = x;
  } else if (hp >= 3 && hp < 4) {
    gPrime = x;
    bPrime = c;
  } else if (hp >= 4 && hp < 5) {
    rPrime = x;
    bPrime = c;
  } else if (hp >= 5 && hp < 6) {
    rPrime = c;
    bPrime = x;
  }

  return {
    r: clamp01(rPrime + m),
    g: clamp01(gPrime + m),
    b: clamp01(bPrime + m)
  };
}

/**
 * Parses hsl(...) and hsla(...) CSS functions.
 */
export function parseHslColor(str: string): NormalizedColor | null {
  const match = str.trim().match(/^hsla?\((.+)\)$/i);
  if (!match || !match[1]) return null;

  const inner = match[1].trim();

  let hStr = '';
  let sStr = '';
  let lStr = '';
  let aStr: string | undefined = undefined;

  if (inner.includes('/') || (!inner.includes(',') && inner.split(/\s+/).length >= 3)) {
    const parts = inner.split('/');
    const hslPart = parts[0]?.trim() ?? '';
    const alphaPart = parts[1]?.trim();

    const channels = hslPart.split(/\s+/).filter(Boolean);
    if (channels.length < 3) return null;

    hStr = channels[0] ?? '0';
    sStr = channels[1] ?? '0';
    lStr = channels[2] ?? '0';
    aStr = alphaPart;
  } else {
    const parts = inner.split(',').map((p) => p.trim());
    if (parts.length < 3) return null;

    hStr = parts[0] ?? '0';
    sStr = parts[1] ?? '0';
    lStr = parts[2] ?? '0';
    aStr = parts[3];
  }

  const h = parseHueAngle(hStr);
  const s = parseChannelValue(sStr, 100);
  const l = parseChannelValue(lStr, 100);
  const a = aStr !== undefined ? parseAlphaValue(aStr) : 1;

  const { r, g, b } = hslToRgb(h, s, l);
  return { r, g, b, a };
}

/**
 * Parses CSS color(srgb r g b [/ a]) syntax.
 */
export function parseColorFunction(str: string): NormalizedColor | null {
  const match = str.trim().match(/^color\(srgb\s+(.+)\)$/i);
  if (!match || !match[1]) return null;

  const inner = match[1].trim();
  const parts = inner.split('/');
  const colorPart = parts[0]?.trim() ?? '';
  const alphaPart = parts[1]?.trim();

  const channels = colorPart.split(/\s+/).filter(Boolean);
  if (channels.length < 3) return null;

  const r = parseChannelValue(channels[0] ?? '0', 1);
  const g = parseChannelValue(channels[1] ?? '0', 1);
  const b = parseChannelValue(channels[2] ?? '0', 1);
  const a = alphaPart !== undefined ? parseAlphaValue(alphaPart) : 1;

  return { r, g, b, a };
}

/**
 * Parses CSS var(--name[, fallback]) syntax.
 */
export function resolveCssVariable(str: string, context?: ColorParseContext): string {
  const trimmed = str.trim();
  const match = trimmed.match(/^var\(\s*(--[a-zA-Z0-9-_]+)(?:\s*,\s*(.+))?\)$/);
  if (!match) return trimmed;

  const varName = match[1];
  const fallback = match[2]?.trim();

  if (varName && context?.cssVariables && context.cssVariables[varName]) {
    return context.cssVariables[varName]!.trim();
  }

  if (fallback) {
    return resolveCssVariable(fallback, context);
  }

  return trimmed;
}

/**
 * Master CSS Color Parser.
 * Converts any standard CSS color value into a NormalizedColor { r, g, b, a } in [0, 1].
 */
export function parseCssColor(
  rawInput: string,
  context?: ColorParseContext
): NormalizedColor | null {
  if (!rawInput) return null;
  let input = rawInput.trim();
  if (!input) return null;

  // Resolve CSS variables if present
  if (input.startsWith('var(')) {
    input = resolveCssVariable(input, context);
  }

  const lower = input.toLowerCase();

  // 1. Transparent
  if (lower === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // 2. CurrentColor
  if (lower === 'currentcolor') {
    if (context?.currentColor) {
      return { ...context.currentColor };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
  }

  // 3. Named Colors
  const namedHex = NAMED_COLORS[lower];
  if (namedHex) {
    return parseHexColor(namedHex);
  }

  // 4. Hex
  if (input.startsWith('#')) {
    return parseHexColor(input);
  }

  // 5. RGB / RGBA
  if (lower.startsWith('rgb(') || lower.startsWith('rgba(')) {
    return parseRgbColor(input);
  }

  // 6. HSL / HSLA
  if (lower.startsWith('hsl(') || lower.startsWith('hsla(')) {
    return parseHslColor(input);
  }

  // 7. color(srgb ...)
  if (lower.startsWith('color(srgb')) {
    return parseColorFunction(input);
  }

  return null;
}

/**
 * Formats a NormalizedColor to a standard hex string (#RRGGBB or #RRGGBBAA).
 */
export function colorToHex(color: NormalizedColor, includeAlpha = false): string {
  const r = Math.round(clamp01(color.r) * 255).toString(16).padStart(2, '0');
  const g = Math.round(clamp01(color.g) * 255).toString(16).padStart(2, '0');
  const b = Math.round(clamp01(color.b) * 255).toString(16).padStart(2, '0');

  if (includeAlpha || color.a < 1) {
    const a = Math.round(clamp01(color.a) * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}${a}`;
  }

  return `#${r}${g}${b}`;
}

/**
 * Formats a NormalizedColor to an rgba(r, g, b, a) CSS string.
 */
export function colorToRgbaString(color: NormalizedColor): string {
  const r = Math.round(clamp01(color.r) * 255);
  const g = Math.round(clamp01(color.g) * 255);
  const b = Math.round(clamp01(color.b) * 255);
  const a = Math.round(clamp01(color.a) * 1000) / 1000;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Checks whether two colors are equivalent within an epsilon tolerance.
 */
export function colorEquals(
  c1: NormalizedColor,
  c2: NormalizedColor,
  tolerance = 0.005
): boolean {
  return (
    Math.abs(c1.r - c2.r) <= tolerance &&
    Math.abs(c1.g - c2.g) <= tolerance &&
    Math.abs(c1.b - c2.b) <= tolerance &&
    Math.abs(c1.a - c2.a) <= tolerance
  );
}
