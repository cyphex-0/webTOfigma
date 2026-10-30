/**
 * Strict SVG XML Parser & Security Sanitizer.
 * Neutralizes XSS vectors, executable scripts, event handlers, and foreign objects
 * while preserving safe vector geometry (viewBox, path d, fills, strokes, transforms).
 */

export interface SvgVectorPath {
  d: string;
  fill?: string | undefined;
  stroke?: string | undefined;
  strokeWidth?: number | undefined;
  opacity?: number | undefined;
  transform?: string | undefined;
}

export interface SvgVectorData {
  viewBox?: { x: number; y: number; width: number; height: number } | undefined;
  width?: number | undefined;
  height?: number | undefined;
  paths: SvgVectorPath[];
}

export interface SvgSanitizationResult {
  isSafe: boolean;
  sanitizedSvg: string;
  vectorData?: SvgVectorData | undefined;
  hasUnsupportedFeatures: boolean;
  diagnostics: string[];
}

const FORBIDDEN_TAGS = new Set([
  'script',
  'foreignobject',
  'iframe',
  'object',
  'embed',
  'audio',
  'video',
  'link',
  'meta'
]);

/**
 * Parses a viewBox string "x y w h" or "x, y, w, h" into structured dimensions.
 */
export function parseViewBox(raw: string): { x: number; y: number; width: number; height: number } | null {
  if (!raw) return null;
  const parts = raw.trim().split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    const [x = 0, y = 0, width = 0, height = 0] = parts;
    return { x, y, width, height };
  }
  return null;
}

/**
 * Converts basic SVG shapes (rect, circle, line) into approximate path 'd' strings
 * for universal vector translation.
 */
