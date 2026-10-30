import React, { useState, useEffect, useRef, useCallback } from 'react';
import { browser } from '../../shared/browser/browser-api';
import { DragController } from './drag-controller';
import { teardownMinibar } from './teardown';
import type {
  JobRecord,
  MessageResponse,
  StartCaptureResponse,
  GetJobStatusResponse,
  CancelJobResponse
} from '../../shared/contracts/messages';
import {
  prepareClipboardPayload,
  writePreparedClipboardPayload
} from '../../core/figma/poc/clipboard-poc';

const STORAGE_KEY_JOBS = 'w2f_jobs';
const STORAGE_KEY_ACTIVE_JOB_ID = 'w2f_active_job_id';

export interface MinibarAppProps {
  hostElement: HTMLElement;
  initialExpanded?: boolean;
}

export const MinibarApp: React.FC<MinibarAppProps> = ({
  hostElement,
  initialExpanded = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);

  const [isExpanded, setIsExpanded] = useState<boolean>(initialExpanded);
  const [activeJob, setActiveJob] = useState<JobRecord | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Initialize Drag Controller
  useEffect(() => {
    if (!handleRef.current) return;

    const controller = new DragController(hostElement, handleRef.current);
    void controller.restorePosition();

    return () => {
      controller.destroy();
    };
  }, [hostElement]);

  // Query background for active job status
  const fetchJobStatus = useCallback(async () => {
    try {
      const response = (await browser.runtime.sendMessage({
        id: `minibar_stat_${Date.now()}`,
        type: 'GET_JOB_STATUS',
        payload: {},
        timestamp: Date.now()
      })) as MessageResponse<GetJobStatusResponse>;

      if (response && response.success && response.payload?.job) {
        setActiveJob(response.payload.job);
      } else if (response && response.success && !response.payload?.job) {
        setActiveJob(null);
      }
    } catch {
      // In standalone tests or disconnected contexts, ignore
    }
  }, []);

  // Poll and subscribe to storage changes for job updates
  useEffect(() => {
    void fetchJobStatus();

    const handleStorageChange = (
      changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
      areaName: string
    ) => {
      if (areaName === 'local') {
        if (changes[STORAGE_KEY_ACTIVE_JOB_ID] || changes[STORAGE_KEY_JOBS]) {
          void fetchJobStatus();
        }
      }
    };

    browser.storage.onChanged.addListener(handleStorageChange);

    return () => {
      browser.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [fetchJobStatus]);

  // Polling fallback when job is actively running
  useEffect(() => {
    const isRunning = Boolean(
      activeJob &&
        (activeJob.state === 'capturing' ||
          activeJob.state === 'processing' ||
          activeJob.state === 'injecting')
    );

    if (!isRunning) return;

    const interval = setInterval(() => {
      void fetchJobStatus();
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [activeJob, fetchJobStatus]);

  // Handle Export Initiation
  const handleStartCapture = async (mode: 'viewport' | 'full-page' | 'select-element') => {
    setIsStarting(true);
    setCopyState('idle');
    setCopyFeedback(null);

    if (mode === 'select-element') {
      try {
        await browser.runtime.sendMessage({
          id: `minibar_pick_${Date.now()}`,
          type: 'ACTIVATE_ELEMENT_PICKER',
          payload: {},
          timestamp: Date.now()
        });
      } catch (err) {
        console.error('[WebToFigma] Error activating element picker from minibar:', err);
      } finally {
        setIsStarting(false);
      }
      return;
    }

    try {
      const response = (await browser.runtime.sendMessage({
        id: `minibar_cap_${Date.now()}`,
        type: 'START_CAPTURE',
        payload: {
          mode,
          userOptions: { triggeredFromMinibar: true }
        },
        timestamp: Date.now()
      })) as MessageResponse<StartCaptureResponse>;

      if (response && response.success && response.payload?.job) {
        setActiveJob(response.payload.job);
      }
    } catch (err) {
      console.error('[WebToFigma] Error starting capture from minibar:', err);
    } finally {
      setIsStarting(false);
    }
  };

  // Handle Job Cancellation
  const handleCancelJob = async () => {
    if (!activeJob) return;
    try {
      const response = (await browser.runtime.sendMessage({
        id: `minibar_can_${Date.now()}`,
        type: 'CANCEL_JOB',
        payload: { jobId: activeJob.jobId, reason: 'Cancelled from in-page minibar' },
        timestamp: Date.now()
      })) as MessageResponse<CancelJobResponse>;

      if (response && response.success) {
        setActiveJob(null);
      }
    } catch (err) {
      console.error('[WebToFigma] Error cancelling job from minibar:', err);
    }
  };

  // Handle Copy to Figma with zero-I/O user gesture
  const handleCopyToFigma = async () => {
    setCopyState('copying');
    setCopyFeedback(null);
    try {
      const prepared = await prepareClipboardPayload('nested-card');
      await writePreparedClipboardPayload(prepared);
      setCopyState('copied');
      setCopyFeedback('Copied! Press Ctrl+V in Figma');
    } catch (err: unknown) {
      setCopyState('error');
      const msg = err instanceof Error ? err.message : String(err);
      setCopyFeedback(`Copy failed: ${msg}`);
    }
  };

  const isJobRunning = Boolean(
    activeJob &&
      (activeJob.state === 'capturing' ||
        activeJob.state === 'processing' ||
        activeJob.state === 'injecting')
  );

  const isReadyToCopy = Boolean(
    activeJob && (activeJob.state === 'ready_to_copy' || activeJob.state === 'completed')
  );

  return (
    <div
      ref={containerRef}
      className={`minibar-container ${isExpanded ? 'expanded' : 'collapsed'}`}
      role="region"
      aria-label="Web to Figma In-Page Controls"
    >
      {/* Drag Handle Row */}
      <div
        ref={handleRef}
        className="minibar-drag-handle"
        title="Drag to reposition minibar"
      >
        <div className="minibar-drag-dots" aria-hidden="true">
          <span className="drag-dot" />
          <span className="drag-dot" />
          <span className="drag-dot" />
        </div>
        <span className="minibar-brand-name">Figma</span>
      </div>

      {/* Collapsed Pill View */}
      {!isExpanded && (
        <>
          {isReadyToCopy ? (
            <div className="minibar-compact-job">
              <button
                type="button"
                className={`minibar-compact-copy-btn ${copyState === 'copied' ? 'copied' : ''}`}
                onClick={handleCopyToFigma}
                disabled={copyState === 'copying'}
                title="Copy ready capture to Figma clipboard"
              >
                {copyState === 'copied' ? '✓ Copied!' : 'Copy to Figma'}
              </button>
            </div>
          ) : isJobRunning && activeJob ? (
            <div className="minibar-compact-job">
              <span className="spinner-xs" aria-hidden="true" />
              <span className="minibar-percent-label">{activeJob.progressPercent}%</span>
              <button
                type="button"
                className="minibar-btn-cancel"
                onClick={handleCancelJob}
                title="Cancel capture"
              >
                Stop
              </button>
            </div>
          ) : (
            <div className="minibar-actions-row">
              <button
                type="button"
                className="minibar-btn minibar-btn-primary"
                onClick={() => handleStartCapture('full-page')}
                disabled={isStarting}
                title="Export full scrollable page to Figma"
              >
                {isStarting ? <span className="spinner-xs" aria-hidden="true" /> : null}
                <span>Full Page</span>
              </button>

              <button
                type="button"
                className="minibar-btn"
                onClick={() => handleStartCapture('viewport')}
                disabled={isStarting}
                title="Capture visible viewport"
              >
                <span>Viewport</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Expanded Card View */}
      {isExpanded && (
        <>
          {isReadyToCopy && activeJob ? (
            <div className="minibar-ready-box">
              <div className="minibar-ready-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="12" fill="#10B981" />
                  <path
                    d="M7 12.5L10.5 16L17 8.5"
                    stroke="white"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Capture Ready!</span>
              </div>

              <div className="minibar-ready-meta">
                <span>Mode: {activeJob.mode}</span>
                <span>Nodes: {activeJob.nodeCount ?? 1}</span>
              </div>

              <button
                type="button"
                className={`minibar-btn-copy ${copyState === 'copied' ? 'copied' : ''}`}
                onClick={handleCopyToFigma}
                disabled={copyState === 'copying'}
              >
                {copyState === 'copied' ? '✓ Copied to Clipboard!' : 'Copy to Figma'}
              </button>

              {copyFeedback && (
                <div className="minibar-copy-feedback" role="status">
                  {copyFeedback}
                </div>
              )}

              <div className="minibar-ready-footer">
                <button
                  type="button"
                  className="minibar-btn-dismiss"
                  onClick={() => setActiveJob(null)}
                >
                  Dismiss / New Export
                </button>
              </div>
            </div>
          ) : isJobRunning && activeJob ? (
            <div className="minibar-status-surface">
              <div className="minibar-status-text-row">
                <span className="minibar-step-label">{activeJob.currentStep || 'Exporting...'}</span>
                <span className="minibar-percent-label">{activeJob.progressPercent}%</span>
              </div>

              <div className="minibar-progress-bar-bg">
                <div
                  className="minibar-progress-bar-fill"
                  style={{ width: `${activeJob.progressPercent}%` }}
                />
              </div>

              <button
                type="button"
                className="minibar-btn-cancel"
                onClick={handleCancelJob}
              >
                Cancel Capture
              </button>
            </div>
          ) : (
            <div className="minibar-actions-row" style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                className="minibar-btn minibar-btn-primary"
                onClick={() => handleStartCapture('full-page')}
                disabled={isStarting}
                title="Export full scrollable page to Figma"
                style={{ flex: 1 }}
              >
                {isStarting ? <span className="spinner-xs" aria-hidden="true" /> : null}
                <span>Full Page</span>
              </button>

              <button
                type="button"
                className="minibar-btn"
                onClick={() => handleStartCapture('viewport')}
                disabled={isStarting}
                title="Capture visible viewport"
                style={{ flex: 1 }}
              >
                <span>Viewport</span>
              </button>

              <button
                type="button"
                className="minibar-btn"
                onClick={() => handleStartCapture('select-element')}
                disabled={isStarting}
                title="Select specific element"
                style={{ flex: 1 }}
              >
                <span>Element</span>
              </button>
            </div>
          )}
        </>
      )}

      {/* Expand/Collapse Toggle & Close Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginLeft: 'auto' }}>
        <button
          type="button"
          className="minibar-icon-btn"
          onClick={() => setIsExpanded((prev) => !prev)}
          title={isExpanded ? 'Collapse minibar' : 'Expand minibar'}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '−' : '+'}
        </button>

        <button
          type="button"
          className="minibar-icon-btn"
          onClick={() => teardownMinibar()}
          title="Close in-page minibar"
          aria-label="Close Minibar"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
