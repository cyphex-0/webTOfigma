import { describe, it, expect } from 'vitest';
import {
  normalizeCandidateUrl,
  checkSameSite,
  DEFAULT_TRACKING_PARAMS,
  DOWNLOAD_EXTENSIONS
} from '../../core/crawler/url-normalizer';

describe('UrlNormalizer & Same-Site Policy', () => {
  const BASE_URL = 'https://example.com/app/index.html';

  it('resolves relative URLs against the base URL', () => {
    const res1 = normalizeCandidateUrl('/about', { baseUrl: BASE_URL });
    expect(res1.isValid).toBe(true);
    expect(res1.canonicalUrl).toBe('https://example.com/about');
    expect(res1.pathname).toBe('/about');

    const res2 = normalizeCandidateUrl('features', { baseUrl: BASE_URL });
    expect(res2.isValid).toBe(true);
    expect(res2.canonicalUrl).toBe('https://example.com/app/features');

    const res3 = normalizeCandidateUrl('../pricing', { baseUrl: BASE_URL });
    expect(res3.isValid).toBe(true);
    expect(res3.canonicalUrl).toBe('https://example.com/pricing');
  });

  it('normalizes trailing slashes safely for directory routes', () => {
    const resA = normalizeCandidateUrl('/about/', { baseUrl: BASE_URL });
    const resB = normalizeCandidateUrl('/about', { baseUrl: BASE_URL });
    expect(resA.canonicalUrl).toBe('https://example.com/about');
    expect(resB.canonicalUrl).toBe('https://example.com/about');
    expect(resA.canonicalUrl).toBe(resB.canonicalUrl);

    // Root remains /
    const rootRes = normalizeCandidateUrl('/', { baseUrl: BASE_URL });
    expect(rootRes.canonicalUrl).toBe('https://example.com/');
  });

  it('omits default ports (80/443) and preserves custom ports', () => {
    const resHttps = normalizeCandidateUrl('https://example.com:443/page', { baseUrl: BASE_URL });
    expect(resHttps.canonicalUrl).toBe('https://example.com/page');

    const resHttp = normalizeCandidateUrl('http://localhost:80/home', { baseUrl: 'http://localhost' });
    expect(resHttp.canonicalUrl).toBe('http://localhost/home');

    const resCustom = normalizeCandidateUrl('http://localhost:8080/home', { baseUrl: 'http://localhost:8080' });
    expect(resCustom.canonicalUrl).toBe('http://localhost:8080/home');
  });

  describe('Same-site and Subdomain Policy', () => {
    it('enforces exact same origin by default', () => {
      const allowed = normalizeCandidateUrl('https://example.com/subpage', { baseUrl: BASE_URL });
      expect(allowed.isValid).toBe(true);
      expect(allowed.isSameOrigin).toBe(true);

      const crossOrigin = normalizeCandidateUrl('https://otherdomain.com/subpage', { baseUrl: BASE_URL });
      expect(crossOrigin.isValid).toBe(false);
      expect(crossOrigin.rejectionReason).toContain('outside allowed site scope');
    });

    it('allows valid subdomains when allowSubdomains is true', () => {
      const sub = normalizeCandidateUrl('https://blog.example.com/post', {
        baseUrl: BASE_URL,
        allowSubdomains: true
      });
      expect(sub.isValid).toBe(true);
      expect(sub.isSameSite).toBe(true);
      expect(sub.isSameOrigin).toBe(false);
      expect(sub.canonicalUrl).toBe('https://blog.example.com/post');
    });

    it('rejects deceptive suffix domains (e.g. example.com.evil.test)', () => {
      expect(checkSameSite('example.com.evil.test', 'example.com', true)).toBe(false);

      const deceptive = normalizeCandidateUrl('https://example.com.evil.test/phish', {
        baseUrl: BASE_URL,
        allowSubdomains: true
      });
      expect(deceptive.isValid).toBe(false);
      expect(deceptive.rejectionReason).toContain('outside allowed site scope');
    });

    it('handles multi-part ccTLDs correctly (e.g. co.uk)', () => {
      expect(checkSameSite('blog.example.co.uk', 'example.co.uk', true)).toBe(true);
      expect(checkSameSite('app.example.co.uk', 'blog.example.co.uk', true)).toBe(true);
      expect(checkSameSite('example.co.uk.attacker.com', 'example.co.uk', true)).toBe(false);
    });
  });

  describe('Exclusions and Disallowed Schemes', () => {
    it('rejects empty and fragment-only links', () => {
      expect(normalizeCandidateUrl('', { baseUrl: BASE_URL }).isValid).toBe(false);
      expect(normalizeCandidateUrl('   ', { baseUrl: BASE_URL }).isValid).toBe(false);
      expect(normalizeCandidateUrl('#', { baseUrl: BASE_URL }).isValid).toBe(false);
      expect(normalizeCandidateUrl('#section-2', { baseUrl: BASE_URL }).isValid).toBe(false);
    });

    it('rejects mailto, tel, javascript, and internal browser schemes', () => {
      expect(normalizeCandidateUrl('mailto:support@example.com', { baseUrl: BASE_URL }).isValid).toBe(false);
      expect(normalizeCandidateUrl('tel:+1234567890', { baseUrl: BASE_URL }).isValid).toBe(false);
      expect(normalizeCandidateUrl('javascript:void(0)', { baseUrl: BASE_URL }).isValid).toBe(false);
      expect(normalizeCandidateUrl('chrome://settings', { baseUrl: BASE_URL }).isValid).toBe(false);
      expect(normalizeCandidateUrl('about:blank', { baseUrl: BASE_URL }).isValid).toBe(false);
      expect(normalizeCandidateUrl('data:text/html,test', { baseUrl: BASE_URL }).isValid).toBe(false);
    });

    it('rejects binary and document file downloads', () => {
      const pdfRes = normalizeCandidateUrl('/documents/whitepaper.pdf', { baseUrl: BASE_URL });
      expect(pdfRes.isValid).toBe(false);
      expect(pdfRes.isDownloadFile).toBe(true);
      expect(pdfRes.rejectionReason).toContain('.pdf');

      const zipRes = normalizeCandidateUrl('/downloads/release.zip', { baseUrl: BASE_URL });
      expect(zipRes.isValid).toBe(false);
      expect(zipRes.isDownloadFile).toBe(true);

      const exeRes = normalizeCandidateUrl('/installer.exe', { baseUrl: BASE_URL });
      expect(exeRes.isValid).toBe(false);
      expect(exeRes.isDownloadFile).toBe(true);
    });
  });

  describe('Query and Fragment Normalization', () => {
    it('strips tracking query parameters while preserving content parameters', () => {
      const url =
        '/products?utm_source=google&category=shoes&gclid=abc1234&page=2&utm_medium=cpc&sort=asc&fbclid=xyz';
      const res = normalizeCandidateUrl(url, { baseUrl: BASE_URL });

      expect(res.isValid).toBe(true);
      // tracking params utm_source, gclid, utm_medium, fbclid are stripped
      // category, page, sort are preserved and sorted alphabetically: category=shoes&page=2&sort=asc
      expect(res.canonicalUrl).toBe('https://example.com/products?category=shoes&page=2&sort=asc');
      expect(res.search).toBe('?category=shoes&page=2&sort=asc');
    });

    it('strips fragments by default', () => {
      const res = normalizeCandidateUrl('/docs#installation', { baseUrl: BASE_URL });
      expect(res.isValid).toBe(true);
      expect(res.canonicalUrl).toBe('https://example.com/docs');
      expect(res.hash).toBeUndefined();
    });

    it('preserves hash routes when includeHashRoutes is enabled', () => {
      const res = normalizeCandidateUrl('/app/#/dashboard/settings', {
        baseUrl: BASE_URL,
        includeHashRoutes: true
      });
      expect(res.isValid).toBe(true);
      expect(res.canonicalUrl).toBe('https://example.com/app/#/dashboard/settings');
      expect(res.hash).toBe('#/dashboard/settings');
    });
  });
});