export function shapeToPathD(element: Element): string | null {
  const tag = element.tagName.toLowerCase();

  if (tag === 'path') {
    return element.getAttribute('d')?.trim() || null;
  }

  if (tag === 'rect') {
    const x = parseFloat(element.getAttribute('x') || '0');
    const y = parseFloat(element.getAttribute('y') || '0');
    const w = parseFloat(element.getAttribute('width') || '0');
    const h = parseFloat(element.getAttribute('height') || '0');
    if (w > 0 && h > 0) {
      return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    }
  }

  if (tag === 'circle') {
    const cx = parseFloat(element.getAttribute('cx') || '0');
    const cy = parseFloat(element.getAttribute('cy') || '0');
    const r = parseFloat(element.getAttribute('r') || '0');
    if (r > 0) {
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
  }

  if (tag === 'line') {
    const x1 = parseFloat(element.getAttribute('x1') || '0');
    const y1 = parseFloat(element.getAttribute('y1') || '0');
    const x2 = parseFloat(element.getAttribute('x2') || '0');
    const y2 = parseFloat(element.getAttribute('y2') || '0');
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  if (tag === 'polyline' || tag === 'polygon') {
    const pointsStr = element.getAttribute('points')?.trim();
    if (pointsStr) {
      const coords = pointsStr.split(/[\s,]+/).map(Number);
      if (coords.length >= 4) {
        let d = `M ${coords[0]} ${coords[1]}`;
        for (let i = 2; i < coords.length; i += 2) {
          if (coords[i] !== undefined && coords[i + 1] !== undefined) {
            d += ` L ${coords[i]} ${coords[i + 1]}`;
          }
        }
        if (tag === 'polygon') d += ' Z';
        return d;
      }
    }
  }

  return null;
}

/**
 * Sanitizes an SVG markup string and extracts vector path and geometry definitions.
 */
export function sanitizeSvgMarkup(rawSvg: string): SvgSanitizationResult {
  const diagnostics: string[] = [];

  if (!rawSvg || !rawSvg.trim()) {
    return {
      isSafe: false,
      sanitizedSvg: '',
      hasUnsupportedFeatures: false,
      diagnostics: ['SVG_EMPTY_MARKUP']
    };
  }

  // Parse using standard DOMParser in XML mode
  const parser = new DOMParser();
  const doc = parser.parseFromString(rawSvg, 'image/svg+xml');

  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    return {
      isSafe: false,
      sanitizedSvg: '',
      hasUnsupportedFeatures: false,
      diagnostics: ['SVG_XML_PARSE_ERROR']
    };
  }

  const svgRoot = doc.querySelector('svg');
  if (!svgRoot) {
    return {
      isSafe: false,
      sanitizedSvg: '',
      hasUnsupportedFeatures: false,
      diagnostics: ['SVG_ROOT_ELEMENT_MISSING']
    };
  }

  let hasUnsupportedFeatures = false;

  // 1. Traverse and sanitize all descendant nodes
  const allElements = Array.from(svgRoot.querySelectorAll('*'));
  for (const el of allElements) {
    const tag = el.tagName.toLowerCase();

    // Check for forbidden tags
    if (FORBIDDEN_TAGS.has(tag)) {
      diagnostics.push(`SVG_STRIPPED_TAG: <${tag}>`);
      el.remove();
      continue;
    }

    // Check for forbidden or dangerous attributes
    const attrNames = el.getAttributeNames();
    for (const attr of attrNames) {
      const lowerAttr = attr.toLowerCase();
      const val = el.getAttribute(attr) || '';
      const lowerVal = val.toLowerCase().trim();

      // Strip on* event handlers (onclick, onload, onerror)
      if (lowerAttr.startsWith('on')) {
        diagnostics.push(`SVG_STRIPPED_EVENT_HANDLER: ${attr}`);
        el.removeAttribute(attr);
        continue;
      }

      // Check for dangerous URL schemes in href / xlink:href / src
      if (lowerAttr === 'href' || lowerAttr === 'xlink:href' || lowerAttr === 'src') {
        if (lowerVal.startsWith('javascript:') || lowerVal.startsWith('vbscript:') || lowerVal.startsWith('data:text/html')) {
          diagnostics.push(`SVG_STRIPPED_DANGEROUS_HREF: ${val}`);
          el.removeAttribute(attr);
          continue;
        }
      }
    }

    // Flag complex filters
    if (tag === 'fedisplacementmap' || tag === 'feturbulence') {
      hasUnsupportedFeatures = true;
      diagnostics.push(`SVG_UNSUPPORTED_FILTER: <${tag}>`);
    }
  }

  // 2. Extract Vector Data (viewBox, dimensions, paths)
  const viewBoxStr = svgRoot.getAttribute('viewBox');
  const viewBox = viewBoxStr ? parseViewBox(viewBoxStr) || undefined : undefined;
  const widthAttr = parseFloat(svgRoot.getAttribute('width') || '0') || undefined;
  const heightAttr = parseFloat(svgRoot.getAttribute('height') || '0') || undefined;

  const vectorPaths: SvgVectorPath[] = [];
  const candidateElements = Array.from(svgRoot.querySelectorAll('path, rect, circle, line, polyline, polygon'));

  for (const el of candidateElements) {
    const d = shapeToPathD(el);
    if (d) {
      const fill = el.getAttribute('fill') || undefined;
      const stroke = el.getAttribute('stroke') || undefined;
      const strokeWidthAttr = el.getAttribute('stroke-width');
      const strokeWidth = strokeWidthAttr ? parseFloat(strokeWidthAttr) || undefined : undefined;
      const opacityAttr = el.getAttribute('opacity');
      const opacity = opacityAttr ? parseFloat(opacityAttr) || undefined : undefined;
      const transform = el.getAttribute('transform') || undefined;

      vectorPaths.push({
        d,
        fill,
        stroke,
        strokeWidth,
        opacity,
        transform
      });
    }
  }

  const vectorData: SvgVectorData = {
    viewBox,
    width: widthAttr ?? viewBox?.width,
    height: heightAttr ?? viewBox?.height,
    paths: vectorPaths
  };

  // 3. Serialize sanitized markup back to string
  const serializer = new XMLSerializer();
  const sanitizedSvg = serializer.serializeToString(svgRoot);

  return {
    isSafe: true,
    sanitizedSvg,
    vectorData,
    hasUnsupportedFeatures,
    diagnostics
  };
}
