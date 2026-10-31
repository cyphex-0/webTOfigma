/**
 * Name Sanitizer and Title Disambiguator for Scene Frames and Layers.
 * 
 * Enforces standardized naming policy:
 * - Top-level page frames: `[Index] - [Page Title] - [Path]`
 * - Control character stripping (ASCII & Unicode control codes)
 * - Safe length truncation without splitting surrogate pairs
 * - Duplicate title disambiguation using path and stable global index
 * - Semantic layer name sanitization preventing CSS class dumps
 */

const CONTROL_CHARS_REGEX = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF\u200E\u200F]/g;
const TAILWIND_CLASS_PATTERN = /^(?:(?:sm|md|lg|xl|2xl|hover|focus|active|disabled):)?(?:flex|grid|block|hidden|relative|absolute|fixed|p-\d+|m-\d+|w-\d+|h-\d+|text-[a-z0-9]+|bg-[a-z0-9]+|rounded-[a-z0-9]+|border-[a-z0-9]+)(?:\s+|$)/i;

export interface SanitizeOptions {
  maxLength?: number | undefined;
  fallback?: string | undefined;
  allowNewlines?: boolean | undefined;
}

/**
 * Strips ASCII and Unicode control characters, normalizes whitespace, and clamps length safely.
 */
export function sanitizeString(input: string, options: SanitizeOptions = {}): string {
  if (!input) {
    return options.fallback ?? '';
  }

  // 1. Remove control codes
  let cleaned = input.replace(CONTROL_CHARS_REGEX, '');

  // 2. Normalize whitespace
  if (options.allowNewlines) {
    cleaned = cleaned.replace(/[^\S\r\n]+/g, ' ').replace(/\n\s*\n/g, '\n');
  } else {
    cleaned = cleaned.replace(/\s+/g, ' ');
  }

  cleaned = cleaned.trim();

  if (cleaned.length === 0) {
    return options.fallback ?? '';
  }

  // 3. Truncate safely without slicing surrogate pairs
  const maxLength = options.maxLength;
  if (maxLength !== undefined && maxLength > 0 && cleaned.length > maxLength) {
    const chars = Array.from(cleaned);
    if (chars.length > maxLength) {
      cleaned = chars.slice(0, maxLength - 1).join('').trim() + '…';
    }
  }

  return cleaned;
}

/**
 * Sanitizes a page title string, removing control characters and bounding length.
 */
export function sanitizePageTitle(title?: string | null, maxLength: number = 80): string {
  if (!title) {
    return 'Untitled';
  }
  return sanitizeString(title, { maxLength, fallback: 'Untitled' });
}

/**
 * Extracts and normalizes the URL pathname for the page frame name.
 */
export function normalizePathSlug(rawUrlOrPath?: string | null): string {
  if (!rawUrlOrPath) {
    return '/';
  }

  let pathname = '';
  try {
    const parsed = new URL(rawUrlOrPath, 'https://example.com');
    pathname = parsed.pathname;
  } catch {
    const match = rawUrlOrPath.match(/^(?:https?:\/\/[^/]+)?(\/[^?#]*)?/i);
    pathname = match && match[1] ? match[1] : rawUrlOrPath;
  }

  if (!pathname || pathname === '') {
    return '/';
  }

  // Clean trailing slash if not root
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  return sanitizeString(pathname, { maxLength: 60, fallback: '/' });
}

export interface FormatFrameNameOptions {
  separator?: string | undefined; // Default ' - '
  maxLength?: number | undefined;
}

/**
 * Formats the standardized top-level Page Frame name:
 * `[Index] - [Page Title] - [Path]`
 * 
 * Example: `01 - Pricing Plans - /pricing`
 */
export function formatPageFrameName(
  index: number,
  title: string,
  urlOrPath: string,
  options: FormatFrameNameOptions = {}
): string {
  const separator = options.separator ?? ' - ';
  const formattedIndex = String(Math.max(1, index)).padStart(2, '0');
  const cleanTitle = sanitizePageTitle(title, 70);
  const cleanPath = normalizePathSlug(urlOrPath);

  const rawName = `${formattedIndex}${separator}${cleanTitle}${separator}${cleanPath}`;
  if (options.maxLength && rawName.length > options.maxLength) {
    return sanitizeString(rawName, { maxLength: options.maxLength });
  }
  return rawName;
}

/**
 * Disambiguates a collection of page frame names to guarantee absolute uniqueness.
 * If two pages have the exact same title and path, appends a stable sequence counter.
 */
export function disambiguatePageNames(
  pages: Array<{ index: number; title: string; url: string }>
): string[] {
  const formattedNames = pages.map((p) => formatPageFrameName(p.index, p.title, p.url));
  const counts = new Map<string, number>();

  for (const name of formattedNames) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  const seen = new Map<string, number>();
  return formattedNames.map((name) => {
    const total = counts.get(name) ?? 1;
    if (total <= 1) {
      return name;
    }
    const occurrence = (seen.get(name) ?? 0) + 1;
    seen.set(name, occurrence);
    return `${name} (${occurrence})`;
  });
}

/**
 * Sanitizes internal child layer names, stripping utility class dumps and control characters.
 */
export function sanitizeLayerName(name?: string | null, fallback: string = 'Layer'): string {
  if (!name || name.trim() === '') {
    return fallback;
  }

  const trimmed = name.trim();

  // Detect Tailwind or atomic utility class dumps (e.g. "flex flex-col items-center justify-between p-4")
  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 3 && tokens.some((t) => TAILWIND_CLASS_PATTERN.test(t))) {
    return fallback;
  }

  // Reject generic "Frame 1" or anonymous wrappers if fallback is more descriptive
  if (/^Frame\s*\d+$/i.test(trimmed) && fallback !== 'Layer') {
    return fallback;
  }

  return sanitizeString(trimmed, { maxLength: 60, fallback });
}
