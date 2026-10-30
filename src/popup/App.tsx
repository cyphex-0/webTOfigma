import React, { useState, useEffect, useCallback } from 'react';
import { browser, getBrowserTargetName } from '../shared/browser/browser-api';
import {
  prepareClipboardPayload,
  writePreparedClipboardPayload,
  type PreparedClipboardPayload
} from '../core/figma/poc/clipboard-poc';
import { POC_FIXTURES } from '../core/figma/poc/fixtures';
import type {
  ActiveTabContext,
  GetActiveTabContextResponse,
  InjectContentScriptResponse,
  StartCaptureResponse,
  JobRecord,
  MessageResponse
} from '../shared/contracts/messages';

export const App: React.FC = () => {
  const targetName = getBrowserTargetName();

  // Tab & Runtime State
  const [activeTab, setActiveTab] = useState<ActiveTabContext | null>(null);
  const [tabLoading, setTabLoading] = useState<boolean>(true);
  const [injectStatus, setInjectStatus] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<JobRecord | null>(null);

  // Phase 1 PoC State
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>('nested-card');
  const [preparedPayload, setPreparedPayload] = useState<PreparedClipboardPayload | null>(null);
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Background Ping State
  const [pingResult, setPingResult] = useState<string | null>(null);

  // Fetch active tab context from background
  const fetchActiveTabContext = useCallback(async () => {
    setTabLoading(true);
    try {
      const response = (await browser.runtime.sendMessage({
        id: `req_${Date.now()}`,
        type: 'GET_ACTIVE_TAB_CONTEXT',
        payload: {},
        timestamp: Date.now()
      })) as MessageResponse<GetActiveTabContextResponse>;

      if (response.success && response.payload?.tab) {
        setActiveTab(response.payload.tab);
      } else {
        setActiveTab(null);
      }
    } catch {
      setActiveTab(null);
    } finally {
      setTabLoading(false);
    }
  }, []);

  // Fetch active job status from background
  const fetchActiveJob = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        id: `req_${Date.now()}`,
        type: 'GET_JOB_STATUS',
        payload: {},
        timestamp: Date.now()
      })) as MessageResponse<{ job: JobRecord | null }>;

      if (response.success && response.payload?.job) {
        setActiveJob(response.payload.job);
      } else {
        setActiveJob(null);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    void fetchActiveTabContext();
    void fetchActiveJob();
  }, [fetchActiveTabContext, fetchActiveJob]);

  // Precompute Phase 1 clipboard payload ahead of click
  const precompute = useCallback(async (fixtureId: string) => {
    setIsPreparing(true);
    setCopyFeedback(null);
    try {
      const prepared = await prepareClipboardPayload(fixtureId);
      setPreparedPayload(prepared);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCopyFeedback({ success: false, message: `Precomputation failed: ${msg}` });
    } finally {
      setIsPreparing(false);
    }
  }, []);

  useEffect(() => {
    void precompute(selectedFixtureId);
  }, [selectedFixtureId, precompute]);

  // Handle direct zero-I/O clipboard write
  const handleCopy = async () => {
    if (!preparedPayload) return;
    try {
      await writePreparedClipboardPayload(preparedPayload);
      setCopyFeedback({
        success: true,
        message: 'Payload copied! Switch to Figma and press Ctrl+V (or Cmd+V).'
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCopyFeedback({
        success: false,
        message: `Clipboard write error: ${msg}`
      });
    }
  };

  // Inject content script into active tab
  const handleInjectScript = async () => {
    if (!activeTab?.tabId) return;
    setInjectStatus('Injecting content script...');
    try {
      const response = (await browser.runtime.sendMessage({
        id: `req_${Date.now()}`,
        type: 'INJECT_CONTENT_SCRIPT',
        payload: { tabId: activeTab.tabId },
        timestamp: Date.now()
      })) as MessageResponse<InjectContentScriptResponse>;

      if (response.success) {
        setInjectStatus('✅ Content script injected successfully!');
      } else {
        setInjectStatus(`❌ Injection failed: ${response.error?.message ?? 'Unknown error'}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setInjectStatus(`❌ Injection error: ${msg}`);
    }
  };

  // Start test capture job
  const handleStartCapture = async () => {
    if (!activeTab?.tabId) return;
    try {
      const response = (await browser.runtime.sendMessage({
        id: `req_${Date.now()}`,
        type: 'START_CAPTURE',
        payload: { tabId: activeTab.tabId, mode: 'single-page' },
        timestamp: Date.now()
      })) as MessageResponse<StartCaptureResponse>;

      if (response.success && response.payload?.job) {
        setActiveJob(response.payload.job);
      }
    } catch {
      // Ignore
    }
  };

  // Cancel active job
  const handleCancelJob = async () => {
    if (!activeJob?.jobId) return;
    try {
      const response = (await browser.runtime.sendMessage({
        id: `req_${Date.now()}`,
        type: 'CANCEL_JOB',
        payload: { jobId: activeJob.jobId, reason: 'Cancelled by user' },
        timestamp: Date.now()
      })) as MessageResponse<{ job: JobRecord }>;

      if (response.success && response.payload?.job) {
        setActiveJob(response.payload.job);
      }
    } catch {
      // Ignore
    }
  };

  const handlePing = async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        id: `req_${Date.now()}`,
        type: 'PING',
        payload: {},
        timestamp: Date.now()
      })) as MessageResponse<{ pong: boolean; workerTime: number }>;

      setPingResult(JSON.stringify(response));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to ping background';
      setPingResult(`Error: ${msg}`);
    }
  };

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="header">
        <div className="title-area">
          <div className="logo-badge">W</div>
          <div className="title-text">
            <h1>Web-to-Figma</h1>
          </div>
        </div>
        <span className="target-badge">{targetName}</span>
      </div>

      {/* Phase 2: Tab Context & Injection Card */}
      <div className="runtime-card">
        <div className="card-header">
          <span className="phase-badge">Phase 2 Runtime</span>
          <span className="card-title">Active Tab Context</span>
        </div>

        {tabLoading ? (
          <div className="tab-loading">Reading active tab...</div>
        ) : activeTab ? (
          <div className="tab-info">
            <div className="tab-title-row">
              <span className="tab-title" title={activeTab.title}>
                {activeTab.title}
              </span>
              <span
                className={`inject-badge ${
                  activeTab.isInjectable ? 'badge-ok' : 'badge-restricted'
                }`}
              >
                {activeTab.isInjectable ? 'Injectable' : 'Restricted'}
              </span>
            </div>
            <div className="tab-url" title={activeTab.url}>
              {activeTab.url}
            </div>

            {activeTab.restrictionReason && (
              <div className="restriction-reason">
                {activeTab.restrictionReason}
              </div>
            )}

            <div className="runtime-actions">
              <button
                className="secondary-btn"
                disabled={!activeTab.isInjectable}
                onClick={handleInjectScript}
              >
                💉 Inject Content Script
              </button>
              <button
                className="secondary-btn"
                disabled={!activeTab.isInjectable}
                onClick={handleStartCapture}
              >
                🚀 Start Capture Job
              </button>
            </div>

            {injectStatus && <div className="status-note">{injectStatus}</div>}
          </div>
        ) : (
          <div className="tab-empty">No active tab detected</div>
        )}

        {/* Active Job Monitor */}
        {activeJob && (
          <div className="job-monitor">
            <div className="job-meta-row">
              <span className="job-state-tag">{activeJob.state}</span>
              <span className="job-step">{activeJob.currentStep}</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{ width: `${activeJob.progressPercent}%` }}
              />
            </div>
            {['capturing', 'processing', 'injecting'].includes(activeJob.state) && (
              <button className="cancel-btn" onClick={handleCancelJob}>
                Cancel Job
              </button>
            )}
          </div>
        )}
      </div>

      {/* Phase 1: Direct Clipboard PoC Tester */}
      <div className="poc-card">
        <div className="poc-header">
          <span className="poc-badge">Phase 1 PoC</span>
          <span className="poc-subtitle">Direct Clipboard Paste</span>
        </div>

        <div className="fixture-selector-group">
          <label htmlFor="fixture-select" className="fixture-label">
            Select Test Fixture:
          </label>
          <select
            id="fixture-select"
            className="fixture-select"
            value={selectedFixtureId}
            onChange={(e) => setSelectedFixtureId(e.target.value)}
          >
            {Object.values(POC_FIXTURES).map((f) => (
              <option key={f.id} value={f.id}>
                {f.title} ({f.nodeCount} nodes)
              </option>
            ))}
          </select>
        </div>

        <p className="fixture-desc">
          {POC_FIXTURES[selectedFixtureId]?.description}
        </p>

        <div className="payload-meta-row">
          {isPreparing ? (
            <span className="meta-status preparing">Preparing payload...</span>
          ) : preparedPayload ? (
            <span className="meta-status ready">
              ⚡ Ready ({preparedPayload.binaryBytes} B binary | {preparedPayload.nodeCount} nodes)
            </span>
          ) : (
            <span className="meta-status error">Payload not ready</span>
          )}
        </div>

        <button
          className="copy-btn"
          disabled={!preparedPayload || isPreparing}
          onClick={handleCopy}
        >
          {isPreparing ? 'Precomputing...' : '📋 Copy to Figma Clipboard'}
        </button>

        {copyFeedback && (
          <div
            className={`feedback-banner ${
              copyFeedback.success ? 'feedback-success' : 'feedback-error'
            }`}
          >
            <div className="feedback-text">{copyFeedback.message}</div>
          </div>
        )}
      </div>

      {/* Background Diagnostic Ping */}
      <div className="diag-section">
        <button className="ping-btn" onClick={handlePing}>
          Ping Background Worker
        </button>
        {pingResult && <div className="ping-result">{pingResult}</div>}
      </div>

      {/* Footer */}
      <div className="footer">
        <span>v0.1.0</span>
        <a onClick={() => browser.runtime.openOptionsPage?.()}>Options</a>
      </div>
    </div>
  );
};
