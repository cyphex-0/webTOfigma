import React, { useState } from 'react';
import type { ExportDiagnostic } from '../../shared/contracts/diagnostics';
import type { DiscoveredRoute } from '../../core/crawler/crawl-scope';
import { partitionRetryableRoutes } from '../../core/diagnostics/failure-recovery';

export interface DiagnosticsViewProps {
  diagnostics: ExportDiagnostic[];
  failedRoutes?: DiscoveredRoute[] | undefined;
  onRetryFailedRoutes?: ((routesToRetry: DiscoveredRoute[]) => Promise<void>) | undefined;
  onClose: () => void;
}

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  diagnostics,
  failedRoutes = [],
  onRetryFailedRoutes,
  onClose
}) => {
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  const { retryableRoutes, unretryableRoutes } = partitionRetryableRoutes(failedRoutes, diagnostics);

  const handleCopyReport = async () => {
    const reportJson = JSON.stringify(
      {
        timestamp: Date.now(),
        totalDiagnostics: diagnostics.length,
        diagnostics,
        failedRoutes
      },
      null,
      2
    );

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(reportJson);
        setCopiedReport(true);
        setTimeout(() => setCopiedReport(false), 2500);
      }
    } catch {
      // Ignore clipboard error
    }
  };

  const handleRetry = async () => {
    if (!onRetryFailedRoutes || retryableRoutes.length === 0) return;
    setIsRetrying(true);
    try {
      await onRetryFailedRoutes(retryableRoutes);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="diagnostics-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="diag-title">
      <div className="diagnostics-modal-card">
        <div className="diagnostics-modal-header">
          <div className="diagnostics-header-title">
            <h2 id="diag-title">Export Diagnostics & Recovery</h2>
            <span className="diagnostics-badge-count">
              {diagnostics.length} issue(s) recorded
            </span>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Close Diagnostics"
          >
            ✕
          </button>
        </div>

        <div className="diagnostics-modal-body">
          {diagnostics.length === 0 ? (
            <div className="diagnostics-empty-state">
              <span>✓ Zero diagnostics or warnings recorded. All stages completed cleanly.</span>
            </div>
          ) : (
            <div className="diagnostics-list">
              {diagnostics.map((d, idx) => (
                <div key={`${d.code}_${idx}`} className={`diagnostic-card-item diag-${d.severity}`}>
                  <div className="diagnostic-item-top">
                    <span className="diag-code-tag">{d.code}</span>
                    <span className={`diag-severity-tag severity-${d.severity}`}>
                      {d.severity.toUpperCase()}
                    </span>
                    <span className="diag-phase-tag">{d.phase}</span>
                  </div>

                  <p className="diag-message-text">{d.message}</p>

                  {d.pageUrl && (
                    <div className="diag-meta-row">
                      <span className="meta-label">Affected URL:</span>
                      <span className="meta-value">{d.pageUrl}</span>
                    </div>
                  )}

                  {d.assetUrl && (
                    <div className="diag-meta-row">
                      <span className="meta-label">Asset:</span>
                      <span className="meta-value">{d.assetUrl}</span>
                    </div>
                  )}

                  {d.recoveryAction && (
                    <div className="diag-action-callout">
                      <strong>Recommended Action:</strong> {d.recoveryAction}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {unretryableRoutes.length > 0 && (
            <div className="unretryable-notice-box" role="status">
              <span>
                Note: {unretryableRoutes.length} route(s) failed due to security/permission restrictions and cannot be recovered via automatic retry.
              </span>
            </div>
          )}
        </div>

        <div className="diagnostics-modal-footer">
          <div className="footer-left-actions">
            <button
              type="button"
              className="btn-copy-report"
              onClick={handleCopyReport}
            >
              {copiedReport ? '✓ Copied to Clipboard' : 'Copy Diagnostics Report (JSON)'}
            </button>
          </div>

          <div className="footer-right-actions">
            {retryableRoutes.length > 0 && onRetryFailedRoutes && (
              <button
                type="button"
                className="btn-retry-failed-routes"
                onClick={handleRetry}
                disabled={isRetrying}
              >
                {isRetrying ? 'Retrying Routes...' : `Retry ${retryableRoutes.length} Failed Route(s)`}
              </button>
            )}
            <button
              type="button"
              className="btn-close-diagnostics"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
