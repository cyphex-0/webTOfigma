import { describe, it, expect } from 'vitest';
import {
  generatePageFrameName,
  generateChildNodeName,
  sanitizePageTitle,
  normalizeUrlPath,
  SiblingNameRegistry
} from '../../core/scene/scene-naming';

describe('Scene Naming Engine', () => {
  describe('Page Frame Naming Policy', () => {
    it('generates standardized two-digit indexed page frame name', () => {
      const name = generatePageFrameName(
        0,
        'Acme Cloud Platform',
        'https://acme.io/landing'
      );
      expect(name).toBe('01 — Acme Cloud Platform — /landing');
    });

    it('formats multi-digit page indexes correctly', () => {
      const name = generatePageFrameName(
        11,
        'Settings & Team',
        'https://acme.io/settings/team'
      );
      expect(name).toBe('12 — Settings & Team — /settings/team');
    });

    it('supports 1-based indexing option', () => {
      const name = generatePageFrameName(
        1,
        'Dashboard',
        'https://acme.io/dashboard',
        { is1BasedIndex: true }
      );
      expect(name).toBe('01 — Dashboard — /dashboard');
    });

    it('sanitizes control characters, excessive whitespace, and tabs in title', () => {
      const dirtyTitle = '  Acme \n\t Platform \u0000\u001F Overview  ';
      const name = generatePageFrameName(
        0,
        dirtyTitle,
        'https://acme.io/'
      );
      expect(name).toBe('01 — Acme Platform Overview — /');
    });

    it('falls back to Untitled when title is blank or whitespace', () => {
      const name = generatePageFrameName(0, '   ', 'https://example.com/');
      expect(name).toBe('01 — Untitled — /');
    });

    it('normalizes complex URLs, query parameters, hashes, and trailing slashes', () => {
      const url = 'https://acme.com/products/widgets/?discount=true&aff=1#specs';
      expect(normalizeUrlPath(url)).toBe('/products/widgets');

      expect(normalizeUrlPath('https://acme.com/')).toBe('/');
      expect(normalizeUrlPath('https://acme.com')).toBe('/');
      expect(normalizeUrlPath('')).toBe('/');
    });
  });

  describe('Child Layer Semantic Naming', () => {
    it('maps semantic kinds to readable design layer names', () => {
      expect(generateChildNodeName({ semanticKind: 'header' })).toBe('Header');
      expect(generateChildNodeName({ semanticKind: 'navigation' })).toBe('Navigation Bar');
      expect(generateChildNodeName({ semanticKind: 'heading-1' })).toBe('Heading — H1');
      expect(generateChildNodeName({ semanticKind: 'heading-2' })).toBe('Heading — H2');
      expect(generateChildNodeName({ semanticKind: 'button' })).toBe('Button');
      expect(generateChildNodeName({ semanticKind: 'card' })).toBe('Card');
      expect(generateChildNodeName({ semanticKind: 'list-item' })).toBe('List Item');
    });

    it('formats repeated element counters as two-digit numbers', () => {
      expect(generateChildNodeName({ semanticKind: 'card' }, 1)).toBe('Card 01');
      expect(generateChildNodeName({ semanticKind: 'card' }, 2)).toBe('Card 02');
      expect(generateChildNodeName({ semanticKind: 'card' }, 10)).toBe('Card 10');
    });

    it('incorporates concise accessible labels for interactive controls', () => {
      expect(
        generateChildNodeName({
          semanticKind: 'button',
          accessibleLabel: 'Sign In'
        })
      ).toBe('Button — Sign In');

      expect(
        generateChildNodeName({
          semanticKind: 'link',
          accessibleLabel: 'Privacy Policy'
        })
      ).toBe('Link — Privacy Policy');
    });

    it('falls back gracefully to HTML tag or generic Container when unknown', () => {
      expect(generateChildNodeName({ sourceTag: 'div' })).toBe('Container');
      expect(generateChildNodeName({ sourceTag: 'span' })).toBe('Span');
      expect(generateChildNodeName({})).toBe('Container');
    });
  });

  describe('SiblingNameRegistry', () => {
    it('disambiguates repeated sibling items with stable sequence numbers', () => {
      const registry = new SiblingNameRegistry();

      registry.register('nav1', { semanticKind: 'navigation' });
      registry.register('card1', { semanticKind: 'card' });
      registry.register('card2', { semanticKind: 'card' });
      registry.register('card3', { semanticKind: 'card' });

      // Unique element gets unnumbered name
      expect(registry.resolveName('nav1', 'Navigation Bar', 0)).toBe('Navigation Bar');

      // Repeated elements get 01, 02, 03
      expect(registry.resolveName('card1', 'Card', 0)).toBe('Card 01');
      expect(registry.resolveName('card2', 'Card', 1)).toBe('Card 02');
      expect(registry.resolveName('card3', 'Card', 2)).toBe('Card 03');
    });
  });
});
