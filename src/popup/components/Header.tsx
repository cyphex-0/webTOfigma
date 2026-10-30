import React from 'react';
import { browser, getBrowserTargetName } from '../../shared/browser/browser-api';

export interface HeaderProps {
  hostname?: string | undefined;
  isInjectable?: boolean | undefined;
  onOpenHelp?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  hostname,
  isInjectable = true,
  onOpenHelp
}) => {
  const browserTarget = getBrowserTargetName();

  const handleOpenSettings = async () => {
    try {
      if (typeof browser !== 'undefined' && browser.runtime?.openOptionsPage) {
        await browser.runtime.openOptionsPage();
      }
    } catch (err) {
      console.error('[WebToFigma] Failed to open options page:', err);
    }
  };

  return (
    <header className="popup-header" role="banner">
      <div className="header-brand">
        <div className="brand-logo" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="6" fill="#2563EB" />
            <path
              d="M12 4L6 8L12 12L18 8L12 4Z"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M6 12L12 16L18 12"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M6 16L12 20L18 16"
              stroke="white"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="brand-titles">
          <h1 className="brand-name">Web to Figma</h1>
          <span className="brand-tagline">Local-First Exporter</span>
        </div>
      </div>

      <div className="header-actions">
        {hostname && (
          <span
            className={`domain-pill ${isInjectable ? 'domain-supported' : 'domain-restricted'}`}
            title={isInjectable ? `Active Site: ${hostname}` : `Restricted Internal Page: ${hostname}`}
          >
            <span className="status-dot" aria-hidden="true" />
            <span className="domain-text">{hostname}</span>
          </span>
        )}

        <button
          type="button"
          className="header-icon-btn"
          onClick={handleOpenSettings}
          title="Open Extension Settings"
          aria-label="Settings"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {onOpenHelp && (
          <button
            type="button"
            className="header-icon-btn"
            onClick={onOpenHelp}
            title="Help & Troubleshooting Guide"
            aria-label="Help and Troubleshooting"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>
        )}
      </div>
    </header>
  );
};
