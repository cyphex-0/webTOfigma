import { describe, it, expect, beforeEach } from 'vitest';
import {
  normalizeAssetUrl,
  parseCssBackgroundUrls,
  parseSrcset,
  discoverElementAssets
} from '../../core/assets/asset-discovery';

describe('Multi-Source Asset Discovery Engine', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  describe('normalizeAssetUrl', () => {
    it('resolves relative URLs against document origin', () => {
      const url = normalizeAssetUrl('/assets/images/logo.png', 'https://example.com/products/');
      expect(url).toBe('https://example.com/assets/images/logo.png');
    });

    it('preserves data: URLs as-is', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
      expect(normalizeAssetUrl(dataUrl)).toBe(dataUrl);
    });

    it('rejects dangerous javascript: and vbscript: URL schemes', () => {
      expect(normalizeAssetUrl('javascript:alert(1)')).toBeNull();
      expect(normalizeAssetUrl('vbscript:msgbox')).toBeNull();
      expect(normalizeAssetUrl('file:///etc/passwd')).toBeNull();
    });
  });

  describe('parseCssBackgroundUrls', () => {
    it('parses single, double, and unquoted url(...) forms', () => {
      const bg = `url("https://example.com/banner.jpg"), url('https://example.com/pattern.png'), url(https://example.com/icon.svg)`;
      const urls = parseCssBackgroundUrls(bg);
      expect(urls).toEqual([
        'https://example.com/banner.jpg',
        'https://example.com/pattern.png',
        'https://example.com/icon.svg'
      ]);
    });

    it('ignores gradients and extracts only image layers', () => {
      const bg = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url("https://example.com/bg.webp")`;
      const urls = parseCssBackgroundUrls(bg);
      expect(urls).toEqual(['https://example.com/bg.webp']);
    });

    it('returns empty array when background-image is none', () => {
      expect(parseCssBackgroundUrls('none')).toEqual([]);
      expect(parseCssBackgroundUrls('')).toEqual([]);
    });
  });

  describe('parseSrcset', () => {
    it('extracts candidate URLs from responsive srcset string', () => {
      const srcset = 'https://example.com/small.jpg 480w, https://example.com/large.jpg 1024w, https://example.com/retina.jpg 2x';
      const candidates = parseSrcset(srcset);
      expect(candidates).toEqual([
        'https://example.com/small.jpg',
        'https://example.com/large.jpg',
        'https://example.com/retina.jpg'
      ]);
    });
  });

  describe('discoverElementAssets', () => {
    it('discovers assets from img elements with intrinsic dimensions and alt text', () => {
      const img = document.createElement('img');
      img.setAttribute('src', 'https://example.com/photo.jpg');
      img.setAttribute('alt', 'Team at work');
      img.setAttribute('width', '800');
      img.setAttribute('height', '600');
      document.body.appendChild(img);

      const assets = discoverElementAssets(img, { objectFit: 'cover' });
      expect(assets.length).toBe(1);
      expect(assets[0]?.kind).toBe('image-bitmap');
      expect(assets[0]?.normalizedUrl).toBe('https://example.com/photo.jpg');
      expect(assets[0]?.altText).toBe('Team at work');
      expect(assets[0]?.intrinsicWidth).toBe(800);
      expect(assets[0]?.intrinsicHeight).toBe(600);
      expect(assets[0]?.aspectRatio).toBe(1.333);
      expect(assets[0]?.objectFit).toBe('cover');
    });

    it('prefers currentSrc over src on img elements', () => {
      const img = document.createElement('img');
      img.setAttribute('src', 'https://example.com/fallback.jpg');
      // Mock currentSrc
      Object.defineProperty(img, 'currentSrc', {
        value: 'https://example.com/high-res-candidate.webp',
        configurable: true
      });

      const assets = discoverElementAssets(img);
      expect(assets[0]?.normalizedUrl).toBe('https://example.com/high-res-candidate.webp');
    });

    it('discovers candidate sources from picture element', () => {
      const picture = document.createElement('picture');
      const sourceWebp = document.createElement('source');
      sourceWebp.setAttribute('srcset', 'https://example.com/art.webp 1x, https://example.com/art-2x.webp 2x');
      const sourcePng = document.createElement('source');
      sourcePng.setAttribute('srcset', 'https://example.com/art.png');

      picture.appendChild(sourceWebp);
      picture.appendChild(sourcePng);

      const assets = discoverElementAssets(picture);
      expect(assets.length).toBe(3);
      expect(assets.map((a) => a.normalizedUrl)).toEqual([
        'https://example.com/art.webp',
        'https://example.com/art-2x.webp',
        'https://example.com/art.png'
      ]);
    });

    it('discovers inline SVG markup and preserves content', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '100');
      rect.setAttribute('height', '100');
      svg.appendChild(rect);

      const assets = discoverElementAssets(svg);
      expect(assets.length).toBe(1);
      expect(assets[0]?.kind).toBe('image-svg');
      expect(assets[0]?.isInlineData).toBe(true);
      expect(assets[0]?.svgContent).toContain('<rect width="100" height="100"');
    });

    it('discovers CSS background-image from computed styles', () => {
      const div = document.createElement('div');
      const assets = discoverElementAssets(div, {
        backgroundImage: 'url("https://example.com/hero-bg.jpg")'
      });
      expect(assets.length).toBe(1);
      expect(assets[0]?.kind).toBe('css-background');
      expect(assets[0]?.normalizedUrl).toBe('https://example.com/hero-bg.jpg');
    });
  });
});
