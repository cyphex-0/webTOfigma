import { describe, it, expect } from 'vitest';
import { isInjectableUrl } from '../../shared/browser/browser-capabilities';
import {
  normalizeOriginPattern,
  hasOriginPermission,
  requestOriginPermission,
  removeOriginPermission
} from '../../background/permission-manager';

describe('Permission Manager and URL Injectability Gate', () => {
  describe('isInjectableUrl', () => {
    it('allows valid HTTPS and HTTP URLs', () => {
      expect(isInjectableUrl('https://example.com/page').injectable).toBe(true);
      expect(isInjectableUrl('http://localhost:3000').injectable).toBe(true);
      expect(isInjectableUrl('https://github.com/cyphex-0/webTOfigma').injectable).toBe(true);
    });

    it('rejects browser system URLs (chrome://, edge://, about:)', () => {
      const chromeResult = isInjectableUrl('chrome://extensions');
      expect(chromeResult.injectable).toBe(false);
      expect(chromeResult.reason).toContain('chrome://');

      const edgeResult = isInjectableUrl('edge://settings');
      expect(edgeResult.injectable).toBe(false);
      expect(edgeResult.reason).toContain('edge://');

      const aboutResult = isInjectableUrl('about:config');
      expect(aboutResult.injectable).toBe(false);
      expect(aboutResult.reason).toContain('about:');
    });

    it('rejects pseudo-schemes (data:, view-source:, blob:)', () => {
      expect(isInjectableUrl('data:text/html,<h1>Hello</h1>').injectable).toBe(false);
      expect(isInjectableUrl('view-source:https://google.com').injectable).toBe(false);
      expect(isInjectableUrl('blob:https://example.com/uuid').injectable).toBe(false);
    });

    it('rejects Extension Web Stores (Chrome Web Store, AMO)', () => {
      const cwsResult = isInjectableUrl('https://chromewebstore.google.com/detail/abc');
      expect(cwsResult.injectable).toBe(false);
      expect(cwsResult.reason).toContain('Web Store');

      const amoResult = isInjectableUrl('https://addons.mozilla.org/en-US/firefox/addon/xyz');
      expect(amoResult.injectable).toBe(false);
      expect(amoResult.reason).toContain('Web Store');
    });

    it('rejects PDF viewer documents', () => {
      const pdfResult = isInjectableUrl('https://example.com/document.pdf');
      expect(pdfResult.injectable).toBe(false);
      expect(pdfResult.reason).toContain('PDF');
    });

    it('rejects empty, null, and malformed strings', () => {
      expect(isInjectableUrl('').injectable).toBe(false);
      expect(isInjectableUrl(undefined).injectable).toBe(false);
      expect(isInjectableUrl('not a url').injectable).toBe(false);
    });
  });

  describe('Origin Pattern Normalization', () => {
    it('normalizes full URLs into wildcard origin patterns', () => {
      expect(normalizeOriginPattern('https://example.com/path?query=1')).toBe('https://example.com/*');
      expect(normalizeOriginPattern('http://localhost:8080/app/dashboard')).toBe('http://localhost:8080/*');
      expect(normalizeOriginPattern('https://sub.domain.org/*')).toBe('https://sub.domain.org/*');
    });
  });

  describe('Optional Host Permissions API', () => {
    it('manages origin permissions lifecycle (request, check, remove)', async () => {
      const testOrigin = 'https://api.github.com';

      // Initially false
      expect(await hasOriginPermission(testOrigin)).toBe(false);

      // Request permission
      const granted = await requestOriginPermission(testOrigin, 'Test multi-page crawl');
      expect(granted).toBe(true);
      expect(await hasOriginPermission(testOrigin)).toBe(true);

      // Remove permission
      const removed = await removeOriginPermission(testOrigin);
      expect(removed).toBe(true);
      expect(await hasOriginPermission(testOrigin)).toBe(false);
    });
  });
});
