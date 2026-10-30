/**
 * Semantic route categorization based on path prefixes, navigation labels, and URL patterns.
 */

export type RouteCategory =
  | 'Main/Marketing'
  | 'Products/Services'
  | 'Blog/Articles'
  | 'Documentation/Help'
  | 'Authentication/Account'
  | 'Dashboard/Application'
  | 'Store/Catalog'
  | 'Other/Unclassified';

export interface RouteCategorizationInput {
  url: string;
  title?: string | undefined;
  navigationLabel?: string | undefined;
}

/**
 * Categorizes a route using path segments, title, and navigation cues.
 * Defaults to 'Other/Unclassified' when evidence is insufficient.
 */
export function categorizeRoute(input: string | RouteCategorizationInput): RouteCategory {
  const urlStr = typeof input === 'string' ? input : input.url;
  const title = typeof input === 'string' ? '' : (input.title ?? '').toLowerCase();
  const navLabel = typeof input === 'string' ? '' : (input.navigationLabel ?? '').toLowerCase();

  let pathname = '';
  try {
    const parsed = new URL(urlStr, 'https://internal-parser.local');
    pathname = parsed.pathname.toLowerCase();
  } catch {
    pathname = urlStr.toLowerCase();
  }

  // Root path is always Main/Marketing
  if (pathname === '/' || pathname === '' || pathname === '/home' || pathname === '/index.html') {
    return 'Main/Marketing';
  }

  const segments = pathname.split('/').filter(Boolean);
  const firstSegment = segments[0] ?? '';
  const fullPath = pathname;

  // 1. Authentication / Account
  if (
    matchesAny(firstSegment, ['login', 'signin', 'sign-in', 'signup', 'sign-up', 'register', 'auth', 'logout', 'signout', 'account', 'profile', 'password', 'forgot-password']) ||
    matchesAny(navLabel, ['sign in', 'log in', 'sign up', 'register', 'my account', 'profile'])
  ) {
    return 'Authentication/Account';
  }

  // 2. Dashboard / Application
  if (
    matchesAny(firstSegment, ['app', 'dashboard', 'admin', 'portal', 'console', 'workspace', 'workspaces', 'overview', 'analytics', 'reports', 'settings']) ||
    matchesAny(navLabel, ['dashboard', 'workspace', 'console', 'app', 'settings'])
  ) {
    return 'Dashboard/Application';
  }

  // 3. Documentation / Help
  if (
    matchesAny(firstSegment, ['docs', 'documentation', 'guide', 'guides', 'help', 'faq', 'api', 'api-docs', 'support', 'reference', 'tutorials', 'kb', 'knowledgebase']) ||
    matchesAny(navLabel, ['docs', 'documentation', 'help center', 'api reference', 'support', 'faq'])
  ) {
    return 'Documentation/Help';
  }

  // 4. Blog / Articles
  if (
    matchesAny(firstSegment, ['blog', 'news', 'article', 'articles', 'posts', 'post', 'press', 'insights', 'stories', 'journal', 'updates']) ||
    matchesAny(navLabel, ['blog', 'news', 'articles', 'press', 'insights'])
  ) {
    return 'Blog/Articles';
  }

  // 5. Store / Catalog
  if (
    matchesAny(firstSegment, ['cart', 'checkout', 'store', 'shop', 'basket', 'categories', 'collections', 'collection']) ||
    matchesAny(navLabel, ['cart', 'checkout', 'shopping bag', 'store', 'shop'])
  ) {
    return 'Store/Catalog';
  }

  // 6. Products / Services
  if (
    matchesAny(firstSegment, ['product', 'products', 'service', 'services', 'solutions', 'integrations', 'features', 'platform', 'item', 'items']) ||
    matchesAny(navLabel, ['products', 'services', 'solutions', 'features', 'integrations'])
  ) {
    return 'Products/Services';
  }

  // 7. Main / Marketing
  if (
    matchesAny(firstSegment, ['about', 'about-us', 'contact', 'contact-us', 'pricing', 'company', 'team', 'careers', 'jobs', 'terms', 'privacy', 'security', 'enterprise', 'customers', 'press-kit']) ||
    matchesAny(navLabel, ['about', 'about us', 'contact', 'pricing', 'company', 'careers', 'terms', 'privacy']) ||
    matchesAny(title, ['home', 'welcome', 'pricing', 'about us'])
  ) {
    return 'Main/Marketing';
  }

  // Fallback to Other/Unclassified when evidence is insufficient
  return 'Other/Unclassified';
}

function matchesAny(value: string, targets: string[]): boolean {
  if (!value) return false;
  return targets.some((t) => value === t || value.startsWith(`${t}-`) || value.endsWith(`-${t}`));
}
