import React, { useEffect } from 'react';

export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="help-modal-title" className="modal-title">
            How to Use Web to Figma
          </h2>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close Help"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <section className="help-step">
            <span className="step-num">1</span>
            <div>
              <strong>Choose Export Mode</strong>
              <p>Select Viewport, Full Page, Select Element, or a multi-page crawl mode from the popup.</p>
            </div>
          </section>

          <section className="help-step">
            <span className="step-num">2</span>
            <div>
              <strong>Click Export to Figma</strong>
              <p>The extension extracts computed CSS, fonts, SVG vectors, and auto-layout frames locally in your browser.</p>
            </div>
          </section>

          <section className="help-step">
            <span className="step-num">3</span>
            <div>
              <strong>Click Copy to Figma</strong>
              <p>When the extraction completes, click the green button to place the vector payload onto your system clipboard.</p>
            </div>
          </section>

          <section className="help-step">
            <span className="step-num">4</span>
            <div>
              <strong>Paste into Figma Canvas</strong>
              <p>Switch to your Figma desktop app or browser tab and press <kbd>Ctrl+V</kbd> (<kbd>Cmd+V</kbd>).</p>
            </div>
          </section>

          <div className="help-callout">
            <strong>Restricted Pages</strong>
            <p>
              Due to browser security policies, extensions cannot capture internal browser pages (<code>chrome://</code>, <code>about:</code>), browser extension stores, or built-in PDF viewers.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-modal-dismiss"
            onClick={onClose}
            autoFocus
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
