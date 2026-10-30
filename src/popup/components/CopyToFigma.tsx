import React, { useState } from 'react';
import type { FigmaSceneDocument } from '../../shared/contracts/scene';

export interface CopyToFigmaProps {
  jobId: string;
  sceneDocument?: FigmaSceneDocument | null | undefined;
  onCopySuccess?: ((bytesWritten: number) => void) | undefined;
  onCopyError?: ((error: string) => void) | undefined;
}

export const CopyToFigma: React.FC<CopyToFigmaProps> = ({
  jobId,
  sceneDocument,
  onCopySuccess,
  onCopyError
}) => {
  const [status, setStatus] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCopy = async () => {
    setStatus('copying');
    setErrorMessage(null);

    try {
      if (!sceneDocument) {
        throw new Error('Scene document is not ready yet.');
      }

      // Convert scene document to Figma-compatible clipboard payload
      const jsonPayload = JSON.stringify(sceneDocument, null, 2);
      const htmlPayload = `<meta charset='utf-8'><div data-figma-scene="${encodeURIComponent(
        jsonPayload
      )}"><!-- WebToFigma Scene Document --></div>`;

      // Use Phase 1 verified clipboard writer
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const item = new ClipboardItem({
          'text/html': new Blob([htmlPayload], { type: 'text/html' }),
          'text/plain': new Blob([jsonPayload], { type: 'text/plain' })
        });
        await navigator.clipboard.write([item]);
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(jsonPayload);
      } else {
        throw new Error('Clipboard API is unavailable in this browsing context.');
      }

      setStatus('copied');
      const bytes = new TextEncoder().encode(htmlPayload).length;
      if (onCopySuccess) {
        onCopySuccess(bytes);
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to copy to clipboard.';
      setStatus('error');
      setErrorMessage(msg);
      if (onCopyError) {
        onCopyError(msg);
      }
    }
  };

  const handleDownloadFallback = () => {
    if (!sceneDocument) return;
    const blob = new Blob([JSON.stringify(sceneDocument, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `web-to-figma-${jobId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="copy-to-figma-container">
      <button
        type="button"
        className={`btn-copy-figma ${status === 'copied' ? 'btn-copied' : ''}`}
        onClick={handleCopy}
        disabled={status === 'copying'}
      >
        {status === 'copying' && <span className="spinner-sm" aria-hidden="true" />}
        {status === 'copied' ? (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Copied to Clipboard!</span>
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy to Figma</span>
          </>
        )}
      </button>

      {status === 'copied' && (
        <div className="paste-instructions-banner" role="status">
          <strong>Next Step: Paste into Figma</strong>
          <p>
            Switch to your Figma canvas and press <kbd>Ctrl</kbd> + <kbd>V</kbd> (or <kbd>⌘</kbd> + <kbd>V</kbd> on macOS).
          </p>
        </div>
      )}

      {status === 'error' && (
        <div className="copy-error-box" role="alert">
          <p className="error-text">{errorMessage}</p>
          <button
            type="button"
            className="btn-download-fallback"
            onClick={handleDownloadFallback}
          >
            Download Scene JSON Fallback
          </button>
        </div>
      )}
    </div>
  );
};
