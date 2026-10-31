import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DiagnosticsView } from '../../popup/components/DiagnosticsView';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import type { DiscoveredRoute } from '../../core/crawler/crawl-scope';

describe('DiagnosticsView UI Component (Phase 22)', () => {
  const sampleDiagnostics: ExportDiagnostic[] = [
    {
      severity: 'error',
      code: 'PAGE_LOAD_TIMEOUT',
      message: 'Page failed to reach network idle state',
      phase: 'dom-extraction',
      pageUrl: 'https://example.com/slow',
      recoveryAction: 'Check your network and retry route',
      timestamp: Date.now()
    },
    {
      severity: 'warning',
      code: 'ASSET_FETCH_TIMEOUT',
      message: 'Image asset fetch timed out',
      phase: 'asset-fetch',
      assetUrl: 'https://example.com/hero.png',
      recoveryAction: 'Retry downloading failed assets',
      timestamp: Date.now()
    }
  ];

  const sampleFailedRoutes: DiscoveredRoute[] = [
    {
      canonicalUrl: 'https://example.com/slow',
      originalUrl: 'https://example.com/slow',
      pathname: '/slow',
      title: 'Slow Page',
      discoverySource: 'anchor',
      depth: 1,
      category: 'Main/Marketing',
      paginationNumber: null,
      isDestructive: false,
      discoveryIndex: 1,
      isSelected: true
    }
  ];

  it('renders list of diagnostic issues with codes, messages, and recovery actions', () => {
    render(
      <DiagnosticsView
        diagnostics={sampleDiagnostics}
        failedRoutes={sampleFailedRoutes}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/2 issue\(s\) recorded/i)).toBeDefined();
    expect(screen.getByText('PAGE_LOAD_TIMEOUT')).toBeDefined();
    expect(screen.getByText('Page failed to reach network idle state')).toBeDefined();
    expect(screen.getByText(/Check your network and retry route/i)).toBeDefined();
    expect(screen.getByText('https://example.com/slow')).toBeDefined();
    expect(screen.getByText('https://example.com/hero.png')).toBeDefined();
  });

  it('renders retry button and triggers onRetryFailedRoutes', async () => {
    const handleRetry = vi.fn().mockResolvedValue(undefined);
    render(
      <DiagnosticsView
        diagnostics={sampleDiagnostics}
        failedRoutes={sampleFailedRoutes}
        onRetryFailedRoutes={handleRetry}
        onClose={vi.fn()}
      />
    );

    const retryBtn = screen.getByRole('button', { name: /Retry 1 Failed Route\(s\)/i });
    expect(retryBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(retryBtn);
    });
    expect(handleRetry).toHaveBeenCalledWith(sampleFailedRoutes);
  });

  it('renders clean empty state when zero diagnostics exist', () => {
    render(<DiagnosticsView diagnostics={[]} onClose={vi.fn()} />);

    expect(screen.getByText(/Zero diagnostics or warnings recorded/i)).toBeDefined();
  });

  it('triggers onClose when close button is clicked', () => {
    const handleClose = vi.fn();
    render(<DiagnosticsView diagnostics={sampleDiagnostics} onClose={handleClose} />);

    const closeBtn = screen.getByRole('button', { name: /Close Diagnostics/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalled();
  });
});
