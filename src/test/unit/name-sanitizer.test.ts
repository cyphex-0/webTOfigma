import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizePageTitle,
  normalizePathSlug,
  formatPageFrameName,
  disambiguatePageNames,
  sanitizeLayerName
} from '../../core/scene/name-sanitizer';

describe('NameSanitizer', () => {
  describe('sanitizeString', () => {
    it('strips ASCII control characters and zero-width spaces', () => {
      const input = 'Hello\x00\x1FWorld\u200B\uFEFF!';
      expect(sanitizeString(input)).toBe('HelloWorld!');
    });

    it('normalizes internal multi-spaces and trims ends', () => {
      const input = '   Product   Catalog   \n\t  ';
      expect(sanitizeString(input)).toBe('Product Catalog');
    });

    it('truncates safely with ellipsis when exceeding maxLength without slicing surrogates', () => {
      const input = 'This is an excessively long title for a web page that should be truncated cleanly';
      const truncated = sanitizeString(input, { maxLength: 30 });
      expect(truncated.length).toBeLessThanOrEqual(30);
      expect(truncated.endsWith('…')).toBe(true);
    });

    it('returns fallback when input is empty or solely control characters', () => {
      expect(sanitizeString('', { fallback: 'Fallback' })).toBe('Fallback');
      expect(sanitizeString('\x00\x1F', { fallback: 'Default' })).toBe('Default');
    });
  });

  describe('sanitizePageTitle', () => {
    it('returns clean title or Untitled fallback', () => {
      expect(sanitizePageTitle('Pricing Plans - Acme Corp')).toBe('Pricing Plans - Acme Corp');
      expect(sanitizePageTitle('')).toBe('Untitled');
      expect(sanitizePageTitle(null)).toBe('Untitled');
      expect(sanitizePageTitle('   ')).toBe('Untitled');
    });
  });

  describe('normalizePathSlug', () => {
    it('extracts and normalizes pathname', () => {
      expect(normalizePathSlug('https://example.com/docs/api/')).toBe('/docs/api');
      expect(normalizePathSlug('https://example.com/')).toBe('/');
      expect(normalizePathSlug('/about-us/')).toBe('/about-us');
      expect(normalizePathSlug('https://example.com/blog?page=2#top')).toBe('/blog');
    });

    it('handles root or empty gracefully', () => {
      expect(normalizePathSlug('')).toBe('/');
      expect(normalizePathSlug(null)).toBe('/');
    });
  });

  describe('formatPageFrameName', () => {
    it('formats standardized [Index] - [Page Title] - [Path]', () => {
      const name = formatPageFrameName(1, 'Home Page', 'https://example.com/');
      expect(name).toBe('01 - Home Page - /');

      const name2 = formatPageFrameName(12, 'Pricing & Features', 'https://example.com/pricing');
      expect(name2).toBe('12 - Pricing & Features - /pricing');
    });

    it('clamps index to minimum 1 and zero-pads to 2 digits', () => {
      const name = formatPageFrameName(0, 'Dashboard', '/app/dashboard');
      expect(name).toBe('01 - Dashboard - /app/dashboard');
    });
  });

  describe('disambiguatePageNames', () => {
    it('uniquely identifies pages with different paths even if titles are identical', () => {
      const pages = [
        { index: 1, title: 'Overview', url: 'https://example.com/product/overview' },
        { index: 2, title: 'Overview', url: 'https://example.com/company/overview' }
      ];
      const names = disambiguatePageNames(pages);
      expect(names).toEqual([
        '01 - Overview - /product/overview',
        '02 - Overview - /company/overview'
      ]);
    });

    it('disambiguates identical formatted names with stable sequence counter', () => {
      const pages = [
        { index: 1, title: 'Catalog', url: 'https://example.com/catalog' },
        { index: 1, title: 'Catalog', url: 'https://example.com/catalog' }
      ];
      const names = disambiguatePageNames(pages);
      expect(names).toEqual([
        '01 - Catalog - /catalog (1)',
        '01 - Catalog - /catalog (2)'
      ]);
    });
  });

  describe('sanitizeLayerName', () => {
    it('replaces utility class dumps with fallback', () => {
      const dump = 'flex flex-col items-center justify-between p-4 bg-white';
      expect(sanitizeLayerName(dump, 'Card Container')).toBe('Card Container');
    });

    it('replaces generic Frame 1 with fallback if available', () => {
      expect(sanitizeLayerName('Frame 1', 'Navigation Bar')).toBe('Navigation Bar');
      expect(sanitizeLayerName('Frame 24', 'Hero Section')).toBe('Hero Section');
    });

    it('preserves valid semantic names', () => {
      expect(sanitizeLayerName('Heading - H1')).toBe('Heading - H1');
      expect(sanitizeLayerName('Call to Action Button')).toBe('Call to Action Button');
    });
  });
});
