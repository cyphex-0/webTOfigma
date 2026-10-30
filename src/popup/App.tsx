import React, { useState, useEffect, useCallback } from 'react';
import { browser, getBrowserTargetName } from '../shared/browser/browser-api';
import {
  prepareClipboardPayload,
  writePreparedClipboardPayload,
  type PreparedClipboardPayload
} from '../core/figma/poc/clipboard-poc';
import { POC_FIXTURES } from '../core/figma/poc/fixtures';

export const App: React.FC = () => {
  const targetName = getBrowserTargetName();

  // Test Harness State
  const [selectedFixtureId, setSelectedFixtureId] = useState<string>('nested-card');
  const [preparedPayload, setPreparedPayload] = useState<PreparedClipboardPayload | null>(null);
  const [isPreparing, setIsPreparing] = useState<boolean>(false);
  const [copyFeedback, setCopyFeedback] = useState<{
    success: boolean;
    message: string;
    fixtureTitle?: string;
  } | null>(null);

  // Background Ping State
  const [pingResult, setPingResult] = useState<string | null>(null);

  // Precompute clipboard payload whenever selected fixture changes (Zero-I/O in click handler)
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

  // Synchronous, zero-I/O copy handler triggered by direct user click
  const handleCopy = async () => {
    if (!preparedPayload) return;

    try {
      await writePreparedClipboardPayload(preparedPayload);
      setCopyFeedback({
        success: true,
        message: 'Payload copied! Switch to Figma canvas and press Ctrl+V (or Cmd+V).',
        fixtureTitle: preparedPayload.title
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setCopyFeedback({
        success: false,
        message: `Clipboard write error: ${msg}`
      });
    }
  };

  const handlePing = async () => {
    try {
      const response = await browser.runtime.sendMessage({ type: 'PING' });
      setPingResult(JSON.stringify(response));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to ping background';
      setPingResult(`Error: ${msg}`);
    }
  };

  const handleOpenOptions = () => {
    browser.runtime.openOptionsPage?.();
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

      {/* Phase 1 POC Section */}
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

        {/* Precomputation Status */}
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

        {/* Action Button: Zero-I/O Write */}
        <button
          className="copy-btn"
          disabled={!preparedPayload || isPreparing}
          onClick={handleCopy}
        >
          {isPreparing ? 'Precomputing...' : '📋 Copy to Figma Clipboard'}
        </button>

        {/* Feedback Alert */}
        {copyFeedback && (
          <div
            className={`feedback-banner ${
              copyFeedback.success ? 'feedback-success' : 'feedback-error'
            }`}
          >
            <div className="feedback-text">{copyFeedback.message}</div>
          </div>
        )}

        {/* Gate Validation Guide */}
        <div className="gate-guide">
          <span className="guide-title">Verification Checklist in Figma:</span>
          <ul>
            <li>Frame created with matching size</li>
            <li>Rectangle & shapes are selectable</li>
            <li>Text is editable (double-click)</li>
            <li>Auto Layout preserves padding/gap</li>
          </ul>
        </div>
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
        <a onClick={handleOpenOptions}>Options</a>
      </div>
    </div>
  );
};
