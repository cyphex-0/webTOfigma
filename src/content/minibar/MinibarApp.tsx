import React, { useState, useEffect, useRef } from 'react';
import { browser } from '../../shared/browser/browser-api';
import { DragController } from './drag-controller';
import { teardownMinibar } from './teardown';
import type {
  StartCaptureResponse,
  MessageResponse
} from '../../shared/contracts/messages';

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
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Initialize Drag Controller
  useEffect(() => {
    if (!handleRef.current) return;

    const controller = new DragController(hostElement, handleRef.current);
    void controller.restorePosition();

    return () => {
      controller.destroy();
    };
  }, [hostElement]);

  const handleStartCapture = async (mode: 'viewport' | 'full-page' | 'select-element') => {
    setIsStarting(true);
    try {
      await browser.runtime.sendMessage({
        id: `minibar_cap_${Date.now()}`,
        type: 'START_CAPTURE',
        payload: {
          mode,
          userOptions: { triggeredFromMinibar: true }
        },
        timestamp: Date.now()
      });
    } catch (err) {
      console.error('[WebToFigma] Error starting capture from minibar:', err);
    } finally {
      setIsStarting(false);
    }
  };

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

      {/* Main Mode Trigger Buttons */}
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

        {isExpanded && (
          <button
            type="button"
            className="minibar-btn"
            onClick={() => handleStartCapture('select-element')}
            disabled={isStarting}
            title="Activate hover element picker"
          >
            <span>Element</span>
          </button>
        )}
      </div>

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
