import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RouteReview } from '../../popup/components/RouteReview';
import { DiscoveredRoute } from '../../core/crawler/crawl-scope';

describe('RouteReview Component', () => {
  const BASE_URL = 'https://example.com';

  const mockRoutes: DiscoveredRoute[] = [
    {
      canonicalUrl: 'https://example.com/',
      originalUrl: 'https://example.com/',
      pathname: '/',
      title: 'Home',
      discoverySource: 'current-page',
      depth: 0,
      category: 'Main/Marketing',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 1,
      isSelected: true
    },
    {
      canonicalUrl: 'https://example.com/blog',
      originalUrl: 'https://example.com/blog',
      pathname: '/blog',
      title: 'Blog',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Blog/Articles',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 2,
      isSelected: true
    },
    {
      canonicalUrl: 'https://example.com/blog/page/2',
      originalUrl: 'https://example.com/blog/page/2',
      pathname: '/blog/page/2',
      title: 'Blog Page 2',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Blog/Articles',
      paginationNumber: 2,
      isDestructive: false,
      discoveryIndex: 3,
      isSelected: false
    },
    {
      canonicalUrl: 'https://example.com/pricing',
      originalUrl: 'https://example.com/pricing',
      pathname: '/pricing',
      title: 'Pricing Plans',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Main/Marketing',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 4,
      isSelected: false
    }
  ];

  it('renders route list with titles, paths, and pagination badges', () => {
    const onStartExport = vi.fn();
    render(
      <RouteReview
        initialRoutes={mockRoutes}
        baseUrl={BASE_URL}
        onStartExport={onStartExport}
      />
    );

    const titles = screen.getAllByTestId('route-item-title').map((el) => el.textContent);
    expect(titles).toContain('Home');
    expect(titles).toContain('Blog');
    expect(titles).toContain('Pricing Plans');
    expect(screen.getByText('P.2')).toBeDefined();
  });

  it('filters visible routes using the search input', () => {
    render(
      <RouteReview
        initialRoutes={mockRoutes}
        baseUrl={BASE_URL}
        onStartExport={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Filter routes by path or title/i);
    fireEvent.change(searchInput, { target: { value: 'pricing' } });

    const titles = screen.getAllByTestId('route-item-title').map((el) => el.textContent);
    expect(titles).toEqual(['Pricing Plans']);
  });

  it('filters routes using preset chips (e.g. Blog & Articles)', () => {
    render(
      <RouteReview
        initialRoutes={mockRoutes}
        baseUrl={BASE_URL}
        onStartExport={vi.fn()}
      />
    );

    const blogPreset = screen.getByRole('button', { name: 'Blog & Articles' });
    fireEvent.click(blogPreset);

    const titles = screen.getAllByTestId('route-item-title').map((el) => el.textContent);
    expect(titles).toContain('Blog');
    expect(titles).toContain('Blog Page 2');
    expect(titles).not.toContain('Home');
    expect(titles).not.toContain('Pricing Plans');
  });

  it('displays a validation error for invalid regex patterns', () => {
    render(
      <RouteReview
        initialRoutes={mockRoutes}
        baseUrl={BASE_URL}
        onStartExport={vi.fn()}
      />
    );

    const regexInput = screen.getByPlaceholderText(/Custom regex filter/i);
    fireEvent.change(regexInput, { target: { value: '[unclosed' } });

    expect(screen.getByTestId('regex-error-message')).toBeDefined();
  });

  it('selects odd and even routes and updates summary label', () => {
    render(
      <RouteReview
        initialRoutes={mockRoutes}
        baseUrl={BASE_URL}
        onStartExport={vi.fn()}
      />
    );

    const oddButton = screen.getByRole('button', { name: /^odd$/i });
    fireEvent.click(oddButton);

    const badge = screen.getByTestId('selection-summary-badge');
    expect(badge.textContent).toContain('Odd pages — discovery order');

    const evenButton = screen.getByRole('button', { name: /^even$/i });
    fireEvent.click(evenButton);
    expect(badge.textContent).toContain('Even pages — discovery order');
  });

  it('handles manual route addition, validation errors, and removal', () => {
    render(
      <RouteReview
        initialRoutes={mockRoutes}
        baseUrl={BASE_URL}
        onStartExport={vi.fn()}
      />
    );

    const manualInput = screen.getByPlaceholderText(/Add unlinked internal route/i);
    const addButton = screen.getByRole('button', { name: /Add Route/i });

    // Try external URL
    fireEvent.change(manualInput, { target: { value: 'https://attacker.com/evil' } });
    fireEvent.click(addButton);
    expect(screen.getByText(/outside allowed site scope/i)).toBeDefined();

    // Add valid route
    fireEvent.change(manualInput, { target: { value: '/docs' } });
    fireEvent.click(addButton);

    expect(screen.getAllByText('/docs').length).toBeGreaterThan(0);

    // Remove manual route
    const removeBtn = screen.getByTitle('Remove manual route');
    fireEvent.click(removeBtn);
    expect(screen.queryByText('/docs')).toBeNull();
  });

  it('enforces page cap and triggers export callback with selected routes', () => {
    const onStartExport = vi.fn();
    render(
      <RouteReview
        initialRoutes={mockRoutes}
        baseUrl={BASE_URL}
        onStartExport={onStartExport}
      />
    );

    // Select all routes (3 non-destructive)
    const selectAllBtn = screen.getByRole('button', { name: /^Select All$/i });
    fireEvent.click(selectAllBtn);

    // Set page cap to 1
    const capSelect = screen.getByLabelText(/Page Cap:/i);
    fireEvent.change(capSelect, { target: { value: '1' } });

    // Cap warning should appear
    expect(screen.getByTestId('cap-warning')).toBeDefined();

    // Export button should trigger callback with only 1 route
    const exportBtn = screen.getByRole('button', { name: /Export 1 Page/i });
    fireEvent.click(exportBtn);

    expect(onStartExport).toHaveBeenCalledTimes(1);
    expect(onStartExport.mock.calls[0]![0]).toHaveLength(1);
  });
});
