import { describe, it, expect } from 'vitest';
import { detectPaginationNumber } from '../../core/crawler/pagination-detector';

describe('PaginationDetector', () => {
  it('detects page numbers from standard query parameters', () => {
    expect(detectPaginationNumber('https://example.com/blog?page=2')).toBe(2);
    expect(detectPaginationNumber('https://example.com/search?q=shoes&p=5')).toBe(5);
    expect(detectPaginationNumber('https://example.com/articles?category=tech&pageNumber=3')).toBe(3);
    expect(detectPaginationNumber('https://example.com/news?paged=10')).toBe(10);
  });

  it('detects page numbers from standard path patterns', () => {
    expect(detectPaginationNumber('https://example.com/blog/page/3')).toBe(3);
    expect(detectPaginationNumber('https://example.com/catalog/p/7')).toBe(7);
    expect(detectPaginationNumber('https://example.com/category/tech/pages/4/')).toBe(4);
  });

  it('detects page numbers from DOM cues and aria labels', () => {
    expect(
      detectPaginationNumber({
        url: 'https://example.com/products/view',
        ariaLabel: 'Go to page 4'
      })
    ).toBe(4);

    expect(
      detectPaginationNumber({
        url: 'https://example.com/products/view',
        ariaLabel: 'Page 6'
      })
    ).toBe(6);

    expect(
      detectPaginationNumber({
        url: 'https://example.com/products/view',
        anchorText: '5'
      })
    ).toBe(5);
  });

  it('strictly returns null for arbitrary IDs, years, timestamps, and product codes', () => {
    expect(detectPaginationNumber('https://example.com/products/item-12345')).toBeNull();
    expect(detectPaginationNumber('https://example.com/blog/2026/10/30/article')).toBeNull();
    expect(detectPaginationNumber('https://example.com/order?orderId=99281')).toBeNull();
    expect(detectPaginationNumber('https://example.com/view?id=42')).toBeNull();
    expect(detectPaginationNumber('https://example.com/profile/user/7')).toBeNull();
  });

  it('handles malformed or invalid inputs gracefully', () => {
    expect(detectPaginationNumber('')).toBeNull();
    expect(detectPaginationNumber('not-a-url')).toBeNull();
    expect(detectPaginationNumber('https://example.com/blog?page=invalid')).toBeNull();
    expect(detectPaginationNumber('https://example.com/blog?page=0')).toBeNull();
    expect(detectPaginationNumber('https://example.com/blog?page=-1')).toBeNull();
  });
});
