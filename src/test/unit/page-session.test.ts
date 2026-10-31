import { describe, it, expect } from 'vitest';
import { evaluatePageSession } from '../../core/crawler/page-session';

describe('PageSession Guard & Auth Redirect Evaluator', () => {
  it('identifies standard content pages as valid', () => {
    const res = evaluatePageSession({
      requestedUrl: 'https://example.com/about',
      finalUrl: 'https://example.com/about',
      statusCode: 200,
      documentTitle: 'About Us — Example Corp'
    });

    expect(res.isContentPage).toBe(true);
    expect(res.isAuthRedirect).toBe(false);
    expect(res.isAccessDenied).toBe(false);
  });

  it('detects HTTP 401 and 403 status codes', () => {
    const res401 = evaluatePageSession({
      requestedUrl: 'https://example.com/admin',
      finalUrl: 'https://example.com/admin',
      statusCode: 401
    });
    expect(res401.isAuthRedirect).toBe(true);
    expect(res401.isAccessDenied).toBe(true);
    expect(res401.isContentPage).toBe(false);

    const res403 = evaluatePageSession({
      requestedUrl: 'https://example.com/internal',
      finalUrl: 'https://example.com/internal',
      statusCode: 403
    });
    expect(res403.isAccessDenied).toBe(true);
    expect(res403.isContentPage).toBe(false);
  });

  it('detects redirects to login or SSO pages', () => {
    const res = evaluatePageSession({
      requestedUrl: 'https://example.com/dashboard/billing',
      finalUrl: 'https://example.com/login?redirect=%2Fdashboard%2Fbilling'
    });

    expect(res.isAuthRedirect).toBe(true);
    expect(res.isContentPage).toBe(false);
    expect(res.reason).toContain('Redirected from /dashboard/billing to login screen');
  });

  it('detects access denied paths', () => {
    const res = evaluatePageSession({
      requestedUrl: 'https://example.com/secret',
      finalUrl: 'https://example.com/access-denied'
    });

    expect(res.isAccessDenied).toBe(true);
    expect(res.isContentPage).toBe(false);
  });

  it('detects login screens via document title or password inputs', () => {
    const resTitle = evaluatePageSession({
      requestedUrl: 'https://example.com/profile',
      finalUrl: 'https://example.com/profile',
      documentTitle: 'Sign In to Your Account'
    });
    expect(resTitle.isAuthRedirect).toBe(true);

    const resPassword = evaluatePageSession({
      requestedUrl: 'https://example.com/checkout/step-2',
      finalUrl: 'https://example.com/checkout/step-2',
      hasPasswordField: true
    });
    expect(resPassword.isAuthRedirect).toBe(true);
  });
});
