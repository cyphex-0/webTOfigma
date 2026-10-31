import { describe, it, expect } from 'vitest';
import {
  validateTargetUrl,
  isPrivateOrLoopbackHost
} from '../../core/security/url-security';

describe('URL Security & Navigation Boundary Validator (Phase 22)', () => {
  it('allows standard https and http URLs', () => {
    const httpsRes = validateTargetUrl('https://example.com/docs');
    expect(httpsRes.isValid).toBe(true);
    expect(httpsRes.sanitizedUrl).toBe('https://example.com/docs');

    const httpRes = validateTargetUrl('http://example.org/about');
    expect(httpRes.isValid).toBe(true);
  });

  it('blocks dangerous and browser-internal URL protocols', () => {
    const blockedProtocols = [
      'chrome://settings',
      'chrome-extension://abcdef/popup.html',
      'moz-extension://abcdef/popup.html',
      'about:blank',
      'file:///etc/passwd',
      'javascript:alert(1)',
      'data:text/html,<h1>PWNED</h1>',
      'blob:https://example.com/uuid',
      'view-source:https://example.com'
    ];

    for (const url of blockedProtocols) {
      const res = validateTargetUrl(url);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('Blocked URL protocol');
    }
  });

  it('blocks cloud instance metadata endpoints', () => {
    const metadataEndpoints = [
      'http://169.254.169.254/latest/meta-data/',
      'http://169.254.170.2/v2/metadata',
      'http://metadata.google.internal/computeMetadata/v1/'
    ];

    for (const url of metadataEndpoints) {
      const res = validateTargetUrl(url);
      expect(res.isValid).toBe(false);
      expect(res.reason).toContain('cloud metadata endpoint prohibited');
    }
  });

  it('detects private and loopback networks', () => {
    expect(isPrivateOrLoopbackHost('localhost')).toBe(true);
    expect(isPrivateOrLoopbackHost('127.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('192.168.1.100')).toBe(true);
    expect(isPrivateOrLoopbackHost('10.0.0.1')).toBe(true);
    expect(isPrivateOrLoopbackHost('172.20.0.5')).toBe(true);
    expect(isPrivateOrLoopbackHost('example.com')).toBe(false);

    // Rejected when allowPrivateNetwork is false (default)
    const localRes = validateTargetUrl('http://localhost:3000');
    expect(localRes.isValid).toBe(false);
    expect(localRes.isPrivateNetwork).toBe(true);

    // Permitted when allowPrivateNetwork is explicitly enabled
    const allowedLocal = validateTargetUrl('http://localhost:3000', { allowPrivateNetwork: true });
    expect(allowedLocal.isValid).toBe(true);
  });

  it('prevents insecure protocol downgrade on redirect', () => {
    const downgradeRes = validateTargetUrl('http://example.com/checkout', {
      expectedOrigin: 'https://example.com'
    });
    expect(downgradeRes.isValid).toBe(false);
    expect(downgradeRes.reason).toContain('Insecure protocol downgrade');
  });

  it('prevents redirect escaping original crawl origin', () => {
    const crossOriginRes = validateTargetUrl('https://evil.com/phish', {
      expectedOrigin: 'https://example.com'
    });
    expect(crossOriginRes.isValid).toBe(false);
    expect(crossOriginRes.reason).toContain('Redirect to cross-origin');
  });
});
