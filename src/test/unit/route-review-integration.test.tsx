import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App } from '../../popup/App';
import { browser } from '../../shared/browser/browser-api';
import { settingsStore } from '../../core/settings/settings-store';

describe('Route Review & Multi-Page Flow Integration', () => {
  const MOCK_BASE_URL = 'https://example.com';

  beforeEach(async () => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    document.head.innerHTML = '';

    // Mock active tab response
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(
      async (msg: any) => {
        if (msg.type === 'GET_ACTIVE_TAB_CONTEXT') {
          return {
            success: true,
            payload: {
              tab: {
                tabId: 101,
                url: MOCK_BASE_URL,
                title: 'Example Home',
                isInjectable: true
              }
            }
          };
        }
        if (msg.type === 'GET_ACTIVE_JOB') {
          return { success: true, payload: { job: null } };
        }
        if (msg.type === 'INJECT_CONTENT_SCRIPT') {
          return { success: true, payload: { injected: true } };
        }
        if (msg.type === 'START_CAPTURE') {
          return {
            success: true,
            payload: {
              job: {
                id: 'job_multi_101',
                state: 'capturing',
                mode: 'selected-pages',
                progress: 10
              }
            }
          };
        }
        return { success: true, payload: {} };
      }
    );

    // Setup DOM anchors on the document for discovery
    document.body.innerHTML = `
      <nav>
        <a href="/">Home</a>
        <a href="/pricing">Pricing Plans</a>
        <a href="/blog">Blog</a>
        <a href="/blog/page/2" aria-label="Page 2">2</a>
        <a href="/account/logout">Sign Out</a>
      </nav>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
  });

  it('transitions from multi-page mode initiation to Route Review panel and executes export with selected routes', async () => {
    render(<App />);

    // Wait for tab context to load
    await waitFor(() => {
      expect(screen.getByText('example.com')).toBeDefined();
    });

    // Select multi-page mode: "selected-pages"
    const selectedPagesRadio = screen.getByRole('radio', { name: /Selected Pages/i });
    fireEvent.click(selectedPagesRadio);

    // Click "Export Selected Pages"
    const actionBtn = screen.getByRole('button', { name: /Export Selected Pages/i });
    fireEvent.click(actionBtn);

    // Route Review panel should appear
    await waitFor(() => {
      expect(screen.getByText('Select Pages to Export')).toBeDefined();
    });

    const reviewPanel = screen.getByText('Select Pages to Export').closest('.route-review-panel') as HTMLElement;
    expect(reviewPanel).toBeDefined();
    const inReview = within(reviewPanel);

    // Verify discovered routes are displayed (and destructive logout is omitted)
    expect(inReview.getByText('Pricing Plans')).toBeDefined();
    expect(inReview.getByText('P.2')).toBeDefined();
    expect(inReview.queryByText('Sign Out')).toBeNull();

    // Select even routes
    const evenBtn = inReview.getByRole('button', { name: /^even$/i });
    fireEvent.click(evenBtn);

    // Click export button in RouteReview panel
    const exportBtn = inReview.getByRole('button', { name: /Export \d+ Pages/i });
    fireEvent.click(exportBtn);

    // Should transition to capture initiation
    await waitFor(() => {
      expect(browser.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'START_CAPTURE',
          payload: expect.objectContaining({
            mode: 'selected-pages',
            tabId: 101,
            userOptions: expect.objectContaining({
              selectedUrls: expect.any(Array)
            })
          })
        })
      );
    });
  });
});
