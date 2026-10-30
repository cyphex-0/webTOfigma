import { describe, it, expect, beforeEach } from 'vitest';
import { handleRuntimeMessage } from '../../background/message-router';
import { jobRegistry } from '../../background/job-registry';

describe('Message Router RPC and Validation', () => {
  beforeEach(async () => {
    await jobRegistry.clearAll();
  });

  it('handles GET_ACTIVE_TAB_CONTEXT for a valid active tab', async () => {
    const response = await handleRuntimeMessage({
      id: 'req_1',
      type: 'GET_ACTIVE_TAB_CONTEXT',
      payload: {},
      timestamp: Date.now()
    });

    expect(response.success).toBe(true);
    expect(response.payload).toBeDefined();
    const payload = response.payload as { tab: any };
    expect(payload.tab.tabId).toBe(101);
    expect(payload.tab.url).toBe('https://example.com/test');
    expect(payload.tab.isInjectable).toBe(true);
  });

  it('rejects INJECT_CONTENT_SCRIPT when tab is restricted', async () => {
    // Set mock tabs with restricted chrome:// URL
    const g = globalThis as Record<string, any>;
    g.__setMockTabs([
      { id: 999, url: 'chrome://settings', title: 'Settings', active: true, currentWindow: true }
    ]);

    const response = await handleRuntimeMessage({
      id: 'req_2',
      type: 'INJECT_CONTENT_SCRIPT',
      payload: { tabId: 999 },
      timestamp: Date.now()
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('RESTRICTED_URL');
    expect(response.error?.message).toContain('chrome://');

    // Reset tabs
    g.__setMockTabs([
      { id: 101, url: 'https://example.com/test', title: 'Example', active: true, currentWindow: true }
    ]);
  });

  it('handles START_CAPTURE and initializes a job', async () => {
    const response = await handleRuntimeMessage({
      id: 'req_3',
      type: 'START_CAPTURE',
      payload: { tabId: 101, mode: 'single-page' },
      timestamp: Date.now()
    });

    expect(response.success).toBe(true);
    const payload = response.payload as { job: any };
    expect(payload.job.state).toBe('capturing');
    expect(payload.job.tabId).toBe(101);
  });

  it('handles GET_JOB_STATUS and CANCEL_JOB', async () => {
    // Start capture first
    const startResp = await handleRuntimeMessage({
      id: 'req_start',
      type: 'START_CAPTURE',
      payload: { tabId: 101, mode: 'single-page' },
      timestamp: Date.now()
    });
    const jobId = (startResp.payload as any).job.jobId;

    // Get status
    const statusResp = await handleRuntimeMessage({
      id: 'req_status',
      type: 'GET_JOB_STATUS',
      payload: { jobId },
      timestamp: Date.now()
    });
    expect(statusResp.success).toBe(true);
    expect((statusResp.payload as any).job.jobId).toBe(jobId);

    // Cancel job
    const cancelResp = await handleRuntimeMessage({
      id: 'req_cancel',
      type: 'CANCEL_JOB',
      payload: { jobId, reason: 'Testing cancel' },
      timestamp: Date.now()
    });
    expect(cancelResp.success).toBe(true);
    expect((cancelResp.payload as any).job.state).toBe('cancelled');
  });

  it('handles PING with worker timestamp', async () => {
    const response = await handleRuntimeMessage({
      id: 'req_ping',
      type: 'PING',
      payload: {},
      timestamp: Date.now()
    });

    expect(response.success).toBe(true);
    const payload = response.payload as { pong: boolean; version: string };
    expect(payload.pong).toBe(true);
    expect(payload.version).toBe('0.1.0');
  });

  it('rejects unknown message types with INVALID_MESSAGE_PAYLOAD error', async () => {
    const response = await handleRuntimeMessage({
      id: 'req_unknown',
      type: 'NON_EXISTENT_TYPE',
      payload: {},
      timestamp: Date.now()
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('INVALID_MESSAGE_PAYLOAD');
    expect(response.error?.message).toContain('Unknown message type');
  });
});
