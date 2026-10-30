import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../popup/App';
import { browser } from '../../shared/browser/browser-api';
import { settingsStore } from '../../core/settings/settings-store';
import type { JobRecord } from '../../shared/contracts/messages';

describe('Popup App Component', () => {
  beforeEach(async () => {
    await browser.storage.local.clear();
    await settingsStore.resetToDefaults();
    vi.restoreAllMocks();
  });

  it('renders header, hostname badge, and active profile on supported tab', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_ACTIVE_TAB_CONTEXT') {
        return {
          id: msg.id,
          success: true,
          payload: {
            tab: {
              tabId: 101,
              url: 'https://acme.design/landing',
              title: 'Acme Design System',
              isInjectable: true
            }
          }
        };
      }
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: null } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<App />);

    expect(await screen.findByText(/Web to Figma/i)).toBeDefined();
    expect(await screen.findByText('acme.design')).toBeDefined();
    expect(await screen.findByText(/Desktop Standard \(1440px\)/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Export Full Page to Figma/i })).toBeDefined();
  });

  it('displays restricted page alert and disables export on internal chrome URLs', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_ACTIVE_TAB_CONTEXT') {
        return {
          id: msg.id,
          success: true,
          payload: {
            tab: {
              tabId: 102,
              url: 'chrome://extensions',
              title: 'Extensions',
              isInjectable: false,
              restrictionReason: 'Browser internal page'
            }
          }
        };
      }
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: null } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<App />);

    expect(await screen.findByText(/Restricted Page/i)).toBeDefined();
    const exportBtn = screen.getByRole('button', { name: /Export Full Page to Figma/i });
    expect(exportBtn.hasAttribute('disabled')).toBe(true);
    expect(screen.getByText(/Export is unavailable on browser internal pages/i)).toBeDefined();
  });

  it('initiates export when clicking primary button on injectable tab', async () => {
    const sendSpy = vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_ACTIVE_TAB_CONTEXT') {
        return {
          id: msg.id,
          success: true,
          payload: {
            tab: {
              tabId: 101,
              url: 'https://example.com',
              title: 'Example',
              isInjectable: true
            }
          }
        };
      }
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: null } };
      }
      if (msg.type === 'INJECT_CONTENT_SCRIPT') {
        return { id: msg.id, success: true, payload: { tabId: 101, injected: true, version: '0.1.0' } };
      }
      if (msg.type === 'START_CAPTURE') {
        return {
          id: msg.id,
          success: true,
          payload: {
            job: {
              jobId: 'job_test_1',
              tabId: 101,
              url: 'https://example.com',
              origin: 'https://example.com',
              mode: 'single-page',
              state: 'capturing',
              createdAt: Date.now(),
              updatedAt: Date.now(),
              progressPercent: 25,
              currentStep: 'Analyzing elements',
              warnings: []
            } as JobRecord
          }
        };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<App />);

    const exportBtn = await screen.findByRole('button', { name: /Export Full Page to Figma/i });
    fireEvent.click(exportBtn);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'INJECT_CONTENT_SCRIPT' })
      );
      expect(sendSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'START_CAPTURE' })
      );
    });
  });

  it('renders JobProgressView when an active job is running', async () => {
    const activeRunningJob: JobRecord = {
      jobId: 'job_progress_123',
      tabId: 101,
      url: 'https://example.com',
      origin: 'https://example.com',
      mode: 'single-page',
      state: 'capturing',
      createdAt: Date.now() - 5000,
      updatedAt: Date.now(),
      progressPercent: 60,
      currentStep: 'Extracting DOM styles',
      nodeCount: 142,
      warnings: ['CSS backdrop-filter clamped']
    };

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_ACTIVE_TAB_CONTEXT') {
        return {
          id: msg.id,
          success: true,
          payload: {
            tab: { tabId: 101, url: 'https://example.com', title: 'Example', isInjectable: true }
          }
        };
      }
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: activeRunningJob } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<App />);

    expect(await screen.findByText(/Capturing Rendered Elements.../i)).toBeDefined();
    expect(screen.getByText('Extracting DOM styles')).toBeDefined();
    expect(screen.getByText('60%')).toBeDefined();
    expect(screen.getByText(/Nodes Extracted:/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /Cancel Export/i })).toBeDefined();
  });

  it('renders ReadyToCopyView and writes to clipboard on user click', async () => {
    const readyJob: JobRecord = {
      jobId: 'job_ready_456',
      tabId: 101,
      url: 'https://example.com',
      origin: 'https://example.com',
      mode: 'single-page',
      state: 'ready_to_copy',
      createdAt: Date.now() - 10000,
      updatedAt: Date.now(),
      progressPercent: 100,
      currentStep: 'Vector payload precomputed',
      nodeCount: 88,
      warnings: []
    };

    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_ACTIVE_TAB_CONTEXT') {
        return {
          id: msg.id,
          success: true,
          payload: {
            tab: { tabId: 101, url: 'https://example.com', title: 'Example', isInjectable: true }
          }
        };
      }
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: readyJob } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    // Mock navigator.clipboard
    const clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        write: clipboardWriteMock
      }
    });

    render(<App />);

    expect(await screen.findByText(/Capture Finished/i)).toBeDefined();
    const copyButton = screen.getByRole('button', { name: /Copy to Figma/i });
    expect(copyButton).toBeDefined();

    fireEvent.click(copyButton);

    expect(await screen.findByText(/Copied to Clipboard!/i)).toBeDefined();
    expect(screen.getByText(/Next Step: Paste into Figma/i)).toBeDefined();
    expect(clipboardWriteMock).toHaveBeenCalled();
  });

  it('opens and closes HelpModal via header trigger and escape key', async () => {
    vi.spyOn(browser.runtime, 'sendMessage').mockImplementation(async (msg: any) => {
      if (msg.type === 'GET_ACTIVE_TAB_CONTEXT') {
        return {
          id: msg.id,
          success: true,
          payload: {
            tab: { tabId: 101, url: 'https://example.com', title: 'Example', isInjectable: true }
          }
        };
      }
      if (msg.type === 'GET_JOB_STATUS') {
        return { id: msg.id, success: true, payload: { job: null } };
      }
      return { id: msg.id, success: true, payload: {} };
    });

    render(<App />);

    const helpBtn = await screen.findByRole('button', { name: /Help and Troubleshooting/i });
    fireEvent.click(helpBtn);

    expect(await screen.findByText(/How to Use Web to Figma/i)).toBeDefined();

    // Press Escape to dismiss
    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByText(/How to Use Web to Figma/i)).toBeNull();
    });
  });
});
