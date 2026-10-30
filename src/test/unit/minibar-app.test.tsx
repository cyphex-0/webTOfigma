import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MinibarApp } from '../../content/minibar/MinibarApp';
import {
  injectMinibarHost,
  mountMinibar,
  toggleMinibar
} from '../../content/minibar/inject-minibar';
import {
  MINIBAR_HOST_ID,
  teardownMinibar,
  isMinibarInjected
} from '../../content/minibar/teardown';
import { browser } from '../../shared/browser/browser-api';
import type { JobRecord } from '../../shared/contracts/messages';

describe('MinibarApp Component and In-Page Lifecycle', () => {
  let hostEl: HTMLElement;

  beforeEach(() => {
    teardownMinibar();
    hostEl = document.createElement('div');
    document.body.appendChild(hostEl);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    teardownMinibar();
    if (hostEl.parentNode) {
      hostEl.parentNode.removeChild(hostEl);
    }
  });

  it('renders collapsed pill with brand title, drag handle, and default mode buttons', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: null } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<MinibarApp hostElement={hostEl} initialExpanded={false} />);

    expect(screen.getByText('Figma')).toBeDefined();
    expect(screen.getByRole('button', { name: /Full Page/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Viewport/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Expand/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Close Minibar/i })).toBeDefined();
  });

  it('toggles between collapsed and expanded modes when clicking expand button', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: null } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<MinibarApp hostElement={hostEl} initialExpanded={false} />);

    // Initially collapsed: Element button is not shown
    expect(screen.queryByRole('button', { name: /^Element$/i })).toBeNull();

    // Click Expand (+)
    const expandBtn = screen.getByRole('button', { name: /Expand/i });
    fireEvent.click(expandBtn);

    // Now expanded: Element button is present
    expect(await screen.findByRole('button', { name: /^Element$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Collapse/i })).toBeDefined();

    // Click Collapse (−)
    const collapseBtn = screen.getByRole('button', { name: /Collapse/i });
    fireEvent.click(collapseBtn);

    // Collapsed again
    expect(screen.queryByRole('button', { name: /^Element$/i })).toBeNull();
  });

  it('dispatches START_CAPTURE runtime message when user clicks Full Page', async () => {
    let capturedMessage: any = null;

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'START_CAPTURE') {
        capturedMessage = msg;
        const mockJob: JobRecord = {
          jobId: 'job_test_123',
          tabId: 101,
          url: 'https://example.com',
          origin: 'https://example.com',
          mode: 'single-page',
          state: 'capturing',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          progressPercent: 10,
          currentStep: 'Starting page extraction',
          warnings: []
        };
        return { id: msg.id, success: true, payload: { job: mockJob } };
      }
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: null } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<MinibarApp hostElement={hostEl} initialExpanded={false} />);

    const fullPageBtn = screen.getByRole('button', { name: /Full Page/i });
    fireEvent.click(fullPageBtn);

    await waitFor(() => {
      expect(capturedMessage).not.toBeNull();
      expect(capturedMessage.type).toBe('START_CAPTURE');
      expect(capturedMessage.payload.mode).toBe('full-page');
      expect(capturedMessage.payload.userOptions.triggeredFromMinibar).toBe(true);
    });
  });

  it('displays live progress percentage and allows cancelling active capture', async () => {
    const mockActiveJob: JobRecord = {
      jobId: 'job_progress_456',
      tabId: 101,
      url: 'https://example.com',
      origin: 'https://example.com',
      mode: 'single-page',
      state: 'capturing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progressPercent: 65,
      currentStep: 'Converting CSS properties to vector models',
      warnings: []
    };

    let cancelDispatched = false;

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: mockActiveJob } };
      }
      if (msg.type === 'CANCEL_JOB') {
        cancelDispatched = true;
        return { id: msg.id, success: true, payload: { job: { ...mockActiveJob, state: 'cancelled' } } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    // Render expanded view with active job
    render(<MinibarApp hostElement={hostEl} initialExpanded={true} />);

    expect(await screen.findByText('65%')).toBeDefined();
    expect(await screen.findByText(/Converting CSS properties to vector models/i)).toBeDefined();

    const cancelBtn = screen.getByRole('button', { name: /Cancel Capture/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelDispatched).toBe(true);
    });
  });

  it('displays Ready to Copy state and performs clipboard write upon user click', async () => {
    const clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      clipboard: {
        write: clipboardWriteMock
      }
    });

    const mockReadyJob: JobRecord = {
      jobId: 'job_ready_789',
      tabId: 101,
      url: 'https://example.com',
      origin: 'https://example.com',
      mode: 'single-page',
      state: 'ready_to_copy',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      progressPercent: 100,
      currentStep: 'Packaging complete',
      nodeCount: 142,
      warnings: []
    };

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: mockReadyJob } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<MinibarApp hostElement={hostEl} initialExpanded={true} />);

    expect(await screen.findByText(/Capture Ready!/i)).toBeDefined();
    expect(screen.getByText(/Nodes: 142/i)).toBeDefined();

    const copyBtn = screen.getByRole('button', { name: /Copy to Figma/i });
    expect(copyBtn).toBeDefined();

    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Copied to Clipboard!/i)).toBeDefined();
      expect(clipboardWriteMock).toHaveBeenCalled();
    });
  });

  it('close button dispatches teardownMinibar and removes host from document', async () => {
    await act(async () => {
      mountMinibar();
    });
    expect(isMinibarInjected()).toBe(true);

    const host = document.getElementById(MINIBAR_HOST_ID);
    expect(host).not.toBeNull();
    const shadow = host?.shadowRoot;
    expect(shadow).not.toBeNull();

    // Await React 18 async mount inside shadow DOM
    await waitFor(() => {
      const btn = shadow?.querySelector('button[aria-label="Close Minibar"]');
      expect(btn).not.toBeNull();
    });

    // Click close button inside Shadow DOM
    const closeBtn = shadow?.querySelector('button[aria-label="Close Minibar"]') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(isMinibarInjected()).toBe(false);
    expect(document.getElementById(MINIBAR_HOST_ID)).toBeNull();
  });

  it('toggleMinibar alternates injection and teardown state', async () => {
    expect(isMinibarInjected()).toBe(false);

    // First toggle: injects
    let active1 = false;
    await act(async () => {
      active1 = toggleMinibar();
    });
    expect(active1).toBe(true);
    expect(isMinibarInjected()).toBe(true);
    expect(document.getElementById(MINIBAR_HOST_ID)).not.toBeNull();

    // Second toggle: tears down
    let active2 = true;
    await act(async () => {
      active2 = toggleMinibar();
    });
    expect(active2).toBe(false);
    expect(isMinibarInjected()).toBe(false);
    expect(document.getElementById(MINIBAR_HOST_ID)).toBeNull();
  });
});
