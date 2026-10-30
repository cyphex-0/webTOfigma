import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  discoverDomAnchors,
  discoverPseudoAnchors,
  discoverSpaRouteHints,
  BrowseSessionRecorder
} from '../../core/crawler/link-discovery';

describe('LinkDiscovery Engine & SPA Route Hints', () => {
  const BASE_URL = 'https://example.com';

  beforeEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  describe('Standard DOM Anchors Discovery', () => {
    it('discovers standard anchors and extracts labels and pagination', () => {
      document.body.innerHTML = `
        <nav>
          <a href="/features" title="Product Features">Features</a>
          <a href="/pricing" aria-label="Subscription Pricing">Plans</a>
          <a href="/features">Duplicate Link</a>
          <a href="mailto:test@example.com">Email</a>
          <a href="/catalog/page/2" aria-label="Page 2">2</a>
        </nav>
      `;

      const links = discoverDomAnchors({
        doc: document,
        baseUrl: BASE_URL,
        depth: 1
      });

      expect(links).toHaveLength(3); // /features, /pricing, /catalog/page/2 (email excluded, duplicate excluded)

      const features = links.find((l) => l.pathname === '/features');
      expect(features).toBeDefined();
      expect(features?.title).toBe('Product Features');
      expect(features?.discoverySource).toBe('anchor');

      const pricing = links.find((l) => l.pathname === '/pricing');
      expect(pricing).toBeDefined();
      expect(pricing?.navigationLabel).toBe('Subscription Pricing');

      const page2 = links.find((l) => l.pathname === '/catalog/page/2');
      expect(page2).toBeDefined();
      expect(page2?.paginationNumber).toBe(2);
    });
  });

  describe('Pseudo-Anchor & SPA Attribute Discovery', () => {
    it('extracts routes from interactive elements with custom routing attributes', () => {
      document.body.innerHTML = `
        <div>
          <button data-href="/dashboard" aria-label="Open Dashboard">Go to Dashboard</button>
          <div routerlink="/settings/profile">Account Settings</div>
          <span ng-reflect-router-link="/billing">Billing Details</span>
          <button data-route="/analytics">Analytics</button>
        </div>
      `;

      const pseudoLinks = discoverPseudoAnchors({
        doc: document,
        baseUrl: BASE_URL,
        depth: 1
      });

      expect(pseudoLinks).toHaveLength(4);
      const paths = pseudoLinks.map((l) => l.pathname);
      expect(paths).toContain('/dashboard');
      expect(paths).toContain('/settings/profile');
      expect(paths).toContain('/billing');
      expect(paths).toContain('/analytics');

      expect(pseudoLinks[0]?.isPseudoAnchor).toBe(true);
      expect(pseudoLinks[0]?.discoverySource).toBe('route-hint');
    });
  });

  describe('Passive SPA Manifest & Prefetch Hints', () => {
    it('extracts static route hints from Next.js __NEXT_DATA__ and prefetch link chunks', () => {
      document.head.innerHTML = `
        <link rel="prefetch" href="/_next/static/chunks/pages/pricing-abc123.js" />
        <link rel="modulepreload" href="/_next/static/chunks/pages/docs/intro.js" />
        <link rel="prefetch" href="/_nuxt/pages/showcase.js" />
      `;

      document.body.innerHTML = `
        <script id="__NEXT_DATA__" type="application/json">
          {
            "props": { "pageProps": {} },
            "page": "/portal",
            "query": {},
            "buildId": "prod-102"
          }
        </script>
      `;

      const hints = discoverSpaRouteHints({
        doc: document,
        baseUrl: BASE_URL,
        depth: 1
      });

      const paths = hints.map((h) => h.pathname);
      expect(paths).toContain('/portal');
      expect(paths).toContain('/pricing');
      expect(paths).toContain('/docs/intro');
      expect(paths).toContain('/showcase');
      expect(hints.every((h) => h.discoverySource === 'route-hint')).toBe(true);
    });
  });

  describe('BrowseSessionRecorder', () => {
    it('records pushState and popstate navigation non-destructively and cleans up', () => {
      const discovered: string[] = [];
      const recorder = new BrowseSessionRecorder(BASE_URL, (route) => {
        discovered.push(route.canonicalUrl);
      });

      expect(recorder.isRecording()).toBe(false);
      recorder.start();
      expect(recorder.isRecording()).toBe(true);

      // Trigger pushState
      window.history.pushState({}, '', '/app/projects');
      window.history.pushState({}, '', '/app/editor');

      // Trigger popstate
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));

      expect(discovered).toContain('https://example.com/app/projects');
      expect(discovered).toContain('https://example.com/app/editor');

      // Stop recorder
      recorder.stop();
      expect(recorder.isRecording()).toBe(false);

      // Subsequent navigations should not trigger callback
      const countBefore = discovered.length;
      window.history.pushState({}, '', '/app/after-stop');
      expect(discovered.length).toBe(countBefore);
    });
  });
});
