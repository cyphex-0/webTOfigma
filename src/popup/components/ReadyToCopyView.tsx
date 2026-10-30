import React, { useState } from 'react';
import type { JobRecord } from '../../shared/contracts/messages';

export interface ReadyToCopyViewProps {
  job: JobRecord;
  onCopyToClipboard: () => Promise<{ success: boolean; bytesWritten?: number; error?: string }>;
  onStartNew: () => void;
}

export const ReadyToCopyView: React.FC<ReadyToCopyViewProps> = ({
  job,
  onCopyToClipboard,
  onStartNew
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bytesWritten, setBytesWritten] = useState<number | null>(null);

  const handleCopyClick = async () => {
    setCopyState('copying');
    setErrorMessage(null);
    try {
      const res = await onCopyToClipboard();
      if (res.success) {
        setCopyState('copied');
        setBytesWritten(res.bytesWritten ?? null);
      } else {
        setCopyState('error');
        setErrorMessage(res.error ?? 'Failed to write to clipboard');
      }
    } catch (err: unknown) {
      setCopyState('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="ready-to-copy-view" role="region" aria-labelledby="ready-to-copy-title">
      <div className="ready-header">
        <div className="ready-icon-wrap" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="12" fill="#10B981" />
            <path d="M7 12.5L10.5 16L17 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="ready-titles">
          <h2 id="ready-to-copy-title" className="ready-title">Capture Finished</h2>
          <span className="ready-subtitle">Vector scene graph packaged and ready</span>
        </div>
      </div>

      <div className="ready-stats-card">
        <div className="stat-item">
          <span className="stat-label">Nodes</span>
          <span className="stat-value">{job.nodeCount?.toLocaleString() ?? '1'}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Mode</span>
          <span className="stat-value">{job.mode}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Status</span>
          <span className="stat-value ready-status-badge">Ready to Copy</span>
        </div>
      </div>

      <div className="copy-action-box">
        <button
          type="button"
          className={`btn-copy-figma ${copyState === 'copied' ? 'btn-copied' : ''}`}
          onClick={handleCopyClick}
          disabled={copyState === 'copying'}
          autoFocus
        >
          {copyState === 'copying' && <span className="spinner-sm" aria-hidden="true" />}
          {copyState === 'copied' ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy to Figma</span>
            </>
          )}
        </button>

        {copyState === 'copied' && (
          <div className="paste-instructions-banner" role="status">
            <strong>Next Step: Paste into Figma</strong>
            <p>
              Switch to your Figma canvas and press <kbd>Ctrl</kbd> + <kbd>V</kbd> (or <kbd>⌘</kbd> + <kbd>V</kbd> on macOS).
            </p>
            {bytesWritten && (
              <span className="payload-size-note">
                Binary payload size: {(bytesWritten / 1024).toFixed(1)} KB
              </span>
            )}
          </div>
        )}

        {copyState === 'error' && errorMessage && (
          <div className="error-banner" role="alert">
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      <div className="ready-disclaimer">
        <span>Note: The extension copies data to your clipboard. It does not paste into Figma automatically.</span>
      </div>

      <div className="ready-footer-actions">
        <button
          type="button"
          className="btn-start-new"
          onClick={onStartNew}
        >
          Start New Export
        </button>
      </div>
    </div>
  );
};
