import { describe, it, expect } from 'vitest';
import { categorizeRoute } from '../../core/crawler/route-categorizer';

describe('RouteCategorizer', () => {
  it('categorizes root and home routes as Main/Marketing', () => {
    expect(categorizeRoute('https://example.com/')).toBe('Main/Marketing');
    expect(categorizeRoute('https://example.com/home')).toBe('Main/Marketing');
    expect(categorizeRoute('https://example.com/index.html')).toBe('Main/Marketing');
    expect(categorizeRoute('https://example.com/pricing')).toBe('Main/Marketing');
    expect(categorizeRoute('https://example.com/about-us')).toBe('Main/Marketing');
    expect(categorizeRoute('https://example.com/careers')).toBe('Main/Marketing');
  });

  it('categorizes authentication and account routes', () => {
    expect(categorizeRoute('https://example.com/login')).toBe('Authentication/Account');
    expect(categorizeRoute('https://example.com/auth/sign-in')).toBe('Authentication/Account');
    expect(categorizeRoute('https://example.com/signup')).toBe('Authentication/Account');
    expect(categorizeRoute('https://example.com/profile')).toBe('Authentication/Account');
    expect(
      categorizeRoute({
        url: 'https://example.com/s/portal-entry',
        navigationLabel: 'Sign In'
      })
    ).toBe('Authentication/Account');
  });

  it('categorizes dashboard and application routes', () => {
    expect(categorizeRoute('https://example.com/app/overview')).toBe('Dashboard/Application');
    expect(categorizeRoute('https://example.com/dashboard')).toBe('Dashboard/Application');
    expect(categorizeRoute('https://example.com/admin/users')).toBe('Dashboard/Application');
    expect(categorizeRoute('https://example.com/workspace/my-team')).toBe('Dashboard/Application');
  });

  it('categorizes documentation and help routes', () => {
    expect(categorizeRoute('https://example.com/docs/getting-started')).toBe('Documentation/Help');
    expect(categorizeRoute('https://example.com/guides/advanced')).toBe('Documentation/Help');
    expect(categorizeRoute('https://example.com/faq')).toBe('Documentation/Help');
    expect(categorizeRoute('https://example.com/api/v1/reference')).toBe('Documentation/Help');
  });

  it('categorizes blog and articles routes', () => {
    expect(categorizeRoute('https://example.com/blog/welcome')).toBe('Blog/Articles');
    expect(categorizeRoute('https://example.com/news/press-release')).toBe('Blog/Articles');
    expect(categorizeRoute('https://example.com/articles/design-systems')).toBe('Blog/Articles');
  });

  it('categorizes store and catalog routes', () => {
    expect(categorizeRoute('https://example.com/store')).toBe('Store/Catalog');
    expect(categorizeRoute('https://example.com/cart')).toBe('Store/Catalog');
    expect(categorizeRoute('https://example.com/checkout')).toBe('Store/Catalog');
    expect(categorizeRoute('https://example.com/categories/mens-wear')).toBe('Store/Catalog');
  });

  it('categorizes products and services routes', () => {
    expect(categorizeRoute('https://example.com/products/exporter')).toBe('Products/Services');
    expect(categorizeRoute('https://example.com/services/consulting')).toBe('Products/Services');
    expect(categorizeRoute('https://example.com/solutions/enterprise')).toBe('Products/Services');
  });

  it('falls back to Other/Unclassified when evidence is insufficient', () => {
    expect(categorizeRoute('https://example.com/xyz123')).toBe('Other/Unclassified');
    expect(categorizeRoute('https://example.com/custom-random-slug')).toBe('Other/Unclassified');
    expect(categorizeRoute('https://example.com/misc/alpha')).toBe('Other/Unclassified');
  });
});
