/**
 * Route filtering engine with presets, safe regex matching, and category management.
 */

import { DiscoveredRoute, matchesPathPattern, isDestructiveRoute } from './crawl-scope';
import { RouteCategory } from './route-categorizer';

export interface PresetFilter {
  id: string;
  label: string;
  pattern: string;
}

export const PRESET_FILTERS: readonly PresetFilter[] = [
  { id: 'blog', label: 'Blog & Articles', pattern: '/blog/*' },
  { id: 'products', label: 'Products', pattern: '/products/*' },
  { id: 'docs', label: 'Documentation', pattern: '/docs/*' },
  { id: 'pricing', label: 'Pricing', pattern: '/pricing*' },
  { id: 'about', label: 'About', pattern: '/about*' }
] as const;

export interface RegexValidationResult {
  isValid: boolean;
  error?: string | undefined;
  regex?: RegExp | undefined;
}

export interface RouteFilterOptions {
  searchQuery?: string | undefined;
  activePresetIds?: string[] | undefined;
  customIncludePatterns?: string[] | undefined;
  customExcludePatterns?: string[] | undefined;
  customRegexPattern?: string | undefined;
  excludeDestructive?: boolean | undefined; // default true
  selectedCategories?: RouteCategory[] | undefined;
  categoryOverrides?: Record<string, RouteCategory> | undefined;
}

/**
 * Validates and compiles a user regex string safely.
 * Rejects excessively long or dangerous exponential patterns to prevent UI freezes.
 */
export function compileSafeUserRegex(patternStr: string): RegexValidationResult {
  const trimmed = patternStr.trim();
  if (!trimmed) {
    return { isValid: true };
  }

  // Length limit guard
  if (trimmed.length > 200) {
    return {
      isValid: false,
      error: 'Regular expression exceeds maximum allowed length (200 characters).'
    };
  }

  // Dangerous nested quantifier patterns prone to ReDoS
  const nestedGroupQuantifier = /\([^)]*[\+\*][^)]*\)[\+\*]/;
  const consecutiveQuantifiers = /(\+|\*|\{[0-9]+,[0-9]*\})\s*(\+|\*|\{[0-9]+,[0-9]*\})/;

  if (nestedGroupQuantifier.test(trimmed) || consecutiveQuantifiers.test(trimmed)) {
    return {
      isValid: false,
      error: 'Dangerous nested quantifiers detected that could freeze the browser.'
    };
  }

  try {
    const regex = new RegExp(trimmed, 'i');
    return { isValid: true, regex };
  } catch (err) {
    return {
      isValid: false,
      error: err instanceof Error ? err.message : 'Invalid regular expression syntax.'
    };
  }
}

/**
 * Applies search, preset path filters, exclude rules, category filters, and regex matching.
 */
export function filterRoutes(
  routes: readonly DiscoveredRoute[],
  options: RouteFilterOptions
): DiscoveredRoute[] {
  const excludeDestructive = options.excludeDestructive ?? true;
  const search = options.searchQuery?.trim().toLowerCase() || '';

  // Gather active include patterns from active presets + custom include patterns
  const activeIncludePatterns: string[] = [];
  if (options.activePresetIds && options.activePresetIds.length > 0) {
    for (const presetId of options.activePresetIds) {
      const preset = PRESET_FILTERS.find((p) => p.id === presetId);
      if (preset) {
        activeIncludePatterns.push(preset.pattern);
      }
    }
  }
  if (options.customIncludePatterns) {
    activeIncludePatterns.push(...options.customIncludePatterns);
  }

  const excludePatterns = options.customExcludePatterns || [];

  // Compile regex if supplied
  let compiledRegex: RegExp | undefined;
  if (options.customRegexPattern) {
    const regexRes = compileSafeUserRegex(options.customRegexPattern);
    if (regexRes.isValid && regexRes.regex) {
      compiledRegex = regexRes.regex;
    }
  }

  return routes.filter((route) => {
    // 1. Destructive routes filter
    if (excludeDestructive && (route.isDestructive || isDestructiveRoute(route.pathname))) {
      return false;
    }

    // 2. Category overrides and filtering
    const effectiveCategory =
      options.categoryOverrides?.[route.canonicalUrl] ?? route.category;

    if (
      options.selectedCategories &&
      options.selectedCategories.length > 0 &&
      !options.selectedCategories.includes(effectiveCategory)
    ) {
      return false;
    }

    // 3. Search query matching
    if (search) {
      const titleMatch = route.title?.toLowerCase().includes(search);
      const pathMatch = route.pathname.toLowerCase().includes(search);
      const urlMatch = route.originalUrl.toLowerCase().includes(search);
      const navMatch = route.navigationLabel?.toLowerCase().includes(search);
      if (!titleMatch && !pathMatch && !urlMatch && !navMatch) {
        return false;
      }
    }

    // 4. Include patterns (presets & custom)
    if (activeIncludePatterns.length > 0) {
      const matched = activeIncludePatterns.some((pattern) =>
        matchesPathPattern(route.pathname, pattern)
      );
      if (!matched) {
        return false;
      }
    }

    // 5. Exclude patterns
    if (excludePatterns.length > 0) {
      const isExcluded = excludePatterns.some((pattern) =>
        matchesPathPattern(route.pathname, pattern)
      );
      if (isExcluded) {
        return false;
      }
    }

    // 6. User regex filter
    if (compiledRegex) {
      if (!compiledRegex.test(route.pathname) && !compiledRegex.test(route.originalUrl)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Reassigns the category of a route without altering its original URL or metadata.
 */
export function reassignRouteCategory(
  route: DiscoveredRoute,
  newCategory: RouteCategory
): DiscoveredRoute {
  return {
    ...route,
    category: newCategory
  };
}

/**
 * Merges multiple source categories into a target category across a route list.
 */
export function mergeCategories(
  routes: readonly DiscoveredRoute[],
  sourceCategories: readonly RouteCategory[],
  targetCategory: RouteCategory
): DiscoveredRoute[] {
  const sourceSet = new Set(sourceCategories);
  return routes.map((r) => {
    if (sourceSet.has(r.category)) {
      return { ...r, category: targetCategory };
    }
    return r;
  });
}
