import { describe, it, expect } from 'vitest';
import {
  STANDARD_RESPONSIVE_BREAKPOINTS,
  matchResponsiveBreakpoint,
  formatResponsiveVariantName
} from '../../core/capture/responsive-profile';
import {
  measureWindowViewport,
  verifyBreakpointAvailability,
  filterAvailableBreakpoints
} from '../../core/capture/viewport-verification';

describe('Responsive Profile & Viewport Verification (Phase 21)', () => {
  describe('Breakpoint Matching & Tolerances', () => {
    it('matches exact standard breakpoints', () => {
      const desktop = matchResponsiveBreakpoint(1440);
      expect(desktop?.id).toBe('desktop');
      expect(desktop?.name).toBe('Desktop');

      const tablet = matchResponsiveBreakpoint(768);
      expect(tablet?.id).toBe('tablet');

      const mobile = matchResponsiveBreakpoint(375);
      expect(mobile?.id).toBe('mobile');
    });

    it('matches within allowable +-16 px tolerance', () => {
      const toleratedDesktop = matchResponsiveBreakpoint(1435);
      expect(toleratedDesktop?.id).toBe('desktop');

      const toleratedMobile = matchResponsiveBreakpoint(380);
      expect(toleratedMobile?.id).toBe('mobile');
    });

    it('rejects viewport widths exceeding tolerance and never mislabels', () => {
      // 1365 px is a common laptop width; must NOT be falsely identified as 1440 px desktop
      const laptop = matchResponsiveBreakpoint(1365);
      expect(laptop).toBeNull();

      const narrowTablet = matchResponsiveBreakpoint(600);
      expect(narrowTablet).toBeNull();
    });
  });

  describe('Variant Naming', () => {
    it('formats exact breakpoint variant names cleanly', () => {
      const name = formatResponsiveVariantName(
        1,
        'Home',
        STANDARD_RESPONSIVE_BREAKPOINTS.desktop,
        1440
      );
      expect(name).toBe('01 - Home - Desktop 1440');
    });

    it('formats variant names with actual width if slightly off exact target', () => {
      const name = formatResponsiveVariantName(
        2,
        'Pricing',
        STANDARD_RESPONSIVE_BREAKPOINTS.mobile,
        378
      );
      expect(name).toBe('02 - Pricing - Mobile 375 (378px)');
    });
  });

  describe('Breakpoint Verification Guard', () => {
    it('marks exact and tolerated viewports as available', () => {
      const res = verifyBreakpointAvailability(
        { width: 1440, height: 900, devicePixelRatio: 1 },
        STANDARD_RESPONSIVE_BREAKPOINTS.desktop
      );
      expect(res.isAvailable).toBe(true);
      expect(res.isExactMatch).toBe(true);
      expect(res.diagnostic).toBeUndefined();
    });

    it('marks mismatched viewports as unavailable with BREAKPOINT_UNAVAILABLE diagnostic', () => {
      const res = verifyBreakpointAvailability(
        { width: 1365, height: 768, devicePixelRatio: 1 },
        STANDARD_RESPONSIVE_BREAKPOINTS.desktop
      );
      expect(res.isAvailable).toBe(false);
      expect(res.diagnostic).toBeDefined();
      expect(res.diagnostic?.code).toBe('BREAKPOINT_UNAVAILABLE');
      expect(res.diagnostic?.message).toContain('1365px');
    });

    it('filters multiple requested breakpoints and collects diagnostics for missing sizes', () => {
      const measured = { width: 375, height: 667, devicePixelRatio: 2 };
      const requested = [
        STANDARD_RESPONSIVE_BREAKPOINTS.desktop,
        STANDARD_RESPONSIVE_BREAKPOINTS.tablet,
        STANDARD_RESPONSIVE_BREAKPOINTS.mobile
      ];

      const filtered = filterAvailableBreakpoints(measured, requested);
      expect(filtered.available).toHaveLength(1);
      expect(filtered.available[0]?.requestedBreakpoint.id).toBe('mobile');

      expect(filtered.unavailable).toHaveLength(2);
      expect(filtered.diagnostics).toHaveLength(2);
      expect(filtered.diagnostics.every((d) => d.code === 'BREAKPOINT_UNAVAILABLE')).toBe(true);
    });
  });
});
