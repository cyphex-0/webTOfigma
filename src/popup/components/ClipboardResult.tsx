import React, { useState } from 'react';
import type { ClipboardBatch } from '../../core/figma/clipboard/batch-partitioner';

export interface ClipboardResultProps {
  batches: ClipboardBatch[];
  currentBatchIndex?: number | undefined;
  isPreparing?: boolean | undefined;
  onCopyBatch: (batchIndex: number) => Promise<void>;
  onRetryBatch?: ((batchIndex: number) => Promise<void>) | undefined;
  onSelectBatch?: ((batchIndex: number) => void) | undefined;
  onExportDiagnostics?: ((batchIndex: number) => void) | undefined;
  onStartNew?: (() => void) | undefined;
}

export const ClipboardResult: React.FC<ClipboardResultProps> = ({
  batches,
  currentBatchIndex = 1,
  isPreparing = false,
  onCopyBatch,
  onRetryBatch,
  onSelectBatch,
  onExportDiagnostics,
  onStartNew
}) => {
  const [activeBatchIndex, setActiveBatchIndex] = useState<number>(currentBatchIndex);
  const [copyingIndex, setCopyingIndex] = useState<number | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const totalBatches = Math.max(1, batches.length);
  const safeIndex = Math.min(Math.max(1, activeBatchIndex), totalBatches);
  const activeBatch = batches[safeIndex - 1] ?? {
    batchId: 'batch_default',
    batchIndex: 1,
    totalBatches: 1,
    pageFrames: [],
    metadata: [],
    nodes: [],
    status: 'ready' as const,
    estimatedBytes: 0
  };

  const isMac =
    typeof navigator !== 'undefined' &&
    /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
  const pasteKey = isMac ? 'Cmd+V' : 'Ctrl+V';

  const handleSelect = (idx: number) => {
    setActiveBatchIndex(idx);
    setLocalError(null);
    onSelectBatch?.(idx);
  };

  const handleCopy = async () => {
    setCopyingIndex(safeIndex);
    setLocalError(null);
    try {
      await onCopyBatch(safeIndex);
      activeBatch.status = 'copied';
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setCopyingIndex(null);
    }
  };

  const handleRetry = async () => {
    setCopyingIndex(safeIndex);
    setLocalError(null);
    try {
      if (onRetryBatch) {
        await onRetryBatch(safeIndex);
      } else {
        await onCopyBatch(safeIndex);
      }
      activeBatch.status = 'copied';
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      setCopyingIndex(null);
    }
  };

  const isCurrentCopied = activeBatch.status === 'copied';
  const isCurrentFailed = activeBatch.status === 'failed' || Boolean(localError);
  const isCurrentPreparing = isPreparing || activeBatch.status === 'preparing' || copyingIndex === safeIndex;
  const isCopyDisabled = isCurrentPreparing;

  const allCopied = batches.length > 0 && batches.every((b) => b.status === 'copied');

  return (
    <div className="clipboard-result-card" role="region" aria-labelledby="clipboard-result-heading">
      {/* Stepper Header for Multi-Batch Exports */}
      {totalBatches > 1 && (
        <div className="batch-stepper-header" role="navigation" aria-label="Batch Stepper">
          <div className="batch-stepper-info">
            <span id="clipboard-result-heading" className="batch-stepper-title">
              Batch {safeIndex} of {totalBatches}
            </span>
            <span className="batch-stepper-meta">
              ({activeBatch.pageFrames.length} pages, {activeBatch.nodes.length} nodes)
            </span>
          </div>

          <div className="batch-stepper-pills" role="tablist">
            {batches.map((b) => {
              const isSelected = b.batchIndex === safeIndex;
              const isCopied = b.status === 'copied';
              const isFailed = b.status === 'failed';
              return (
                <button
                  key={b.batchId}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`batch-pill ${isSelected ? 'active' : ''} ${isCopied ? 'copied' : ''} ${
                    isFailed ? 'failed' : ''
                  }`}
                  onClick={() => handleSelect(b.batchIndex)}
                  title={`Batch ${b.batchIndex}: ${b.status}`}
                >
                  {isCopied ? '✓' : b.batchIndex}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Copy Action Card */}
      <div className="clipboard-action-box">
        {totalBatches === 1 && (
          <h3 id="clipboard-result-heading" className="clipboard-single-title">
            Scene Ready for Figma
          </h3>
        )}

        <div className="clipboard-summary-row">
          <span className="clipboard-node-summary">
            {activeBatch.nodes.length > 0
              ? `${activeBatch.nodes.length.toLocaleString()} vector nodes ready`
              : 'Vector scene graph compiled'}
          </span>
          {activeBatch.estimatedBytes > 0 && (
            <span className="clipboard-size-tag">
              ~{Math.round(activeBatch.estimatedBytes / 1024)} KB
            </span>
          )}
        </div>

        {/* Primary Copy to Figma Button */}
        <button
          type="button"
          className={`btn-copy-figma ${isCurrentCopied ? 'btn-copied' : ''} ${
            isCurrentFailed ? 'btn-error' : ''
          }`}
          onClick={handleCopy}
          disabled={isCopyDisabled}
        >
          {isCurrentPreparing ? (
            <>
              <span className="spinner-sm" aria-hidden="true" />
              <span>Preparing Payload...</span>
            </>
          ) : isCurrentCopied ? (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>
                {totalBatches > 1 ? `Batch ${safeIndex} Copied!` : 'Copied to Clipboard!'}
              </span>
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>
                {totalBatches > 1 ? `Copy Batch ${safeIndex} to Figma` : 'Copy to Figma'}
              </span>
            </>
          )}
        </button>

        {/* Failed Batch State & Independent Retry */}
        {isCurrentFailed && (
          <div className="clipboard-error-box" role="alert">
            <span className="error-title">Copy failed for Batch {safeIndex}</span>
            <p className="error-message">
              {localError || activeBatch.error || 'Clipboard write permission denied or activation expired.'}
            </p>
            <button
              type="button"
              className="btn-retry-batch"
              onClick={handleRetry}
              disabled={isCurrentPreparing}
            >
              Retry Batch {safeIndex}
            </button>
          </div>
        )}

        {/* Honest Paste Instructions Confirmation */}
        {isCurrentCopied && (
          <div className="paste-instructions-banner" role="status">
            <strong>Next Step: Paste into Figma</strong>
            <p>
              Open your Figma file canvas and press <kbd>{pasteKey}</kbd>.
            </p>
            <p className="paste-honest-disclaimer">
              The extension copied the payload to your system clipboard; it does not control Figma or verify paste.
            </p>
            {totalBatches > 1 && safeIndex < totalBatches && (
              <button
                type="button"
                className="btn-next-batch"
                onClick={() => handleSelect(safeIndex + 1)}
              >
                Proceed to Batch {safeIndex + 1} →
              </button>
            )}
          </div>
        )}

        {allCopied && totalBatches > 1 && (
          <div className="all-batches-complete-banner" role="status">
            🎉 All {totalBatches} batches have been copied to your clipboard!
          </div>
        )}

        {/* Diagnostic JSON Download */}
        <div className="clipboard-footer-actions">
          {onExportDiagnostics && (
            <button
              type="button"
              className="btn-diagnostic-json"
              onClick={() => onExportDiagnostics(safeIndex)}
              title="Download diagnostic JSON (for inspection, not a .fig file)"
            >
              Export Diagnostics (JSON)
            </button>
          )}

          {onStartNew && (
            <button
              type="button"
              className="btn-start-new"
              onClick={onStartNew}
            >
              Start New Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
