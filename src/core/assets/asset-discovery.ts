/**
 * Multi-Source Asset Discovery Engine.
 * Extracts visual asset references from img (currentSrc, srcset), picture/source,
 * multi-layered CSS background-image declarations, and inline SVG elements.
 * Handles data: URLs locally and rejects dangerous URL schemes (javascript:).
 */

export type DiscoveredAssetKind =
  | 'image-bitmap'
  | 'image-svg'
  | 'css-background'
  | 'canvas';

export interface DiscoveredAsset {
  rawUrl: string;
  normalizedUrl: string;
  kind: DiscoveredAssetKind;
  sourceTag: string;
  isInlineData: boolean;
  altText?: string | undefined;
  intrinsicWidth?: number | undefined;
  intrinsicHeight?: number | undefined;
  aspectRatio?: number | undefined;
  objectFit?: string | undefined;
  objectPosition?: string | undefined;
  svgContent?: string | undefined;
}

const DANGEROUS_SCHEMES = ['javascript:', 'vbscript:', 'file:'];

/**
 * Normalizes an asset URL against document origin or custom base URI.
 * Preserves inline data: URLs directly.
 */
export function normalizeAssetUrl(rawUrl: string, baseHref?: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const lower = trimmed.toLowerCase();
  for (const scheme of DANGEROUS_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return null;
    }
  }

  // Preserve inline data: URLs without resolution
  if (lower.startsWith('data:')) {
    return trimmed;
  }

  try {
    const base = baseHref || (typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const resolved = new URL(trimmed, base);
    return resolved.href;
  } catch {
    return null;
  }
}

/**
 * Parses CSS background-image declarations, extracting all url(...) layers.
 * Handles single-quoted, double-quoted, unquoted URLs, and comma-separated layers.
 * Skips CSS gradients (linear-gradient, radial-gradient, etc.) and dangerous schemes.
 */
export function parseCssBackgroundUrls(computedBg: string): string[] {
  if (!computedBg || computedBg === 'none') {
    return [];
  }

  const urls: string[] = [];
  // Regular expression matching url(...) with optional quotes
  const urlRegex = /url\(\s*(?:['"]([^'"]+)['"]|([^'")]+))\s*\)/gi;

  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(computedBg)) !== null) {
    const raw = (match[1] || match[2] || '').trim();
    if (raw) {
      const normalized = normalizeAssetUrl(raw);
      if (normalized) {
        urls.push(normalized);
      }
    }
  }

  return urls;
}

/**
 * Parses responsive srcset attribute into individual candidate URLs.
 */
export function parseSrcset(srcset: string): string[] {
  if (!srcset || !srcset.trim()) return [];

  const candidates: string[] = [];
  // Split on commas not enclosed in quotes or parens
  const parts = srcset.split(/,\s+/);

  for (const part of parts) {
    const tokens = part.trim().split(/\s+/);
    const candidateUrl = tokens[0]?.trim();
    if (candidateUrl) {
      const normalized = normalizeAssetUrl(candidateUrl);
      if (normalized && !candidates.includes(normalized)) {
        candidates.push(normalized);
      }
    }
  }

  return candidates;
}

/**
 * Discovers all asset references embedded in or applied to an individual DOM element.
 */
export function discoverElementAssets(
  element: Element,
  computedStyle?: CSSStyleDeclaration | Record<string, string>
): DiscoveredAsset[] {
  const assets: DiscoveredAsset[] = [];
  const tagName = element.tagName.toLowerCase();

  // 1. HTMLImageElement: img
  if (tagName === 'img') {
    const img = element as HTMLImageElement;
    // Prefer browser-selected currentSrc, fallback to src
    const rawSrc = img.currentSrc || img.getAttribute('src') || '';
    const normalized = normalizeAssetUrl(rawSrc);

    if (normalized) {
      const naturalWidth = img.naturalWidth || parseFloat(img.getAttribute('width') || '0') || undefined;
      const naturalHeight = img.naturalHeight || parseFloat(img.getAttribute('height') || '0') || undefined;
      let aspectRatio: number | undefined;
      if (naturalWidth && naturalHeight && naturalHeight > 0) {
        aspectRatio = Math.round((naturalWidth / naturalHeight) * 1000) / 1000;
      }

      const altText = img.getAttribute('alt')?.trim() || undefined;
      const style = computedStyle as any;

      assets.push({
        rawUrl: rawSrc,
        normalizedUrl: normalized,
        kind: 'image-bitmap',
        sourceTag: 'img',
        isInlineData: normalized.startsWith('data:'),
        altText,
        intrinsicWidth: naturalWidth,
        intrinsicHeight: naturalHeight,
        aspectRatio,
        objectFit: style?.objectFit,
        objectPosition: style?.objectPosition
      });
    }

    // Also collect responsive srcset candidates if distinct
    const srcset = img.getAttribute('srcset');
    if (srcset) {
      const candidates = parseSrcset(srcset);
      for (const candidate of candidates) {
        if (!assets.some((a) => a.normalizedUrl === candidate)) {
          assets.push({
            rawUrl: candidate,
            normalizedUrl: candidate,
            kind: 'image-bitmap',
            sourceTag: 'img',
            isInlineData: candidate.startsWith('data:')
          });
        }
      }
    }
  }

  // 2. Picture element: inspect <source srcset="...">
  if (tagName === 'picture') {
    const sources = element.querySelectorAll('source');
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      if (source) {
        const srcset = source.getAttribute('srcset');
        if (srcset) {
          const candidates = parseSrcset(srcset);
          for (const candidate of candidates) {
            if (!assets.some((a) => a.normalizedUrl === candidate)) {
              assets.push({
                rawUrl: candidate,
                normalizedUrl: candidate,
                kind: 'image-bitmap',
                sourceTag: 'source',
                isInlineData: candidate.startsWith('data:')
              });
            }
          }
        }
      }
    }
  }

  // 3. Inline SVG Element: <svg>
  if (tagName === 'svg') {
    const svgMarkup = element.outerHTML;
    assets.push({
      rawUrl: 'inline-svg',
      normalizedUrl: `inline-svg-${assets.length + 1}`,
      kind: 'image-svg',
      sourceTag: 'svg',
      isInlineData: true,
      svgContent: svgMarkup
    });
  }

  // 4. CSS background-image
  if (computedStyle) {
    const bg = (computedStyle as any).backgroundImage;
    if (bg && bg !== 'none') {
      const urls = parseCssBackgroundUrls(bg);
      for (const url of urls) {
        assets.push({
          rawUrl: url,
          normalizedUrl: url,
          kind: 'css-background',
          sourceTag: tagName,
          isInlineData: url.startsWith('data:')
        });
      }
    }
  }

  return assets;
}
