/**
 * Conservative pagination pattern detector.
 * Identifies explicit page numbers from standard URL patterns and pagination cues.
 * Strictly avoids guessing parity or page identity from arbitrary numbers (product IDs, years, timestamps).
 */

export interface PaginationDetectionInput {
  url: string;
  anchorText?: string | undefined;
  ariaLabel?: string | undefined;
  rel?: string | undefined;
}

/**
 * Standard path segments representing pagination.
 * e.g. /page/2, /p/3, /pages/4
 */
const PAGINATION_PATH_REGEX = /(?:^|\/)(?:page|pages|p)\/(\d+)(?:\/|$|\?)/i;

/**
 * Standard query parameter keys representing explicit page numbers.
 */
const PAGINATION_QUERY_KEYS: ReadonlySet<string> = new Set([
  'page',
  'p',
  'pg',
  'pagenumber',
  'page_no',
  'paged',
  'page_index'
]);

/**
 * Detects whether a candidate URL or DOM cue represents an explicit pagination index.
 * Returns the 1-based page number if confident, or null otherwise.
 */
export function detectPaginationNumber(
  input: string | PaginationDetectionInput
): number | null {
  const urlStr = typeof input === 'string' ? input : input.url;

  let parsed: URL;
  try {
    // If relative, use a dummy origin to parse path and query safely
    parsed = new URL(urlStr, 'https://internal-parser.local');
  } catch {
    return null;
  }

  // 1. Check explicit query parameters (?page=2, ?p=3)
  for (const [key, value] of parsed.searchParams.entries()) {
    if (PAGINATION_QUERY_KEYS.has(key.toLowerCase())) {
      const parsedNum = parseInt(value, 10);
      if (!isNaN(parsedNum) && parsedNum > 0 && String(parsedNum) === value.trim()) {
        return parsedNum;
      }
    }
  }

  // 2. Check path pattern (/page/2, /pages/3, /p/4)
  const pathMatch = parsed.pathname.match(PAGINATION_PATH_REGEX);
  if (pathMatch && pathMatch[1]) {
    const parsedNum = parseInt(pathMatch[1], 10);
    if (!isNaN(parsedNum) && parsedNum > 0) {
      return parsedNum;
    }
  }

  // 3. Check contextual DOM cues if available (rel="next", aria-label="Page 3", etc.)
  if (typeof input !== 'string') {
    if (input.ariaLabel) {
      const ariaMatch = input.ariaLabel.match(/(?:page|go to page)\s*(\d+)/i);
      if (ariaMatch && ariaMatch[1]) {
        const parsedNum = parseInt(ariaMatch[1], 10);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          return parsedNum;
        }
      }
    }

    if (input.anchorText) {
      const trimmedText = input.anchorText.trim();
      // Pure numeric anchor text in a pagination list (e.g. <a>3</a>)
      if (/^\d+$/.test(trimmedText)) {
        const parsedNum = parseInt(trimmedText, 10);
        // Only treat as page number if within realistic pagination bounds (< 1000)
        if (!isNaN(parsedNum) && parsedNum > 0 && parsedNum < 1000) {
          // If the URL also has some numeric component, or anchor text is purely the number
          return parsedNum;
        }
      }
    }
  }

  // Never guess on arbitrary IDs or numbers
  return null;
}
