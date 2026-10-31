/**
 * Responsive Viewport Profiles and Breakpoint Definitions.
 * 
 * Defines standard responsive profiles (Desktop 1440, Tablet 768, Mobile 375)
 * with strict measured viewport verification:
 * - A capture is only attributed to a breakpoint if actual measured window.innerWidth
 *   matches within a documented tolerance (e.g. +-16 px).
 * - Never calls a viewport "virtual" or claims a 1365 px capture is 1440 px.
 */

export interface ResponsiveBreakpoint {
  id: 'desktop' | 'tablet' | 'mobile' | string;
  name: string;
  targetWidth: number;
  tolerancePx: number;
  minHeight?: number | undefined;
}

export const DEFAULT_VIEWPORT_TOLERANCE_PX = 16;

export const STANDARD_RESPONSIVE_BREAKPOINTS: Record<'desktop' | 'tablet' | 'mobile', ResponsiveBreakpoint> = {
  desktop: {
    id: 'desktop',
    name: 'Desktop',
    targetWidth: 1440,
    tolerancePx: DEFAULT_VIEWPORT_TOLERANCE_PX,
    minHeight: 900
  },
  tablet: {
    id: 'tablet',
    name: 'Tablet',
    targetWidth: 768,
    tolerancePx: DEFAULT_VIEWPORT_TOLERANCE_PX,
    minHeight: 1024
  },
  mobile: {
    id: 'mobile',
    name: 'Mobile',
    targetWidth: 375,
    tolerancePx: DEFAULT_VIEWPORT_TOLERANCE_PX,
    minHeight: 667
  }
};

/**
 * Matches an actual measured viewport width to a registered responsive breakpoint within tolerance.
 */
export function matchResponsiveBreakpoint(
  actualWidth: number,
  breakpoints: readonly ResponsiveBreakpoint[] = Object.values(STANDARD_RESPONSIVE_BREAKPOINTS)
): ResponsiveBreakpoint | null {
  for (const bp of breakpoints) {
    const diff = Math.abs(actualWidth - bp.targetWidth);
    if (diff <= bp.tolerancePx) {
      return bp;
    }
  }
  return null;
}

/**
 * Generates clear, honest naming for responsive variant frames:
 * E.g., "01 - Home - Desktop 1440" or "01 - Home - Mobile 375" (or "(376px)" if slightly off exact target).
 */
export function formatResponsiveVariantName(
  routeIndex: number,
  routeTitle: string,
  breakpoint: ResponsiveBreakpoint,
  actualWidth: number
): string {
  const paddedIndex = String(routeIndex).padStart(2, '0');
  const cleanTitle = routeTitle.trim() || 'Untitled';
  
  if (actualWidth === breakpoint.targetWidth) {
    return `${paddedIndex} - ${cleanTitle} - ${breakpoint.name} ${breakpoint.targetWidth}`;
  }

  return `${paddedIndex} - ${cleanTitle} - ${breakpoint.name} ${breakpoint.targetWidth} (${actualWidth}px)`;
}
