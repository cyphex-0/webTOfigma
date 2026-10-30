/**
 * Visibility Filtering and Pruning Engine.
 * Evaluates DOM computed styles, geometric bounds, non-rendered tags,
 * and extension exclusion attributes to determine layer visibility.
 */

import type { SourceRect, VisibilityFlags } from '../../shared/contracts/source-node';

/**
 * Non-rendered HTML tags that should never be converted into visual scene nodes.
 */
export const NON_RENDERED_TAGS: ReadonlySet<string> = new Set([
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
  'NOSCRIPT',
  'META',
  'LINK',
  'HEAD',
  'TITLE',
  'PARAM',
  'SOURCE',
  'TRACK'
]);

/**
 * Checks if an element is marked for exclusion by the Web-to-Figma extension
 * (e.g. in-page minibar, capture overlays, guides).
 */
export function isExtensionExcluded(el: Element): boolean {
  if (el.getAttribute('data-w2f-exclude') === 'true') return true;
  if (el.getAttribute('data-web-to-figma-minibar') === 'true') return true;
  if (el.id === 'web-to-figma-minibar-host') return true;
  return false;
}

/**
 * Checks if a tag is a non-visual metadata or execution tag.
 */
export function isNonRenderedTag(tagName: string): boolean {
  return NON_RENDERED_TAGS.has(tagName.toUpperCase());
}

export interface VisibilityEvaluation {
  shouldPruneSubtree: boolean;
  shouldPruneElement: boolean;
  flags: VisibilityFlags;
  reason?: string;
}

/**
 * Evaluates whether an element should be included, pruned, or marked as hidden/offscreen.
 * 
 * @param el DOM Element
 * @param rect Viewport-space bounding box
 * @param style ComputedStyle declaration or snapshot
 * @param viewportWidth Visible viewport width in CSS pixels (default: window.innerWidth)
 * @param viewportHeight Visible viewport height in CSS pixels (default: window.innerHeight)
 */
export function evaluateElementVisibility(
  el: Element,
  rect: SourceRect,
  style: CSSStyleDeclaration | Record<string, string>,
  viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1440,
  viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900
): VisibilityEvaluation {
  // 1. Extension UI exclusion: prune element and entire subtree
  if (isExtensionExcluded(el)) {
    return {
      shouldPruneSubtree: true,
      shouldPruneElement: true,
      flags: { isVisible: false, isClipped: false, isOffscreen: false, opacity: 0 },
      reason: 'extension-excluded'
    };
  }

  // 2. Non-rendered metadata/script tags: prune element and entire subtree
  if (isNonRenderedTag(el.tagName)) {
    return {
      shouldPruneSubtree: true,
      shouldPruneElement: true,
      flags: { isVisible: false, isClipped: false, isOffscreen: false, opacity: 0 },
      reason: 'non-rendered-tag'
    };
  }

  const display = (style.display || '').toLowerCase();
  const visibility = (style.visibility || '').toLowerCase();
  const contentVisibility = ((style as any)['content-visibility'] || (style as any).contentVisibility || '').toLowerCase();
  const rawOpacity = parseFloat(style.opacity || '1');
  const opacity = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(1, rawOpacity)) : 1;

  // 3. display: none removes the element and all descendants from formatting
  if (display === 'none') {
    return {
      shouldPruneSubtree: true,
      shouldPruneElement: true,
      flags: { isVisible: false, isClipped: false, isOffscreen: false, opacity: 0 },
      reason: 'display-none'
    };
  }

  // 4. content-visibility: hidden skips rendering of descendants
  if (contentVisibility === 'hidden') {
    return {
      shouldPruneSubtree: true,
      shouldPruneElement: true,
      flags: { isVisible: false, isClipped: false, isOffscreen: false, opacity },
      reason: 'content-visibility-hidden'
    };
  }

  // 5. visibility: hidden / collapse makes element invisible, but descendants might override
  const isHiddenByVisibility = visibility === 'hidden' || visibility === 'collapse';

  // 6. Zero-size check: width and height are 0
  const isZeroSize = rect.width === 0 && rect.height === 0;

  // 7. Opacity 0 check
  const isZeroOpacity = opacity === 0;

  // 8. Viewport Intersection / Offscreen calculation
  const right = rect.x + rect.width;
  const bottom = rect.y + rect.height;
  const isOffscreen =
    right <= 0 ||
    rect.x >= viewportWidth ||
    bottom <= 0 ||
    rect.y >= viewportHeight;

  // 9. Clipping detection: element partially extends beyond viewport bounds
  const isPartiallyClippedByViewport =
    !isOffscreen &&
    (rect.x < 0 ||
      right > viewportWidth ||
      rect.y < 0 ||
      bottom > viewportHeight);

  const overflow = (style.overflow || '').toLowerCase();
  const isClipped = isPartiallyClippedByViewport || overflow === 'hidden' || overflow === 'clip';

  const isVisible = !isHiddenByVisibility && !isZeroOpacity && !isZeroSize;

  return {
    shouldPruneSubtree: false,
    // If element is 0-size, we don't prune subtree if it has children or visible overflow
    shouldPruneElement: isZeroSize && el.childElementCount === 0 && !el.textContent?.trim(),
    flags: {
      isVisible,
      isClipped,
      isOffscreen,
      opacity
    },
    ...(isVisible ? {} : { reason: isHiddenByVisibility ? 'visibility-hidden' : isZeroOpacity ? 'opacity-zero' : 'zero-size' })
  };
}
